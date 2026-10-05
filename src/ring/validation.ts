import { z } from "zod";

/**
 * Environment Variables Schema
 */
export const EnvSchema = z.object({
  OPENWAY_PROVIDER: z.enum(["simulator", "playground", "api"]).default("simulator"),
  RING_ACCESS_TOKEN: z.string().optional(),
  RING_API_BASE_URL: z.string().url().default("https://api.amazonvision.com"),
  RING_OAUTH_BASE_URL: z.string().url().default("https://oauth.ring.com"),
  RING_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

/**
 * Helper to safely parse and validate environment variables
 */
export function getValidatedEnv(): ValidatedEnv {
  const result = EnvSchema.safeParse({
    OPENWAY_PROVIDER: process.env.OPENWAY_PROVIDER,
    RING_ACCESS_TOKEN: process.env.RING_ACCESS_TOKEN,
    RING_API_BASE_URL: process.env.RING_API_BASE_URL || "https://api.amazonvision.com",
    RING_OAUTH_BASE_URL: process.env.RING_OAUTH_BASE_URL || "https://oauth.ring.com",
    RING_WEBHOOK_SECRET: process.env.RING_WEBHOOK_SECRET,
    PORT: process.env.PORT || "3000",
    NODE_ENV: process.env.NODE_ENV || "development",
  });

  if (!result.success) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  return result.data;
}

/**
 * JSON:API Resource Schema (Official Ring Partner API format)
 */
export const JsonApiResourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  attributes: z.record(z.any()).optional().default({}),
  relationships: z
    .record(
      z.object({
        data: z
          .union([
            z.object({ id: z.string(), type: z.string() }),
            z.array(z.object({ id: z.string(), type: z.string() })),
          ])
          .optional(),
        links: z.record(z.string()).optional(),
      })
    )
    .optional(),
  links: z.record(z.string()).optional(),
});

export const JsonApiDocumentSchema = z.object({
  data: z.union([JsonApiResourceSchema, z.array(JsonApiResourceSchema)]),
  included: z.array(JsonApiResourceSchema).optional(),
  meta: z.record(z.any()).optional(),
  links: z.record(z.string()).optional(),
  errors: z
    .array(
      z.object({
        id: z.string().optional(),
        status: z.string().optional(),
        code: z.string().optional(),
        title: z.string().optional(),
        detail: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Official Ring Webhook v1.1 Schema
 * Reflects documented structure with meta.request_id, meta.account_id, and data envelope.
 */
export const OfficialRingWebhookV1_1Schema = z.object({
  meta: z.object({
    version: z.string().optional().default("1.1"),
    time: z.string().optional(),
    request_id: z.string().optional(),
    account_id: z.string().optional(),
  }),
  data: z.object({
    id: z.string().min(1),
    type: z.string().min(1), // e.g. "button_press", "motion", "device_online"
    attributes: z
      .object({
        source: z.string().optional(), // deviceId
        source_type: z.string().optional(),
        timestamp: z.union([z.string(), z.number()]).optional(),
        event_type: z.string().optional(),
      })
      .optional()
      .default({}),
    relationships: z.record(z.any()).optional(),
  }),
});

/**
 * Simulator / Legacy Direct Webhook Schema
 */
export const DirectRingWebhookSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  device_id: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]),
  components: z.array(z.string()).optional().default([]),
  source: z.string().optional().default("simulator_webhook"),
  data: z.record(z.any()).optional(),
});

/**
 * Unified Ingestion Schema (accepts documented v1.1 structure or direct simulator payload)
 */
export const RingWebhookPayloadSchema = z.union([
  OfficialRingWebhookV1_1Schema,
  DirectRingWebhookSchema,
]);

export type RingWebhookPayload = z.infer<typeof RingWebhookPayloadSchema>;

/**
 * Official Ring Image Download Request Schema
 * Endpoint: POST /v1/devices/{device_id}/media/image/download
 */
export const RingImageDownloadRequestSchema = z.object({
  components: z.array(z.string()).min(1).default(["camera"]),
  format: z.enum(["jpeg", "png"]).optional().default("jpeg"),
});

export type RingImageDownloadRequest = z.infer<typeof RingImageDownloadRequestSchema>;
