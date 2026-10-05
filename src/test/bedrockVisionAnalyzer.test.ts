import { describe, it, expect, vi } from "vitest";
import { BedrockVisionAnalyzer } from "../vision/BedrockVisionAnalyzer";
import { VisionAnalysisError, mapBedrockError } from "../vision/errors";
import { buildSystemPrompt, buildUserPrompt } from "../vision/prompts";
import { BEDROCK_OBSERVATION_JSON_SCHEMA, VisionAnalysisOutputSchema } from "../vision/schemas";
import { Evidence } from "../evidence/types";
import { AccessibilityRequirements } from "../domain/types";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

describe("BedrockVisionAnalyzer & Vision Components", () => {
  const dummyEvidence: Evidence = {
    id: "evi_test_123",
    venueId: "venue_main_01",
    entranceId: "ent_main",
    deviceId: "cam_ring_1",
    componentId: "main_sensor",
    provider: "RING",
    providerEventId: "ding_987",
    capturedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    evidenceType: "IMAGE",
    mediaReference: "ring://snapshots/ding_987.jpg",
    provenance: "OFFICIAL_RING",
    isSimulated: false,
    freshness: "FRESH",
    checksum: "sha256_mock_hash",
    createdAt: new Date().toISOString(),
  };

  const dummyRequirements: AccessibilityRequirements = {
    pathwayClear: true,
    obstructionFree: true,
    doorReady: true,
  };

  const validModelOutput = {
    pathwayClear: "TRUE",
    obstructionPresent: "FALSE",
    doorReady: "TRUE",
    confidence: 0.95,
    evidenceQuality: "SUFFICIENT",
    observedFeatures: ["clear ramp", "door threshold", "handrail"],
    explanation: "The wheelchair ramp and entrance doorway are clearly visible and unobstructed.",
  };

  describe("System and User Prompt Construction", () => {
    it("builds a system prompt strictly enforcing privacy and domain boundaries", () => {
      const prompt = buildSystemPrompt();

      // Core purpose
      expect(prompt).toContain("environmental evidence analyzer");
      expect(prompt).toContain("OpenWay");

      // Privacy rules: no identifying people, disability, demographics
      expect(prompt).toContain("Do NOT identify people");
      expect(prompt).toContain("Do NOT infer disability");
      expect(prompt).toContain("Do NOT infer age, gender, race, identity");

      // Non-certification rules: no legal/ADA claims, no state transitions
      expect(prompt).toContain("Do NOT determine legal accessibility compliance");
      expect(prompt).toContain("Do NOT determine or suggest OpenWay application states");
      expect(prompt).toContain("return UNKNOWN");
    });

    it("injects configured requirements dynamically into user prompt", () => {
      const prompt = buildUserPrompt(dummyRequirements, "North Accessible Entrance");

      expect(prompt).toContain("North Accessible Entrance");
      expect(prompt).toContain("- pathwayClear: The wheelchair ramp");
      expect(prompt).toContain("- obstructionFree: The doorway and threshold");
      expect(prompt).toContain("- doorReady: The doorway and automatic push-plate");
      expect(prompt).toContain("Determine strictly whether each observable condition is TRUE, FALSE, or UNKNOWN");
    });

    it("supports custom venue requirements in user prompt", () => {
      const customReqs: AccessibilityRequirements = {
        pathwayClear: true,
        obstructionFree: false,
        doorReady: false,
        snowCleared: true,
      };

      const prompt = buildUserPrompt(customReqs, "Side Entrance");
      expect(prompt).toContain("- pathwayClear:");
      expect(prompt).not.toContain("- obstructionFree:");
      expect(prompt).toContain("- snowCleared: Configured venue requirement must be observed clear.");
    });
  });

  describe("Structured Output Schema Validation", () => {
    it("validates a strictly compliant model output", () => {
      const parsed = VisionAnalysisOutputSchema.safeParse(validModelOutput);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid tri-state values", () => {
      const invalid = {
        ...validModelOutput,
        pathwayClear: "YES", // Invalid value
      };
      const parsed = VisionAnalysisOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects boolean values when explicit tri-state string is required", () => {
      const invalid = {
        ...validModelOutput,
        pathwayClear: true, // Should be "TRUE"
      };
      const parsed = VisionAnalysisOutputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects outputs with missing required fields", () => {
      const missingField = {
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        // doorReady missing
        confidence: 0.9,
        evidenceQuality: "SUFFICIENT",
        observedFeatures: [],
        explanation: "Test",
      };
      const parsed = VisionAnalysisOutputSchema.safeParse(missingField);
      expect(parsed.success).toBe(false);
    });

    it("rejects extraneous fields like state injections (.strict() rule)", () => {
      const injectedState = {
        ...validModelOutput,
        state: "VERIFIED_RESTORED", // FORBIDDEN: model attempting to decide state
      };
      const parsed = VisionAnalysisOutputSchema.safeParse(injectedState);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain("Unrecognized key");
      }
    });

    it("verifies JSON Schema specification for Bedrock toolConfig", () => {
      expect(BEDROCK_OBSERVATION_JSON_SCHEMA.type).toBe("object");
      expect(BEDROCK_OBSERVATION_JSON_SCHEMA.additionalProperties).toBe(false);
      expect((BEDROCK_OBSERVATION_JSON_SCHEMA.properties as any).pathwayClear.enum).toEqual([
        "TRUE",
        "FALSE",
        "UNKNOWN",
      ]);
      expect(BEDROCK_OBSERVATION_JSON_SCHEMA.required).toContain("pathwayClear");
      expect(BEDROCK_OBSERVATION_JSON_SCHEMA.required).toContain("confidence");
    });
  });

  describe("BedrockVisionAnalyzer Execution & MIME Handling", () => {
    it("rejects empty image bytes with IMAGE_INVALID", async () => {
      const analyzer = new BedrockVisionAnalyzer();
      await expect(
        analyzer.analyzeImage({
          evidence: dummyEvidence,
          imageBytes: new Uint8Array(0),
          mimeType: "image/jpeg",
          requirements: dummyRequirements,
        })
      ).rejects.toThrow("Image payload is empty or invalid.");
    });

    it("rejects oversized images (>5MB) with IMAGE_TOO_LARGE", async () => {
      const analyzer = new BedrockVisionAnalyzer();
      const largeBytes = new Uint8Array(5 * 1024 * 1024 + 1);
      await expect(
        analyzer.analyzeImage({
          evidence: dummyEvidence,
          imageBytes: largeBytes,
          mimeType: "image/jpeg",
          requirements: dummyRequirements,
        })
      ).rejects.toThrow("Image size exceeds 5MB limit");
    });

    it("constructs ConverseCommand with JPEG image format and tool calling", async () => {
      let capturedCommand: any = null;
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          capturedCommand = command;
          return {
            output: {
              message: {
                content: [
                  {
                    toolUse: {
                      name: "record_accessibility_observation",
                      input: validModelOutput,
                    },
                  },
                ],
              },
            },
          };
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer(
        { region: "us-east-1", modelId: "amazon.nova-lite-v1:0" },
        mockClient
      );

      const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const observation = await analyzer.analyzeImage({
        evidence: dummyEvidence,
        imageBytes: fakeImageBytes,
        mimeType: "image/jpeg",
        requirements: dummyRequirements,
        entranceName: "Main Entrance",
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(capturedCommand).toBeInstanceOf(ConverseCommand);
      expect(capturedCommand.input.modelId).toBe("amazon.nova-lite-v1:0");

      // Verify image format passed to Bedrock
      const userMessage = capturedCommand.input.messages[0];
      const imageBlock = userMessage.content[0].image;
      expect(imageBlock.format).toBe("jpeg");
      expect(imageBlock.source.bytes).toBe(fakeImageBytes);

      // Verify observation result
      expect(observation.analyzer).toBe("amazon-bedrock");
      expect(observation.pathwayClear).toBe("TRUE");
      expect(observation.obstructionPresent).toBe("FALSE");
      expect(observation.doorReady).toBe("TRUE");
      expect(observation.confidence).toBe(0.95);
      expect(observation.isSimulated).toBe(false);
      expect(observation.modelId).toBe("amazon.nova-lite-v1:0");
      expect(observation.modelRegion).toBe("us-east-1");
    });

    it("constructs ConverseCommand with PNG image format", async () => {
      let capturedCommand: any = null;
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          capturedCommand = command;
          return {
            output: {
              message: {
                content: [
                  {
                    toolUse: {
                      name: "record_accessibility_observation",
                      input: validModelOutput,
                    },
                  },
                ],
              },
            },
          };
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockClient);
      const fakePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      await analyzer.analyzeImage({
        evidence: dummyEvidence,
        imageBytes: fakePngBytes,
        mimeType: "image/png",
        requirements: dummyRequirements,
      });

      const userMessage = capturedCommand.input.messages[0];
      const imageBlock = userMessage.content[0].image;
      expect(imageBlock.format).toBe("png");
    });

    it("supports parsing JSON from text block as fallback", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          output: {
            message: {
              content: [
                {
                  text: `Here is the analysis:\n${JSON.stringify(validModelOutput)}`,
                },
              ],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockClient);
      const observation = await analyzer.analyzeImage({
        evidence: dummyEvidence,
        imageBytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
        requirements: dummyRequirements,
      });

      expect(observation.pathwayClear).toBe("TRUE");
      expect(observation.observedFeatures).toEqual(["clear ramp", "door threshold", "handrail"]);
    });

    it("passes guardrail configuration when configured", async () => {
      let capturedCommand: any = null;
      const mockClient = {
        send: vi.fn().mockImplementation(async (command) => {
          capturedCommand = command;
          return {
            output: {
              message: {
                content: [
                  {
                    toolUse: {
                      name: "record_accessibility_observation",
                      input: validModelOutput,
                    },
                  },
                ],
              },
            },
          };
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer(
        {
          guardrailId: "gr-openway-privacy-123",
          guardrailVersion: "DRAFT",
        },
        mockClient
      );

      await analyzer.analyzeImage({
        evidence: dummyEvidence,
        imageBytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
        requirements: dummyRequirements,
      });

      expect(capturedCommand.input.guardrailConfig).toEqual({
        guardrailIdentifier: "gr-openway-privacy-123",
        guardrailVersion: "DRAFT",
      });
    });

    it("throws INVALID_MODEL_OUTPUT if Bedrock returns empty content", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          output: {
            message: {
              content: [],
            },
          },
        }),
      } as unknown as BedrockRuntimeClient;

      const analyzer = new BedrockVisionAnalyzer({}, mockClient);
      await expect(
        analyzer.analyzeImage({
          evidence: dummyEvidence,
          imageBytes: new Uint8Array([1, 2, 3]),
          mimeType: "image/jpeg",
          requirements: dummyRequirements,
        })
      ).rejects.toThrow("Bedrock returned empty response content.");
    });
  });

  describe("Error Mapping & Resiliency", () => {
    it("maps 403 / AccessDeniedException to BEDROCK_AUTH_ERROR (non-retryable)", () => {
      const err = new Error("User is not authorized to perform: bedrock:InvokeModel");
      err.name = "AccessDeniedException";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("BEDROCK_AUTH_ERROR");
      expect(mapped.statusCode).toBe(403);
      expect(mapped.retryable).toBe(false);
    });

    it("maps 429 / ThrottlingException to BEDROCK_THROTTLED (retryable)", () => {
      const err = new Error("Rate limit exceeded for Converse operation");
      err.name = "ThrottlingException";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("BEDROCK_THROTTLED");
      expect(mapped.statusCode).toBe(429);
      expect(mapped.retryable).toBe(true);
    });

    it("maps TimeoutError to BEDROCK_TIMEOUT (retryable)", () => {
      const err = new Error("Request timed out after 30000ms");
      err.name = "TimeoutError";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("BEDROCK_TIMEOUT");
      expect(mapped.statusCode).toBe(504);
      expect(mapped.retryable).toBe(true);
    });

    it("maps ResourceNotFoundException to BEDROCK_UNAVAILABLE", () => {
      const err = new Error("The model amazon.nova-lite-v1:0 does not exist in region");
      err.name = "ResourceNotFoundException";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("BEDROCK_UNAVAILABLE");
      expect(mapped.statusCode).toBe(503);
      expect(mapped.retryable).toBe(false);
    });

    it("maps 503 / ServiceUnavailableException to BEDROCK_UNAVAILABLE (retryable)", () => {
      const err = new Error("Bedrock runtime is currently down");
      err.name = "ServiceUnavailableException";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("BEDROCK_UNAVAILABLE");
      expect(mapped.statusCode).toBe(503);
      expect(mapped.retryable).toBe(true);
    });

    it("maps ValidationException to IMAGE_INVALID", () => {
      const err = new Error("ValidationException: Image dimensions too large or corrupted");
      err.name = "ValidationException";

      const mapped = mapBedrockError(err);
      expect(mapped.code).toBe("IMAGE_INVALID");
      expect(mapped.statusCode).toBe(400);
      expect(mapped.retryable).toBe(false);
    });
  });
});
