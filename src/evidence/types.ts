/**
 * OpenWay Evidence Model: Types & Enums
 *
 * ARCHITECTURAL RULE 1:
 * Ring is evidence infrastructure. It provides raw events, device context,
 * timestamps, and media evidence. It does not contain accessibility policy.
 *
 * ARCHITECTURAL RULE 2:
 * AI does not control state transitions. AI generates structured observations
 * with tri-state values ("TRUE" | "FALSE" | "UNKNOWN").
 */

export type EvidenceProvider = "RING" | "SIMULATOR" | "OPENWAY";

export type EvidenceType = "IMAGE" | "VIDEO" | "EVENT" | "STATUS";

/**
 * Strict Provenance Tracking
 * Never allow a simulated image or event to appear as official Ring evidence.
 */
export type EvidenceProvenance =
  | "OFFICIAL_RING"     // Received directly from official Ring Partner API or signed webhook
  | "SIMULATED_LOCAL"   // Generated locally in developer playground or deterministic simulator
  | "OPENWAY_DERIVED";  // Derived by OpenWay evidence processing pipeline

export type EvidenceFreshness = "FRESH" | "STALE" | "INVALID" | "UNKNOWN";

export interface Evidence {
  id: string;
  venueId: string;
  entranceId: string;
  provider: EvidenceProvider;
  providerEventId?: string;
  deviceId: string;
  componentId: string;
  capturedAt: string;     // ISO 8601 timestamp of camera capture
  receivedAt: string;     // ISO 8601 timestamp when received by OpenWay
  evidenceType: EvidenceType;
  mediaReference?: string;
  provenance: EvidenceProvenance;
  isSimulated: boolean;
  freshness: EvidenceFreshness;
  checksum?: string;
  createdAt: string;
}

/**
 * Tri-state observation value.
 * Explicitly avoids JavaScript nullable boolean ambiguity.
 */
export type ObservationValue = "TRUE" | "FALSE" | "UNKNOWN";

export interface AccessibilityObservation {
  id: string;
  evidenceId: string;
  entranceId: string;
  pathwayClear: ObservationValue;
  obstructionPresent: ObservationValue;
  doorReady: ObservationValue;
  confidence: number; // 0.0 - 1.0 (statistical metric from vision analyzer, not state controller)
  observedAt: string;
  analyzer: string;
  analyzerVersion: string;
  explanation: string;
}

export type AssessmentOutcome = "SATISFIED" | "INTERRUPTED" | "UNKNOWN";

export interface AggregatedAssessment {
  outcome: AssessmentOutcome;
  reasonCode: string;
  explanation: string;
  matchedEvidence: Evidence[];
  matchedObservations: AccessibilityObservation[];
  contradictionDetected: boolean;
  freshness: EvidenceFreshness;
  evaluatedAt: string;
}
