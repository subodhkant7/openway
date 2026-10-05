import { z } from "zod";
import { ObservationValue } from "@/evidence/types";

/**
 * Strict tri-state observation values.
 * Explicitly avoids JavaScript nullable boolean ambiguity.
 */
export const ObservationValueSchema = z.enum(["TRUE", "FALSE", "UNKNOWN"]);

/**
 * Strict Machine-Readable Vision Analysis Output Schema.
 * Constrains Bedrock vision analysis output to environmental observations only.
 *
 * CRITICAL ARCHITECTURAL RULE:
 * The model output MUST NOT contain state transitions (e.g. "state": "VERIFIED_RESTORED").
 * Any extraneous fields are rejected with .strict().
 */
export const VisionAnalysisOutputSchema = z
  .object({
    pathwayClear: ObservationValueSchema.describe(
      "TRUE if the accessible path/ramp is clearly free of obstacles; FALSE if blocked; UNKNOWN if unobservable or uncertain."
    ),
    obstructionPresent: ObservationValueSchema.describe(
      "TRUE if an obstacle or package is physically present; FALSE if confirmed absent; UNKNOWN if unobservable or uncertain."
    ),
    doorReady: ObservationValueSchema.describe(
      "TRUE if the entrance doorway/push-plate is clear and accessible; FALSE if blocked/inaccessible; UNKNOWN if unobservable or uncertain."
    ),
    confidence: z
      .number()
      .min(0.0)
      .max(1.0)
      .describe("Statistical observation confidence score (0.0 to 1.0). Never decides state alone."),
    evidenceQuality: z
      .enum(["SUFFICIENT", "INSUFFICIENT"])
      .describe("SUFFICIENT if the entrance and pathway are adequately illuminated and visible; INSUFFICIENT if occluded, dark, or blurry."),
    observedFeatures: z
      .array(z.string().max(100))
      .max(10)
      .describe("List of camera-observable physical elements identified (e.g. ['ramp surface', 'handrail', 'package box'])."),
    explanation: z
      .string()
      .min(3)
      .max(500)
      .describe("Concise, factual, evidence-oriented description of observed conditions. No legal or ADA claims."),
  })
  .strict();

export type VisionAnalysisOutput = z.infer<typeof VisionAnalysisOutputSchema>;

/**
 * JSON Schema specification matching VisionAnalysisOutputSchema.
 * Used for platform-enforced structured output (tool calling / JSON schema definition).
 */
export const BEDROCK_OBSERVATION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    pathwayClear: {
      type: "string",
      enum: ["TRUE", "FALSE", "UNKNOWN"],
      description: "TRUE if the accessible pathway is clearly free of obstacles, FALSE if blocked, UNKNOWN if uncertain.",
    },
    obstructionPresent: {
      type: "string",
      enum: ["TRUE", "FALSE", "UNKNOWN"],
      description: "TRUE if a physical obstruction is present, FALSE if verified absent, UNKNOWN if uncertain.",
    },
    doorReady: {
      type: "string",
      enum: ["TRUE", "FALSE", "UNKNOWN"],
      description: "TRUE if doorway is clear and ready, FALSE if blocked, UNKNOWN if uncertain.",
    },
    confidence: {
      type: "number",
      minimum: 0.0,
      maximum: 1.0,
      description: "Statistical vision confidence between 0.0 and 1.0.",
    },
    evidenceQuality: {
      type: "string",
      enum: ["SUFFICIENT", "INSUFFICIENT"],
      description: "SUFFICIENT if lighting and field of view are adequate; INSUFFICIENT if dark, glare, or occluded.",
    },
    observedFeatures: {
      type: "array",
      items: { type: "string" },
      description: "List of camera-observable physical elements identified.",
    },
    explanation: {
      type: "string",
      description: "Concise factual description of physical conditions. Do not include legal or building-code compliance claims.",
    },
  },
  required: [
    "pathwayClear",
    "obstructionPresent",
    "doorReady",
    "confidence",
    "evidenceQuality",
    "observedFeatures",
    "explanation",
  ],
  additionalProperties: false,
};

