import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimitCache } from "@/lib/rateLimit";
import { isValidRingMediaHost } from "@/ring/RingClient";
import { DynamoKeys } from "@/persistence/dynamo/schema";
import { DEMO_IDS } from "@/persistence/bootstrap";

describe("Phase 6 Security, Tenant Isolation & Concurrency Defenses", () => {
  beforeEach(() => {
    clearRateLimitCache();
  });

  describe("1. Demo Tenant Isolation & Key Sanitization", () => {
    it("ensures DynamoDB key generators sanitize and scope partitions correctly", () => {
      const venueKey = DynamoKeys.venuePk("venue_alpha");
      expect(venueKey).toBe("VENUE#venue_alpha");

      const entranceKey = DynamoKeys.entrancePk("entrance_beta");
      expect(entranceKey).toBe("ENTRANCE#entrance_beta");

      const currentAssessKey = DynamoKeys.currentAssessmentPk("entrance_beta");
      expect(currentAssessKey).toBe("ENTRANCE#entrance_beta");
    });

    it("verifies demo tenant constants point exclusively to isolated demo venue", () => {
      expect(DEMO_IDS.VENUE_ID).toBe("venue_maple_cafe");
      expect(DEMO_IDS.ENTRANCE_ID).toBe("entrance_side_accessible");
    });
  });

  describe("2. Public Endpoint Rate Limiting", () => {
    it("permits requests within configured window and rejects excessive requests", () => {
      const clientKey = "test_judge_ip_01";
      const options = { windowMs: 1000, maxRequests: 3 };

      const r1 = checkRateLimit(clientKey, options);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(clientKey, options);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(clientKey, options);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request exceeds limit
      const r4 = checkRateLimit(clientKey, options);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.resetMs).toBeGreaterThan(0);
    });
  });

  describe("3. SSRF & Arbitrary Media Host Validation", () => {
    it("permits official Ring and AWS domains", () => {
      expect(isValidRingMediaHost("https://api.amazonvision.com/v1/media/123")).toBe(true);
      expect(isValidRingMediaHost("https://ring-media-us-east-1.s3.amazonaws.com/snap.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://media.ring.com/download/clip")).toBe(true);
    });

    it("strictly rejects internal loopback, AWS IMDS, and arbitrary external domains", () => {
      expect(isValidRingMediaHost("http://127.0.0.1/evil")).toBe(false);
      expect(isValidRingMediaHost("http://localhost:8080/token")).toBe(false);
      expect(isValidRingMediaHost("http://169.254.169.254/latest/meta-data/")).toBe(false);
      expect(isValidRingMediaHost("https://attacker-controlled-site.com/media")).toBe(false);
      expect(isValidRingMediaHost("https://not-really-ring.com.evil.com/img")).toBe(false);
    });
  });
});
