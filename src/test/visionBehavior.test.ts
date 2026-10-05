import { describe, it, expect, beforeEach } from "vitest";
import { VisionPipelineService } from "../vision/VisionPipelineService";
import { SimulatorVisionAnalyzer } from "../vision/SimulatorVisionAnalyzer";
import { BedrockVisionAnalyzer } from "../vision/BedrockVisionAnalyzer";
import { resetGlobalStorage, getStorageProvider } from "../persistence";
import { Entrance } from "../domain/types";
import { Evidence } from "../evidence/types";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

describe("Vision Behavior, Safety Boundaries & Domain Integration", () => {
  let pipeline: VisionPipelineService;
  const storage = getStorageProvider();

  const testEntrance: Entrance = {
    id: "entrance_west_accessible",
    venueId: "venue_main_01",
    name: "West Ramp Entrance",
    description: "Main accessible ramp entrance on West side",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_ring_west",
      componentId: "main_sensor",
      deviceName: "West Entrance Cam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  beforeEach(async () => {
    resetGlobalStorage();
    pipeline = VisionPipelineService.getInstance();
    pipeline.resetCache();
    await storage.entrances.save(testEntrance);
  });

  describe("Scene Interpretation Behavior", () => {
    it("handles clear scene: pathwayClear=TRUE, obstructionPresent=FALSE -> AVAILABLE", async () => {
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_clear_scene_01",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_ring_101",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/clear.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_clear_01",
        createdAt: now,
      };

      const simAnalyzer = new SimulatorVisionAnalyzer("CLEAR");
      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer: simAnalyzer,
      });

      expect(result.success).toBe(true);
      expect(result.observation.pathwayClear).toBe("TRUE");
      expect(result.observation.obstructionPresent).toBe("FALSE");
      expect(result.observation.doorReady).toBe("TRUE");
      expect(result.observation.evidenceQuality).toBe("SUFFICIENT");
      expect(result.resultingState).toBe("AVAILABLE");
      expect(result.observation.isSimulated).toBe(true); // Simulator analyzer flags isSimulated=true
    });

    it("handles blocked scene: obstructionPresent=TRUE -> triggers INTERRUPTED / ACTION_REQUIRED with open task", async () => {
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_blocked_ramp_02",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_ring_102",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/blocked.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_blocked_02",
        createdAt: now,
      };

      const simAnalyzer = new SimulatorVisionAnalyzer("BLOCKED");
      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer: simAnalyzer,
      });

      expect(result.success).toBe(true);
      expect(result.observation.obstructionPresent).toBe("TRUE");
      expect(result.observation.pathwayClear).toBe("FALSE");
      expect(result.resultingState).toBe("ACTION_REQUIRED");

      // Verify open remediation task was automatically dispatched
      const activeTask = await storage.remediations.findActiveByEntranceId(testEntrance.id);
      expect(activeTask).not.toBeNull();
      expect(activeTask?.status).toBe("OPEN");
    });

    it("handles unclear/insufficient scene: evidenceQuality=INSUFFICIENT -> transitions to UNKNOWN", async () => {
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_dark_scene_03",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_ring_103",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/dark.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_dark_03",
        createdAt: now,
      };

      const simAnalyzer = new SimulatorVisionAnalyzer("UNCERTAIN");
      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer: simAnalyzer,
      });

      expect(result.observation.evidenceQuality).toBe("INSUFFICIENT");
      expect(result.observation.pathwayClear).toBe("UNKNOWN");
      expect(result.resultingState).toBe("UNKNOWN");
    });
  });

  describe("Safety Boundaries & Non-Authority of AI", () => {
    it("safety boundary: AI model CANNOT produce state directly; policy is authoritative", async () => {
      const mockBedrockClient = {
        send: async () => ({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    name: "record_accessibility_observation",
                    input: {
                      pathwayClear: "TRUE",
                      obstructionPresent: "FALSE",
                      doorReady: "TRUE",
                      confidence: 0.99,
                      evidenceQuality: "SUFFICIENT",
                      observedFeatures: ["clear doorway"],
                      explanation: "Door is clear",
                      state: "VERIFIED_RESTORED", // Attempt to inject state directly
                    },
                  },
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_state_inject_04",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_104",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/inject.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_inject_04",
        createdAt: now,
      };

      // BedrockVisionAnalyzer must reject this directly due to .strict() schema validation
      await expect(
        analyzer.analyzeImage({
          evidence,
          imageBytes: sampleImageBytes,
          mimeType: "image/jpeg",
          requirements: testEntrance.requirements,
        })
      ).rejects.toThrow("Unrecognized key");
    });

    it("safety boundary: high confidence (0.99) with STALE evidence produces UNKNOWN, NEVER RESTORED", async () => {
      const staleTime = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago (freshness limit is 300s)

      const evidence: Evidence = {
        id: "ev_stale_high_conf",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_stale_105",
        capturedAt: staleTime,
        receivedAt: staleTime,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/stale.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "STALE",
        checksum: "hash_stale_05",
        createdAt: staleTime,
      };

      const mockBedrockClient = {
        send: async () => ({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    name: "record_accessibility_observation",
                    input: {
                      pathwayClear: "TRUE",
                      obstructionPresent: "FALSE",
                      doorReady: "TRUE",
                      confidence: 0.99, // Extremely high confidence!
                      evidenceQuality: "SUFFICIENT",
                      observedFeatures: ["clear ramp"],
                      explanation: "High confidence clear ramp",
                    },
                  },
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);

      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer,
      });

      // Gatekeeper and aggregator must override high AI confidence because evidence is stale
      expect(result.resultingState).toBe("UNKNOWN");
      expect(result.assessment?.reasonCode).toBe("STALE_EVIDENCE");
    });

    it("safety boundary: high confidence with wrong camera cannot influence target entrance", async () => {
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_wrong_cam_06",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: "cam_back_alley_99", // Wrong camera!
        componentId: "alley_sensor",
        provider: "RING",
        providerEventId: "evt_wrong_cam_106",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/wrong_cam.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_wrong_06",
        createdAt: now,
      };

      const mockBedrockClient = {
        send: async () => ({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    name: "record_accessibility_observation",
                    input: {
                      pathwayClear: "TRUE",
                      obstructionPresent: "FALSE",
                      doorReady: "TRUE",
                      confidence: 0.98,
                      evidenceQuality: "SUFFICIENT",
                      observedFeatures: ["clear path"],
                      explanation: "Observation from unconfigured camera",
                    },
                  },
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);

      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer,
      });

      // Wrong camera must be rejected by policy aggregation
      expect(result.resultingState).toBe("UNKNOWN");
      expect(result.assessment?.reasonCode).toBe("NO_MATCHING_EVIDENCE");
    });

    it("safety boundary: pathway is clear but doorReady is UNKNOWN -> does NOT declare restoration", async () => {
      // Set entrance to RECHECKING
      await storage.assessments.save({
        id: "assess_recheck_init",
        entranceId: testEntrance.id,
        state: "RECHECKING",
        reasonCode: "STAFF_COMPLETED_TASK",
        reason: "Staff completed remediation. Verification in progress.",
        evidenceIds: [],
        observationIds: [],
        policyVersion: "1.0.0",
        assessedAt: new Date().toISOString(),
      });

      // Active remediation task marked completed
      await storage.remediations.save({
        id: "task_recheck_test",
        entranceId: testEntrance.id,
        triggerAssessmentId: "assess_recheck_init",
        status: "COMPLETED",
        reason: "Boxes cleared",
        createdAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date(Date.now() - 30000).toISOString(),
      });

      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_partial_unknown_07",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_partial_107",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/partial.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_partial_07",
        createdAt: now,
      };

      const mockBedrockClient = {
        send: async () => ({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    name: "record_accessibility_observation",
                    input: {
                      pathwayClear: "TRUE",
                      obstructionPresent: "FALSE",
                      doorReady: "UNKNOWN", // Door is occluded or unknown!
                      confidence: 0.85,
                      evidenceQuality: "SUFFICIENT",
                      observedFeatures: ["clear ramp"],
                      explanation: "Ramp is clear but entrance door is not in frame.",
                    },
                  },
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);
      const result = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer,
      });

      // Gatekeeper MUST deny restoration because doorReady is required but UNKNOWN
      expect(result.gatekeeperResult?.allowed).toBe(false);
      expect(result.resultingState).not.toBe("VERIFIED_RESTORED");
      expect(result.resultingState).toBe("UNKNOWN");
    });
  });

  describe("End-to-End Integration with Provenance Tracking", () => {
    it("distinguishes OFFICIAL_RING vs SIMULATED_LOCAL accurately in observation provenance", async () => {
      // 1. Official Ring evidence analyzed by Bedrock
      const now = new Date().toISOString();
      const officialRingEvidence: Evidence = {
        id: "ev_official_ring_08",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "ding_official_999",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://live/snapshot.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false, // OFFICIAL RING
        freshness: "FRESH",
        checksum: "sha256_official",
        createdAt: now,
      };

      const mockBedrockClient = {
        send: async () => ({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    name: "record_accessibility_observation",
                    input: {
                      pathwayClear: "TRUE",
                      obstructionPresent: "FALSE",
                      doorReady: "TRUE",
                      confidence: 0.94,
                      evidenceQuality: "SUFFICIENT",
                      observedFeatures: ["official snapshot ramp"],
                      explanation: "Official camera shows clear entrance",
                    },
                  },
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const bedrockAnalyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);

      const officialResult = await pipeline.processEvidence({
        evidence: officialRingEvidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer: bedrockAnalyzer,
      });

      expect(officialResult.observation.analyzer).toBe("amazon-bedrock");
      expect(officialResult.observation.isSimulated).toBe(false); // Retains OFFICIAL_RING provenance!

      // 2. Simulated local Ring evidence analyzed by Bedrock
      const simulatedEvidence: Evidence = {
        id: "ev_simulated_ring_09",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "SIMULATOR",
        providerEventId: "sim_ding_888",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://simulator/snapshot.jpg",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true, // SIMULATED LOCAL
        freshness: "FRESH",
        checksum: "sha256_simulated",
        createdAt: now,
      };

      const simResult = await pipeline.processEvidence({
        evidence: simulatedEvidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer: bedrockAnalyzer,
      });

      expect(simResult.observation.analyzer).toBe("amazon-bedrock");
      expect(simResult.observation.isSimulated).toBe(true); // Honest provenance: simulated evidence sent to Bedrock
    });

    it("enforces idempotency and cost control: identical evidence does not re-invoke Bedrock", async () => {
      let callCount = 0;
      const mockBedrockClient = {
        send: async () => {
          callCount++;
          return {
            output: {
              message: {
                content: [
                  {
                    toolUse: {
                      name: "record_accessibility_observation",
                      input: {
                        pathwayClear: "TRUE",
                        obstructionPresent: "FALSE",
                        doorReady: "TRUE",
                        confidence: 0.95,
                        evidenceQuality: "SUFFICIENT",
                        observedFeatures: ["ramp"],
                        explanation: "Clean ramp",
                      },
                    },
                  },
                ],
              },
            },
          };
        },
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockBedrockClient);
      const now = new Date().toISOString();
      const evidence: Evidence = {
        id: "ev_idempotent_10",
        venueId: testEntrance.venueId,
        entranceId: testEntrance.id,
        deviceId: testEntrance.cameraBinding.deviceId,
        componentId: testEntrance.cameraBinding.componentId,
        provider: "RING",
        providerEventId: "evt_idempotent_110",
        capturedAt: now,
        receivedAt: now,
        evidenceType: "IMAGE",
        mediaReference: "ring://snapshot/idem.jpg",
        provenance: "OFFICIAL_RING",
        isSimulated: false,
        freshness: "FRESH",
        checksum: "hash_idem_10",
        createdAt: now,
      };

      // First run: calls Bedrock
      const res1 = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer,
      });

      // Second run: cached in memory, Bedrock is NOT called
      const res2 = await pipeline.processEvidence({
        evidence,
        imageBytes: sampleImageBytes,
        mimeType: "image/jpeg",
        entrance: testEntrance,
        analyzer,
      });

      expect(callCount).toBe(1);
      expect(res1.observation.id).toBe(res2.observation.id);
    });
  });
});
