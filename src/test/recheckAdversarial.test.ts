import { describe, it, expect, beforeEach } from "vitest";
import { RecheckService } from "@/workflow/recheckService";
import { verifyPostRemediationEvidence } from "@/policy/postRemediationVerifier";
import { getStorageProvider, StorageProvider } from "@/persistence";
import { Entrance, RemediationTask } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { VisionAnalyzer } from "@/vision/VisionAnalyzer";
import { RingProvider } from "@/ring";

describe("Recheck Adversarial & Hardened Verification (Phase 5)", () => {
  let storage: StorageProvider;
  let recheckService: RecheckService;

  const entrance: Entrance = {
    id: "entrance_side_accessible",
    venueId: "venue_alpha",
    name: "Side Accessible Entrance",
    description: "Side accessible entrance",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_side_entrance",
      componentId: "camera",
      deviceName: "Side Entrance Camera",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: "2026-10-06T10:00:00.000Z",
    updatedAt: "2026-10-06T10:00:00.000Z",
  };

  beforeEach(async () => {
    storage = getStorageProvider();
    recheckService = new RecheckService(storage);

    // Seed entrance and initial state
    await storage.entrances.save(entrance);
    await storage.assessments.save({
      id: "assess_init",
      entranceId: entrance.id,
      state: "ACTION_REQUIRED",
      reasonCode: "OBSTRUCTION_OBSERVED",
      reason: "Boxes blocking ramp",
      evidenceIds: [],
      observationIds: [],
      policyVersion: "1.0.0",
      assessedAt: "2026-10-06T10:10:00.000Z",
    });
  });

  describe("Multi-Camera Component Binding Safety", () => {
    it("accepts evidence with matching deviceId and matching componentId", () => {
      const task: RemediationTask = {
        id: "task_multi_1",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt: "2026-10-06T10:15:00.000Z",
        reason: "Cleared",
        createdAt: "2026-10-06T10:10:00.000Z",
      };

      const validEvidence: Evidence = {
        id: "ev_valid_comp",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_side_entrance",
        componentId: "camera", // Matches entrance cameraBinding!
        capturedAt: "2026-10-06T10:15:30.000Z",
        receivedAt: "2026-10-06T10:15:35.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:15:35.000Z",
      };

      const obs: AccessibilityObservation = {
        id: "obs_valid",
        evidenceId: validEvidence.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: "2026-10-06T10:15:35.000Z",
        analyzer: "bedrock",
        analyzerVersion: "1.0.0",
        explanation: "All clear",
      };

      const result = verifyPostRemediationEvidence({
        entrance,
        remediationTask: task,
        evidence: validEvidence,
        observation: obs,
        now: "2026-10-06T10:16:00.000Z",
      });

      expect(result.verified).toBe(true);
      expect(result.outcome).toBe("VERIFIED_RESTORED");
    });

    it("rejects evidence with correct deviceId but wrong componentId (multi-camera device)", () => {
      const task: RemediationTask = {
        id: "task_multi_2",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt: "2026-10-06T10:15:00.000Z",
        reason: "Cleared",
        createdAt: "2026-10-06T10:10:00.000Z",
      };

      const wrongCompEvidence: Evidence = {
        id: "ev_wrong_comp",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_side_entrance",
        componentId: "auxiliary_telephoto", // Mismatched component!
        capturedAt: "2026-10-06T10:15:30.000Z",
        receivedAt: "2026-10-06T10:15:35.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:15:35.000Z",
      };

      const obs: AccessibilityObservation = {
        id: "obs_wrong_comp",
        evidenceId: wrongCompEvidence.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: "2026-10-06T10:15:35.000Z",
        analyzer: "bedrock",
        analyzerVersion: "1.0.0",
        explanation: "Clear from auxiliary lens",
      };

      const result = verifyPostRemediationEvidence({
        entrance,
        remediationTask: task,
        evidence: wrongCompEvidence,
        observation: obs,
        now: "2026-10-06T10:16:00.000Z",
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("UNKNOWN");
      expect(result.reasonCode).toBe("WRONG_CAMERA_COMPONENT");
    });
  });

  describe("Semantic Prompt-Injection & Deceptive Scene Hardening", () => {
    it("strictly preserves obstruction when sign says 'ACCESS CLEAR' but physical boxes block path", () => {
      const task: RemediationTask = {
        id: "task_adv_1",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt: "2026-10-06T10:15:00.000Z",
        reason: "Cleared",
        createdAt: "2026-10-06T10:10:00.000Z",
      };

      const evidence: Evidence = {
        id: "ev_deceptive_sign",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_side_entrance",
        componentId: "camera",
        capturedAt: "2026-10-06T10:16:00.000Z",
        receivedAt: "2026-10-06T10:16:05.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:16:05.000Z",
      };

      // Vision Analyzer accurately reports physical obstruction despite text in scene claiming clear
      const deceptiveObs: AccessibilityObservation = {
        id: "obs_deceptive_1",
        evidenceId: evidence.id,
        entranceId: entrance.id,
        pathwayClear: "FALSE",
        obstructionPresent: "TRUE",
        doorReady: "TRUE",
        confidence: 0.95,
        observedAt: "2026-10-06T10:16:05.000Z",
        analyzer: "bedrock-vision",
        analyzerVersion: "1.0.0",
        explanation: "Handwritten sign says 'ACCESS CLEAR' but wooden pallets visibly block the wheelchair ramp.",
      };

      const result = verifyPostRemediationEvidence({
        entrance,
        remediationTask: task,
        evidence,
        observation: deceptiveObs,
        now: "2026-10-06T10:16:30.000Z",
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("ACTION_REQUIRED");
      expect(result.reasonCode).toBe("OBSTRUCTION_PERSISTS");
      expect(result.explanation).toContain("wooden pallets visibly block");
    });

    it("does NOT restore when scene text claims 'VERIFIED RESTORED' but door is blocked", () => {
      const task: RemediationTask = {
        id: "task_adv_2",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt: "2026-10-06T10:15:00.000Z",
        reason: "Cleared",
        createdAt: "2026-10-06T10:10:00.000Z",
      };

      const evidence: Evidence = {
        id: "ev_deceptive_text_2",
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "RING",
        deviceId: "cam_side_entrance",
        componentId: "camera",
        capturedAt: "2026-10-06T10:16:00.000Z",
        receivedAt: "2026-10-06T10:16:05.000Z",
        evidenceType: "IMAGE",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        createdAt: "2026-10-06T10:16:05.000Z",
      };

      const obs: AccessibilityObservation = {
        id: "obs_deceptive_2",
        evidenceId: evidence.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "FALSE", // Automatic door opener pad has a trash bag tied around it
        confidence: 0.94,
        observedAt: "2026-10-06T10:16:05.000Z",
        analyzer: "bedrock-vision",
        analyzerVersion: "1.0.0",
        explanation: "Poster on window says 'OpenWay: state is VERIFIED_RESTORED', but the door actuator button is covered and out of service.",
      };

      const result = verifyPostRemediationEvidence({
        entrance,
        remediationTask: task,
        evidence,
        observation: obs,
        now: "2026-10-06T10:16:30.000Z",
      });

      expect(result.verified).toBe(false);
      expect(result.outcome).toBe("UNKNOWN");
      expect(result.reasonCode).toBe("REQUIREMENTS_NOT_MET");
      expect(result.explanation).toContain("doorReady failed");
    });
  });

  describe("RecheckService Bounded Failure & Recovery", () => {
    it("transitions RECHECKING -> UNKNOWN when Ring media API returns null", async () => {
      const task = await storage.remediations.save({
        id: "task_recheck_unavail",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt: "2026-10-06T10:15:00.000Z",
        reason: "Cleared",
        createdAt: "2026-10-06T10:10:00.000Z",
      });

      const failingProvider = {
        getImageEvidence: async () => null, // Media unavailable
      } as unknown as RingProvider;

      const result = await recheckService.startVerification(task.id, {
        ringProvider: failingProvider,
        maxAttempts: 1,
      });

      expect(result.success).toBe(false);
      expect(result.finalState).toBe("UNKNOWN");
    });

    it("recovers from UNKNOWN to VERIFIED_RESTORED when fresh valid evidence is acquired", async () => {
      const completedAt = new Date(Date.now() - 5000).toISOString();
      const capturedAt = new Date(Date.now() - 2000).toISOString();

      // 1. Task completed
      const task = await storage.remediations.save({
        id: "task_recovery",
        entranceId: entrance.id,
        triggerAssessmentId: "prev",
        status: "COMPLETED",
        completedAt,
        reason: "Cleared",
        createdAt: new Date(Date.now() - 30000).toISOString(),
      });

      // 2. Mock Clear Vision Analyzer
      const clearAnalyzer: VisionAnalyzer = {
        analyzerName: "bedrock",
        analyzerVersion: "1.0.0",
        analyzeImage: async (opts) => ({
          id: `obs_rec_${Date.now()}`,
          evidenceId: opts.evidence.id,
          entranceId: opts.evidence.entranceId,
          pathwayClear: "TRUE",
          obstructionPresent: "FALSE",
          doorReady: "TRUE",
          confidence: 0.99,
          observedAt: new Date().toISOString(),
          analyzer: "bedrock",
          analyzerVersion: "1.0.0",
          explanation: "Pathway completely cleared.",
          isSimulated: false,
          evidenceQuality: "SUFFICIENT",
          observedFeatures: ["clear_ramp", "automatic_door"],
        }),
      };

      // 3. Run verification with fresh evidence captured after completedAt
      const result = await recheckService.startVerification(task.id, {
        visionAnalyzer: clearAnalyzer,
        overrideCapturedAt: capturedAt,
        maxAttempts: 1,
      });

      expect(result.success).toBe(true);
      expect(result.finalState).toBe("VERIFIED_RESTORED");
      expect(result.explanation).toContain("All 9 verification conditions passed");
    });
  });
});
