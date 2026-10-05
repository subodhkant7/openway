import { Entrance, RemediationTask, AssuranceState } from "@/domain/types";
import { Evidence, AccessibilityObservation, EvidenceFreshness } from "@/evidence/types";
import { FreshnessConfig } from "@/evidence/freshness";

export interface RestorationGateParams {
  currentState: AssuranceState;
  entrance: Entrance;
  remediationTask?: RemediationTask | null;
  evidence: Evidence;
  observations: AccessibilityObservation[];
  now?: Date | string;
  freshnessConfig?: FreshnessConfig;
  allRecentObservations?: AccessibilityObservation[];
}

export interface GatekeeperResult {
  allowed: boolean;
  reasonCode:
    | "GATE_PASSED"
    | "INVALID_STATE"
    | "NO_REMEDIATION"
    | "REMEDIATION_INCOMPLETE"
    | "TEMPORAL_INCONSISTENCY"
    | "WRONG_ENTRANCE"
    | "WRONG_CAMERA_DEVICE"
    | "WRONG_CAMERA_COMPONENT"
    | "STALE_EVIDENCE"
    | "INVALID_EVIDENCE"
    | "REQUIREMENTS_NOT_MET"
    | "CONTRADICTORY_EVIDENCE"
    | "TEMPORALLY_UNVERIFIED"
    | "INVALID_PROVENANCE";
  explanation: string;
  evaluatedFreshness?: EvidenceFreshness;
}
