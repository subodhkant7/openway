import { describe, it, expect } from "vitest";
import { classifyEvidenceTemporality } from "@/evidence/temporalClassification";
import { verifyPostRemediationEvidence } from "@/policy/postRemediationVerifier";
import { Entrance, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";

describe("Evidence Temporal Semantics & Verification Invariants (Phase 5)", () => {
  const baseEntrance: Entrance = {
    id: "entrance_main",
    venueId: "venue_alpha",
    name: "Main Accessible Entrance",
    description: "Main accessible entrance",
    enabled: true,
    cameraBinding: {
      deviceId: "device_cam_01",
      componentId: "camera",
      deviceName: "Front Door Cam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: "2026-10-06T10:00:00.000Z",
    updatedAt: "2026-10-06T10:00:00.000Z",
  };

  const completedTask: RemediationTask = {
    id: "task_remed_101",
    entranceId: "entrance_main",
    triggerAssessmentId: "assess_prev",
    status: "COMPLETED",
    reason: "Clear pathway",
    createdAt: "2026-10-06T10:10:00.000Z",
    completedAt: "2026-10-06T10:15:00.000Z",
    completedBy: "Staff Alex",
  };

  const createObservation = (evidenceId: string): AccessibilityObservation => ({
    id: `obs_${evidenceId}`,
    evidenceId,
    entranceId: "entrance_main",
    pathwayClear: "TRUE",
    obstructionPresent: "FALSE",
    doorReady: "TRUE",
    confidence: 0.98,
    observedAt: "2026-10-06T10:16:00.000Z",
    analyzer: "bedrock-claude-3-5-sonnet",
    analyzerVersion: "1.0.0",
    explanation: "Pathway is completely unobstructed and door is ready.",
  });

  describe("classifyEvidenceTemporality", () => {
    it("classifies evidence captured before completion as PRE_REMEDIATION", () => {
      const classification = classifyEvidenceTemporality(
        {
          capturedAt: "2026-10-06T10:14:59.000Z",
          receivedAt: "2026-10-06T10:16:00.000Z",
        },
        {
          remediationCompletedAt: "2026-10-06T10:15:00.000Z",
          now: "2026-10-06T10:16:30.000Z",
        }
      );
      expect(classification).toBe("PRE_REMEDIATION");
    });

    it("classifies evidence captured at or after completion as POST_REMEDIATION", () => {
      const classification = classifyEvidenceTemporality(
        {
          capturedAt: "2026-10-06T10:15:00.000Z",
          receivedAt: "2026-10-06T10:16:00.000Z",
        },
        {
          remediationCompletedAt: "2026-10-06T10:15:00.000Z",
          now: "2026-10-06T10:16:30.000Z",
        }
      );
      expect(classification).toBe("POST_REMEDIATION");
    });

    it("classifies missing or unestablished capturedAt as TEMPORALLY_UNVERIFIED", () => {
      const classificationEmpty = classifyEvidenceTemporality(
        { capturedAt: "", receivedAt: "2026-10-06T10:16:00.000Z" },
        { remediationCompletedAt: "2026-10-06T10:15:00.000Z" }
      );
      expect(classificationEmpty).toBe("TEMPORALLY_UNVERIFIED");

      const classificationUndefined = classifyEvidenceTemporality(
        { capturedAt: undefined, receivedAt: "2026-10-06T10:16:00.000Z" },
        { remediationCompletedAt: "2026-10-06T10:15:00.000Z" }
      );
      expect(classificationUndefined).toBe("TEMPORALLY_UNVERIFIED");
    });

    it("classifies evidence older than maxAgeSeconds as STALE", () => {
      const classification = classifyEvidenceTemporality(
        {
          capturedAt: "2026-10-06T10:00:00.000Z",
          receivedAt: "2026-10-06T10:16:00.000Z",
        },
        {
          remediationCompletedAt: "2026-10-06T10:15:00.000Z",
          now: "2026-10-06T10:16:00.000Z",
          maxAgeSeconds: 180, // 3 minutes
        }
      );
      expect(classification).toBe("STALE");
    });

    it("classifies future timestamps as INVALID", () => {
      const classification = classifyEvidenceTemporality(
        {
          capturedAt: "2026-10-06T11:00:00.000Z",
          receivedAt: "2026-10-06T10:16:00.000Z",
        },
        {
          remediationCompletedAt: "2026-10-06T10:15:00.000Z",
          now: "2026-10-06T10:16:00.000Z",
        }
      );
      expect(classification).toBe("INVALID");
    });
  });

  describe("verifyPostRemediationEvidence", () => {
    it("strictly rejects evidence captured before completion even if received after completion", () => {
      // 10:10 obstruction detected -> 10:15 completed -> 10:14 captured -> 10:20 received
      const evidence: Evidence = {
        id: "ev_pre_remediation",
        venueId: "venue_alpha",
        entranceId: "entrance_main",
        provider: "RING",
        deviceId: "device_cam_01",
        componentId: "camera",
        capturedAt: "2026-10-06T10:14:30.000Z", // BEFORE 10:15:00 completedAt!
        receivedAt: "2026-10-06T10:20:00.000Z", // AFTER 10:15:00 completedAt
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:20:00.000Z",
      };

      const result = verifyPostRemediationEvidence({
        entrance: baseEntrance,
        remediationTask: completedTask,
        evidence,
        observation: createObservation(evidence.id),
        now: "2026-10-06T10:20:10.000Z",
        freshnessConfig: { defaultMaxAgeSeconds: 600 },
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("UNKNOWN");
      expect(result.reasonCode).toBe("TEMPORAL_INCONSISTENCY");
      expect(result.classification).toBe("PRE_REMEDIATION");
    });

    it("accepts evidence captured at or after completion", () => {
      const evidence: Evidence = {
        id: "ev_post_remediation",
        venueId: "venue_alpha",
        entranceId: "entrance_main",
        provider: "RING",
        deviceId: "device_cam_01",
        componentId: "camera",
        capturedAt: "2026-10-06T10:15:05.000Z", // AFTER completedAt (10:15:00)
        receivedAt: "2026-10-06T10:15:10.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:15:10.000Z",
      };

      const result = verifyPostRemediationEvidence({
        entrance: baseEntrance,
        remediationTask: completedTask,
        evidence,
        observation: createObservation(evidence.id),
        now: "2026-10-06T10:15:30.000Z",
      });

      expect(result.verified).toBe(true);
      expect(result.outcome).toBe("VERIFIED_RESTORED");
      expect(result.reasonCode).toBe("GATE_PASSED");
      expect(result.classification).toBe("POST_REMEDIATION");
    });

    it("strictly returns UNKNOWN if evidence capture timestamp is missing", () => {
      const evidence: Evidence = {
        id: "ev_missing_capture_ts",
        venueId: "venue_alpha",
        entranceId: "entrance_main",
        provider: "RING",
        deviceId: "device_cam_01",
        componentId: "camera",
        capturedAt: undefined, // Provider omitted capture timestamp!
        receivedAt: "2026-10-06T10:16:00.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "UNKNOWN",
        createdAt: "2026-10-06T10:16:00.000Z",
      };

      const result = verifyPostRemediationEvidence({
        entrance: baseEntrance,
        remediationTask: completedTask,
        evidence,
        observation: createObservation(evidence.id),
        now: "2026-10-06T10:16:30.000Z",
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("UNKNOWN");
      expect(result.reasonCode).toBe("TEMPORALLY_UNVERIFIED");
      expect(result.classification).toBe("TEMPORALLY_UNVERIFIED");
    });

    it("never assumes requestAt > completedAt proves capturedAt > completedAt", () => {
      // System made request at 10:16, Ring returned cached image from 10:12
      const evidence: Evidence = {
        id: "ev_cached_ring_image",
        venueId: "venue_alpha",
        entranceId: "entrance_main",
        provider: "RING",
        deviceId: "device_cam_01",
        componentId: "camera",
        capturedAt: "2026-10-06T10:12:00.000Z", // Cached frame!
        receivedAt: "2026-10-06T10:16:05.000Z", // Returned at 10:16
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:16:05.000Z",
      };

      const result = verifyPostRemediationEvidence({
        entrance: baseEntrance,
        remediationTask: completedTask, // completed at 10:15:00
        evidence,
        observation: createObservation(evidence.id),
        now: "2026-10-06T10:16:30.000Z",
        freshnessConfig: { defaultMaxAgeSeconds: 600 },
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("UNKNOWN");
      expect(result.reasonCode).toBe("TEMPORAL_INCONSISTENCY");
    });
  });
});
