import { Entrance, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation, TemporalEvidenceClassification } from "@/evidence/types";
import { evaluateEvidenceFreshness, FreshnessConfig } from "@/evidence/freshness";
import { classifyEvidenceTemporality } from "@/evidence/temporalClassification";

export interface PostRemediationVerificationParams {
  entrance: Entrance;
  remediationTask: RemediationTask;
  evidence?: Evidence | null;
  observation?: AccessibilityObservation | null;
  allRecentObservations?: AccessibilityObservation[];
  now?: string | Date;
  freshnessConfig?: FreshnessConfig;
}

export interface PostRemediationVerificationResult {
  verified: boolean;
  outcome: "VERIFIED_RESTORED" | "ACTION_REQUIRED" | "UNKNOWN";
  reasonCode:
    | "GATE_PASSED"
    | "EVIDENCE_MISSING"
    | "TEMPORALLY_UNVERIFIED"
    | "TEMPORAL_INCONSISTENCY"
    | "WRONG_ENTRANCE"
    | "WRONG_CAMERA_DEVICE"
    | "WRONG_CAMERA_COMPONENT"
    | "STALE_EVIDENCE"
    | "INVALID_EVIDENCE"
    | "OBSERVATION_INVALID"
    | "REQUIREMENTS_NOT_MET"
    | "CONTRADICTORY_EVIDENCE"
    | "OBSTRUCTION_PERSISTS";
  explanation: string;
  classification: TemporalEvidenceClassification;
  evaluatedAt: string;
}

/**
 * Strict Post-Remediation Verification Policy (Phase 5 Invariant)
 *
 * Implements the 10 Mandatory Post-Remediation Conditions:
 * 1. Evidence exists
 * 2. Evidence capture time is known (not empty or undefined)
 * 3. Capture time is at or after remediation completion (capturedAt >= completedAt)
 * 4. Evidence matches entrance
 * 5. Evidence matches camera device
 * 6. Evidence matches camera component
 * 7. Evidence is fresh
 * 8. Observation is valid
 * 9. Observation satisfies configured requirements
 * 10. No contradictory current evidence exists
 *
 * If any cannot be established: UNKNOWN (or ACTION_REQUIRED if obstruction explicitly persists).
 * NEVER assumes success. NEVER accepts staff completion alone as verification.
 */
