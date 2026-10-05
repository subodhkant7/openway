import { evaluateEvidenceFreshness } from "@/evidence/freshness";
import { RestorationGateParams, GatekeeperResult } from "./types";
import { verifyPostRemediationEvidence, PostRemediationVerificationParams, PostRemediationVerificationResult } from "./postRemediationVerifier";

export type RestorationGatekeeperResult = GatekeeperResult;
export { verifyPostRemediationEvidence };
export type { PostRemediationVerificationParams, PostRemediationVerificationResult };

/**
 * Pure Deterministic Restoration Gatekeeper
 *
 * Implements the core product invariant:
 * "An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."
 *
 * ALL 9 conditions must be satisfied before access can be declared restored:
 * 1. Current state is RECHECKING
 * 2. Remediation exists and is COMPLETED
 * 3. Remediation occurred before the verification evidence was captured
 * 4. Evidence belongs to the correct entrance and venue
 * 5. Evidence matches the entrance's explicit camera binding (deviceId & componentId)
 * 6. Evidence is FRESH (based on captured timestamp, not DB insertion time)
 * 7. Configured accessibility requirements are explicitly satisfied (tri-state TRUE/FALSE)
 * 8. No contradictory observations exist in the verification window
 * 9. Evidence provenance is valid and honest (simulated != official Ring)
 */
