import { describe, it, expect } from "vitest";
import { canDeclareRestored } from "@/policy/restorationGatekeeper";
import { Entrance, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";

describe("Restoration Gatekeeper & Property Invariants", () => {
  const entrance: Entrance = {
    id: "entrance_01",
    venueId: "venue_01",
    name: "Main Ramp",
    description: "Ramp",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_front",
      componentId: "comp_vid",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const now = new Date("2026-10-05T12:00:00Z");
  const remediationCompletedAt = new Date("2026-10-05T11:59:00Z").toISOString();
  const evidenceCapturedAt = new Date("2026-10-05T11:59:30Z").toISOString(); // 30s after remediation

  const completedRemediation: RemediationTask = {
    id: "task_01",
    entranceId: entrance.id,
    triggerAssessmentId: "assess_01",
    status: "COMPLETED",
    reason: "Clear ramp",
    createdAt: new Date("2026-10-05T11:50:00Z").toISOString(),
    completedAt: remediationCompletedAt,
    completedBy: "Alex Staff",
  };

  const freshClearEvidence: Evidence = {
    id: "ev_fresh_01",
    venueId: entrance.venueId,
    entranceId: entrance.id,
    provider: "RING",
    deviceId: "cam_front",
    componentId: "comp_vid",
    capturedAt: evidenceCapturedAt,
    receivedAt: evidenceCapturedAt,
    evidenceType: "IMAGE",
    provenance: "OFFICIAL_RING",
    isSimulated: false,
    freshness: "FRESH",
    createdAt: evidenceCapturedAt,
  };

  const validObservations: AccessibilityObservation[] = [
    {
      id: "obs_01",
      evidenceId: freshClearEvidence.id,
      entranceId: entrance.id,
      pathwayClear: "TRUE",
      obstructionPresent: "FALSE",
      doorReady: "TRUE",
      confidence: 0.98,
      observedAt: evidenceCapturedAt,
      analyzer: "openway-test",
      analyzerVersion: "1.0",
      explanation: "Ramp is completely clear",
    },
  ];

  it("PASSES all 9 conditions when fresh post-remediation evidence matches entrance camera", () => {
    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: freshClearEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBe("GATE_PASSED");
    expect(result.evaluatedFreshness).toBe("FRESH");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 1: Current State must be RECHECKING
  // -------------------------------------------------------------------------
  it("REJECTS restoration if currentState is not RECHECKING", () => {
    const result = canDeclareRestored({
      currentState: "AVAILABLE",
      entrance,
      remediationTask: completedRemediation,
      evidence: freshClearEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_STATE");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 2: Remediation must exist and be COMPLETED
  // -------------------------------------------------------------------------
  it("REJECTS restoration when remediation task is missing", () => {
    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: null,
      evidence: freshClearEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("NO_REMEDIATION");
  });

  it("REJECTS restoration when remediation task is still OPEN", () => {
    const openTask: RemediationTask = {
      ...completedRemediation,
      status: "OPEN",
      completedAt: undefined,
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: openTask,
      evidence: freshClearEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("REMEDIATION_INCOMPLETE");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 3: Temporal Consistency: Evidence must be captured AFTER remediation
  // -------------------------------------------------------------------------
  it("REJECTS restoration when evidence was captured BEFORE remediation was completed", () => {
    // Evidence captured at 11:58, but remediation was reported at 11:59
    const preRemediationEvidence: Evidence = {
      ...freshClearEvidence,
      capturedAt: new Date("2026-10-05T11:58:00Z").toISOString(),
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: preRemediationEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("TEMPORAL_INCONSISTENCY");
    expect(result.explanation).toMatch(/BEFORE remediation was completed/);
  });

  // -------------------------------------------------------------------------
  // INVARIANT 4 & 5: Camera Binding Match (entrance, device, component)
  // -------------------------------------------------------------------------
  it("REJECTS restoration when evidence device does not match entrance camera binding", () => {
    const wrongDeviceEvidence: Evidence = {
      ...freshClearEvidence,
      deviceId: "cam_back_gate", // Unbound device!
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: wrongDeviceEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("WRONG_CAMERA_DEVICE");
  });

  it("REJECTS restoration when evidence component does not match camera binding", () => {
    const wrongComponentEvidence: Evidence = {
      ...freshClearEvidence,
      componentId: "comp_other",
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: wrongComponentEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("WRONG_CAMERA_COMPONENT");
  });

  it("REJECTS restoration when evidence belongs to a different entrance", () => {
    const wrongEntranceEvidence: Evidence = {
      ...freshClearEvidence,
      entranceId: "entrance_other_99",
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: wrongEntranceEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("WRONG_ENTRANCE");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 6: Evidence must be FRESH
  // -------------------------------------------------------------------------
  it("REJECTS restoration when verification evidence is STALE (> max age)", () => {
    const staleEvidence: Evidence = {
      ...freshClearEvidence,
      // 10 minutes ago
      capturedAt: new Date("2026-10-05T11:49:00Z").toISOString(),
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: {
        ...completedRemediation,
        completedAt: new Date("2026-10-05T11:48:00Z").toISOString(),
      },
      evidence: staleEvidence,
      observations: validObservations,
      now,
      freshnessConfig: { defaultMaxAgeSeconds: 180 },
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("STALE_EVIDENCE");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 7: Requirements must be satisfied
  // -------------------------------------------------------------------------
  it("REJECTS restoration when observation still shows obstruction present", () => {
    const stillBlockedObs: AccessibilityObservation[] = [
      {
        ...validObservations[0],
        obstructionPresent: "TRUE",
        pathwayClear: "FALSE",
      },
    ];

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: freshClearEvidence,
      observations: stillBlockedObs,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("REQUIREMENTS_NOT_MET");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 8: Contradictory observations produce rejection
  // -------------------------------------------------------------------------
  it("REJECTS restoration when contradictory observations exist in verification window", () => {
    const contradictoryObs: AccessibilityObservation = {
      ...validObservations[0],
      id: "obs_contra",
      obstructionPresent: "TRUE", // Contradicts obs_01!
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: freshClearEvidence,
      observations: validObservations,
      allRecentObservations: [contradictoryObs],
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("CONTRADICTORY_EVIDENCE");
  });

  // -------------------------------------------------------------------------
  // INVARIANT 9: Provenance Honesty
  // -------------------------------------------------------------------------
  it("REJECTS restoration if simulated evidence falsely claims OFFICIAL_RING provenance", () => {
    const deceptiveEvidence: Evidence = {
      ...freshClearEvidence,
      isSimulated: true,
      provenance: "OFFICIAL_RING", // Invalid/dishonest combination!
    };

    const result = canDeclareRestored({
      currentState: "RECHECKING",
      entrance,
      remediationTask: completedRemediation,
      evidence: deceptiveEvidence,
      observations: validObservations,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_PROVENANCE");
  });
});
