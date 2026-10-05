import { getStorageProvider, StorageProvider } from "@/persistence";
import { AssuranceState, Entrance, RemediationTask } from "@/domain/types";
import { Evidence } from "@/evidence/types";
import { EvidenceAcquisitionService } from "@/evidence/evidenceAcquisition";
import { canDeclareRestored, RestorationGatekeeperResult } from "@/policy/restorationGatekeeper";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { VisionPipelineService } from "@/vision/VisionPipelineService";
import { DetailedVisionObservation, VisionAnalyzer } from "@/vision/VisionAnalyzer";
import { RingProvider } from "@/ring";
import { safeLog } from "@/ring/errors";

export interface RecheckOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  ringProvider?: RingProvider;
  visionAnalyzer?: VisionAnalyzer;
  correlationId?: string;
  overrideCapturedAt?: string;
  overrideBytes?: Uint8Array;
  overrideMimeType?: "image/jpeg" | "image/png";
}

export interface RecheckResult {
  success: boolean;
  taskId: string;
  entranceId: string;
  previousState: AssuranceState;
  finalState: AssuranceState;
  evidenceUsed?: Evidence;
  observation?: DetailedVisionObservation;
  gatekeeperResult?: RestorationGatekeeperResult;
  attempts: number;
  explanation: string;
}

export class RecheckService {
  private storage: StorageProvider;
  private evidenceAcquisition: EvidenceAcquisitionService;
  private visionPipeline: VisionPipelineService;

  constructor(
    storage?: StorageProvider,
    evidenceAcquisition?: EvidenceAcquisitionService,
    visionPipeline?: VisionPipelineService
  ) {
    this.storage = storage || getStorageProvider();
    this.evidenceAcquisition = evidenceAcquisition || new EvidenceAcquisitionService(this.storage);
    this.visionPipeline = visionPipeline || VisionPipelineService.getInstance();
  }

  /**
   * Executes a bounded post-remediation verification workflow.
   *
   * ABSOLUTE VERIFICATION INVARIANTS:
   * 1. Staff completion is NEVER equivalent to restoration.
   * 2. Evidence must have been captured strictly AT or AFTER task completedAt.
   * 3. Evidence must strictly match the entrance camera binding.
   * 4. All 9 gatekeeper conditions must pass for VERIFIED_RESTORED.
   * 5. Bounded attempts only; never polls indefinitely.
   */
  public async startVerification(
    taskId: string,
    options: RecheckOptions = {}
  ): Promise<RecheckResult> {
    const correlationId = options.correlationId || `recheck_${Date.now()}`;
    const maxAttempts = options.maxAttempts ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 0;

    // 1. Retrieve remediation task
    const task = await this.storage.remediations.findById(taskId);
    if (!task) {
      throw new Error(`Remediation task ${taskId} not found.`);
    }

    const entrance = await this.storage.entrances.findById(task.entranceId);
    if (!entrance) {
      throw new Error(`Entrance ${task.entranceId} not found.`);
    }

    // 2. Ensure task completedAt timestamp exists
    const nowIso = new Date().toISOString();
    let completedTask = task;
    if (task.status !== "COMPLETED") {
      completedTask = await this.storage.remediations.save({
        ...task,
        status: "COMPLETED",
        completedAt: nowIso,
      });
    }

    const completedAt = completedTask.completedAt || nowIso;

    // 3. Ensure entrance is transitioned to RECHECKING
    const latestAssessment = await this.storage.assessments.findLatestByEntranceId(entrance.id);
    let currentState: AssuranceState = latestAssessment?.state || "ACTION_REQUIRED";

    if (currentState === "ACTION_REQUIRED" || currentState === "UNKNOWN") {
      const transToRecheck = transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "RECHECKING",
        trigger: "STAFF_COMPLETED_TASK",
        correlationId,
        evidenceIds: [],
        reason: `Staff reported task ${taskId} complete. Verification actively initiated.`,
      });

