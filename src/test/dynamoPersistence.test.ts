import { describe, it, expect } from "vitest";
import { DynamoKeys } from "@/persistence/dynamo/schema";
import { OptimisticLockError, withOptimisticRetry } from "@/persistence/dynamo/concurrency";
import { encryptToken, decryptToken, RingAccountLinkingService } from "@/ring/accountLinking";

describe("DynamoDB Persistence & Concurrency Engine (Phase 6)", () => {
  describe("Single-Table Schema Key Conventions", () => {
    it("generates correct partition and sort keys for all domain entities", () => {
      expect(DynamoKeys.venuePk("v1")).toBe("VENUE#v1");
      expect(DynamoKeys.venueSk()).toBe("METADATA");

      expect(DynamoKeys.entrancePk("e1")).toBe("ENTRANCE#e1");
      expect(DynamoKeys.entranceGsi1Pk("v1")).toBe("VENUE#v1");
      expect(DynamoKeys.entranceGsi1Sk("e1")).toBe("ENTRANCE#e1");

      expect(DynamoKeys.evidencePk("ev1")).toBe("EVIDENCE#ev1");
      expect(DynamoKeys.evidenceGsi1Pk("e1")).toBe("ENTRANCE#e1");
      expect(DynamoKeys.evidenceGsi1Sk("2026-10-06T10:00:00Z", "ev1")).toBe("EVIDENCE#2026-10-06T10:00:00Z#ev1");

      expect(DynamoKeys.currentAssessmentPk("e1")).toBe("ENTRANCE#e1");
      expect(DynamoKeys.currentAssessmentSk()).toBe("ASSESSMENT#CURRENT");

      expect(DynamoKeys.activeTaskPk("e1")).toBe("ENTRANCE#e1");
      expect(DynamoKeys.activeTaskSk()).toBe("TASK#ACTIVE");

      expect(DynamoKeys.idempotencyPk("req_123")).toBe("IDEMPOTENCY#req_123");
      expect(DynamoKeys.idempotencySk()).toBe("RECORD");
    });
  });

  describe("Optimistic Concurrency & Retry Handler", () => {
    it("succeeds when operation does not throw lock error", async () => {
      let counter = 0;
      const result = await withOptimisticRetry(async () => {
        counter++;
        return `success_${counter}`;
      });
      expect(result).toBe("success_1");
      expect(counter).toBe(1);
    });

    it("retries on OptimisticLockError and resolves on subsequent attempt", async () => {
      let attempts = 0;
      const result = await withOptimisticRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new OptimisticLockError("Conflict", "e1", 1, 2);
          }
          return "resolved_after_retry";
        },
        { maxAttempts: 5, baseDelayMs: 5 }
      );

      expect(result).toBe("resolved_after_retry");
      expect(attempts).toBe(3);
    });

    it("throws when max retry attempts are exceeded", async () => {
      await expect(
        withOptimisticRetry(
          async () => {
            throw new OptimisticLockError("Persistent conflict", "e1", 1, 2);
          },
          { maxAttempts: 2, baseDelayMs: 5 }
        )
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  describe("OAuth Token Encryption at Rest", () => {
    it("encrypts and decrypts OAuth tokens accurately using AES-256-GCM", () => {
      const plaintextToken = "ring_oauth_access_secret_token_12345";
      const encrypted = encryptToken(plaintextToken);

      expect(encrypted.ciphertext).not.toBe(plaintextToken);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(plaintextToken);
    });

    it("safely handles account linking lifecycle and refresh states", async () => {
      const service = new RingAccountLinkingService();

      // User without linked account
      const status1 = await service.getAccountStatus("user_new_01");
      expect(status1).toBe("ONBOARDING_REQUIRED");

      const tokenRes1 = await service.getValidAccessToken("user_new_01");
      expect(tokenRes1.status).toBe("ONBOARDING_REQUIRED");

      // Link an active account with 1 hour expiration
      await service.linkAccount({
        partnerUserId: "user_linked_01",
        ringAccountReference: "ring_acct_abc",
        accessToken: "live_access_tok_999",
        refreshToken: "live_refresh_tok_999",
        expiresInSeconds: 3600,
      });

      const status2 = await service.getAccountStatus("user_linked_01");
      expect(status2).toBe("LINKED");

      const tokenRes2 = await service.getValidAccessToken("user_linked_01");
      expect(tokenRes2.status).toBe("VALID");
      expect(tokenRes2.accessToken).toBe("live_access_tok_999");
    });
  });
});
