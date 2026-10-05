import { Entrance } from "@/domain/types";
import {
  Evidence,
  AccessibilityObservation,
  AggregatedAssessment,
  ObservationValue,
} from "./types";
import { evaluateEvidenceFreshness, FreshnessConfig } from "./freshness";

export interface AggregationInput {
  entrance: Entrance;
  evidenceList: Evidence[];
  observations: AccessibilityObservation[];
  freshnessConfig?: FreshnessConfig;
  now?: Date | string;
}

/**
 * Deterministically combines evidence and structured observations for an entrance.
 *
 * Enforces:
 * 1. Strict camera binding match (device + component)
 * 2. Freshness evaluation for each evidence item
 * 3. Contradiction detection across observations
 * 4. Verification of typed entrance requirements
 */
export function aggregateObservations(input: AggregationInput): AggregatedAssessment {
  const { entrance, evidenceList, observations, freshnessConfig, now = new Date() } = input;
  const evaluatedAt = new Date(now).toISOString();

  // 1. Filter evidence matching this entrance's camera binding
  const matchingEvidence = evidenceList.filter((e) => {
    const entranceMatch = e.entranceId === entrance.id;
    const deviceMatch = e.deviceId === entrance.cameraBinding.deviceId;
    const componentMatch = e.componentId === entrance.cameraBinding.componentId;
    return entranceMatch && deviceMatch && componentMatch;
  });

  if (matchingEvidence.length === 0) {
    return {
      outcome: "UNKNOWN",
      reasonCode: "NO_MATCHING_EVIDENCE",
      explanation: "No evidence found matching entrance camera binding.",
      matchedEvidence: [],
      matchedObservations: [],
      contradictionDetected: false,
      freshness: "UNKNOWN",
      evaluatedAt,
    };
  }

  // 2. Evaluate freshness across matching evidence
  const evaluatedEvidence = matchingEvidence.map((e) => ({
    evidence: e,
    freshness: evaluateEvidenceFreshness(e, freshnessConfig, now),
  }));

  const hasInvalid = evaluatedEvidence.some((e) => e.freshness === "INVALID");
  if (hasInvalid) {
    return {
      outcome: "UNKNOWN",
      reasonCode: "INVALID_EVIDENCE",
      explanation: "Evidence timestamp is invalid or in the future.",
      matchedEvidence: matchingEvidence,
      matchedObservations: [],
      contradictionDetected: false,
      freshness: "INVALID",
      evaluatedAt,
    };
  }

  // Find matching observations for the matching evidence
  const matchedEvidenceIds = new Set(matchingEvidence.map((e) => e.id));
  const matchedObservations = observations.filter(
    (obs) => obs.entranceId === entrance.id && matchedEvidenceIds.has(obs.evidenceId)
  );

  if (matchedObservations.length === 0) {
    return {
      outcome: "UNKNOWN",
      reasonCode: "OBSERVATIONS_MISSING",
      explanation: "Matching evidence exists but has no structured observations.",
      matchedEvidence: matchingEvidence,
      matchedObservations: [],
      contradictionDetected: false,
      freshness: evaluatedEvidence[0].freshness,
      evaluatedAt,
    };
  }

  // 3. Contradiction Detection across fresh observations
  // Gather observation values
  const freshEvidenceIds = new Set(
    evaluatedEvidence.filter((e) => e.freshness === "FRESH").map((e) => e.evidence.id)
  );
  const freshObservations = matchedObservations.filter((obs) =>
    freshEvidenceIds.has(obs.evidenceId)
  );

  // Check contradictions among fresh observations
  const obstructionValues = new Set<ObservationValue>();
  const pathwayValues = new Set<ObservationValue>();
  const doorValues = new Set<ObservationValue>();

  for (const obs of freshObservations) {
    if (obs.obstructionPresent !== "UNKNOWN") obstructionValues.add(obs.obstructionPresent);
    if (obs.pathwayClear !== "UNKNOWN") pathwayValues.add(obs.pathwayClear);
    if (obs.doorReady !== "UNKNOWN") doorValues.add(obs.doorReady);
  }

  const hasContradiction =
    (obstructionValues.has("TRUE") && obstructionValues.has("FALSE")) ||
    (pathwayValues.has("TRUE") && pathwayValues.has("FALSE")) ||
    (doorValues.has("TRUE") && doorValues.has("FALSE"));

  if (hasContradiction) {
    return {
      outcome: "UNKNOWN",
      reasonCode: "CONTRADICTORY_OBSERVATIONS",
      explanation: "Conflicting fresh observations detected in the evaluation window.",
      matchedEvidence: matchingEvidence,
      matchedObservations,
      contradictionDetected: true,
      freshness: "FRESH",
      evaluatedAt,
    };
  }

  // 4. Interruption Detection (Even stale interruption evidence must trigger caution or check)
  // An active obstruction reported as TRUE in fresh observations immediately yields INTERRUPTED
  const freshObstruction = freshObservations.some((obs) => obs.obstructionPresent === "TRUE");
  const freshPathwayBlocked = freshObservations.some((obs) => obs.pathwayClear === "FALSE");
  const freshDoorBlocked = freshObservations.some((obs) => obs.doorReady === "FALSE");

  if (freshObstruction || freshPathwayBlocked || freshDoorBlocked) {
    const reasons: string[] = [];
    if (freshObstruction) reasons.push("Physical obstruction present");
    if (freshPathwayBlocked) reasons.push("Pathway is not clear");
    if (freshDoorBlocked) reasons.push("Doorway is not ready");

    return {
      outcome: "INTERRUPTED",
      reasonCode: "ACCESS_INTERRUPTED",
      explanation: reasons.join("; "),
      matchedEvidence: matchingEvidence,
      matchedObservations,
      contradictionDetected: false,
      freshness: "FRESH",
      evaluatedAt,
    };
  }

  // 5. Check if evidence is fresh enough for SATISFIED
  const hasStaleEvidence = evaluatedEvidence.some((e) => e.freshness === "STALE");
  const allFresh = evaluatedEvidence.length > 0 && evaluatedEvidence.every((e) => e.freshness === "FRESH");

  if (!allFresh || hasStaleEvidence) {
    return {
      outcome: "UNKNOWN",
      reasonCode: "STALE_EVIDENCE",
      explanation: "Evidence is stale. Fresh observation is required to assure accessibility.",
      matchedEvidence: matchingEvidence,
      matchedObservations,
      contradictionDetected: false,
      freshness: "STALE",
      evaluatedAt,
    };
  }

  // 6. Check required entrance conditions
  const reqs = entrance.requirements;
  let allRequirementsSatisfied = true;
  const unsatisfiedReasons: string[] = [];

  if (reqs.obstructionFree) {
    const hasClearObstruction = freshObservations.every((obs) => obs.obstructionPresent === "FALSE");
    if (!hasClearObstruction) {
      allRequirementsSatisfied = false;
      unsatisfiedReasons.push("Obstruction-free condition not confirmed false");
    }
  }

  if (reqs.pathwayClear) {
    const hasPathwayClear = freshObservations.some((obs) => obs.pathwayClear === "TRUE");
    if (!hasPathwayClear) {
      allRequirementsSatisfied = false;
      unsatisfiedReasons.push("Pathway-clear condition not confirmed true");
    }
  }

  if (reqs.doorReady) {
    const hasDoorReady = freshObservations.some((obs) => obs.doorReady === "TRUE");
    if (!hasDoorReady) {
      allRequirementsSatisfied = false;
      unsatisfiedReasons.push("Door-ready condition not confirmed true");
    }
  }

  if (allRequirementsSatisfied) {
    return {
      outcome: "SATISFIED",
      reasonCode: "REQUIREMENTS_SATISFIED",
      explanation: "All configured accessibility requirements satisfied by fresh camera evidence.",
      matchedEvidence: matchingEvidence,
      matchedObservations,
      contradictionDetected: false,
      freshness: "FRESH",
      evaluatedAt,
    };
  }

  return {
    outcome: "UNKNOWN",
    reasonCode: "REQUIREMENTS_UNCONFIRMED",
    explanation: unsatisfiedReasons.join("; ") || "Evidence observations do not conclusively satisfy requirements.",
    matchedEvidence: matchingEvidence,
    matchedObservations,
    contradictionDetected: false,
    freshness: "FRESH",
    evaluatedAt,
  };
}
