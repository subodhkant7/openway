import { describe, it, expect, beforeEach } from "vitest";
import { RingWebhookHandler } from "@/ring/webhook";
import { RecheckService } from "@/workflow/recheckService";
import { AccessAssuranceOrchestrator } from "@/workflow/accessAssuranceOrchestrator";
import { SimulatorVisionAnalyzer } from "@/vision/SimulatorVisionAnalyzer";
import { resetGlobalStorage, getStorageProvider } from "@/persistence";
import { bootstrapStorage, DEMO_IDS } from "@/persistence/bootstrap";
import { transitionAssuranceState } from "@/workflow/stateMachine";

describe("Concurrency, Race Conditions & Optimistic Locking", () => {
  beforeEach(async () => {
    resetGlobalStorage();
    await bootstrapStorage();
    RingWebhookHandler.resetCache();
  });

  describe("Concurrent Webhook Attack (20 identical deliveries)", () => {
    it("processes exactly 1 webhook and treats 19 concurrent deliveries as idempotent duplicates", async () => {
      const payload = JSON.stringify({
        event_id: "evt_concurrent_storm_001",
        event_type: "motion",
        device_id: "cam_front_entrance",
        timestamp: new Date().toISOString(),
        components: ["camera"],
      });

      // Launch 20 concurrent webhook handler invocations
      const promises = Array.from({ length: 20 }).map(() =>
        Promise.resolve().then(() => RingWebhookHandler.processWebhook(payload, null))
      );

      const results = await Promise.all(promises);

      const acceptedCount = results.filter((r) => r.status === "accepted").length;
      const duplicateCount = results.filter((r) => r.status === "duplicate").length;

      // Invariant: Exactly one delivery is accepted, all 19 other deliveries are idempotent duplicates
      expect(acceptedCount).toBe(1);
      expect(duplicateCount).toBe(19);
    });
  });

  describe("Race Condition: Staff Complete vs New Obstruction Event", () => {
    it("aborts verification when a new obstruction event arrives while recheck is running", async () => {
      const storage = getStorageProvider();
      const entrance = await storage.entrances.findById(DEMO_IDS.ENTRANCE_ID);
      expect(entrance).not.toBeNull();

      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      // 1. Create an active remediation task and set state to RECHECKING
      const task = await storage.remediations.save({
        id: "task_race_01",
        entranceId: DEMO_IDS.ENTRANCE_ID,
        triggerAssessmentId: "init",
        status: "COMPLETED",
        reason: "Boxes cleared",
        createdAt: new Date(now - 120000).toISOString(),
        completedAt: new Date(now - 60000).toISOString(),
        completedBy: "Alex Staff",
      });

      await storage.assessments.save({
        id: "assess_rechecking_race",
        entranceId: DEMO_IDS.ENTRANCE_ID,
        state: "RECHECKING",
        reasonCode: "RECHECKING_AWAITING_EVIDENCE",
        reason: "Pending verification",
        evidenceIds: [],
        observationIds: [],
        policyVersion: "1.0.0",
        assessedAt: new Date(now - 55000).toISOString(),
      });

      // 2. Simulate a new obstruction event arriving concurrently (transitioning state to ACTION_REQUIRED)
      await storage.assessments.save({
        id: "assess_interrupted_by_new_event",
        entranceId: DEMO_IDS.ENTRANCE_ID,
        state: "ACTION_REQUIRED",
        reasonCode: "ACCESS_INTERRUPTED",
        reason: "New delivery boxes observed blocking entrance ramp.",
        evidenceIds: ["ev_new_obstruction"],
        observationIds: ["obs_new_obstruction"],
        policyVersion: "1.0.0",
        assessedAt: new Date(now + 1000).toISOString(),
      });

      // Also create the new active remediation task
      await storage.remediations.save({
        id: "task_race_new_active",
        entranceId: DEMO_IDS.ENTRANCE_ID,
        triggerAssessmentId: "assess_interrupted_by_new_event",
        status: "OPEN",
        reason: "Clear new delivery boxes",
        createdAt: new Date(now + 1000).toISOString(),
      });

      // 3. The stale recheck worker attempts to verify the old completed task
      const recheckService = new RecheckService();
      const result = await recheckService.startVerification(task.id, {
        visionAnalyzer: new SimulatorVisionAnalyzer("CLEAR"),
      });

      // Invariant: Stale verification MUST abort!
      // Must NEVER declare VERIFIED_RESTORED over an active interruption!
      expect(result.success).toBe(false);
      expect(result.finalState).not.toBe("VERIFIED_RESTORED");
      expect(result.gatekeeperResult?.allowed).toBe(false);
      expect(result.gatekeeperResult?.reasonCode).toBe("INVALID_STATE");

      // Verify DB assessment remains ACTION_REQUIRED
      const latestDbAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
      expect(latestDbAssessment?.state).toBe("ACTION_REQUIRED");
    });
  });

  describe("Race Condition: VERIFIED_RESTORED + New Obstruction Event", () => {
    it("transitions directly from VERIFIED_RESTORED to INTERRUPTED -> ACTION_REQUIRED when a new obstruction occurs", async () => {
      const storage = getStorageProvider();
      const now = Date.now();

      // 1. Entrance starts in VERIFIED_RESTORED state
      await new Promise((r) => setTimeout(r, 20));
      await storage.assessments.save({
        id: "assess_verified_01",
        entranceId: DEMO_IDS.ENTRANCE_ID,
        state: "VERIFIED_RESTORED",
        reasonCode: "VERIFIED_RESTORED",
        reason: "Ramp verified clear.",
        evidenceIds: ["ev_clear_01"],
        observationIds: ["obs_clear_01"],
        policyVersion: "1.0.0",
        assessedAt: new Date().toISOString(),
      });

      await new Promise((r) => setTimeout(r, 20));

      // 2. Incoming Ring motion event triggers obstruction orchestrator
      const orchestrator = new AccessAssuranceOrchestrator(storage);
      const result = await orchestrator.processRingEvent(
        {
          provider: "ring_api",
          eventCategory: "official_ring",
          eventId: `evt_obstruction_${Date.now()}`,
          eventType: "motion",
          deviceId: DEMO_IDS.CAMERA_DEVICE_ID,
          timestamp: new Date().toISOString(),
          componentIds: [DEMO_IDS.CAMERA_COMPONENT_ID],
          source: "test",
          receivedAt: new Date().toISOString(),
          summary: "Motion detected on front ramp",
        },
        {
          visionAnalyzer: new SimulatorVisionAnalyzer("BLOCKED"),
        }
      );

      // Invariant: State machine must successfully transition from VERIFIED_RESTORED to ACTION_REQUIRED
      expect(result.pipelineResult?.stateTransitioned).toBe(true);
      expect(result.pipelineResult?.previousState).toBe("VERIFIED_RESTORED");
      expect(result.pipelineResult?.resultingState).toBe("ACTION_REQUIRED");

      // Verify a new task was dispatched
      expect(result.taskCreated).toBeDefined();
      expect(result.taskCreated?.status).toBe("OPEN");

      // Verify latest assessment in storage is ACTION_REQUIRED
      const latest = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
      expect(latest?.state).toBe("ACTION_REQUIRED");
    });
  });
});
