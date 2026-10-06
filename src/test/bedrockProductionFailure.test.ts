import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VisionPipelineService } from "@/vision/VisionPipelineService";
import { Entrance } from "@/domain/types";
import { Evidence } from "@/evidence/types";
import { resetGlobalStorage } from "@/persistence";

describe("Bedrock Production Failure Drill", () => {
  const origEnv = process.env.OPENWAY_ENV;

  beforeEach(() => {
    resetGlobalStorage();
    VisionPipelineService.getInstance().resetCache();
    process.env.OPENWAY_ENV = "production";
  });

  afterEach(() => {
    process.env.OPENWAY_ENV = origEnv;
  });

  const entrance: Entrance = {
    id: "entrance_side_accessible",
    venueId: "venue_maple_cafe",
    name: "Side Accessible Entrance",
    description: "Accessible entrance ramp",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_front_entrance",
      componentId: "component_video_01",
      deviceName: "Front Ramp Camera",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const evidence: Evidence = {
    id: "ev_drill_01",
    venueId: "venue_maple_cafe",
    entranceId: "entrance_side_accessible",
    provider: "RING",
    deviceId: "cam_front_entrance",
    componentId: "component_video_01",
    capturedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    evidenceType: "IMAGE",
    provenance: "OFFICIAL_RING",
    isSimulated: false,
    freshness: "FRESH",
    createdAt: new Date().toISOString(),
  };

  const errorScenarios = [
    { name: "HTTP 401 Unauthorized (Invalid AWS Credentials)", error: new Error("UnrecognizedClientException: The security token included in the request is invalid.") },
    { name: "HTTP 403 Forbidden (Insufficient Bedrock Permissions)", error: new Error("AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel") },
    { name: "HTTP 429 Too Many Requests (Rate limit throttled)", error: new Error("ThrottlingException: Too many requests. Rate exceeded.") },
    { name: "HTTP 500 Internal Server Error (Upstream Bedrock Failure)", error: new Error("InternalServerException: Internal service error encountered.") },
    { name: "HTTP 503 Service Unavailable", error: new Error("ServiceUnavailableException: Service is temporarily overloaded.") },
    { name: "Request Timeout (AbortController signal aborted)", error: new Error("TimeoutError: Bedrock request timed out after 15000ms.") },
    { name: "Model Unavailable / Invalid Model ID", error: new Error("ResourceNotFoundException: The model amazon.nova-lite-v1:0 does not exist in region us-east-1.") },
    { name: "Malformed or Empty Model Response", error: new Error("InvalidModelOutput: Model returned empty response content.") },
  ];

  for (const scenario of errorScenarios) {
    it(`fails closed to UNKNOWN when encountering ${scenario.name}`, async () => {
      const pipeline = VisionPipelineService.getInstance();

      const mockBedrockAnalyzer = {
        analyzerName: "amazon-bedrock",
        analyzerVersion: "1.0.0",
        analyzeImage: vi.fn().mockRejectedValue(scenario.error),
      };

      const result = await pipeline.processEvidence({
        entrance,
        evidence: {
          ...evidence,
          id: `ev_${Math.random().toString(36).slice(2, 8)}`,
        },
        imageBytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
        analyzer: mockBedrockAnalyzer as any,
      });

      // Verification: State MUST fail closed to UNKNOWN
      expect(result.observation.pathwayClear).toBe("UNKNOWN");
      expect(result.observation.obstructionPresent).toBe("UNKNOWN");
      expect(result.observation.doorReady).toBe("UNKNOWN");
      expect(result.observation.evidenceQuality).toBe("INSUFFICIENT");
      expect(result.resultingState).toBe("UNKNOWN");

      // Core Invariant: MUST NOT produce a false green or clear observation!
      expect(result.observation.pathwayClear).not.toBe("TRUE");
      expect(result.resultingState).not.toBe("AVAILABLE");
      expect(result.resultingState).not.toBe("VERIFIED_RESTORED");
    });
  }
});
