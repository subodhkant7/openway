import { Evidence, EvidenceFreshness, EvidenceType, EvidenceProvenance } from "./types";

export interface FreshnessConfig {
  maxAgeSecondsByType?: Partial<Record<EvidenceType, number>>;
  maxAgeSecondsByProvenance?: Partial<Record<EvidenceProvenance, number>>;
  defaultMaxAgeSeconds?: number;
  futureToleranceSeconds?: number;
}

export const DEFAULT_FRESHNESS_CONFIG: Required<FreshnessConfig> = {
  maxAgeSecondsByType: {
    IMAGE: 180,    // 3 minutes for snapshot image verification
    VIDEO: 300,    // 5 minutes for video media clip
    EVENT: 60,     // 1 minute for motion/doorbell events
    STATUS: 120,   // 2 minutes for health/device status
  },
  maxAgeSecondsByProvenance: {
    OFFICIAL_RING: 180,
    SIMULATED_LOCAL: 300,
    OPENWAY_DERIVED: 180,
  },
  defaultMaxAgeSeconds: 120,
  futureToleranceSeconds: 15, // Allow up to 15s clock drift
};

/**
 * Pure deterministic freshness evaluator.
 * Does NOT consult AI model confidence or external services.
 */
export function evaluateEvidenceFreshness(
  evidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance">,
  config: FreshnessConfig = {},
  now: Date | string = new Date()
): EvidenceFreshness {
  if (!evidence || !evidence.capturedAt) {
    return "UNKNOWN";
  }

  const capturedTimestamp = new Date(evidence.capturedAt).getTime();
  const evaluationTimestamp = new Date(now).getTime();

  if (isNaN(capturedTimestamp) || isNaN(evaluationTimestamp)) {
    return "INVALID";
  }

  const ageMs = evaluationTimestamp - capturedTimestamp;
  const ageSeconds = ageMs / 1000;

  const futureTolerance = config.futureToleranceSeconds ?? DEFAULT_FRESHNESS_CONFIG.futureToleranceSeconds;

  // Timestamp in the future beyond allowable clock drift
  if (ageSeconds < -futureTolerance) {
    return "INVALID";
  }

  // Determine applicable max age
  let maxAge = config.defaultMaxAgeSeconds ?? DEFAULT_FRESHNESS_CONFIG.defaultMaxAgeSeconds;

  if (config.maxAgeSecondsByType?.[evidence.evidenceType] !== undefined) {
    maxAge = config.maxAgeSecondsByType[evidence.evidenceType]!;
  } else if (DEFAULT_FRESHNESS_CONFIG.maxAgeSecondsByType[evidence.evidenceType] !== undefined) {
    maxAge = DEFAULT_FRESHNESS_CONFIG.maxAgeSecondsByType[evidence.evidenceType]!;
  }

  // Check provenance constraint if stricter
  const provenanceMax =
    config.maxAgeSecondsByProvenance?.[evidence.provenance] ??
    DEFAULT_FRESHNESS_CONFIG.maxAgeSecondsByProvenance[evidence.provenance];

  if (provenanceMax !== undefined && provenanceMax < maxAge) {
    maxAge = provenanceMax;
  }

  if (ageSeconds > maxAge) {
    return "STALE";
  }

  return "FRESH";
}
