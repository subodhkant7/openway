import { describe, it, expect, vi } from "vitest";
import {
  transitionAssuranceState,
  isValidTransition,
  VALID_TRANSITIONS,
} from "@/workflow/stateMachine";

describe("Assurance State Machine Transitions", () => {
  const entranceId = "entrance_01";
  const correlationId = "corr_test_01";

  it("permits standard valid transition sequence: AVAILABLE -> INTERRUPTED -> ACTION_REQUIRED -> RECHECKING -> VERIFIED_RESTORED -> AVAILABLE", () => {
    // 1. AVAILABLE -> INTERRUPTED
    const t1 = transitionAssuranceState({
      entranceId,
      currentState: "AVAILABLE",
      nextState: "INTERRUPTED",
      trigger: "OBSTRUCTION_DETECTED",
      correlationId,
      reason: "Box on ramp",
    });
    expect(t1.success).toBe(true);
    expect(t1.newState).toBe("INTERRUPTED");

    // 2. INTERRUPTED -> ACTION_REQUIRED
    const t2 = transitionAssuranceState({
      entranceId,
      currentState: "INTERRUPTED",
      nextState: "ACTION_REQUIRED",
      trigger: "TASK_CREATED",
      correlationId,
      reason: "Remediation task dispatched to staff",
    });
    expect(t2.success).toBe(true);
    expect(t2.newState).toBe("ACTION_REQUIRED");

    // 3. ACTION_REQUIRED -> RECHECKING
    const t3 = transitionAssuranceState({
      entranceId,
      currentState: "ACTION_REQUIRED",
      nextState: "RECHECKING",
      trigger: "STAFF_COMPLETED_TASK",
      correlationId,
      reason: "Staff reported physical clearance",
    });
    expect(t3.success).toBe(true);
    expect(t3.newState).toBe("RECHECKING");

    // 4. RECHECKING -> VERIFIED_RESTORED
    const t4 = transitionAssuranceState({
      entranceId,
      currentState: "RECHECKING",
      nextState: "VERIFIED_RESTORED",
      trigger: "FRESH_EVIDENCE_VERIFIED",
      correlationId,
      reason: "Fresh post-remediation camera snapshot proves clearance",
    });
    expect(t4.success).toBe(true);
    expect(t4.newState).toBe("VERIFIED_RESTORED");

    // 5. VERIFIED_RESTORED -> AVAILABLE
    const t5 = transitionAssuranceState({
      entranceId,
      currentState: "VERIFIED_RESTORED",
      nextState: "AVAILABLE",
      trigger: "NORMAL_CYCLE",
      correlationId,
    });
    expect(t5.success).toBe(true);
    expect(t5.newState).toBe("AVAILABLE");
  });

  it("permits RECHECKING -> UNKNOWN on stale or contradictory evidence", () => {
    const t = transitionAssuranceState({
      entranceId,
      currentState: "RECHECKING",
      nextState: "UNKNOWN",
      trigger: "STALE_EVIDENCE",
      correlationId,
    });
    expect(t.success).toBe(true);
    expect(t.newState).toBe("UNKNOWN");
  });

  it("permits RECHECKING -> ACTION_REQUIRED when recheck finds active obstruction", () => {
    const t = transitionAssuranceState({
      entranceId,
      currentState: "RECHECKING",
      nextState: "ACTION_REQUIRED",
      trigger: "OBSTRUCTION_STILL_PRESENT",
      correlationId,
    });
    expect(t.success).toBe(true);
    expect(t.newState).toBe("ACTION_REQUIRED");
  });

  it("REJECTS direct jump from AVAILABLE to VERIFIED_RESTORED", () => {
    const t = transitionAssuranceState({
      entranceId,
      currentState: "AVAILABLE",
      nextState: "VERIFIED_RESTORED",
      trigger: "INVALID_JUMP",
      correlationId,
    });
    expect(t.success).toBe(false);
    expect(t.newState).toBe("AVAILABLE");
    expect(t.error).toMatch(/Invalid state machine transition/);
  });

  it("REJECTS direct jump from INTERRUPTED to VERIFIED_RESTORED", () => {
    const t = transitionAssuranceState({
      entranceId,
      currentState: "INTERRUPTED",
      nextState: "VERIFIED_RESTORED",
      trigger: "INVALID_BYPASS",
      correlationId,
    });
    expect(t.success).toBe(false);
    expect(t.newState).toBe("INTERRUPTED");
  });

  it("REJECTS direct jump from ACTION_REQUIRED to VERIFIED_RESTORED without RECHECKING", () => {
    // Invariant: Staff completing a task must enter RECHECKING, NEVER directly VERIFIED_RESTORED
    const t = transitionAssuranceState({
      entranceId,
      currentState: "ACTION_REQUIRED",
      nextState: "VERIFIED_RESTORED",
      trigger: "STAFF_CLICKED_FIXED",
      correlationId,
    });
    expect(t.success).toBe(false);
    expect(t.newState).toBe("ACTION_REQUIRED");
    expect(isValidTransition("ACTION_REQUIRED", "VERIFIED_RESTORED")).toBe(false);
  });

  it("emits structured transition logs with correlationId and without secrets", () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    transitionAssuranceState({
      entranceId: "entrance_01",
      currentState: "AVAILABLE",
      nextState: "INTERRUPTED",
      trigger: "CAMERA_OBSTRUCTION",
      correlationId: "corr_audit_123",
      evidenceIds: ["ev_1"],
      reason: "Obstruction verified",
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedStr = consoleSpy.mock.calls[0][1];
    const parsed = JSON.parse(loggedStr);

    expect(parsed.correlationId).toBe("corr_audit_123");
    expect(parsed.previousState).toBe("AVAILABLE");
    expect(parsed.nextState).toBe("INTERRUPTED");
    expect(parsed.evidenceIds).toEqual(["ev_1"]);
    expect(parsed.token).toBeUndefined();

    consoleSpy.mockRestore();
  });
});
