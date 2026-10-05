import { AssuranceState } from "@/domain/types";

export interface TransitionRequest {
  entranceId: string;
  currentState: AssuranceState;
  nextState: AssuranceState;
  trigger: string;
  correlationId: string;
  evidenceIds?: string[];
  reason?: string;
  timestamp?: string;
}

export interface TransitionResult {
  success: boolean;
  previousState: AssuranceState;
  newState: AssuranceState;
  error?: string;
  log: StructuredTransitionLog;
}

export interface StructuredTransitionLog {
  correlationId: string;
  entranceId: string;
  previousState: AssuranceState;
  nextState: AssuranceState;
  trigger: string;
  evidenceIds: string[];
  reason?: string;
  timestamp: string;
}

/**
 * Deterministic Transition Table
 * Defines every allowable state transition in OpenWay.
 */
export const VALID_TRANSITIONS: Record<AssuranceState, readonly AssuranceState[]> = {
  AVAILABLE: ["INTERRUPTED", "UNKNOWN"],
  INTERRUPTED: ["ACTION_REQUIRED", "UNKNOWN", "AVAILABLE"],
  ACTION_REQUIRED: ["RECHECKING", "UNKNOWN"],
  RECHECKING: ["VERIFIED_RESTORED", "UNKNOWN", "ACTION_REQUIRED", "INTERRUPTED"],
  VERIFIED_RESTORED: ["AVAILABLE", "INTERRUPTED", "UNKNOWN"],
  UNKNOWN: ["AVAILABLE", "INTERRUPTED", "RECHECKING"],
} as const;

/**
 * Checks if a transition from fromState to toState is allowed by policy.
 */
export function isValidTransition(fromState: AssuranceState, toState: AssuranceState): boolean {
  if (fromState === toState) return true; // Idempotent self-transition allowed
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Executes a deterministic state transition.
 * Rejects invalid transitions with an error.
 * Emits sanitized structured logs (never logs secrets or raw media bytes).
 */
export function transitionAssuranceState(req: TransitionRequest): TransitionResult {
  const timestamp = req.timestamp || new Date().toISOString();
  const evidenceIds = req.evidenceIds || [];

  const log: StructuredTransitionLog = {
    correlationId: req.correlationId,
    entranceId: req.entranceId,
    previousState: req.currentState,
    nextState: req.nextState,
    trigger: req.trigger,
    evidenceIds,
    reason: req.reason,
    timestamp,
  };

  if (!isValidTransition(req.currentState, req.nextState)) {
    const errorMsg = `Invalid state machine transition from "${req.currentState}" to "${req.nextState}" via trigger "${req.trigger}".`;
    console.warn(`[OpenWay StateMachine] REJECTED: ${errorMsg}`, JSON.stringify(log));
    return {
      success: false,
      previousState: req.currentState,
      newState: req.currentState,
      error: errorMsg,
      log,
    };
  }

  // Structured transition logging (safe: no secrets, signed URLs, or raw bytes)
  console.info(`[OpenWay StateMachine] TRANSITION: ${req.currentState} -> ${req.nextState}`, JSON.stringify(log));

  return {
    success: true,
    previousState: req.currentState,
    newState: req.nextState,
    log,
  };
}
