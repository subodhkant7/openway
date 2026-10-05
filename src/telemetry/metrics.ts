/**
 * OpenWay Operational Telemetry Metrics
 *
 * Tracks operational counts for Ring evidence calls, Bedrock vision analyses,
 * deduplication hits, rechecks, unknown outcomes, and verified restorations.
 *
 * SAFETY INVARIANT:
 * Never stores or exposes account IDs, Ring tokens, AWS credentials, or signed URLs.
 */

export interface OpenWayMetrics {
  ringEvidenceCalls: number;
  bedrockCalls: number;
  dedupeHits: number;
  recheckAttempts: number;
  unknownOutcomes: number;
  verifiedRestorations: number;
  lastUpdated: string;
}

class MetricsRegistry {
  private metrics: Omit<OpenWayMetrics, "lastUpdated"> = {
    ringEvidenceCalls: 0,
    bedrockCalls: 0,
    dedupeHits: 0,
    recheckAttempts: 0,
    unknownOutcomes: 0,
    verifiedRestorations: 0,
  };
  private lastUpdated: string = new Date().toISOString();

  public increment(metric: keyof Omit<OpenWayMetrics, "lastUpdated">, amount = 1): void {
    this.metrics[metric] += amount;
    this.lastUpdated = new Date().toISOString();
  }

  public getSnapshot(): OpenWayMetrics {
    return {
      ...this.metrics,
      lastUpdated: this.lastUpdated,
    };
  }

  public reset(): void {
    this.metrics = {
      ringEvidenceCalls: 0,
      bedrockCalls: 0,
      dedupeHits: 0,
      recheckAttempts: 0,
      unknownOutcomes: 0,
      verifiedRestorations: 0,
    };
    this.lastUpdated = new Date().toISOString();
  }
}

export const telemetry = new MetricsRegistry();
