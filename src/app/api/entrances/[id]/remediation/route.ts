import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorageProvider } from "@/persistence";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { RemediationTask, AuditEvent, AccessAssessment } from "@/domain/types";
import { validateTenantAccess } from "@/lib/tenantAuth";

const CreateRemediationSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  correlationId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const entranceId = params.id;
    const authCheck = validateTenantAccess({ entranceId });
    if (!authCheck.allowed) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const parsed = CreateRemediationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const storage = getStorageProvider();
    const entrance = await storage.entrances.findById(entranceId);
    if (!entrance) {
      return NextResponse.json({ error: "Entrance not found" }, { status: 404 });
    }

    const latestAssessment = await storage.assessments.findLatestByEntranceId(entranceId);
    const currentState = latestAssessment?.state || "AVAILABLE";
    const correlationId = parsed.data.correlationId || `corr_${Date.now()}`;
    const now = new Date().toISOString();

    const taskId = `task_${Date.now()}`;
    const newTask: RemediationTask = {
      id: taskId,
      entranceId,
      triggerAssessmentId: latestAssessment?.id || "init",
      status: "OPEN",
      reason: parsed.data.reason,
      createdAt: now,
    };

    let updatedAssessment: AccessAssessment | null = latestAssessment;

    // Execute atomic transaction for state transition + task creation + audit event
    await storage.transaction(async (tx) => {
      // If entrance was AVAILABLE or INTERRUPTED, move state to ACTION_REQUIRED
      if (currentState === "AVAILABLE" || currentState === "INTERRUPTED") {
        if (currentState === "AVAILABLE") {
          transitionAssuranceState({
            entranceId,
            currentState: "AVAILABLE",
            nextState: "INTERRUPTED",
            trigger: "ISSUE_REPORTED_FOR_REMEDIATION",
            correlationId,
            reason: parsed.data.reason,
          });
        }

        const transition = transitionAssuranceState({
          entranceId,
          currentState: "INTERRUPTED",
          nextState: "ACTION_REQUIRED",
          trigger: "REMEDIATION_TASK_DISPATCHED",
          correlationId,
          reason: parsed.data.reason,
        });

        if (transition.success) {
          updatedAssessment = await tx.assessments.save({
            id: `assess_${Date.now()}`,
            entranceId,
            state: "ACTION_REQUIRED",
            reasonCode: "REMEDIATION_TASK_OPENED",
            reason: `Remediation task dispatched: ${parsed.data.reason}`,
            evidenceIds: latestAssessment?.evidenceIds || [],
            observationIds: latestAssessment?.observationIds || [],
            policyVersion: "1.0.0",
            assessedAt: now,
            previousAssessmentId: latestAssessment?.id,
          });
        }
      }

      await tx.remediations.save(newTask);

      const auditEvent: AuditEvent = {
        id: `audit_${Date.now()}`,
        type: "TASK_CREATED",
        timestamp: now,
        correlationId,
        entityType: "REMEDIATION_TASK",
        entityId: newTask.id,
        metadata: {
          entranceId,
          reason: parsed.data.reason,
          currentState: updatedAssessment?.state || currentState,
        },
      };
      await tx.auditEvents.append(auditEvent);
    });

    return NextResponse.json({
      success: true,
      remediationTask: newTask,
      assessment: updatedAssessment,
    });
  } catch (error) {
    console.error("[API] Failed to create remediation task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
