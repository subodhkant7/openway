import { describe, it, expect } from "vitest";
import {
  Evidence,
  AccessibilityObservation,
  evaluateEvidenceFreshness,
  aggregateObservations,
} from "@/evidence";
import { Entrance } from "@/domain/types";

describe("Evidence Model & Freshness Evaluation", () => {
  const baseEntrance: Entrance = {
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

  it("evaluates fresh evidence as FRESH within configurable max age", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const capturedAt = new Date("2026-10-05T11:59:00Z").toISOString(); // 60s ago

    const evidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance"> = {
      capturedAt,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
    };

    const freshness = evaluateEvidenceFreshness(evidence, { defaultMaxAgeSeconds: 120 }, now);
    expect(freshness).toBe("FRESH");
  });

  it("evaluates old evidence as STALE when exceeding max age threshold", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const capturedAt = new Date("2026-10-05T11:50:00Z").toISOString(); // 10 mins ago

    const evidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance"> = {
      capturedAt,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
    };

    const freshness = evaluateEvidenceFreshness(evidence, { defaultMaxAgeSeconds: 180 }, now);
    expect(freshness).toBe("STALE");
  });

  it("rejects evidence with future timestamps beyond clock drift tolerance as INVALID", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const capturedAt = new Date("2026-10-05T12:05:00Z").toISOString(); // 5 mins in future

    const evidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance"> = {
      capturedAt,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
    };

    const freshness = evaluateEvidenceFreshness(evidence, { futureToleranceSeconds: 15 }, now);
    expect(freshness).toBe("INVALID");
  });

  it("returns INVALID for malformed timestamps and UNKNOWN for missing timestamps", () => {
    expect(
      evaluateEvidenceFreshness({ capturedAt: "invalid-date", evidenceType: "IMAGE", provenance: "OFFICIAL_RING" })
    ).toBe("INVALID");

    expect(
      evaluateEvidenceFreshness({ capturedAt: "", evidenceType: "IMAGE", provenance: "OFFICIAL_RING" })
    ).toBe("UNKNOWN");
  });

  it("applies type-specific and provenance-specific freshness thresholds", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const capturedAt = new Date("2026-10-05T11:58:30Z").toISOString(); // 90s ago

    // For EVENT type (default max age 60s), 90s is STALE
    const eventEvidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance"> = {
      capturedAt,
      evidenceType: "EVENT",
      provenance: "OFFICIAL_RING",
    };
    expect(evaluateEvidenceFreshness(eventEvidence, {}, now)).toBe("STALE");

    // For IMAGE type (default max age 180s), 90s is FRESH
    const imageEvidence: Pick<Evidence, "capturedAt" | "evidenceType" | "provenance"> = {
      capturedAt,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
    };
    expect(evaluateEvidenceFreshness(imageEvidence, {}, now)).toBe("FRESH");
  });
});