export function canDeclareRestored(params: RestorationGateParams): GatekeeperResult {
  const {
    currentState,
    entrance,
    remediationTask,
    evidence,
    observations,
    now = new Date(),
    freshnessConfig,
    allRecentObservations = [],
  } = params;

  // 1. Current state must be RECHECKING
  if (currentState !== "RECHECKING") {
    return {
      allowed: false,
      reasonCode: "INVALID_STATE",
      explanation: `Cannot declare restored from state "${currentState}". Entrance must be in RECHECKING state.`,
    };
  }

  // 2. Remediation must exist and be completed
  if (!remediationTask) {
    return {
      allowed: false,
      reasonCode: "NO_REMEDIATION",
      explanation: "No remediation task found. Restoration requires a completed remediation task.",
    };
  }

  if (remediationTask.status !== "COMPLETED" || !remediationTask.completedAt) {
    return {
      allowed: false,
      reasonCode: "REMEDIATION_INCOMPLETE",
      explanation: `Remediation task is in status "${remediationTask.status}". Physical action must be reported completed before verification.`,
    };
  }

  // 3. Remediation must have occurred BEFORE the verification evidence was captured
  if (!evidence.capturedAt) {
    return {
      allowed: false,
      reasonCode: "TEMPORALLY_UNVERIFIED",
      explanation: "Verification evidence lacks an authoritative capture timestamp from Ring.",
    };
  }

  const remediationTime = new Date(remediationTask.completedAt).getTime();
  const evidenceCapturedTime = new Date(evidence.capturedAt).getTime();

  if (isNaN(remediationTime) || isNaN(evidenceCapturedTime)) {
    return {
      allowed: false,
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: "Invalid timestamp in remediation task or verification evidence.",
    };
  }

  if (evidenceCapturedTime < remediationTime) {
    return {
      allowed: false,
      reasonCode: "TEMPORAL_INCONSISTENCY",
      explanation: `Verification evidence captured at ${evidence.capturedAt} was taken BEFORE remediation was completed at ${remediationTask.completedAt}. Fresh post-remediation evidence is mandatory.`,
    };
  }

  // 4. Evidence belongs to the correct entrance and venue
  if (evidence.entranceId !== entrance.id) {
    return {
      allowed: false,
      reasonCode: "WRONG_ENTRANCE",
      explanation: `Evidence entranceId "${evidence.entranceId}" does not match configured entrance "${entrance.id}".`,
    };
  }

  if (entrance.venueId && evidence.venueId && evidence.venueId !== entrance.venueId) {
    return {
      allowed: false,
      reasonCode: "WRONG_ENTRANCE",
      explanation: `Evidence venueId "${evidence.venueId}" does not match entrance venue "${entrance.venueId}".`,
    };
  }

  // 5. Evidence belongs to the correct Ring device and component
  if (evidence.deviceId !== entrance.cameraBinding.deviceId) {
    return {
      allowed: false,
      reasonCode: "WRONG_CAMERA_DEVICE",
      explanation: `Evidence deviceId "${evidence.deviceId}" does not match entrance camera binding "${entrance.cameraBinding.deviceId}".`,
    };
  }

  if (evidence.componentId !== entrance.cameraBinding.componentId) {
    return {
      allowed: false,
      reasonCode: "WRONG_CAMERA_COMPONENT",
      explanation: `Evidence componentId "${evidence.componentId}" does not match entrance camera binding "${entrance.cameraBinding.componentId}".`,
    };
  }

  // 6. Evidence must be FRESH
  const freshness = evaluateEvidenceFreshness(evidence, freshnessConfig, now);
  if (freshness === "STALE") {
    return {
      allowed: false,
      reasonCode: "STALE_EVIDENCE",
      explanation: `Evidence is STALE. Captured at ${evidence.capturedAt}, exceeding allowable verification window.`,
      evaluatedFreshness: freshness,
    };
  }

  if (freshness === "INVALID") {
    return {
      allowed: false,
      reasonCode: "INVALID_EVIDENCE",
      explanation: `Evidence timestamp ${evidence.capturedAt} is invalid or in the future.`,
      evaluatedFreshness: freshness,
    };
  }

  if (freshness !== "FRESH") {
    return {
      allowed: false,
      reasonCode: "STALE_EVIDENCE",
      explanation: `Evidence freshness status is "${freshness}". Only FRESH evidence can restore access.`,
      evaluatedFreshness: freshness,
    };
  }

  // 9. Evidence provenance is valid & honest
  // Never allow simulated data to masquerade as official Ring evidence
  if (evidence.isSimulated && evidence.provenance === "OFFICIAL_RING") {
    return {
      allowed: false,
      reasonCode: "INVALID_PROVENANCE",
      explanation: "Security invariant violation: simulated evidence cannot claim OFFICIAL_RING provenance.",
      evaluatedFreshness: freshness,
    };
  }

  if (!["OFFICIAL_RING", "SIMULATED_LOCAL", "OPENWAY_DERIVED"].includes(evidence.provenance)) {
    return {
      allowed: false,
      reasonCode: "INVALID_PROVENANCE",
      explanation: `Unknown evidence provenance "${evidence.provenance}".`,
      evaluatedFreshness: freshness,
    };
  }

  // 7. Check required conditions from observations attached to this evidence
  const matchingObservations = observations.filter(
    (obs) => obs.evidenceId === evidence.id && obs.entranceId === entrance.id
  );

  if (matchingObservations.length === 0) {
    return {
      allowed: false,
      reasonCode: "REQUIREMENTS_NOT_MET",
      explanation: "No structured observations found for this verification evidence.",
      evaluatedFreshness: freshness,
    };
  }

  // 8. Contradiction Detection
  const combinedObservations = [...matchingObservations, ...allRecentObservations];
  const hasObstruction = combinedObservations.some((obs) => obs.obstructionPresent === "TRUE");
  const hasClearObstruction = combinedObservations.some((obs) => obs.obstructionPresent === "FALSE");

  if (hasObstruction && hasClearObstruction) {
    return {
      allowed: false,
      reasonCode: "CONTRADICTORY_EVIDENCE",
      explanation: "Contradictory observations detected in verification window.",
      evaluatedFreshness: freshness,
    };
  }

  const reqs = entrance.requirements;

  for (const obs of matchingObservations) {
    if (reqs.obstructionFree && obs.obstructionPresent !== "FALSE") {
      return {
        allowed: false,
        reasonCode: "REQUIREMENTS_NOT_MET",
        explanation: `Requirement obstructionFree failed: observation is "${obs.obstructionPresent}".`,
        evaluatedFreshness: freshness,
      };
    }

    if (reqs.pathwayClear && obs.pathwayClear !== "TRUE") {
      return {
        allowed: false,
        reasonCode: "REQUIREMENTS_NOT_MET",
        explanation: `Requirement pathwayClear failed: observation is "${obs.pathwayClear}".`,
        evaluatedFreshness: freshness,
      };
    }

    if (reqs.doorReady && obs.doorReady !== "TRUE") {
      return {
        allowed: false,
        reasonCode: "REQUIREMENTS_NOT_MET",
        explanation: `Requirement doorReady failed: observation is "${obs.doorReady}".`,
        evaluatedFreshness: freshness,
      };
    }
  }

  // All 9 conditions strictly passed!
  return {
    allowed: true,
    reasonCode: "GATE_PASSED",
    explanation: "All 9 verification conditions passed. Physical restoration proven by fresh post-remediation evidence.",
    evaluatedFreshness: "FRESH",
  };
}
