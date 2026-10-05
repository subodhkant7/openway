import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorageProvider } from "@/persistence";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { AuditEvent, AccessAssessment } from "@/domain/types";

const CompleteSchema = z.object({
  completedBy: z.string().min(1, "completedBy is required").default("Staff Member"),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const body = await request.json().catch(() => ({}));
    const parsed = CompleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const storage = getStorageProvider();
    const task = await storage.remediations.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Remediation task not found" }, { status: 404 });
    }

    if (task.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Remediation task is already completed" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const correlationId = `complete_${Date.now()}`;
    const entranceId = task.entranceId;

    const latestAssessment = await storage.assessments.findLatestByEntranceId(entranceId);
    const currentState = latestAssessment?.state || "ACTION_REQUIRED";

    let updatedAssessment: AccessAssessment | null = latestAssessment;
    const completedTask = {
      ...task,
      status: "COMPLETED" as const,
      completedAt: now,
      completedBy: parsed.data.completedBy,
    };

    await storage.transaction(async (tx) => {
      // 1. Save completed task
      await tx.remediations.save(completedTask);

      // 2. Append TASK_COMPLETED audit event
      const completeEvent: AuditEvent = {
        id: `audit_${Date.now()}_comp`,
        type: "TASK_COMPLETED",
        timestamp: now,
        correlationId,
        entityType: "REMEDIATION_TASK",
        entityId: task.id,
        metadata: {
          entranceId,
          completedBy: parsed.data.completedBy,
          notes: parsed.data.notes,
          notice: "Remediation claimed complete. Fresh physical verification is required.",
        },
      };
      await tx.auditEvents.append(completeEvent);

      // 3. Transition Entrance state: ACTION_REQUIRED -> RECHECKING
      // Core Invariant: Staff completing a task NEVER produces VERIFIED_RESTORED directly!
      const transition = transitionAssuranceState({
        entranceId,
        currentState,
        nextState: "RECHECKING",
        trigger: "STAFF_REPORTED_COMPLETE",
        correlationId,
        reason: `Physical remediation reported by ${parsed.data.completedBy}; verification required.`,
      });

      if (transition.success) {
        updatedAssessment = await tx.assessments.save({
          id: `assess_${Date.now()}`,
          entranceId,
          state: "RECHECKING",
          reasonCode: "RECHECKING_AWAITING_EVIDENCE",
          reason: `Remediation reported by ${parsed.data.completedBy}. Pending fresh post-remediation evidence.`,
          evidenceIds: latestAssessment?.evidenceIds || [],
          observationIds: latestAssessment?.observationIds || [],
          policyVersion: "1.0.0",
          assessedAt: now,
          previousAssessmentId: latestAssessment?.id,
        });

        // 4. Append VERIFICATION_STARTED audit event
        const verificationEvent: AuditEvent = {
          id: `audit_${Date.now()}_verif`,
          type: "VERIFICATION_STARTED",
          timestamp: now,
          correlationId,
          entityType: "ENTRANCE",
          entityId: entranceId,
          metadata: {
            state: "RECHECKING",
            message: "Assurance verification initiated. Waiting for fresh camera observation.",
          },
        };
        await tx.auditEvents.append(verificationEvent);
      }
    });

    return NextResponse.json({
      success: true,
      remediationTask: completedTask,
      assessment: updatedAssessment,
      verificationPending: true,
      message: "Remediation recorded. Fresh camera evidence is required to verify restoration.",
    });
  } catch (error) {
    console.error("[API] Failed to complete remediation task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