describe("Observation Aggregation Logic", () => {
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
  const freshTime = new Date("2026-10-05T11:59:30Z").toISOString();

  it("Case A: Satisfied when all requirements met by fresh evidence", () => {
    const evidence: Evidence = {
      id: "ev_01",
      venueId: entrance.venueId,
      entranceId: entrance.id,
      provider: "RING",
      deviceId: "cam_front",
      componentId: "comp_vid",
      capturedAt: freshTime,
      receivedAt: freshTime,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
      isSimulated: false,
      freshness: "FRESH",
      createdAt: freshTime,
    };

    const observation: AccessibilityObservation = {
      id: "obs_01",
      evidenceId: evidence.id,
      entranceId: entrance.id,
      pathwayClear: "TRUE",
      obstructionPresent: "FALSE",
      doorReady: "TRUE",
      confidence: 0.95,
      observedAt: freshTime,
      analyzer: "test-v1",
      analyzerVersion: "1.0",
      explanation: "Clear ramp",
    };

    const result = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations: [observation],
      now,
    });

    expect(result.outcome).toBe("SATISFIED");
    expect(result.reasonCode).toBe("REQUIREMENTS_SATISFIED");
    expect(result.contradictionDetected).toBe(false);
  });

  it("Case B: Interrupted when fresh observation indicates obstruction", () => {
    const evidence: Evidence = {
      id: "ev_02",
      venueId: entrance.venueId,
      entranceId: entrance.id,
      provider: "RING",
      deviceId: "cam_front",
      componentId: "comp_vid",
      capturedAt: freshTime,
      receivedAt: freshTime,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
      isSimulated: false,
      freshness: "FRESH",
      createdAt: freshTime,
    };

    const observation: AccessibilityObservation = {
      id: "obs_02",
      evidenceId: evidence.id,
      entranceId: entrance.id,
      pathwayClear: "FALSE",
      obstructionPresent: "TRUE",
      doorReady: "TRUE",
      confidence: 0.92,
      observedAt: freshTime,
      analyzer: "test-v1",
      analyzerVersion: "1.0",
      explanation: "Pallet left on ramp",
    };

    const result = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations: [observation],
      now,
    });

    expect(result.outcome).toBe("INTERRUPTED");
    expect(result.reasonCode).toBe("ACCESS_INTERRUPTED");
  });

  it("Case C: Unknown when evidence is stale", () => {
    const staleTime = new Date("2026-10-05T11:40:00Z").toISOString(); // 20m ago

    const evidence: Evidence = {
      id: "ev_03",
      venueId: entrance.venueId,
      entranceId: entrance.id,
      provider: "RING",
      deviceId: "cam_front",
      componentId: "comp_vid",
      capturedAt: staleTime,
      receivedAt: freshTime,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
      isSimulated: false,
      freshness: "STALE",
      createdAt: freshTime,
    };

    const observation: AccessibilityObservation = {
      id: "obs_03",
      evidenceId: evidence.id,
      entranceId: entrance.id,
      pathwayClear: "TRUE",
      obstructionPresent: "FALSE",
      doorReady: "TRUE",
      confidence: 0.95,
      observedAt: freshTime,
      analyzer: "test-v1",
      analyzerVersion: "1.0",
      explanation: "Old clear snapshot",
    };

    const result = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations: [observation],
      now,
    });

    expect(result.outcome).toBe("UNKNOWN");
    expect(result.reasonCode).toBe("STALE_EVIDENCE");
  });

  it("Case D: Unknown when contradictory observations exist for the same window", () => {
    const evidence: Evidence = {
      id: "ev_04",
      venueId: entrance.venueId,
      entranceId: entrance.id,
      provider: "RING",
      deviceId: "cam_front",
      componentId: "comp_vid",
      capturedAt: freshTime,
      receivedAt: freshTime,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
      isSimulated: false,
      freshness: "FRESH",
      createdAt: freshTime,
    };

    const obsClear: AccessibilityObservation = {
      id: "obs_04a",
      evidenceId: evidence.id,
      entranceId: entrance.id,
      pathwayClear: "TRUE",
      obstructionPresent: "FALSE",
      doorReady: "TRUE",
      confidence: 0.85,
      observedAt: freshTime,
      analyzer: "analyzer-a",
      analyzerVersion: "1.0",
      explanation: "Clear",
    };

    const obsBlocked: AccessibilityObservation = {
      id: "obs_04b",
      evidenceId: evidence.id,
      entranceId: entrance.id,
      pathwayClear: "FALSE",
      obstructionPresent: "TRUE",
      doorReady: "TRUE",
      confidence: 0.87,
      observedAt: freshTime,
      analyzer: "analyzer-b",
      analyzerVersion: "1.0",
      explanation: "Blocked",
    };

    const result = aggregateObservations({
      entrance,
      evidenceList: [evidence],
      observations: [obsClear, obsBlocked],
      now,
    });

    expect(result.outcome).toBe("UNKNOWN");
    expect(result.reasonCode).toBe("CONTRADICTORY_OBSERVATIONS");
    expect(result.contradictionDetected).toBe(true);
  });

  it("Rejects evidence that does not match the entrance camera binding", () => {
    const mismatchedEvidence: Evidence = {
      id: "ev_wrong_cam",
      venueId: entrance.venueId,
      entranceId: entrance.id,
      provider: "RING",
      deviceId: "cam_other_door", // Wrong device!
      componentId: "comp_vid",
      capturedAt: freshTime,
      receivedAt: freshTime,
      evidenceType: "IMAGE",
      provenance: "OFFICIAL_RING",
      isSimulated: false,
      freshness: "FRESH",
      createdAt: freshTime,
    };

    const result = aggregateObservations({
      entrance,
      evidenceList: [mismatchedEvidence],
      observations: [],
      now,
    });

    expect(result.outcome).toBe("UNKNOWN");
    expect(result.reasonCode).toBe("NO_MATCHING_EVIDENCE");
  });
});
