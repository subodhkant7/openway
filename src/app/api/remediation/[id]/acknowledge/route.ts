import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";
import { AuditEvent } from "@/domain/types";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const storage = getStorageProvider();

    const task = await storage.remediations.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Remediation task not found" }, { status: 404 });
    }

    if (task.status !== "OPEN") {
      return NextResponse.json(
        { error: `Cannot acknowledge task in status "${task.status}"` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const correlationId = `ack_${Date.now()}`;

    let updatedTask = task;

    await storage.transaction(async (tx) => {
      updatedTask = {
        ...task,
        status: "ACKNOWLEDGED",
        acknowledgedAt: now,
      };
      await tx.remediations.save(updatedTask);

      const auditEvent: AuditEvent = {
        id: `audit_${Date.now()}`,
        type: "TASK_ACKNOWLEDGED",
        timestamp: now,
        correlationId,
        entityType: "REMEDIATION_TASK",
        entityId: task.id,
        metadata: {
          entranceId: task.entranceId,
          status: "ACKNOWLEDGED",
        },
      };
      await tx.auditEvents.append(auditEvent);
    });

    return NextResponse.json({ success: true, remediationTask: updatedTask });
  } catch (error) {
    console.error("[API] Failed to acknowledge remediation task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
