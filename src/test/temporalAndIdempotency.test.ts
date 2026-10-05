import { describe, it, expect, beforeEach } from "vitest";
import { canDeclareRestored } from "@/policy/restorationGatekeeper";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { Entrance, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { RingWebhookHandler } from "@/ring/webhook";

describe("Temporal Consistency & Idempotency Invariants", () => {
  const entrance: Entrance = {
    id: "entrance_temporal_01",
    venueId: "venue_01",
    name: "North Accessible Ramp",
    description: "Ramp",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_north",
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

  beforeEach(() => {
    RingWebhookHandler.resetCache();
  });

  describe("Temporal Consistency", () => {
    it("strictly rejects verification when evidence timestamp is in the future beyond tolerance", () => {
      const now = new Date("2026-10-05T12:00:00Z");
      const remediation: RemediationTask = {
        id: "task_t1",
        entranceId: entrance.id,
        triggerAssessmentId: "a1",
        status: "COMPLETED",
        reason: "Clear ramp",
        createdAt: "2026-10-05T11:50:00Z",
        completedAt: "2026-10-05T11:55:00Z",
      };

      // Captured 10 minutes in the future!
      const futureEvidence: Evidence = {
        id: "ev_future",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_north",
        componentId: "comp_vid",
        capturedAt: "2026-10-05T12:10:00Z",
        receivedAt: "2026-10-05T12:00:00Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "INVALID",
        createdAt: "2026-10-05T12:00:00Z",
      };

      const obs: AccessibilityObservation = {
        id: "obs_f",
        evidenceId: futureEvidence.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: "2026-10-05T12:10:00Z",
        analyzer: "test",
        analyzerVersion: "1.0",
        explanation: "Clear",
      };

      const result = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: remediation,
        evidence: futureEvidence,
        observations: [obs],
        now,
      });

      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("INVALID_EVIDENCE");
    });

    it("evaluates freshness based on capturedAt, not merely receivedAt", () => {
      const now = new Date("2026-10-05T12:00:00Z");
      const remediation: RemediationTask = {
        id: "task_t2",
        entranceId: entrance.id,
        triggerAssessmentId: "a2",
        status: "COMPLETED",
        reason: "Clear ramp",
        createdAt: "2026-10-05T11:30:00Z",
        completedAt: "2026-10-05T11:35:00Z",
      };

      // Captured 20 mins ago (stale), but receivedAt is just now!
      const delayedEvidence: Evidence = {
        id: "ev_delayed",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_north",
        componentId: "comp_vid",
        capturedAt: "2026-10-05T11:40:00Z", // Stale capture
        receivedAt: "2026-10-05T12:00:00Z", // Recent ingestion
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "STALE",
        createdAt: "2026-10-05T12:00:00Z",
      };

      const obs: AccessibilityObservation = {
        id: "obs_del",
        evidenceId: delayedEvidence.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: "2026-10-05T12:00:00Z",
        analyzer: "test",
        analyzerVersion: "1.0",
        explanation: "Clear",
      };

      const result = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: remediation,
        evidence: delayedEvidence,
        observations: [obs],
        now,
        freshnessConfig: { defaultMaxAgeSeconds: 180 },
      });

      // Must be rejected as STALE despite recent receivedAt
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe("STALE_EVIDENCE");
    });
  });

  describe("Idempotency Invariants", () => {
    it("handles duplicate self-transitions idempotently in state machine", () => {
      const res1 = transitionAssuranceState({
        entranceId: entrance.id,
        currentState: "AVAILABLE",
        nextState: "AVAILABLE",
        trigger: "HEARTBEAT_POLL",
        correlationId: "corr_idem_1",
      });
      expect(res1.success).toBe(true);
      expect(res1.newState).toBe("AVAILABLE");

      const res2 = transitionAssuranceState({
        entranceId: entrance.id,
        currentState: "INTERRUPTED",
        nextState: "INTERRUPTED",
        trigger: "CONSECUTIVE_OBSTRUCTION_EVENT",
        correlationId: "corr_idem_2",
      });
      expect(res2.success).toBe(true);
      expect(res2.newState).toBe("INTERRUPTED");
    });

    it("idempotently handles duplicate webhook deliveries using request_id", () => {
      const webhookPayload = JSON.stringify({
        meta: {
          version: "1.1",
          request_id: "req_idem_12345",
          time: "2026-10-05T12:00:00Z",
        },
        data: {
          id: "ev_data_123",
          type: "motion",
          time: "2026-10-05T12:00:00Z",
          device: {
            id: "cam_north",
            description: "North camera",
          },
        },
      });

      const firstResult = RingWebhookHandler.processWebhook(
        webhookPayload,
        undefined
      );
      expect(firstResult.status).toBe("accepted");

      const secondResult = RingWebhookHandler.processWebhook(
        webhookPayload,
        undefined
      );
      expect(secondResult.status).toBe("duplicate");
    });
  });
});
