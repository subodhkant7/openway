import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { RingWebhookHandler } from "@/ring/webhook";
import { RingProviderError } from "@/ring/errors";

describe("RingWebhookHandler", () => {
  const secret = "test_webhook_secret_key_12345";

  beforeEach(() => {
    RingWebhookHandler.resetCache();
  });

  const sign = (body: string, s: string) => {
    return crypto.createHmac("sha256", s).update(body, "utf8").digest("hex");
  };

  it("accepts and normalizes a valid signed Ring webhook event", () => {
    const payload = {
      event_id: "evt_101",
      event_type: "motion",
      device_id: "cam_front_entrance",
      timestamp: new Date().toISOString(),
      components: ["motion_sensor"],
      source: "ring_device",
    };

    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, secret);

    const result = RingWebhookHandler.processWebhook(rawBody, signature, secret);

    expect(result.status).toBe("accepted");
    expect(result.eventId).toBe("evt_101");
    expect(result.normalizedEvent).toBeDefined();
    expect(result.normalizedEvent?.eventType).toBe("motion");
    expect(result.normalizedEvent?.deviceId).toBe("cam_front_entrance");
    expect(result.normalizedEvent?.provider).toBe("ring_api");
  });

  it("rejects an invalid HMAC signature with SIGNATURE_INVALID", () => {
    const payload = {
      event_id: "evt_102",
      event_type: "motion",
      device_id: "cam_01",
      timestamp: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(payload);
    const badSignature = "0000000000000000000000000000000000000000000000000000000000000000";

    expect(() =>
      RingWebhookHandler.processWebhook(rawBody, badSignature, secret)
    ).toThrowError(
      expect.objectContaining({
        code: "SIGNATURE_INVALID",
        statusCode: 401,
      })
    );
  });

  it("rejects a malformed JSON payload with INVALID_EVENT", () => {
    const rawBody = "{ not_valid_json: }";
    const signature = sign(rawBody, secret);

    expect(() =>
      RingWebhookHandler.processWebhook(rawBody, signature, secret)
    ).toThrowError(
      expect.objectContaining({
        code: "INVALID_EVENT",
        statusCode: 400,
      })
    );
  });

  it("rejects a payload missing mandatory fields with INVALID_EVENT", () => {
    const rawBody = JSON.stringify({
      // missing event_id and device_id
      event_type: "motion",
      timestamp: 1234567,
    });
    const signature = sign(rawBody, secret);

    expect(() =>
      RingWebhookHandler.processWebhook(rawBody, signature, secret)
    ).toThrowError(
      expect.objectContaining({
        code: "INVALID_EVENT",
        statusCode: 400,
      })
    );
  });

  it("handles duplicate event deliveries idempotently without re-triggering logic", () => {
    const payload = {
      event_id: "evt_duplicate_test_01",
      event_type: "motion",
      device_id: "cam_side_door",
      timestamp: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, secret);

    // First arrival: accepted
    const firstResult = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(firstResult.status).toBe("accepted");

    // Second arrival: duplicate acknowledged idempotently
    const secondResult = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(secondResult.status).toBe("duplicate");
    expect(secondResult.eventId).toBe("evt_duplicate_test_01");
  });

  it("safely accepts and normalizes custom/unsupported event types without crashing", () => {
    const payload = {
      event_id: "evt_custom_unknown_999",
      event_type: "future_laser_beam_sensor_break",
      device_id: "cam_special",
      timestamp: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, secret);

    const result = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(result.status).toBe("accepted");
    expect(result.normalizedEvent?.eventType).toBe("future_laser_beam_sensor_break");
  });
});
