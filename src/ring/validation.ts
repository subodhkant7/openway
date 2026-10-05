import { z } from "zod";

/**
 * Environment Variables Schema
 */
export const EnvSchema = z.object({
  OPENWAY_PROVIDER: z.enum(["simulator", "playground", "api"]).default("simulator"),
  RING_ACCESS_TOKEN: z.string().optional(),
  RING_API_BASE_URL: z.string().url().default("https://api.amazonvision.com"),
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
 * Raw Ring API Device Schema (flexible for Ring Partner API / AVA shapes)
 */
export const RawRingDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional().default("Ring Camera"),
  description: z.string().optional(),
  kind: z.string().optional().default("camera"),
  device_type: z.string().optional(),
  status: z
    .union([
      z.string(),
      z.object({
        state: z.string().optional(),
        online: z.boolean().optional(),
      }),
    ])
    .optional(),
  capabilities: z
    .union([
      z.record(z.any()),
      z.array(z.string()),
    ])
    .optional(),
  components: z.array(z.string()).optional(),
  battery_level: z.number().optional(),
  firmware_version: z.string().optional(),
  location_id: z.string().optional(),
});

export const RawRingDeviceListSchema = z.union([
  z.array(RawRingDeviceSchema),
  z.object({
    devices: z.array(RawRingDeviceSchema),
  }),
  z.object({
    data: z.array(
      z.object({
        id: z.string(),
        type: z.string().optional(),
        attributes: z.record(z.any()).optional(),
      })
    ),
  }),
]);

/**
 * Raw Ring Webhook Payload Schema
 */
export const RawRingWebhookPayloadSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  device_id: z.string().min(1),
  timestamp: z.string().or(z.number()),
  components: z.array(z.string()).optional().default([]),
  source: z.string().optional().default("ring_webhook"),
  data: z.record(z.any()).optional(),
});

export type RawRingWebhookPayload = z.infer<typeof RawRingWebhookPayloadSchema>;
