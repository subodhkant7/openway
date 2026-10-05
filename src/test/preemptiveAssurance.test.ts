import { describe, it, expect, beforeEach } from "vitest";
import { AccessAssuranceOrchestrator } from "../workflow/accessAssuranceOrchestrator";
import { RecheckService } from "../workflow/recheckService";
import { EventReconciliationService } from "../workflow/eventReconciliation";
import { SimulatorVisionAnalyzer } from "../vision/SimulatorVisionAnalyzer";
import { BedrockVisionAnalyzer } from "../vision/BedrockVisionAnalyzer";
import { resetGlobalStorage, getStorageProvider } from "../persistence";
import { Entrance, Venue } from "../domain/types";
import { RingEvent } from "../ring/types";
import { RingProvider } from "../ring";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

function createMockBedrockClient(input: any): BedrockRuntimeClient {
  return {
    send: async () => ({
      output: {
        message: {
          content: [
            {
              toolUse: {
                name: "record_accessibility_observation",
                input,
              },
            },
          ],
        },
      },
    }),
  } as unknown as BedrockRuntimeClient;
}

describe("Proactive Event-Driven Assurance & Remediation Workflow", () => {
  let orchestrator: AccessAssuranceOrchestrator;
  let recheckService: RecheckService;
  let reconciliationService: EventReconciliationService;
  const storage = getStorageProvider();

  const venue: Venue = {
    id: "venue_city_library",
    name: "Central Public Library",
    timezone: "America/New_York",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const entrance: Entrance = {
    id: "entrance_west_ramp",
    venueId: venue.id,
    name: "West Accessible Ramp",
    description: "ADA-accessible step-free ramp entrance",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_ring_library_01",
      componentId: "main_sensor",
      deviceName: "West Ramp Ring Camera",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    resetGlobalStorage();
    orchestrator = AccessAssuranceOrchestrator.getInstance();
    orchestrator.resetCache();
    recheckService = new RecheckService(storage);
    reconciliationService = new EventReconciliationService(storage, orchestrator);

    await storage.venues.save(venue);
    await storage.entrances.save(entrance);
  });

  describe("Canonical Preemptive Detection & Verification Lifecycle", () => {
    it("preemptiveDetectionToVerifiedRestoration: complete end-to-end assurance lifecycle", async () => {
      // 1. Initial State: AVAILABLE
      const initialAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      expect(initialAssessment?.state || "AVAILABLE").toBe("AVAILABLE");

      // 2. Preemptive Trigger: Ring motion event occurs (proactive, NO visitor arrival required)
      const ringEvent: RingEvent = {
        provider: "ring_api",
        eventCategory: "official_ring",
        eventId: "ring_evt_delivery_101",
        eventType: "motion",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        timestamp: new Date().toISOString(),
        componentIds: [entrance.cameraBinding.componentId],
        source: "ring_webhook",
        receivedAt: new Date().toISOString(),
      };

      // Bedrock detects delivery packages blocking ramp
      const blockedBedrockClient = createMockBedrockClient({
        pathwayClear: "FALSE",
        obstructionPresent: "TRUE",
        doorReady: "TRUE",
        confidence: 0.95,
        evidenceQuality: "SUFFICIENT",
        observedFeatures: ["stacked courier boxes", "ramp slope"],
        explanation: "Two courier delivery boxes sit in the middle of the access ramp.",
      });

      const blockedAnalyzer = new BedrockVisionAnalyzer({}, blockedBedrockClient);

      // Process event through orchestrator
      const orchestrationResult = await orchestrator.processEvent(ringEvent, {
        visionAnalyzer: blockedAnalyzer,
      });

      expect(orchestrationResult.accepted).toBe(true);
      expect(orchestrationResult.correlationResult.status).toBe("CORRELATED");

      // 3. Assert Transitions: AVAILABLE -> INTERRUPTED -> ACTION_REQUIRED
      expect(orchestrationResult.pipelineResult?.previousState).toBe("AVAILABLE");
      expect(orchestrationResult.pipelineResult?.resultingState).toBe("ACTION_REQUIRED");

      // 4. Assert Remediation Task Created automatically with specific physical requirement
      const activeTask = await storage.remediations.findActiveByEntranceId(entrance.id);
      expect(activeTask).not.toBeNull();
      expect(activeTask?.status).toBe("OPEN");
      expect(activeTask?.reason).toContain("delivery boxes");

      // 5. Staff Acknowledges Task
      const ackTask = await storage.remediations.save({
        ...activeTask!,
        status: "ACKNOWLEDGED",
        assignedTo: "Staff Member Alex",
      });
      expect(ackTask.status).toBe("ACKNOWLEDGED");

      // 6. Critical Invariant Assertion: Staff reporting complete NEVER restores access directly!
      const completedTime = new Date().toISOString();
      const completedTask = await storage.remediations.save({
        ...ackTask,
        status: "COMPLETED",
        completedAt: completedTime,
        completedBy: "Staff Member Alex",
      });

      // Verify that after staff completion, state is NOT VERIFIED_RESTORED!
      const postReportAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      expect(postReportAssessment?.state).not.toBe("VERIFIED_RESTORED");

      // 7. Explicit Recheck: OpenWay explicitly requests fresh post-remediation Ring evidence
      // Evidence capture timestamp is strictly AFTER remediation completion (completedAt)
      const freshPostRemediationTime = new Date(Date.now() + 2000).toISOString();

      const clearBedrockClient = createMockBedrockClient({
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.98,
        evidenceQuality: "SUFFICIENT",
        observedFeatures: ["clear ramp surface", "unobstructed doorway"],
        explanation: "Ramp and doorway are completely clear of obstacles.",
      });

      const clearAnalyzer = new BedrockVisionAnalyzer({}, clearBedrockClient);

      // Execute post-remediation verification
      const verificationResult = await recheckService.startVerification(completedTask.id, {
        visionAnalyzer: clearAnalyzer,
        overrideCapturedAt: freshPostRemediationTime,
      });

      // 8. Assert Final State: VERIFIED_RESTORED with all 9 gatekeeper checks passing
      expect(verificationResult.success).toBe(true);
      expect(verificationResult.finalState).toBe("VERIFIED_RESTORED");
      expect(verificationResult.gatekeeperResult?.allowed).toBe(true);
      expect(verificationResult.gatekeeperResult?.reasonCode).toBe("GATE_PASSED");

      // 9. Verify Complete Audit Trail
      const audits = await storage.auditEvents.listByEntranceId(entrance.id);
      const auditTypes = audits.map((a) => a.type);

      expect(auditTypes).toContain("ACCESS_INTERRUPTED");
      expect(auditTypes).toContain("TASK_CREATED");
      expect(auditTypes).toContain("VERIFICATION_INITIATED");
      expect(auditTypes).toContain("ACCESS_VERIFIED_RESTORED");
    });
  });

  describe("Specific Operational Scenarios (A through H)", () => {
    it("Scenario A: Preemptive obstruction detects and opens task without visitor arrival", async () => {
      const ringEvent: RingEvent = {
        provider: "simulator",
        eventCategory: "simulated_local",
        eventId: "sim_evt_preemptive_obstruction",
        eventType: "simulated_motion",
        deviceId: entrance.cameraBinding.deviceId,
        timestamp: new Date().toISOString(),
        componentIds: [entrance.cameraBinding.componentId],
        source: "simulator",
        receivedAt: new Date().toISOString(),
      };

      const simAnalyzer = new SimulatorVisionAnalyzer("BLOCKED");
      const res = await orchestrator.processEvent(ringEvent, {
        visionAnalyzer: simAnalyzer,
      });

      expect(res.pipelineResult?.resultingState).toBe("ACTION_REQUIRED");
      const task = await storage.remediations.findActiveByEntranceId(entrance.id);
      expect(task).toBeDefined();
      expect(task?.status).toBe("OPEN");
    });

    it("Scenario C: False completion (staff reports fixed, but recheck evidence still shows obstruction)", async () => {
      // Create completed task
      const task = await storage.remediations.save({
        id: "task_false_complete",
        entranceId: entrance.id,
        triggerAssessmentId: "assess_1",
        status: "COMPLETED",
        reason: "Boxes on ramp",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date(Date.now() - 10000).toISOString(),
      });

      // Recheck evidence shows obstruction is STILL present
      const stillBlockedAnalyzer = new SimulatorVisionAnalyzer("BLOCKED");
      const res = await recheckService.startVerification(task.id, {
        visionAnalyzer: stillBlockedAnalyzer,
        overrideCapturedAt: new Date().toISOString(),
      });

      expect(res.success).toBe(false);
      expect(res.finalState).toBe("ACTION_REQUIRED");
      expect(res.explanation).toContain("Physical obstruction still observed");
    });

    it("Scenario D: Verification unavailable &rarr; transitions RECHECKING to UNKNOWN", async () => {
      const task = await storage.remediations.save({
        id: "task_unavail",
        entranceId: entrance.id,
        triggerAssessmentId: "assess_1",
        status: "COMPLETED",
        reason: "Clear debris",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date(Date.now() - 10000).toISOString(),
      });

      // Mock provider where image download fails
      const mockFailingProvider = {
        getImageEvidence: async () => null,
      } as unknown as RingProvider;

      const res = await recheckService.startVerification(task.id, {
        ringProvider: mockFailingProvider,
        visionAnalyzer: new SimulatorVisionAnalyzer("UNCERTAIN"),
        maxAttempts: 1,
      });

      expect(res.success).toBe(false);
      expect(res.finalState).toBe("UNKNOWN");
    });

    it("Scenario E: Stale evidence (captured before task completion) cannot verify restoration", async () => {
      const completionTime = new Date(Date.now() - 10000).toISOString();
      const task = await storage.remediations.save({
        id: "task_stale_verif",
        entranceId: entrance.id,
        triggerAssessmentId: "assess_1",
        status: "COMPLETED",
        reason: "Boxes cleared",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: completionTime,
      });

      // Evidence captured BEFORE remediation completion (stale)
      const preRemediationTime = new Date(Date.now() - 25000).toISOString();

      const res = await recheckService.startVerification(task.id, {
        visionAnalyzer: new SimulatorVisionAnalyzer("CLEAR"),
        overrideCapturedAt: preRemediationTime, // Captured BEFORE completedAt
        maxAttempts: 1,
      });

      expect(res.success).toBe(false);
      expect(res.finalState).toBe("UNKNOWN");
      expect(res.gatekeeperResult?.reasonCode).toBe("TEMPORAL_INCONSISTENCY");
    });

    it("Scenario F: Wrong camera / wrong component cannot restore access", async () => {
      const completionTime = new Date(Date.now() - 10000).toISOString();
      const task = await storage.remediations.save({
        id: "task_wrong_cam",
        entranceId: entrance.id,
        triggerAssessmentId: "assess_1",
        status: "COMPLETED",
        reason: "Snow cleared",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: completionTime,
      });

      // Provider returns evidence for wrong device
      const wrongCamProvider = {
        getImageEvidence: async () => ({
          deviceId: "cam_unbound_back_dock_99", // Wrong camera!
          dataUrl: "data:image/jpeg;base64,dGVzdA==",
          capturedAt: new Date().toISOString(),
          source: "simulator",
          isSimulated: true,
        }),
      } as unknown as RingProvider;

      const res = await recheckService.startVerification(task.id, {
        ringProvider: wrongCamProvider,
        visionAnalyzer: new SimulatorVisionAnalyzer("CLEAR"),
        maxAttempts: 1,
      });

      expect(res.success).toBe(false);
      expect(res.finalState).not.toBe("VERIFIED_RESTORED");
    });

    it("Scenario G: Contradictory observations during recheck safely resolve to UNKNOWN", async () => {
      const task = await storage.remediations.save({
        id: "task_contra",
        entranceId: entrance.id,
        triggerAssessmentId: "assess_1",
        status: "COMPLETED",
        reason: "Pallet removed",
        createdAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date(Date.now() - 5000).toISOString(),
      });

      const res = await recheckService.startVerification(task.id, {
        visionAnalyzer: new SimulatorVisionAnalyzer("CONTRADICTORY"),
        overrideCapturedAt: new Date().toISOString(),
        maxAttempts: 1,
      });

      expect(res.success).toBe(false);
      expect(res.finalState).toBe("UNKNOWN");
    });

    it("Scenario H: Event reconciliation discovers missed events and re-processes them idempotently", async () => {
      const pastTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // Mock provider with missed event in history
      const missedEvent: RingEvent = {
        provider: "ring_api",
        eventCategory: "official_ring",
        eventId: "missed_ring_event_555",
        eventType: "motion",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        timestamp: pastTime,
        componentIds: [entrance.cameraBinding.componentId],
        source: "ring_api",
        receivedAt: pastTime,
      };

      const mockProvider = {
        getRecentEvents: async () => [missedEvent],
        getImageEvidence: async () => ({
          deviceId: entrance.cameraBinding.deviceId,
          dataUrl: "data:image/jpeg;base64,dGVzdA==",
          capturedAt: pastTime,
          source: "ring_media_download",
          isSimulated: false,
        }),
      } as unknown as RingProvider;

      // Reconcile missed events
      const report = await reconciliationService.reconcileMissedEvents({
        ringProvider: mockProvider,
        lookbackMinutes: 30,
      });

      expect(report.eventsDiscovered).toBe(1);
      expect(report.eventsProcessed).toBe(1);
      expect(report.recoveredEventIds).toContain("missed_ring_event_555");

      // Running reconciliation again should deduplicate the event
      const report2 = await reconciliationService.reconcileMissedEvents({
        ringProvider: mockProvider,
        lookbackMinutes: 30,
      });

      expect(report2.eventsDeduplicated).toBe(1);
    });

    it("Duplicate Ring events are deduplicated without duplicate Bedrock invocations", async () => {
      const ringEvent: RingEvent = {
        provider: "ring_api",
        eventCategory: "official_ring",
        eventId: "dup_event_999",
        eventType: "motion",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        timestamp: new Date().toISOString(),
        componentIds: [entrance.cameraBinding.componentId],
        source: "ring_webhook",
        receivedAt: new Date().toISOString(),
      };

      const analyzer = new SimulatorVisionAnalyzer("CLEAR");

      // First call
      const res1 = await orchestrator.processEvent(ringEvent, { visionAnalyzer: analyzer });
      expect(res1.deduplicated).toBeFalsy();

      // Second call with same event
      const res2 = await orchestrator.processEvent(ringEvent, { visionAnalyzer: analyzer });
      expect(res2.deduplicated).toBe(true);
    });
  });
});