export function verifyPostRemediationEvidence(
  params: PostRemediationVerificationParams
): PostRemediationVerificationResult {
  const now = params.now || new Date();
  const nowIso = typeof now === "string" ? now : now.toISOString();

  // 1. Evidence exists
  if (!params.evidence) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "EVIDENCE_MISSING",
      explanation: "No camera evidence available for post-remediation verification.",
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  const { evidence, entrance, remediationTask, observation } = params;

  // 2. Evidence capture time is known
  if (!evidence.capturedAt || typeof evidence.capturedAt !== "string" || evidence.capturedAt.trim() === "") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORALLY_UNVERIFIED",
      explanation: "Evidence capture timestamp is missing or unverified from camera metadata.",
      classification: "TEMPORALLY_UNVERIFIED",
      evaluatedAt: nowIso,
    };
  }

  const captureTime = new Date(evidence.capturedAt).getTime();
  const nowTime = new Date(now).getTime();
  const futureToleranceMs = (params.freshnessConfig?.futureToleranceSeconds ?? 15) * 1000;

  if (isNaN(captureTime) || isNaN(nowTime)) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORALLY_UNVERIFIED",
      explanation: `Invalid capture timestamp format: ${evidence.capturedAt}`,
      classification: "TEMPORALLY_UNVERIFIED",
      evaluatedAt: nowIso,
    };
  }

  // Reject non-positive or epoch zero timestamps
  if (captureTime <= 0) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Negative or non-positive capture timestamp detected: ${evidence.capturedAt}`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  // Reject future-dated evidence beyond clock drift
  if (captureTime > nowTime + futureToleranceMs) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "INVALID_EVIDENCE",
      explanation: `Verification evidence captured timestamp ${evidence.capturedAt} is in the future beyond allowable clock drift.`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  // 3. Capture time is at or after remediation completion
  if (!remediationTask.completedAt) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: "Remediation task has no completedAt timestamp.",
      classification: "PRE_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  const completionTime = new Date(remediationTask.completedAt).getTime();
  if (isNaN(completionTime)) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Invalid remediation completedAt timestamp: ${remediationTask.completedAt}`,
      classification: "PRE_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  // Reject non-positive or future completion timestamps
  if (completionTime <= 0) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Negative or non-positive remediation completion timestamp: ${remediationTask.completedAt}`,
      classification: "PRE_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (completionTime > nowTime + futureToleranceMs) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Remediation completed timestamp ${remediationTask.completedAt} is in the future beyond allowable clock drift.`,
      classification: "PRE_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (captureTime < completionTime) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Evidence captured at ${evidence.capturedAt} was taken BEFORE staff completion at ${remediationTask.completedAt}. Pre-remediation evidence cannot verify restoration.`,
      classification: "PRE_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  // 4. Evidence matches entrance
  if (evidence.entranceId !== entrance.id) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "WRONG_ENTRANCE",
      explanation: `Evidence entrance ID "${evidence.entranceId}" does not match configured entrance "${entrance.id}".`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  // 5. Evidence matches device
  if (evidence.deviceId !== entrance.cameraBinding.deviceId) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "WRONG_CAMERA_DEVICE",
      explanation: `Evidence device ID "${evidence.deviceId}" does not match entrance camera binding "${entrance.cameraBinding.deviceId}".`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  // 6. Evidence matches component
  if (
    !evidence.componentId ||
    evidence.componentId !== entrance.cameraBinding.componentId
  ) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "WRONG_CAMERA_COMPONENT",
      explanation: `Evidence component ID "${evidence.componentId}" does not match configured entrance component "${entrance.cameraBinding.componentId}".`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  // 7. Evidence is fresh
  const freshness = evaluateEvidenceFreshness(evidence, params.freshnessConfig, now);
  if (freshness === "STALE") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "STALE_EVIDENCE",
      explanation: `Evidence is STALE (captured at ${evidence.capturedAt}). Fresh evidence is required.`,
      classification: "STALE",
      evaluatedAt: nowIso,
    };
  }

  if (freshness === "INVALID") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "INVALID_EVIDENCE",
      explanation: `Evidence timestamp ${evidence.capturedAt} is invalid or in the future.`,
      classification: "INVALID",
      evaluatedAt: nowIso,
    };
  }

  if (freshness !== "FRESH") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "STALE_EVIDENCE",
      explanation: `Evidence freshness status is "${freshness}". Only FRESH evidence can verify restoration.`,
      classification: "STALE",
      evaluatedAt: nowIso,
    };
  }

  // 8. Observation is valid
  if (!observation) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "OBSERVATION_INVALID",
      explanation: "No structured vision observation found for this verification evidence.",
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (observation.evidenceId !== evidence.id) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "OBSERVATION_INVALID",
      explanation: `Observation evidence ID "${observation.evidenceId}" does not match evidence ID "${evidence.id}".`,
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  // 10. Check for contradictory current evidence in the window
  const allObservations = [observation, ...(params.allRecentObservations || [])];
  const hasObstruction = allObservations.some((obs) => obs.obstructionPresent === "TRUE");
  const hasClear = allObservations.some((obs) => obs.obstructionPresent === "FALSE");

  if (hasObstruction && hasClear) {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "CONTRADICTORY_EVIDENCE",
      explanation: "Contradictory observations detected in verification window.",
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  // 9. Observation satisfies configured requirements
  const reqs = entrance.requirements;

  // Check if obstruction is explicitly present in the post-remediation evidence
  if (
    observation.obstructionPresent === "TRUE" ||
    (reqs.pathwayClear && observation.pathwayClear === "FALSE")
  ) {
    return {
      verified: false,
      outcome: "ACTION_REQUIRED",
      reasonCode: "OBSTRUCTION_PERSISTS",
      explanation: `Post-remediation evidence shows physical obstruction still present: ${observation.explanation}`,
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (reqs.obstructionFree && observation.obstructionPresent !== "FALSE") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "REQUIREMENTS_NOT_MET",
      explanation: `Requirement obstructionFree failed: observation is "${observation.obstructionPresent}".`,
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (reqs.pathwayClear && observation.pathwayClear !== "TRUE") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "REQUIREMENTS_NOT_MET",
      explanation: `Requirement pathwayClear failed: observation is "${observation.pathwayClear}".`,
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  if (reqs.doorReady && observation.doorReady !== "TRUE") {
    return {
      verified: false,
      outcome: "UNKNOWN",
      reasonCode: "REQUIREMENTS_NOT_MET",
      explanation: `Requirement doorReady failed: observation is "${observation.doorReady}".`,
      classification: "POST_REMEDIATION",
      evaluatedAt: nowIso,
    };
  }

  // All 10 conditions passed!
  return {
    verified: true,
    outcome: "VERIFIED_RESTORED",
    reasonCode: "GATE_PASSED",
    explanation: "All 10 verification invariants strictly satisfied. Fresh post-remediation evidence proves physical restoration.",
    classification: "POST_REMEDIATION",
    evaluatedAt: nowIso,
  };
}