      if (transToRecheck.success) {
        currentState = "RECHECKING";
        await this.storage.assessments.save({
          id: `assess_recheck_${Date.now()}`,
          entranceId: entrance.id,
          state: "RECHECKING",
          reasonCode: "STAFF_COMPLETED_TASK",
          reason: "Staff reported remediation complete. Verification initiated.",
          evidenceIds: [],
          observationIds: [],
          policyVersion: "1.0.0",
          assessedAt: nowIso,
          previousAssessmentId: latestAssessment?.id,
        });

        await this.storage.auditEvents.append({
          id: `audit_${Date.now()}_recheck_start`,
          type: "VERIFICATION_INITIATED",
          timestamp: nowIso,
          correlationId,
          entityType: "REMEDIATION_TASK",
          entityId: taskId,
          metadata: {
            entranceId: entrance.id,
            completedAt,
            status: "RECHECKING",
          },
        });
      }
    }

    // 4. Bounded Fresh Evidence Acquisition & Verification Loop
    let attempt = 0;
    let lastGatekeeperResult: RestorationGatekeeperResult | undefined;
    let lastEvidence: Evidence | undefined;
    let lastObservation: DetailedVisionObservation | undefined;

    while (attempt < maxAttempts) {
      attempt++;

      const { telemetry } = await import("@/telemetry/metrics");
      telemetry.increment("recheckAttempts");

      if (initialDelayMs > 0 && attempt > 1) {
        const delay = initialDelayMs * Math.pow(options.backoffFactor ?? 1.5, attempt - 2);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Acquire fresh Ring image evidence
      const acquired = await this.evidenceAcquisition.acquireFreshEvidence({
        entrance,
        provider: options.ringProvider,
        mode: "latest_in_range",
        correlationId,
        providerEventId: `recheck_ev_${taskId}_${attempt}`,
        overrideCapturedAt: options.overrideCapturedAt,
        overrideBytes: options.overrideBytes,
        overrideMimeType: options.overrideMimeType,
      });

      lastEvidence = acquired.evidence;

      // Invariant: Capture timestamp must be established from metadata
      if (!acquired.capturedAt || typeof acquired.capturedAt !== "string" || acquired.capturedAt.trim() === "") {
        safeLog("warn", "Recheck evidence missing authoritative capture timestamp", {
          entranceId: entrance.id,
          attempt,
        });

        lastGatekeeperResult = {
          allowed: false,
          reasonCode: "TEMPORALLY_UNVERIFIED",
          explanation: "Evidence capture timestamp is missing or unverified from camera metadata.",
        };

        continue;
      }

      // Enforce temporal rule: capturedAt MUST be >= completedAt
      const evidenceCaptureTime = new Date(acquired.capturedAt).getTime();
      const remediationCompleteTime = new Date(completedAt).getTime();

      if (isNaN(evidenceCaptureTime) || evidenceCaptureTime < remediationCompleteTime) {
        // Evidence captured before completion cannot verify restoration!
        safeLog("warn", "Recheck evidence predates remediation completion", {
          capturedAt: acquired.capturedAt,
          completedAt,
          attempt,
        });

        lastGatekeeperResult = {
          allowed: false,
          reasonCode: "TEMPORAL_INCONSISTENCY",
          explanation: `Evidence captured at ${acquired.capturedAt} predates task completion at ${completedAt}.`,
        };

        // Try next attempt if available
        continue;
      }

      // Run Vision Analysis
      const pipelineResult = await this.visionPipeline.processEvidence({
        evidence: acquired.evidence,
        imageBytes: acquired.imageBytes,
        mimeType: acquired.mimeType,
        entrance,
        analyzer: options.visionAnalyzer,
        correlationId,
        skipAssessment: true, // We execute gatekeeper check explicitly below
      });

      lastObservation = pipelineResult.observation;

      // Evaluate pure RestorationGatekeeper & Post-Remediation Verifier
      const gatekeeper = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: completedTask,
        evidence: acquired.evidence,
        observations: [lastObservation],
        now: new Date().toISOString(),
      });

      lastGatekeeperResult = gatekeeper;

      if (gatekeeper.allowed) {
        // Restoration verified! Transition state machine to VERIFIED_RESTORED
        const restoreTrans = transitionAssuranceState({
          entranceId: entrance.id,
          currentState: "RECHECKING",
          nextState: "VERIFIED_RESTORED",
          trigger: "FRESH_EVIDENCE_VERIFIED",
          correlationId,
          evidenceIds: [acquired.evidence.id],
          reason: gatekeeper.explanation,
        });

        if (restoreTrans.success) {
          const restoredAssessment = await this.storage.assessments.save({
            id: `assess_restored_${Date.now()}`,
            entranceId: entrance.id,
            state: "VERIFIED_RESTORED",
            reasonCode: "VERIFIED_RESTORED",
            reason: gatekeeper.explanation,
            evidenceIds: [acquired.evidence.id],
            observationIds: [lastObservation.id],
            policyVersion: "1.0.0",
            assessedAt: new Date().toISOString(),
            previousAssessmentId: latestAssessment?.id,
          });

          await this.storage.auditEvents.append({
            id: `audit_${Date.now()}_verified_restored`,
            type: "ACCESS_VERIFIED_RESTORED",
            timestamp: new Date().toISOString(),
            correlationId,
            entityType: "ASSESSMENT",
            entityId: restoredAssessment.id,
            metadata: {
              entranceId: entrance.id,
              previousState: "RECHECKING",
              nextState: "VERIFIED_RESTORED",
              evidenceId: acquired.evidence.id,
              observationId: lastObservation.id,
              explanation: gatekeeper.explanation,
            },
          });

          const { telemetry } = await import("@/telemetry/metrics");
          telemetry.increment("verifiedRestorations");

          return {
            success: true,
            taskId,
            entranceId: entrance.id,
            previousState: currentState,
            finalState: "VERIFIED_RESTORED",
            evidenceUsed: acquired.evidence,
            observation: lastObservation,
            gatekeeperResult: gatekeeper,
            attempts: attempt,
            explanation: gatekeeper.explanation,
          };
        }
      } else if (
        (lastObservation.obstructionPresent === "TRUE" || lastObservation.pathwayClear === "FALSE") &&
        lastObservation.pathwayClear !== "UNKNOWN" &&
        lastObservation.obstructionPresent !== "UNKNOWN" &&
        !lastObservation.explanation.toLowerCase().includes("conflict") &&
        gatekeeper.reasonCode !== "CONTRADICTORY_EVIDENCE"
      ) {
        // Obstruction still present! Recheck failed: transition back to ACTION_REQUIRED
        transitionAssuranceState({
          entranceId: entrance.id,
          currentState: "RECHECKING",
          nextState: "ACTION_REQUIRED",
          trigger: "RECHECK_OBSTRUCTION_PRESENT",
          correlationId,
          evidenceIds: [acquired.evidence.id],
          reason: `Recheck failed: ${lastObservation.explanation}`,
        });

        await this.storage.assessments.save({
          id: `assess_recheck_failed_${Date.now()}`,
          entranceId: entrance.id,
          state: "ACTION_REQUIRED",
          reasonCode: "RECHECK_FAILED_OBSTRUCTION",
          reason: `Physical obstruction still observed: ${lastObservation.explanation}`,
          evidenceIds: [acquired.evidence.id],
          observationIds: [lastObservation.id],
          policyVersion: "1.0.0",
          assessedAt: new Date().toISOString(),
          previousAssessmentId: latestAssessment?.id,
        });

        return {
          success: false,
          taskId,
          entranceId: entrance.id,
          previousState: currentState,
          finalState: "ACTION_REQUIRED",
          evidenceUsed: acquired.evidence,
          observation: lastObservation,
          gatekeeperResult: gatekeeper,
          attempts: attempt,
          explanation: `Recheck failed: Physical obstruction still observed during post-remediation verification.`,
        };
      }
    }

    // 5. Max attempts exhausted or evidence unavailable/stale &rarr; Transition to UNKNOWN
    transitionAssuranceState({
      entranceId: entrance.id,
      currentState: "RECHECKING",
      nextState: "UNKNOWN",
      trigger: "VERIFICATION_UNAVAILABLE",
      correlationId,
      evidenceIds: lastEvidence ? [lastEvidence.id] : [],
      reason: lastGatekeeperResult?.explanation || "Verification evidence unavailable or insufficient.",
    });

    await this.storage.assessments.save({
      id: `assess_unknown_${Date.now()}`,
      entranceId: entrance.id,
      state: "UNKNOWN",
      reasonCode: lastGatekeeperResult?.reasonCode || "VERIFICATION_UNAVAILABLE",
      reason: lastGatekeeperResult?.explanation || "Verification evidence unavailable or insufficient.",
      evidenceIds: lastEvidence ? [lastEvidence.id] : [],
      observationIds: lastObservation ? [lastObservation.id] : [],
      policyVersion: "1.0.0",
      assessedAt: new Date().toISOString(),
      previousAssessmentId: latestAssessment?.id,
    });

    const { telemetry } = await import("@/telemetry/metrics");
    telemetry.increment("unknownOutcomes");

    return {
      success: false,
      taskId,
      entranceId: entrance.id,
      previousState: currentState,
      finalState: "UNKNOWN",
      evidenceUsed: lastEvidence,
      observation: lastObservation,
      gatekeeperResult: lastGatekeeperResult,
      attempts: attempt,
      explanation:
        lastGatekeeperResult?.explanation ||
        `Verification timed out after ${maxAttempts} attempts without conclusive proof of restoration.`,
    };
  }
}
