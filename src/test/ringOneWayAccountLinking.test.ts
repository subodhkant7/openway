import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { resetGlobalStorage, getStorageProvider } from "@/persistence";
import { DEMO_IDS } from "@/persistence/bootstrap";
import {
  encryptToken,
  decryptToken,
  validateIndependentTokenKey,
  RingAccountLinkingService,
} from "@/ring/accountLinking";
import { RingWebhookHandler } from "@/ring/webhook";
import { POST as exchangeRoute } from "@/app/api/ring/oauth/exchange/route";
import { POST as linkRoute, GET as getLinkRoute } from "@/app/api/ring/oauth/link/route";
import { POST as unlinkRoute } from "@/app/api/ring/oauth/unlink/route";
import { POST as webhookRoute } from "@/app/api/ring/webhook/route";

describe("Ring One-Way Account Linking & Token Management", () => {
  const originalEnv = process.env;
  const TEST_HMAC_KEY = "test_official_ring_hmac_signing_key_44321";
  const TEST_TOKEN_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32-byte hex
  const TEST_CLIENT_ID = "ava1.ring.client.openway_test_app";
  const TEST_CLIENT_SECRET = "test_ring_client_secret_xyz987";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      RING_HMAC_SIGNING_KEY: TEST_HMAC_KEY,
      RING_TOKEN_ENCRYPTION_KEY: TEST_TOKEN_KEY,
      RING_CLIENT_ID: TEST_CLIENT_ID,
      RING_CLIENT_SECRET: TEST_CLIENT_SECRET,
      RING_OAUTH_BASE_URL: "https://oauth.ring.com",
      RING_API_BASE_URL: "https://api.amazonvision.com",
      OPENWAY_PROVIDER: "simulator",
      NODE_ENV: "test",
    };
    resetGlobalStorage();
    RingWebhookHandler.resetCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Dedicated Token Encryption Key & Cryptographic Helpers", () => {
    it("encrypts and decrypts OAuth tokens correctly using AES-256-GCM", () => {
      const originalToken = "Atza|test_ring_access_token_super_secret_payload_98765";
      const encrypted = encryptToken(originalToken);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes in hex = 32 chars
      expect(encrypted.ciphertext).not.toContain(originalToken);

      const decrypted = decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(originalToken);
    });

    it("detects tampering with ciphertext or authTag and fails closed", () => {
      const originalToken = "Atza|integrity_test_token";
      const encrypted = encryptToken(originalToken);

      // Tamper with the ciphertext
      const tamperedCiphertext =
        encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.slice(-2) === "aa" ? "bb" : "aa");

      expect(() => {
        decryptToken(tamperedCiphertext, encrypted.iv, encrypted.authTag);
      }).toThrow();

      // Tamper with the authentication tag
      const tamperedTag =
        encrypted.authTag.slice(0, -2) + (encrypted.authTag.slice(-2) === "00" ? "11" : "00");

      expect(() => {
        decryptToken(encrypted.ciphertext, encrypted.iv, tamperedTag);
      }).toThrow();
    });

    it("rejects identical token-encryption key and HMAC key or client secrets", () => {
      // Reusing HMAC key as token encryption key must be rejected
      expect(() => {
        validateIndependentTokenKey(TEST_HMAC_KEY);
      }).toThrow(/SECURITY VIOLATION.*RING_HMAC_SIGNING_KEY/);

      // Reusing client secret as token encryption key must be rejected
      expect(() => {
        validateIndependentTokenKey(TEST_CLIENT_SECRET);
      }).toThrow(/SECURITY VIOLATION.*RING_CLIENT_SECRET/);
    });
  });

  describe("2. Token Exchange Endpoint (/api/ring/oauth/exchange)", () => {
    it("rejects requests missing an authorization code with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/ring/oauth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await exchangeRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("INVALID_REQUEST");
    });

    it("returns 500 when server-side Ring client credentials are not configured", async () => {
      delete process.env.RING_CLIENT_ID;
      delete process.env.RING_CLIENT_SECRET;

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "test_auth_code_123" }),
      });

      const res = await exchangeRoute(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("CONFIGURATION_ERROR");
      expect(JSON.stringify(data)).not.toContain(TEST_CLIENT_SECRET);
    });

    it("successfully exchanges authorization code, verifies Account ID via /v1/users/me, and stores unclaimed token", async () => {
      const mockAccountId = "ava1.ring.account.user_john_doe_999";
      const mockAccessToken = "Atza|test_exchanged_access_token";
      const mockRefreshToken = "Atzr|test_exchanged_refresh_token";

      // Mock upstream Ring OAuth server and Amazon Vision Users API
      const fetchMock = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/oauth/token")) {
          return new Response(
            JSON.stringify({
              access_token: mockAccessToken,
              refresh_token: mockRefreshToken,
              expires_in: 14400,
              token_type: "Bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (urlStr.includes("/v1/users/me")) {
          return new Response(
            JSON.stringify({
              data: {
                id: mockAccountId,
                type: "users",
                attributes: {
                  first_name: "John",
                  last_name: "Doe",
                  email: "john@example.com",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      });

      global.fetch = fetchMock as unknown as typeof fetch;

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "valid_ring_oauth_code_abc123" }),
      });

      const res = await exchangeRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(data.status).toBe("unclaimed_stored");

      // Verify token was stored in unclaimed repository
      const storage = getStorageProvider();
      const unclaimed = await storage.accountLinks.findUnclaimedTokenByAccountId(mockAccountId);
      expect(unclaimed).not.toBeNull();
      expect(unclaimed?.ringAccountId).toBe(mockAccountId);

      // Verify tokens were encrypted at rest and decrypt correctly
      const decryptedAccess = decryptToken(unclaimed!.encryptedAccessToken, unclaimed!.iv, unclaimed!.authTag);
      expect(decryptedAccess).toBe(mockAccessToken);
    });

    it("handles upstream OAuth errors safely without exposing codes or secrets", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        if (url.toString().includes("/oauth/token")) {
          return new Response(
            JSON.stringify({ error: "invalid_grant", error_description: "Code has expired" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "expired_code_xyz" }),
      });

      const res = await exchangeRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("UPSTREAM_TOKEN_EXCHANGE_FAILED");
      expect(JSON.stringify(data)).not.toContain("expired_code_xyz");
    });
  });

  describe("3. Nonce Verification & Account Linking Flow (/api/ring/oauth/link)", () => {
    const mockAccountId = "ava1.ring.account.venue_door_test";
    const mockAccessToken = "Atza|mock_valid_token_for_linking";
    const mockRefreshToken = "Atzr|mock_refresh_token_for_linking";

    beforeEach(async () => {
      // Seed an unclaimed token in storage
      const storage = getStorageProvider();
      const encAccess = encryptToken(mockAccessToken);
      const encRefresh = encryptToken(mockRefreshToken);
      await storage.accountLinks.saveUnclaimedToken({
        ringAccountId: mockAccountId,
        encryptedAccessToken: encAccess.ciphertext,
        encryptedRefreshToken: encRefresh.ciphertext,
        iv: encAccess.iv,
        authTag: encAccess.authTag,
        expiresAt: new Date(Date.now() + 14400 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 900,
      });
    });

    it("computes and matches nonce in URL-safe Base64 without padding and claims account", async () => {
      const timeMs = Date.now();
      const payload = `${timeMs}:${mockAccountId}`;
      // Ring specification: HMAC-SHA256 with URL-safe Base64 without '=' padding
      const expectedNonce = crypto
        .createHmac("sha256", TEST_HMAC_KEY)
        .update(payload, "utf8")
        .digest("base64url");

      // Verify encoding format: URL-safe without padding
      expect(expectedNonce).not.toContain("=");
      expect(expectedNonce).not.toContain("+");
      expect(expectedNonce).not.toContain("/");

      // Mock Ring App-Integrations POST and PATCH calls
      const calls: string[] = [];
      global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v1/accounts/me/app-integrations")) {
          calls.push(`${init?.method} ${urlStr}`);
          if (init?.method === "POST") {
            return new Response(
              JSON.stringify({ data: { type: "app-integrations", attributes: { status: "awaiting" } } }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          if (init?.method === "PATCH") {
            return new Response(
              JSON.stringify({ data: { type: "app-integrations", attributes: { status: "completed" } } }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        }
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: expectedNonce,
          time: timeMs,
          venueId: DEMO_IDS.VENUE_ID,
          operatorId: "operator@maplestcafe.openway.org",
        }),
      });

      const res = await linkRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.ringAccountId).toBe(mockAccountId);
      expect(data.status).toBe("LINKED");

      // Confirm both POST (awaiting) and PATCH (completed) were called in sequence
      expect(calls).toEqual([
        "POST https://api.amazonvision.com/v1/accounts/me/app-integrations",
        "PATCH https://api.amazonvision.com/v1/accounts/me/app-integrations",
      ]);

      // Confirm unclaimed token was deleted atomically upon claim
      const storage = getStorageProvider();
      const unclaimedAfter = await storage.accountLinks.findUnclaimedTokenByAccountId(mockAccountId);
      expect(unclaimedAfter).toBeNull();

      // Confirm claimed account exists under user
      const claimed = await storage.accountLinks.findByUserId("operator@maplestcafe.openway.org");
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe("LINKED");
      expect(claimed?.ringAccountReference).toBe(mockAccountId);
    });

    it("rejects expired nonce (>600s window) with 400 Bad Request", async () => {
      const expiredTimeMs = Date.now() - 650 * 1000; // 650s old
      const payload = `${expiredTimeMs}:${mockAccountId}`;
      const nonce = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("base64url");

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce,
          time: expiredTimeMs,
          venueId: DEMO_IDS.VENUE_ID,
        }),
      });

      const res = await linkRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("NONCE_EXPIRED");
    });

    it("rejects future-dated nonce with 400 Bad Request", async () => {
      const futureTimeMs = Date.now() + 60 * 1000; // 60s in future
      const payload = `${futureTimeMs}:${mockAccountId}`;
      const nonce = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("base64url");

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce,
          time: futureTimeMs,
          venueId: DEMO_IDS.VENUE_ID,
        }),
      });

      const res = await linkRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("FUTURE_TIMESTAMP");
    });

    it("rejects forged or invalid nonces with 400 Bad Request", async () => {
      const timeMs = Date.now();
      const invalidNonce = "invalid_forged_nonce_random_bits_12345";

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: invalidNonce,
          time: timeMs,
          venueId: DEMO_IDS.VENUE_ID,
        }),
      });

      const res = await linkRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("NONCE_MISMATCH");
    });

    it("rejects cross-tenant linking attempts with 403 Forbidden", async () => {
      const timeMs = Date.now();
      const payload = `${timeMs}:${mockAccountId}`;
      const nonce = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("base64url");

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce,
          time: timeMs,
          venueId: "venue_unauthorized_external_corp",
        }),
      });

      const res = await linkRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("FORBIDDEN");
    });

    it("prevents double-claiming under concurrent requests", async () => {
      const timeMs = Date.now();
      const payload = `${timeMs}:${mockAccountId}`;
      const nonce = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("base64url");

      global.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

      // First claim
      const req1 = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce, time: timeMs, venueId: DEMO_IDS.VENUE_ID }),
      });
      const res1 = await linkRoute(req1);
      expect(res1.status).toBe(200);

      // Second claim with same nonce/token
      const req2 = new NextRequest("http://localhost:3000/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce, time: timeMs, venueId: DEMO_IDS.VENUE_ID }),
      });
      const res2 = await linkRoute(req2);
      expect(res2.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("4. Automated Token Refresh & Account Unlinking", () => {
    it("proactively refreshes tokens nearing expiration (< 5 mins)", async () => {
      const storage = getStorageProvider();
      const service = new RingAccountLinkingService(storage);

      const oldAccess = "Atza|old_access_token";
      const oldRefresh = "Atzr|old_refresh_token";
      const newAccess = "Atza|new_refreshed_access_token_12345";
      const newRefresh = "Atzr|new_refreshed_refresh_token_67890";

      // Link account expiring in 3 minutes (within 5-minute threshold)
      await service.linkAccount({
        partnerUserId: "user_refresh_test",
        ringAccountReference: "ava1.ring.account.refresh_test",
        accessToken: oldAccess,
        refreshToken: oldRefresh,
        expiresInSeconds: 180, // 3 minutes
      });

      // Mock upstream OAuth refresh
      global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (url.toString().includes("/oauth/token")) {
          const bodyStr = init?.body?.toString() || "";
          expect(bodyStr).toContain("grant_type=refresh_token");
          return new Response(
            JSON.stringify({
              access_token: newAccess,
              refresh_token: newRefresh,
              expires_in: 14400,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      }) as unknown as typeof fetch;

      const tokenResult = await service.getValidAccessToken("user_refresh_test");
      expect(tokenResult.status).toBe("REFRESHED");
      expect(tokenResult.accessToken).toBe(newAccess);

      // Verify rotated credentials in persistent storage
      const stored = await storage.accountLinks.findByUserId("user_refresh_test");
      expect(stored).not.toBeNull();
      const decryptedStored = decryptToken(stored!.encryptedAccessToken, stored!.iv, stored!.authTag);
      expect(decryptedStored).toBe(newAccess);
    });

    it("moves link to ACCOUNT_RELINK_REQUIRED if upstream token refresh fails or is revoked", async () => {
      const storage = getStorageProvider();
      const service = new RingAccountLinkingService(storage);

      await service.linkAccount({
        partnerUserId: "user_revoked_test",
        ringAccountReference: "ava1.ring.account.revoked",
        accessToken: "expired_token",
        refreshToken: "revoked_refresh_token",
        expiresInSeconds: 60, // 1 minute
      });

      // Mock upstream OAuth returning 400 invalid_grant
      global.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Refresh token revoked" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch;

      const tokenResult = await service.getValidAccessToken("user_revoked_test");
      expect(tokenResult.status).toBe("ACCOUNT_RELINK_REQUIRED");
      expect(tokenResult.error).toContain("Re-linking required");

      const stored = await storage.accountLinks.findByUserId("user_revoked_test");
      expect(stored?.status).toBe("ACCOUNT_RELINK_REQUIRED");
    });

    it("unlinks account and purges local credentials via /api/ring/oauth/unlink", async () => {
      const storage = getStorageProvider();
      const service = new RingAccountLinkingService(storage);

      await service.linkAccount({
        partnerUserId: "operator_venue_maple_cafe",
        ringAccountReference: "ava1.ring.account.disconnect_me",
        accessToken: "to_be_deleted",
        refreshToken: "to_be_deleted_refresh",
        expiresInSeconds: 3600,
        venueId: DEMO_IDS.VENUE_ID,
      });

      const req = new NextRequest("http://localhost:3000/api/ring/oauth/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: DEMO_IDS.VENUE_ID }),
      });

      const res = await unlinkRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.unlinked).toBe(true);

      const status = await service.getAccountStatus("operator_venue_maple_cafe");
      expect(status).toBe("ONBOARDING_REQUIRED");
    });
  });

  describe("5. Webhook Hardening & Lifecycle Events", () => {
    it("validates HMAC-SHA256 signature using RING_HMAC_SIGNING_KEY and timing-safe comparison", () => {
      const payload = JSON.stringify({
        meta: { version: "1.1", request_id: "req_wh_test_1" },
        data: { id: "dev_motion_1", type: "motion", attributes: { source: "cam_1" } },
      });

      const validSig = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("hex");
      const result = RingWebhookHandler.verifySignature(payload, validSig);
      expect(result.isValid).toBe(true);

      const invalidSig = "a".repeat(64);
      const invalidResult = RingWebhookHandler.verifySignature(payload, invalidSig);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toContain("mismatch");
    });

    it("rejects malformed signature strings", () => {
      const payload = '{"test":true}';
      const result = RingWebhookHandler.verifySignature(payload, "malformed_short_sig");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Malformed");
    });

    it("handles app_integration_removed lifecycle webhook event and cleans up local account link", async () => {
      const storage = getStorageProvider();
      const service = new RingAccountLinkingService(storage);

      const accountId = "ava1.ring.account.unlinked_by_ring_user";
      await service.linkAccount({
        partnerUserId: "operator_demo_linked",
        ringAccountReference: accountId,
        accessToken: "linked_token",
        refreshToken: "linked_refresh",
        expiresInSeconds: 3600,
        venueId: accountId,
      });

      const payload = JSON.stringify({
        meta: {
          version: "1.1",
          request_id: "req_removal_event_999",
          account_id: accountId,
        },
        data: {
          id: "ev_removal_1",
          type: "app_integration_removed",
          attributes: {
            source: accountId,
            source_type: "users",
            timestamp: Date.now(),
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("hex");

      const req = new NextRequest("http://localhost:3000/api/ring/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
        body: payload,
      });

      const res = await webhookRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(data.status).toBe("accepted");

      // Verify account was removed from storage
      const stored = await storage.accountLinks.findByVenueId(accountId);
      expect(stored).toBeNull();
    });

    it("deduplicates repeat webhook deliveries idempotently", () => {
      const payload = JSON.stringify({
        meta: { version: "1.1", request_id: "repeat_req_123" },
        data: { id: "repeat_ev_1", type: "motion", attributes: { source: "cam_1" } },
      });
      const sig = crypto.createHmac("sha256", TEST_HMAC_KEY).update(payload).digest("hex");

      const first = RingWebhookHandler.processWebhook(payload, sig);
      expect(first.status).toBe("accepted");

      const second = RingWebhookHandler.processWebhook(payload, sig);
      expect(second.status).toBe("duplicate");
    });
  });
});
