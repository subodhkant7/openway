import crypto from "crypto";
import { RingEvent } from "./types";
import { RingProviderError, safeLog } from "./errors";
import { RingWebhookPayloadSchema } from "./validation";

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

export interface WebhookProcessResult {
  status: "accepted" | "duplicate" | "rejected";
  eventId?: string;
  normalizedEvent?: RingEvent;
  message: string;
}

export class RingWebhookHandler {
  // In-memory deduplication cache storing seen event IDs / request IDs with expiration timestamps (TTL: 1 hour)
  private static processedEvents = new Map<string, number>();
  private static readonly TTL_MS = 60 * 60 * 1000;

  /**
   * Verifies the HMAC-SHA256 signature in the X-Signature header against the raw body.
   */
  public static verifySignature(
    rawBody: string,
    signatureHeader: string | null | undefined,
    secret?: string
  ): WebhookVerificationResult {
    const webhookSecret = secret || process.env.RING_WEBHOOK_SECRET;

    // If no secret configured in development, allow if explicitly in simulator or test mode
    if (!webhookSecret) {
      if (process.env.OPENWAY_PROVIDER === "simulator" || process.env.NODE_ENV === "test") {
        return { isValid: true };
      }
      return {
        isValid: false,
        error: "Webhook secret is not configured on the server (RING_WEBHOOK_SECRET missing)",
      };
    }

    if (!signatureHeader) {
      return {
        isValid: false,
        error: "Missing X-Signature header in incoming webhook request",
      };
    }

    try {
      const hmac = crypto.createHmac("sha256", webhookSecret);
      hmac.update(rawBody, "utf8");
      const expectedSignature = hmac.digest("hex");

      // Clean prefix if present (e.g. "sha256=")
      const cleanReceivedSignature = signatureHeader.replace(/^sha256=/, "");

      // Timing-safe buffer comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      const receivedBuffer = Buffer.from(cleanReceivedSignature, "hex");

      if (expectedBuffer.length !== receivedBuffer.length) {
        return { isValid: false, error: "Signature length mismatch" };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
      return {
        isValid,
        error: isValid ? undefined : "HMAC signature mismatch",
      };
    } catch (err) {
      return {
        isValid: false,
        error: `Signature calculation error: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Processes the raw webhook request, ensuring idempotency, safe logging, and normalization.
   */
  public static processWebhook(
    rawBody: string,
    signatureHeader: string | null | undefined,
    secret?: string
  ): WebhookProcessResult {
    // Clean expired entries from deduplication cache
    this.cleanExpiredCache();

    // 1. Verify Signature
    const verification = this.verifySignature(rawBody, signatureHeader, secret);
    if (!verification.isValid) {
      safeLog("warn", "Ring webhook rejected: invalid signature", {
        reason: verification.error,
      });
      throw new RingProviderError({
        code: "SIGNATURE_INVALID",
        message: verification.error || "Invalid webhook signature",
        statusCode: 401,
      });
    }

    // 2. Parse & Validate Payload against official Ring schema
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      throw new RingProviderError({
        code: "INVALID_EVENT",
        message: "Malformed JSON payload in webhook body",
        statusCode: 400,
      });
    }

    const parseResult = RingWebhookPayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      throw new RingProviderError({
        code: "INVALID_EVENT",
        message: `Invalid webhook payload structure: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
        statusCode: 400,
      });
    }

    const payload = parseResult.data;

    // Distinguish official v1.1 structure vs direct schema
    let eventId: string;
    let eventType: string;
    let deviceId: string;
    let timestamp: string;
    let components: string[] = [];

    if ("data" in payload && Boolean(payload.data)) {
      // Official Ring Webhook v1.1 structure
      const official = payload as {
        meta?: { version?: string; time?: string; request_id?: string; account_id?: string };
        data: {
          id: string;
          type: string;
          attributes?: {
            source?: string;
            source_type?: string;
            timestamp?: string | number;
            event_type?: string;
          };
          relationships?: Record<string, unknown>;
        };
      };
      const meta = official.meta || {};
      const data = official.data;
      const attrs = data.attributes || {};

      // Unique event / request ID for deduplication
      eventId = meta.request_id || data.id;
      eventType = attrs.event_type || data.type || "motion";
      deviceId = attrs.source || "unknown_device";

      const rawTime = attrs.timestamp || meta.time || Date.now();
      timestamp = typeof rawTime === "number" ? new Date(rawTime).toISOString() : String(rawTime);
      components = ["camera"];
    } else {
      // Direct / Simulator schema
      const direct = payload as {
        event_id: string;
        event_type: string;
        device_id: string;
        timestamp: string | number;
        components?: string[];
      };
      eventId = direct.event_id;
      eventType = direct.event_type;
      deviceId = direct.device_id;
      timestamp =
        typeof direct.timestamp === "number"
          ? new Date(direct.timestamp).toISOString()
          : String(direct.timestamp);
      components = direct.components || [];
    }

    // 3. Idempotency Check
    if (this.processedEvents.has(eventId)) {
      safeLog("info", "Ring webhook duplicate event ignored idempotently", {
        eventId,
        eventType,
        deviceId,
      });

      return {
        status: "duplicate",
        eventId,
        message: "Duplicate event acknowledged idempotently.",
      };
    }

    // Record event ID in deduplication cache
    this.processedEvents.set(eventId, Date.now() + this.TTL_MS);

    // 4. Normalize Event Model
    const normalizedEvent: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId,
      eventType,
      deviceId,
      timestamp,
      componentIds: components,
      source: "ring_webhook_v1.1",
      receivedAt: new Date().toISOString(),
      summary: `Ring webhook: ${eventType} on device ${deviceId}`,
      rawReference: {
        eventType,
        deviceId,
        eventId,
      },
    };

    safeLog("info", "Ring webhook event normalized successfully", {
      eventId,
      eventType,
      deviceId,
    });

    return {
      status: "accepted",
      eventId,
      normalizedEvent,
      message: "Webhook processed and normalized successfully.",
    };
  }

  /**
   * Helper to clear deduplication cache (useful for testing)
   */
  public static resetCache(): void {
    this.processedEvents.clear();
  }

  private static cleanExpiredCache(): void {
    const now = Date.now();
    this.processedEvents.forEach((expiresAt, id) => {
      if (expiresAt < now) {
        this.processedEvents.delete(id);
      }
    });
  }
}
