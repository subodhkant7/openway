import { getStorageProvider, StorageProvider } from "@/persistence";
import { Entrance, AccessAssessment, AuditEvent, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { aggregateObservations } from "@/evidence/aggregation";
import { canDeclareRestored } from "@/policy/restorationGatekeeper";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { VisionAnalyzer, DetailedVisionObservation } from "./VisionAnalyzer";
import { BedrockVisionAnalyzer } from "./BedrockVisionAnalyzer";
import { SimulatorVisionAnalyzer } from "./SimulatorVisionAnalyzer";

export interface PipelineExecutionOptions {
  evidence: Evidence;
  imageBytes: Uint8Array | Buffer;
  mimeType: "image/jpeg" | "image/png";
  entrance: Entrance;
  analyzer?: VisionAnalyzer;
  correlationId?: string;
  skipAssessment?: boolean;
}

export interface PipelineResult {
  success: boolean;
  observation: DetailedVisionObservation;
  assessment?: AccessAssessment;
  stateTransitioned: boolean;
  previousState: string;
  resultingState: string;
  gatekeeperResult?: ReturnType<typeof canDeclareRestored> | null;
  timingMs: {
    evidenceAcquisitionMs: number;
    visionInferenceMs: number;
    policyEvaluationMs: number;
    totalMs: number;
  };
}

export class VisionPipelineService {
  private static instance: VisionPipelineService | null = null;
  private cache = new Map<string, DetailedVisionObservation>();

  public static getInstance(): VisionPipelineService {
    if (!this.instance) {
      this.instance = new VisionPipelineService();
    }
    return this.instance;
  }

  /**
   * Resets the in-memory vision observation deduplication cache (useful for testing).
   */
  public resetCache(): void {
    this.cache.clear();
  }

  /**
   * Deterministic processing key for idempotency and cost control.
   */
  public getProcessingKey(evidence: Evidence, analyzerVersion: string): string {
    return `${evidence.provider}_${evidence.providerEventId || evidence.id}_${evidence.id}_${analyzerVersion}`;
  }

  /**
   * Selects analyzer based on environment and provider mode.
   */
  public resolveAnalyzer(): VisionAnalyzer {
    const providerMode = process.env.OPENWAY_PROVIDER || "simulator";
    const useLiveBedrock =
      Boolean(process.env.AWS_ACCESS_KEY_ID) ||
      Boolean(process.env.AWS_PROFILE) ||
      process.env.OPENWAY_VISION_PROVIDER === "bedrock";

    if (useLiveBedrock && providerMode !== "simulator") {
      return new BedrockVisionAnalyzer();
    }
    return new SimulatorVisionAnalyzer();
  }

  /**
   * Executes the end-to-end vision pipeline:
   * Evidence -> VisionAnalyzer -> Observation -> Policy -> State Machine
   */
  public async processEvidence(options: PipelineExecutionOptions): Promise<PipelineResult> {
    const pipelineStart = Date.now();
    const correlationId = options.correlationId || `pipeline_${Date.now()}`;
    const storage: StorageProvider = getStorageProvider();
    const { entrance, evidence, imageBytes, mimeType } = options;

    const analyzer = options.analyzer || this.resolveAnalyzer();
    const processingKey = this.getProcessingKey(evidence, analyzer.analyzerVersion);

    // 1. Idempotency & Cost Control Check
    let observation: DetailedVisionObservation;
    let visionInferenceMs = 0;

    if (this.cache.has(processingKey)) {
      const { telemetry } = await import("@/telemetry/metrics");
      telemetry.increment("dedupeHits");
      observation = this.cache.get(processingKey)!;
    } else {
      const { telemetry } = await import("@/telemetry/metrics");
      telemetry.increment("bedrockCalls");
      const inferenceStart = Date.now();
      observation = await analyzer.analyzeImage({
        evidence,
        imageBytes,
        mimeType,
        requirements: entrance.requirements,
        entranceName: entrance.name,
        correlationId,
      });
      visionInferenceMs = Date.now() - inferenceStart;
      this.cache.set(processingKey, observation);
    }

    // 2. Persist Observation
    await storage.observations.save(observation);

    // Append observation audit event
    const nowIso = new Date().toISOString();
    await storage.auditEvents.append({
      id: `audit_obs_${Date.now()}`,
      type: "OBSERVATION_CREATED",
      timestamp: nowIso,
      correlationId,
      entityType: "OBSERVATION",
      entityId: observation.id,
      metadata: {
        entranceId: entrance.id,
        evidenceId: evidence.id,
        analyzer: observation.analyzer,
        pathwayClear: observation.pathwayClear,
        obstructionPresent: observation.obstructionPresent,
        confidence: observation.confidence,
        evidenceQuality: observation.evidenceQuality,
        isSimulated: observation.isSimulated,
      },
    });

    if (options.skipAssessment) {
      return {
        success: true,
        observation,
        stateTransitioned: false,
        previousState: "UNKNOWN",
        resultingState: "UNKNOWN",
        timingMs: {
          evidenceAcquisitionMs: 0,
          visionInferenceMs,
          policyEvaluationMs: 0,
          totalMs: Date.now() - pipelineStart,
        },
      };
    }

    // 3. Deterministic Policy & State Machine Evaluation
    const policyStart = Date.now();
    const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
    const activeRemediation = await storage.remediations.findActiveByEntranceId(entrance.id);
    const completedRemediation = (await storage.remediations.listByEntranceId(entrance.id))
      .filter((t) => t.status === "COMPLETED")
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())[0];

    const currentState = latestAssessment?.state || "AVAILABLE";

    const aggregated = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations: [observation],
      now: nowIso,
    });

    let targetState = currentState;
    let targetReasonCode = aggregated.reasonCode;
    let targetReason = aggregated.explanation;
    let gatekeeperResult = null;
    let newTaskToCreate: RemediationTask | null = null;

    if (currentState === "RECHECKING") {
      gatekeeperResult = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: completedRemediation || activeRemediation,
        evidence,
        observations: [observation],
        now: nowIso,
      });

      if (gatekeeperResult.allowed) {
        targetState = "VERIFIED_RESTORED";
        targetReasonCode = "VERIFIED_RESTORED";
        targetReason = gatekeeperResult.explanation;
      } else if (aggregated.outcome === "INTERRUPTED") {
        targetState = "ACTION_REQUIRED";
        targetReasonCode = "RECHECKING_FAILED_OBSTRUCTION";
        targetReason = `Recheck failed: ${aggregated.explanation}`;
      } else {
        targetState = "UNKNOWN";
        targetReasonCode = gatekeeperResult.reasonCode;
        targetReason = gatekeeperResult.explanation;
      }
    } else {
      if (aggregated.outcome === "INTERRUPTED") {
        targetState = "INTERRUPTED";
        targetReasonCode = "ACCESS_INTERRUPTED";
        targetReason = aggregated.explanation;

        if (!activeRemediation) {
          newTaskToCreate = {
            id: `task_${Date.now()}`,
            entranceId: entrance.id,
            triggerAssessmentId: `assess_${Date.now()}`,
            status: "OPEN",
            reason: observation.explanation || aggregated.explanation,
            createdAt: nowIso,
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

    let updatedAssessment: AccessAssessment = latestAssessment || {
      id: `assess_${Date.now()}`,
      entranceId: entrance.id,
      state: currentState,
      reasonCode: "INITIAL",
      reason: "Initial assessment",
      evidenceIds: [evidence.id],
      observationIds: [observation.id],
      policyVersion: "1.0.0",
      assessedAt: nowIso,
    };

    let stateTransitioned = false;

    await storage.transaction(async (tx) => {
      if (currentState === "AVAILABLE" && targetState === "ACTION_REQUIRED") {
        const step1 = transitionAssuranceState({
          entranceId: entrance.id,
          currentState: "AVAILABLE",
          nextState: "INTERRUPTED",
          trigger: aggregated.reasonCode,
          correlationId,
          evidenceIds: [evidence.id],
          reason: targetReason,
        });

        if (step1.success) {
          const step2 = transitionAssuranceState({
            entranceId: entrance.id,
            currentState: "INTERRUPTED",
            nextState: "ACTION_REQUIRED",
            trigger: "TASK_DISPATCHED",
            correlationId,
            evidenceIds: [evidence.id],
            reason: newTaskToCreate?.reason || targetReason,
          });

          if (step2.success) {
            stateTransitioned = true;
            updatedAssessment = await tx.assessments.save({
              id: `assess_${Date.now()}`,
              entranceId: entrance.id,
              state: "ACTION_REQUIRED",
              reasonCode: targetReasonCode,
              reason: targetReason,
              evidenceIds: [evidence.id],
              observationIds: [observation.id],
              policyVersion: "1.0.0",
              assessedAt: nowIso,
              previousAssessmentId: latestAssessment?.id,
            });

            await tx.auditEvents.append({
              id: `audit_${Date.now()}_trans`,
              type: "ACCESS_INTERRUPTED",
              timestamp: nowIso,
              correlationId,
              entityType: "ASSESSMENT",
              entityId: updatedAssessment.id,
              metadata: {
                entranceId: entrance.id,
                previousState: currentState,
                nextState: "ACTION_REQUIRED",
                reasonCode: targetReasonCode,
                explanation: targetReason,
              },
            });
          }
        }
      } else if (targetState !== currentState) {
        const transition = transitionAssuranceState({
          entranceId: entrance.id,
          currentState,
          nextState: targetState,
          trigger: aggregated.reasonCode,
          correlationId,
          evidenceIds: [evidence.id],
          reason: targetReason,
        });

        if (transition.success) {
          stateTransitioned = true;
          updatedAssessment = await tx.assessments.save({
            id: `assess_${Date.now()}`,
            entranceId: entrance.id,
            state: targetState,
            reasonCode: targetReasonCode,
            reason: targetReason,
            evidenceIds: [evidence.id],
            observationIds: [observation.id],
            policyVersion: "1.0.0",
            assessedAt: nowIso,
            previousAssessmentId: latestAssessment?.id,
          });

          let auditType: AuditEvent["type"] = "OBSERVATION_CREATED";
          if (targetState === "VERIFIED_RESTORED") auditType = "ACCESS_VERIFIED_RESTORED";
          else if (targetState === "INTERRUPTED" || targetState === "ACTION_REQUIRED") auditType = "ACCESS_INTERRUPTED";
          else if (targetState === "UNKNOWN") auditType = "ASSESSMENT_UNKNOWN";

          await tx.auditEvents.append({
            id: `audit_${Date.now()}_trans`,
            type: auditType,
            timestamp: nowIso,
            correlationId,
            entityType: "ASSESSMENT",
            entityId: updatedAssessment.id,
            metadata: {
              entranceId: entrance.id,
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
          timestamp: nowIso,
          correlationId,
          entityType: "REMEDIATION_TASK",
          entityId: newTaskToCreate.id,
          metadata: {
            entranceId: entrance.id,
            reason: newTaskToCreate.reason,
          },
        });
      }
    });

    const policyEvaluationMs = Date.now() - policyStart;
    const totalMs = Date.now() - pipelineStart;

    return {
      success: true,
      observation,
      assessment: updatedAssessment,
      stateTransitioned,
      previousState: currentState,
      resultingState: updatedAssessment.state,
      gatekeeperResult,
      timingMs: {
        evidenceAcquisitionMs: 0,
        visionInferenceMs,
        policyEvaluationMs,
        totalMs,
      },
    };
  }
}
