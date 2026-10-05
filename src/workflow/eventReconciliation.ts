import { RingEvent } from "@/ring/types";
import { RingProvider, getRingProvider } from "@/ring";
import { AccessAssuranceOrchestrator, OrchestrationResult } from "./accessAssuranceOrchestrator";
import { getStorageProvider, StorageProvider } from "@/persistence";
import { safeLog } from "@/ring/errors";

export interface ReconciliationOptions {
  ringProvider?: RingProvider;
  lookbackMinutes?: number;
  sinceTimestamp?: string;
  limit?: number;
  forceReplay?: boolean;
}

export interface ReconciliationReport {
  timestamp: string;
  sinceTimestamp: string;
  eventsDiscovered: number;
  eventsProcessed: number;
  eventsDeduplicated: number;
  results: OrchestrationResult[];
  recoveredEventIds: string[];
}

export class EventReconciliationService {
  private storage: StorageProvider;
  private orchestrator: AccessAssuranceOrchestrator;
  private lastReconciliationTimestamp: string;

  constructor(
    storage?: StorageProvider,
    orchestrator?: AccessAssuranceOrchestrator
  ) {
    this.storage = storage || getStorageProvider();
    this.orchestrator = orchestrator || AccessAssuranceOrchestrator.getInstance();
    // Default last reconciliation timestamp to 1 hour ago
    this.lastReconciliationTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }

  public getLastReconciliationTimestamp(): string {
    return this.lastReconciliationTimestamp;
  }

  public setLastReconciliationTimestamp(ts: string): void {
    this.lastReconciliationTimestamp = ts;
  }

  /**
   * Reconciles missed Ring events after transient outages or on operator demand.
   *
   * ARCHITECTURAL RULE:
   * Event-driven first, reconciliation second.
   * Discovered events enter the exact same idempotent orchestration pipeline.
   */
  public async reconcileMissedEvents(
    options: ReconciliationOptions = {}
  ): Promise<ReconciliationReport> {
    const startTime = new Date().toISOString();
    const provider = options.ringProvider || getRingProvider();
    const lookbackMinutes = options.lookbackMinutes ?? 60;
    const sinceTimestamp =
      options.sinceTimestamp ||
      new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

    const limit = options.limit ?? 50;

    safeLog("info", "Starting event reconciliation", { sinceTimestamp, limit });

    // 1. Fetch recent events from Ring provider
    let recentEvents: RingEvent[] = [];
    try {
      recentEvents = await provider.getRecentEvents(undefined, limit);
    } catch (err) {
      safeLog("warn", "Failed to retrieve Ring event history for reconciliation", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        timestamp: startTime,
        sinceTimestamp,
        eventsDiscovered: 0,
        eventsProcessed: 0,
        eventsDeduplicated: 0,
        results: [],
        recoveredEventIds: [],
      };
    }

    // 2. Filter events newer than sinceTimestamp
    const sinceMs = new Date(sinceTimestamp).getTime();
    const missedEvents = recentEvents.filter((ev) => {
      const evMs = new Date(ev.timestamp).getTime();
      return evMs >= sinceMs;
    });

    const results: OrchestrationResult[] = [];
    const recoveredEventIds: string[] = [];
    let eventsDeduplicated = 0;

    // 3. Replay discovered events through orchestrator
    for (const ev of missedEvents) {
      try {
        const res = await this.orchestrator.processEvent(ev, {
          ringProvider: provider,
          correlationId: `reconcile_${ev.eventId}_${Date.now()}`,
        });

        results.push(res);
        if (res.deduplicated) {
          eventsDeduplicated++;
        } else {
          recoveredEventIds.push(ev.eventId);
        }
      } catch (err) {
        safeLog("warn", "Error processing reconciled event", {
          eventId: ev.eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.lastReconciliationTimestamp = startTime;

    // Append audit event for reconciliation run
    await this.storage.auditEvents.append({
      id: `audit_reconciliation_${Date.now()}`,
      type: "RING_EVENT_INGESTED",
      timestamp: startTime,
      correlationId: `reconcile_run_${Date.now()}`,
      entityType: "ENTRANCE",
      entityId: "ALL",
      metadata: {
        sinceTimestamp,
        eventsDiscovered: missedEvents.length,
        eventsProcessed: results.length,
        recoveredEventIds,
      },
    });

    return {
      timestamp: startTime,
      sinceTimestamp,
      eventsDiscovered: missedEvents.length,
      eventsProcessed: results.length,
      eventsDeduplicated,
      results,
      recoveredEventIds,
    };
  }
}
