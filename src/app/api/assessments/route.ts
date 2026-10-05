import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorageProvider } from "@/persistence";
import { canDeclareRestored } from "@/policy/restorationGatekeeper";
import { aggregateObservations } from "@/evidence/aggregation";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { AccessAssessment, AuditEvent, RemediationTask } from "@/domain/types";

const ObservationInputSchema = z.object({
  id: z.string().optional(),
  pathwayClear: z.enum(["TRUE", "FALSE", "UNKNOWN"]),
  obstructionPresent: z.enum(["TRUE", "FALSE", "UNKNOWN"]),
  doorReady: z.enum(["TRUE", "FALSE", "UNKNOWN"]),
  confidence: z.number().min(0).max(1).default(1.0),
  observedAt: z.string().optional(),
  analyzer: z.string().default("openway-evaluator-v1"),
  analyzerVersion: z.string().default("1.0.0"),
  explanation: z.string().default("Automated camera observation evaluation"),
});

const AssessRequestSchema = z.object({
  entranceId: z.string().min(1, "entranceId is required"),
  correlationId: z.string().optional(),
  evidence: z.object({
    id: z.string().optional(),
    venueId: z.string().optional(),
    provider: z.enum(["RING", "SIMULATOR", "OPENWAY"]).default("RING"),
    providerEventId: z.string().optional(),
    deviceId: z.string().min(1),
    componentId: z.string().min(1),
    capturedAt: z.string(),
    receivedAt: z.string().optional(),
    evidenceType: z.enum(["IMAGE", "VIDEO", "EVENT", "STATUS"]).default("IMAGE"),
    mediaReference: z.string().optional(),
    provenance: z.enum(["OFFICIAL_RING", "SIMULATED_LOCAL", "OPENWAY_DERIVED"]).default("OFFICIAL_RING"),
    isSimulated: z.boolean().default(false),
    checksum: z.string().optional(),
  }),
  observations: z.array(ObservationInputSchema).min(1, "At least one observation is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AssessRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { entranceId, correlationId = `corr_${Date.now()}`, evidence: evInput, observations: obsInputs } = parsed.data;
    const storage = getStorageProvider();

    // 1. Verify entrance exists
    const entrance = await storage.entrances.findById(entranceId);
    if (!entrance) {
      return NextResponse.json({ error: "Entrance not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const evidenceId = evInput.id || `ev_${Date.now()}`;

    // Construct Evidence entity
    const evidence: Evidence = {
      id: evidenceId,
      venueId: evInput.venueId || entrance.venueId,
      entranceId,
      provider: evInput.provider,
      providerEventId: evInput.providerEventId,
      deviceId: evInput.deviceId,
      componentId: evInput.componentId,
      capturedAt: evInput.capturedAt,
      receivedAt: evInput.receivedAt || now,
      evidenceType: evInput.evidenceType,
      mediaReference: evInput.mediaReference,
      provenance: evInput.provenance,
      isSimulated: evInput.isSimulated,
      freshness: "FRESH", // will be computed in gatekeeper & aggregator
      checksum: evInput.checksum,
      createdAt: now,
    };

    // Construct Observation entities
    const observations: AccessibilityObservation[] = obsInputs.map((obs, idx) => ({
      id: obs.id || `obs_${Date.now()}_${idx}`,
      evidenceId: evidence.id,
      entranceId,
      pathwayClear: obs.pathwayClear,
      obstructionPresent: obs.obstructionPresent,
      doorReady: obs.doorReady,
      confidence: obs.confidence,
      observedAt: obs.observedAt || now,
      analyzer: obs.analyzer,
      analyzerVersion: obs.analyzerVersion,
      explanation: obs.explanation,
    }));

    // Check camera binding before proceeding
    const bindingMatch =
      evidence.deviceId === entrance.cameraBinding.deviceId &&
      evidence.componentId === entrance.cameraBinding.componentId;

    if (!bindingMatch) {
      // Reject wrong camera evidence
      const auditReject: AuditEvent = {
        id: `audit_${Date.now()}_reject`,
        type: "WRONG_CAMERA_REJECTED",
        timestamp: now,
        correlationId,
        entityType: "EVIDENCE",
        entityId: evidence.id,
        metadata: {
          entranceId,
          expectedDevice: entrance.cameraBinding.deviceId,
          expectedComponent: entrance.cameraBinding.componentId,
          actualDevice: evidence.deviceId,
          actualComponent: evidence.componentId,
          message: "Evidence from unbound Ring camera/component rejected.",
        },
      };
      await storage.auditEvents.append(auditReject);

      return NextResponse.json(
        {
          success: false,
          reasonCode: "WRONG_CAMERA_REJECTED",
          explanation: `Evidence from device "${evidence.deviceId}" component "${evidence.componentId}" does not match entrance binding "${entrance.cameraBinding.deviceId}/${entrance.cameraBinding.componentId}".`,
        },
        { status: 422 }
      );
    }

    // Save evidence and observations
    await storage.evidence.save(evidence);
    for (const obs of observations) {
      await storage.observations.save(obs);
    }

    const latestAssessment = await storage.assessments.findLatestByEntranceId(entranceId);
    const activeRemediation = await storage.remediations.findActiveByEntranceId(entranceId);
    const completedRemediation = (await storage.remediations.listByEntranceId(entranceId))
      .filter((t) => t.status === "COMPLETED")
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())[0];

    const currentState = latestAssessment?.state || "AVAILABLE";

    // Run observation aggregator
    const aggregated = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations,
      now,
    });

    let targetState = currentState;
    let targetReasonCode = aggregated.reasonCode;
    let targetReason = aggregated.explanation;
    let gatekeeperResult = null;
    let newTaskToCreate: RemediationTask | null = null;

    if (currentState === "RECHECKING") {
      // Must pass pure restoration gatekeeper to restore
      gatekeeperResult = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: completedRemediation || activeRemediation,
        evidence,
        observations,
        now,
      });

      if (gatekeeperResult.allowed) {
        targetState = "VERIFIED_RESTORED";
        targetReasonCode = "VERIFIED_RESTORED";
        targetReason = gatekeeperResult.explanation;
      } else if (aggregated.outcome === "INTERRUPTED") {
        targetState = "ACTION_REQUIRED";
        targetReasonCode = "RECHECKING_FAILED_OBSTRUCTION";
        targetReason = `Rechecking failed: ${aggregated.explanation}`;
      } else {
        // Stale, contradictory, or insufficient evidence -> UNKNOWN
        targetState = "UNKNOWN";
        targetReasonCode = gatekeeperResult.reasonCode;
        targetReason = gatekeeperResult.explanation;
      }
    } else {
      // Normal operational states: AVAILABLE, INTERRUPTED, ACTION_REQUIRED, UNKNOWN, VERIFIED_RESTORED
      if (aggregated.outcome === "INTERRUPTED") {
        targetState = "INTERRUPTED";
        targetReasonCode = "ACCESS_INTERRUPTED";
        targetReason = aggregated.explanation;

        // Auto-create remediation task if none active
        if (!activeRemediation) {
          newTaskToCreate = {
            id: `task_${Date.now()}`,
            entranceId,
            triggerAssessmentId: `assess_${Date.now()}`,
            status: "OPEN",
            reason: aggregated.explanation,
            createdAt: now,
          };
          targetState = "ACTION_REQUIRED";
        }
      } else if (aggregated.outcome === "SATISFIED") {
        if (currentState === "UNKNOWN" || currentState === "VERIFIED_RESTORED") {
          targetState = "AVAILABLE";
        }
      } else if (aggregated.outcome === "UNKNOWN") {
        targetState = "UNKNOWN";
        targetReasonCode = aggregated.reasonCode;
        targetReason = aggregated.explanation;
      }
    }

    // Attempt transition in state machine
    let newAssessment: AccessAssessment = latestAssessment || {
      id: `assess_${Date.now()}`,
      entranceId,
      state: currentState,
      reasonCode: "INITIAL",
      reason: "Initial assessment",
      evidenceIds: [evidence.id],
      observationIds: observations.map((o) => o.id),
      policyVersion: "1.0.0",
      assessedAt: now,
    };

    await storage.transaction(async (tx) => {
      if (targetState !== currentState) {
        const transition = transitionAssuranceState({
          entranceId,
          currentState,
          nextState: targetState,
          trigger: aggregated.reasonCode,
          correlationId,
          evidenceIds: [evidence.id],
          reason: targetReason,
        });

        if (transition.success) {
          newAssessment = await tx.assessments.save({
            id: `assess_${Date.now()}`,
            entranceId,
            state: targetState,
            reasonCode: targetReasonCode,
            reason: targetReason,
            evidenceIds: [evidence.id],
            observationIds: observations.map((o) => o.id),
            policyVersion: "1.0.0",
            assessedAt: now,
            previousAssessmentId: latestAssessment?.id,
          });

          // Append audit event for state change
          let auditType: AuditEvent["type"] = "OBSERVATION_CREATED";
          if (targetState === "VERIFIED_RESTORED") auditType = "ACCESS_VERIFIED_RESTORED";
          else if (targetState === "INTERRUPTED" || targetState === "ACTION_REQUIRED") auditType = "ACCESS_INTERRUPTED";
          else if (targetState === "UNKNOWN") auditType = "ASSESSMENT_UNKNOWN";

          await tx.auditEvents.append({
            id: `audit_${Date.now()}_trans`,
            type: auditType,
            timestamp: now,
            correlationId,
            entityType: "ASSESSMENT",
            entityId: newAssessment.id,
            metadata: {
              previousState: currentState,
              nextState: targetState,
              reasonCode: targetReasonCode,
              explanation: targetReason,
            },
          });
        }
      }

      if (newTaskToCreate) {
        await tx.remediations.save(newTaskToCreate);
        await tx.auditEvents.append({
          id: `audit_${Date.now()}_task`,
          type: "TASK_CREATED",
          timestamp: now,
          correlationId,
          entityType: "REMEDIATION_TASK",
          entityId: newTaskToCreate.id,
          metadata: {
            entranceId,
            reason: newTaskToCreate.reason,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      assessment: newAssessment,
      aggregatedOutcome: aggregated.outcome,
      gatekeeperResult,
      evidenceId: evidence.id,
    });
  } catch (error) {
    console.error("[API] Assessment evaluation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
