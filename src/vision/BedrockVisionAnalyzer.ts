import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from "@aws-sdk/client-bedrock-runtime";
import { VisionAnalyzer, VisionAnalysisInput, DetailedVisionObservation } from "./VisionAnalyzer";
import {
  VisionAnalysisOutputSchema,
  VisionAnalysisOutput,
  BEDROCK_OBSERVATION_JSON_SCHEMA,
} from "./schemas";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { getBedrockConfig, BedrockConfig } from "./modelConfig";
import { VisionAnalysisError, mapBedrockError } from "./errors";

export class BedrockVisionAnalyzer implements VisionAnalyzer {
  public readonly analyzerName = "amazon-bedrock";
  public readonly analyzerVersion = "1.0.0";

  private client: BedrockRuntimeClient;
  private config: BedrockConfig;

  constructor(customConfig?: Partial<BedrockConfig>, customClient?: BedrockRuntimeClient) {
    this.config = { ...getBedrockConfig(), ...customConfig };
    this.client =
      customClient ||
      new BedrockRuntimeClient({
        region: this.config.region,
        maxAttempts: this.config.maxRetries,
      });
  }

  /**
   * Analyzes camera image evidence using Amazon Bedrock Runtime Converse API.
   *
   * Image bytes remain strictly in server memory during transport.
   * Model output is strictly validated against VisionAnalysisOutputSchema.
   */
  public async analyzeImage(input: VisionAnalysisInput): Promise<DetailedVisionObservation> {
    const startTime = Date.now();
    const correlationId = input.correlationId || `bedrock_${Date.now()}`;
    const observedAt = new Date().toISOString();

    // 1. Validate image payload
    if (!input.imageBytes || input.imageBytes.length === 0) {
      throw new VisionAnalysisError({
        code: "IMAGE_INVALID",
        message: "Image payload is empty or invalid.",
      });
    }

    if (input.imageBytes.length > 5 * 1024 * 1024) {
      throw new VisionAnalysisError({
        code: "IMAGE_TOO_LARGE",
        message: "Image size exceeds 5MB limit for Bedrock vision inference.",
      });
    }

    // 2. Build system and user prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input.requirements, input.entranceName);

    // Bedrock Converse API format for images
    const imageFormat = input.mimeType === "image/png" ? "png" : "jpeg";

    const converseParams: ConverseCommandInput = {
      modelId: this.config.modelId,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [
            {
              image: {
                format: imageFormat,
                source: {
                  bytes: input.imageBytes,
                },
              },
            },
            {
              text: userPrompt,
            },
          ],
        },
      ],
      // Platform-enforced structured output via Tool calling JSON schema
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "record_accessibility_observation",
              description: "Record structured accessibility observation from camera evidence",
              inputSchema: {
                json: BEDROCK_OBSERVATION_JSON_SCHEMA as any,
              },
            },
          },
        ],
        toolChoice: {
          tool: {
            name: "record_accessibility_observation",
          },
        },
      },
      inferenceConfig: {
        maxTokens: 512,
        temperature: 0.1, // Low temperature for deterministic factual extraction
      },
    };

    // Optional Bedrock Guardrails
    if (this.config.guardrailId && this.config.guardrailVersion) {
      converseParams.guardrailConfig = {
        guardrailIdentifier: this.config.guardrailId,
        guardrailVersion: this.config.guardrailVersion,
      };
    }

    let inferenceMs = 0;
    let rawOutput: unknown = null;

    try {
      const inferenceStart = Date.now();
      const command = new ConverseCommand(converseParams);
      const response = await this.client.send(command);
      inferenceMs = Date.now() - inferenceStart;

      // Extract output from ToolUse or Text fallback
      const messageContent = response.output?.message?.content;
      if (!messageContent || messageContent.length === 0) {
        throw new VisionAnalysisError({
          code: "INVALID_MODEL_OUTPUT",
          message: "Bedrock returned empty response content.",
        });
      }

      // Check for structured tool use block
      const toolUseBlock = messageContent.find((block) => Boolean(block.toolUse));
      if (toolUseBlock && toolUseBlock.toolUse?.input) {
        rawOutput = toolUseBlock.toolUse.input;
      } else {
        // Fallback: parse JSON from text block
        const textBlock = messageContent.find((block) => Boolean(block.text));
        if (textBlock && textBlock.text) {
          const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            rawOutput = JSON.parse(jsonMatch[0]);
          } else {
            rawOutput = JSON.parse(textBlock.text);
          }
        }
      }
    } catch (err) {
      // Map error into VisionAnalysisError
      throw mapBedrockError(err);
    }

    // 3. Strict Zod Schema Validation
    const parsed = VisionAnalysisOutputSchema.safeParse(rawOutput);
    if (!parsed.success) {
      throw new VisionAnalysisError({
        code: "INVALID_MODEL_OUTPUT",
        message: `Model output failed schema validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        details: parsed.error.format(),
      });
    }

    const validated: VisionAnalysisOutput = parsed.data;
    const totalMs = Date.now() - startTime;

    // 4. Construct provider-neutral AccessibilityObservation
    return {
      id: `obs_bedrock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      evidenceId: input.evidence.id,
      entranceId: input.evidence.entranceId,
      pathwayClear: validated.pathwayClear,
      obstructionPresent: validated.obstructionPresent,
      doorReady: validated.doorReady,
      confidence: validated.confidence,
      evidenceQuality: validated.evidenceQuality,
      observedFeatures: validated.observedFeatures,
      observedAt,
      analyzer: this.analyzerName,
      analyzerVersion: this.analyzerVersion,
      modelId: this.config.modelId,
      modelRegion: this.config.region,
      isSimulated: input.evidence.isSimulated,
      explanation: validated.explanation,
      timingMs: {
        totalMs,
        inferenceMs,
      },
    };
  }
}
