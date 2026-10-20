import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { RingWebhookHandler } from "@/ring/webhook";

describe("RingWebhookHandler", () => {
  const secret = "test_webhook_secret_key_12345";

  beforeEach(() => {
    RingWebhookHandler.resetCache();
  });

  const sign = (body: string, s: string) => {
    return crypto.createHmac("sha256", s).update(body, "utf8").digest("hex");
  };

  it("accepts and normalizes an official Ring Webhook v1.1 payload", () => {
    // Documented official Ring v1.1 payload format
    const officialPayload = {
      meta: {
        version: "1.1",
        time: "2026-10-05T12:00:00.000Z",
        request_id: "req_c83081fc_2f1b_4cb7",
        account_id: "ava1.ring.account.test_123",
      },
      data: {
        id: "cam_front_entrance_motion_1771027372",
        type: "motion",
        attributes: {
          source: "cam_front_entrance",
          source_type: "devices",
          timestamp: 1771027372393,
        },
        relationships: {
          devices: {
            links: {
              self: "/v1/devices/cam_front_entrance",
            },
          },
        },
      },
    };

    const rawBody = JSON.stringify(officialPayload);
    const signature = sign(rawBody, secret);

    const result = RingWebhookHandler.processWebhook(rawBody, signature, secret);

    expect(result.status).toBe("accepted");
    expect(result.eventId).toBe("req_c83081fc_2f1b_4cb7");
    expect(result.normalizedEvent).toBeDefined();
    expect(result.normalizedEvent?.eventType).toBe("motion");
    expect(result.normalizedEvent?.deviceId).toBe("cam_front_entrance");
    expect(result.normalizedEvent?.eventCategory).toBe("official_ring");
  });

  it("accepts official button_press doorbell event type", () => {
    const doorbellPayload = {
      meta: {
        version: "1.1",
        time: "2026-10-05T12:05:00.000Z",
        request_id: "req_doorbell_99",
      },
      data: {
        id: "cam_doorbell_123_button_press",
        type: "button_press",
        attributes: {
          source: "cam_doorbell_123",
          source_type: "devices",
        },
      },
    };

    const rawBody = JSON.stringify(doorbellPayload);
    const signature = sign(rawBody, secret);

    const result = RingWebhookHandler.processWebhook(rawBody, signature, secret);

    expect(result.status).toBe("accepted");
    expect(result.normalizedEvent?.eventType).toBe("button_press");
    expect(result.normalizedEvent?.deviceId).toBe("cam_doorbell_123");
  });

  it("accepts valid signatures with sha256= prefix format", () => {
    const payload = JSON.stringify({
      meta: { request_id: "req_prefix_test" },
      data: { id: "d_prefix", type: "motion", attributes: { source: "cam_prefix" } },
    });
    const hexSig = sign(payload, secret);
    const prefixedSig = `sha256=${hexSig}`;

    const result = RingWebhookHandler.processWebhook(payload, prefixedSig, secret);
    expect(result.status).toBe("accepted");
    expect(result.eventId).toBe("req_prefix_test");
  });

  it("rejects an invalid HMAC signature with SIGNATURE_INVALID", () => {
    const payload = {
      meta: { request_id: "req_invalid_sig" },
      data: { id: "d_1", type: "motion" },
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

  it("rejects malformed signature header formats (wrong length or non-hex)", () => {
    const payload = JSON.stringify({
      meta: { request_id: "req_malformed_sig" },
      data: { id: "d_1", type: "motion" },
    });

    // Too short
    expect(() =>
      RingWebhookHandler.processWebhook(payload, "sha256=abcd1234", secret)
    ).toThrowError(
      expect.objectContaining({
        code: "SIGNATURE_INVALID",
        statusCode: 401,
      })
    );

    // Non-hex characters
    expect(() =>
      RingWebhookHandler.processWebhook(
        payload,
        "sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
        secret
      )
    ).toThrowError(
      expect.objectContaining({
        code: "SIGNATURE_INVALID",
        statusCode: 401,
      })
    );
  });

  it("rejects a malformed JSON payload with INVALID_EVENT", () => {
    const rawBody = "{ invalid_json: ";
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

  it("handles duplicate event deliveries idempotently using request_id", () => {
    const payload = {
      meta: {
        request_id: "req_idempotent_duplicate_check",
      },
      data: {
        id: "ev_idemp_01",
        type: "motion",
        attributes: { source: "cam_ramp" },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = sign(rawBody, secret);

    // First arrival: accepted
    const firstResult = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(firstResult.status).toBe("accepted");

    // Second arrival: duplicate acknowledged idempotently
    const secondResult = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(secondResult.status).toBe("duplicate");
    expect(secondResult.eventId).toBe("req_idempotent_duplicate_check");
  });

  it("safely accepts direct simulator payloads for local testing", () => {
    const simulatorPayload = {
      event_id: "sim_direct_101",
      event_type: "simulated_motion",
      device_id: "sim_cam_01",
      timestamp: new Date().toISOString(),
    };

    const rawBody = JSON.stringify(simulatorPayload);
    const signature = sign(rawBody, secret);

    const result = RingWebhookHandler.processWebhook(rawBody, signature, secret);
    expect(result.status).toBe("accepted");
    expect(result.normalizedEvent?.eventType).toBe("simulated_motion");
  });
});
