import { RingEvent } from "@/ring/types";
import { Entrance, RemediationTask } from "@/domain/types";
import { getStorageProvider, StorageProvider } from "@/persistence";
import { EventCorrelator, EventCorrelationResult } from "./eventCorrelator";
import { EvidenceAcquisitionService, AcquiredEvidenceResult } from "@/evidence/evidenceAcquisition";
import { VisionPipelineService, PipelineResult } from "@/vision/VisionPipelineService";
import { VisionAnalyzer } from "@/vision/VisionAnalyzer";
import { RingProvider, getRingProvider } from "@/ring";
import { safeLog } from "@/ring/errors";

export interface OrchestrationResult {
  accepted: boolean;
  correlationId: string;
  eventId: string;
  correlationResult: EventCorrelationResult;
  pipelineResult?: PipelineResult;
  taskCreated?: RemediationTask;
  deduplicated?: boolean;
  timingMs: {
    ringEventToEvidenceMs: number;
    evidenceToVisionMs: number;
    visionToPolicyMs: number;
    totalAssuranceLatencyMs: number;
  };
}

export class AccessAssuranceOrchestrator {
  private static instance: AccessAssuranceOrchestrator | null = null;
  private storage: StorageProvider;
  private correlator: EventCorrelator;
  private evidenceAcquisition: EvidenceAcquisitionService;
  private visionPipeline: VisionPipelineService;
  private processedEvents = new Map<string, OrchestrationResult>();
  private inProcessQueue: Promise<void> = Promise.resolve();

  constructor(
    storage?: StorageProvider,
    correlator?: EventCorrelator,
    evidenceAcquisition?: EvidenceAcquisitionService,
    visionPipeline?: VisionPipelineService
  ) {
    this.storage = storage || getStorageProvider();
    this.correlator = correlator || new EventCorrelator(this.storage);
    this.evidenceAcquisition = evidenceAcquisition || new EvidenceAcquisitionService(this.storage);
    this.visionPipeline = visionPipeline || VisionPipelineService.getInstance();
  }

  public static getInstance(): AccessAssuranceOrchestrator {
    if (!this.instance) {
      this.instance = new AccessAssuranceOrchestrator();
    }
    return this.instance;
  }

  public resetCache(): void {
    this.processedEvents.clear();
  }

  /**
   * Asynchronous non-blocking webhook ingestion boundary.
   * Enqueues the event for background processing without blocking webhook response.
   */
  public enqueueEvent(
    event: RingEvent,
    options?: {
      ringProvider?: RingProvider;
      visionAnalyzer?: VisionAnalyzer;
      correlationId?: string;
    }
  ): { accepted: boolean; eventId: string; correlationId: string } {
    const correlationId = options?.correlationId || `async_corr_${Date.now()}_${event.eventId}`;

    // Chain execution onto the in-process queue
    this.inProcessQueue = this.inProcessQueue
      .then(async () => {
        try {
          await this.processEvent(event, { ...options, correlationId });
        } catch (err) {
          safeLog("error", "Async event orchestration error", {
            eventId: event.eventId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
      .catch((err) => {
        safeLog("error", "Queue execution error", { error: String(err) });
      });

    return {
      accepted: true,
      eventId: event.eventId,
      correlationId,
    };
  }

  public async processRingEvent(
    event: RingEvent,
    options?: {
      ringProvider?: RingProvider;
      visionAnalyzer?: VisionAnalyzer;
      overrideVisionAnalyzer?: VisionAnalyzer;
      correlationId?: string;
    }
  ): Promise<OrchestrationResult> {
    return this.processEvent(event, {
      ...options,
      visionAnalyzer: options?.overrideVisionAnalyzer || options?.visionAnalyzer,
    });
  }

  /**
   * Synchronous / Direct Event Processing Pipeline:
   * Event &rarr; Correlator &rarr; Evidence &rarr; Vision &rarr; Policy &rarr; State &rarr; Task
   */
  public async processEvent(
    event: RingEvent,
    options?: {
      ringProvider?: RingProvider;
      visionAnalyzer?: VisionAnalyzer;
      correlationId?: string;
    }
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const correlationId = options?.correlationId || `corr_${event.eventId}_${Date.now()}`;

    // 1. Initial Event Deduplication
    const dedupeKey = `${event.provider}_${event.eventId}_${event.deviceId}`;
    if (this.processedEvents.has(dedupeKey)) {
      const cached = this.processedEvents.get(dedupeKey)!;
      return {
        ...cached,
        deduplicated: true,
      };
    }

    // 2. Correlate event to entrance and camera binding
    const correlation = await this.correlator.correlateEvent(event);

    if (correlation.status !== "CORRELATED" || !correlation.entrance) {
      const result: OrchestrationResult = {
        accepted: false,
        correlationId,
        eventId: event.eventId,
        correlationResult: correlation,
        timingMs: {
          ringEventToEvidenceMs: 0,
          evidenceToVisionMs: 0,
          visionToPolicyMs: 0,
          totalAssuranceLatencyMs: Date.now() - startTime,
        },
      };
      this.processedEvents.set(dedupeKey, result);
      return result;
    }

    const entrance: Entrance = correlation.entrance;

    // 3. Acquire fresh Ring image evidence
    const evidenceAcquisitionStart = Date.now();
    const acquired = await this.evidenceAcquisition.acquireFreshEvidence({
      entrance,
      provider: options?.ringProvider,
      mode: "latest_in_range",
      eventTimestamp: event.timestamp,
      correlationId,
      providerEventId: event.eventId,
    });
    const ringEventToEvidenceMs = Date.now() - evidenceAcquisitionStart;

    // 4. Run Multimodal Vision Pipeline
    const visionStart = Date.now();
    const pipelineResult = await this.visionPipeline.processEvidence({
      evidence: acquired.evidence,
      imageBytes: acquired.imageBytes,
      mimeType: acquired.mimeType,
      entrance,
      analyzer: options?.visionAnalyzer,
      correlationId,
    });
    const evidenceToVisionMs = Date.now() - visionStart;

    // 5. Check if remediation task was created as part of the state transition
    let taskCreated: RemediationTask | undefined;
    if (pipelineResult.resultingState === "ACTION_REQUIRED") {
      const activeTask = await this.storage.remediations.findActiveByEntranceId(entrance.id);
      if (activeTask) {
        taskCreated = activeTask;
      }
    }

    const totalAssuranceLatencyMs = Date.now() - startTime;
    const visionToPolicyMs = pipelineResult.timingMs?.policyEvaluationMs || 0;

    const result: OrchestrationResult = {
      accepted: true,
      correlationId,
      eventId: event.eventId,
      correlationResult: correlation,
      pipelineResult,
      taskCreated,
      timingMs: {
        ringEventToEvidenceMs,
        evidenceToVisionMs,
        visionToPolicyMs,
        totalAssuranceLatencyMs,
      },
    };

    this.processedEvents.set(dedupeKey, result);
    return result;
  }
}
