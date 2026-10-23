import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RingClient, isValidRingMediaHost } from "@/ring/RingClient";
import { RingPlaygroundProvider } from "@/ring/RingPlaygroundProvider";
import { RingProviderError } from "@/ring/errors";

describe("Live Ring API Contract & Evidence Semantics (Phase 5)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("SSRF Protection (isValidRingMediaHost)", () => {
    it("permits legitimate Ring and AWS S3 media hosts", () => {
      expect(isValidRingMediaHost("https://media.ring.com/v1/devices/123/snap.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://api.amazonvision.com/v1/media/dl")).toBe(true);
      expect(isValidRingMediaHost("https://s3.us-east-1.amazonaws.com/ring-media/snap.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://ring-snapshots.s3.amazonaws.com/image.jpg")).toBe(true);
    });

    it("strictly rejects loopback, private IPs, and untrusted domains", () => {
      expect(isValidRingMediaHost("http://localhost:8080/evil.jpg")).toBe(false);
      expect(isValidRingMediaHost("http://127.0.0.1/evil.jpg")).toBe(false);
      expect(isValidRingMediaHost("http://169.254.169.254/latest/meta-data/")).toBe(false);
      expect(isValidRingMediaHost("http://10.0.0.1/internal.jpg")).toBe(false);
      expect(isValidRingMediaHost("http://192.168.1.100/router.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://attacker-controlled-site.com/exploit.jpg")).toBe(false);
    });
  });

  describe("POST /v1/devices/{device_id}/media/image/download contract", () => {
    it("handles 303 See Other redirect and preserves authoritative capture timestamp from headers", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const captureTime = "2026-10-06T10:14:22.000Z";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 303,
        headers: new Headers({
          Location: "https://s3.us-east-1.amazonaws.com/ring-media/snapshot_123.jpg",
          "x-ring-captured-at": captureTime,
        }),
      });

      const result = await client.downloadImage("/v1/devices/dev_front_door/media/image/download", {
        components: ["camera"],
      });

      expect(result.url).toBe("https://s3.us-east-1.amazonaws.com/ring-media/snapshot_123.jpg");
      expect(result.capturedAt).toBe(new Date(captureTime).toISOString());
    });

    it("throws SECURITY_VIOLATION if redirect Location points to unauthorized host", async () => {
      const client = new RingClient({ accessToken: "test_token" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 303,
        headers: new Headers({
          Location: "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        }),
      });

      await expect(
        client.downloadImage("/v1/devices/dev_front_door/media/image/download")
      ).rejects.toThrowError(/violates origin allowlist/);
    });

    it("handles HTTP 416 (MEDIA_NOT_FOUND / Range Not Satisfiable) safely with MEDIA_UNAVAILABLE", async () => {
      const client = new RingClient({ accessToken: "test_token" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 416,
        text: async () => "Requested range not satisfiable / no media found in range",
      });

      try {
        await client.downloadImage("/v1/devices/dev_front_door/media/image/download");
        expect.fail("Should have thrown RingProviderError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(RingProviderError);
        const rErr = err as RingProviderError;
        expect(rErr.code).toBe("MEDIA_UNAVAILABLE");
        expect(rErr.statusCode).toBe(416);
      }
    });

    it("handles HTTP 503 (SERVICE_UNAVAILABLE) safely with retryable error", async () => {
      const client = new RingClient({ accessToken: "test_token", maxRetries: 0 });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      });

      try {
        await client.downloadImage("/v1/devices/dev_front_door/media/image/download");
        expect.fail("Should have thrown RingProviderError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(RingProviderError);
        const rErr = err as RingProviderError;
        expect(rErr.code).toBe("SERVICE_UNAVAILABLE");
        expect(rErr.isRetryable).toBe(true);
      }
    });

    it("never synthesizes capture timestamp when Ring response metadata omits it", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const provider = new RingPlaygroundProvider(client);

      // Return JSON without captured_at metadata
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          url: "https://media.ring.com/snapshot.jpg",
          // captured_at omitted!
        }),
      });

      const media = await provider.getImageEvidence("dev_front_door", ["camera"]);
      expect(media).not.toBeNull();
      expect(media?.capturedAt).toBeUndefined(); // MUST NOT synthesize!
    });
  });

  describe("Event History Pagination (links.next)", () => {
    it("traverses multiple pages via links.next and deduplicates events", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const provider = new RingPlaygroundProvider(client);

      // Page 1
      const page1 = {
        data: [
          { id: "event_1", type: "motion", attributes: { timestamp: "2026-10-06T10:10:00Z" } },
          { id: "event_2", type: "motion", attributes: { timestamp: "2026-10-06T10:09:00Z" } },
        ],
        links: {
          next: "/v1/events?limit=2&page_token=page2",
        },
      };

      // Page 2 (contains event_2 again as duplicate, plus event_3)
      const page2 = {
        data: [
          { id: "event_2", type: "motion", attributes: { timestamp: "2026-10-06T10:09:00Z" } },
          { id: "event_3", type: "ding", attributes: { timestamp: "2026-10-06T10:08:00Z" } },
        ],
        links: {}, // End of pages
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => page2,
        });

      const paginated = await provider.getEventHistory({ limit: 2, maxPages: 3 });

      expect(paginated.pagesFetched).toBe(2);
      expect(paginated.events.length).toBe(3); // event_1, event_2, event_3 (event_2 deduplicated!)
      expect(paginated.events.map((e) => e.eventId)).toEqual(["event_1", "event_2", "event_3"]);
      expect(paginated.hasMore).toBe(false);
    });

    it("queries /v1/history/devices/{id}/events for device-specific event history and normalizes history-events", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const provider = new RingPlaygroundProvider(client);

      const historyResponse = {
        data: [
          {
            id: "hist_evt_101",
            type: "history-events",
            attributes: {
              event_type: "on_demand",
              start: "2026-10-23T11:15:00Z",
              end: "2026-10-23T11:15:30Z",
              is_third_party_reviewed: false,
              device_id: "dev_ramp_cam",
            },
          },
        ],
      };

      let requestedUrl = "";
      global.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/vnd.api+json" }),
          json: async () => historyResponse,
        });
      });

      const events = await provider.getRecentEvents("dev_ramp_cam", 5);

      expect(requestedUrl).toContain("/v1/history/devices/dev_ramp_cam/events?limit=5");
      expect(events.length).toBe(1);
      const ev = events[0];
      expect(ev.eventId).toBe("hist_evt_101");
      expect(ev.eventType).toBe("on_demand"); // correctly extracted from attributes.event_type rather than generic type!
      expect(ev.timestamp).toBe("2026-10-23T11:15:00Z"); // correctly extracted from attributes.start
      expect(ev.provider).toBe("ring_playground");
      expect(ev.eventCategory).toBe("official_ring");
      expect(ev.source).toBe("ring_playground_api");
    });

    it("handles empty event history collections gracefully", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const provider = new RingPlaygroundProvider(client);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/vnd.api+json" }),
        json: async () => ({ data: [] }),
      });

      const events = await provider.getRecentEvents("dev_empty", 5);
      expect(events).toEqual([]);
    });

    it("handles 401 and 403 error responses gracefully without throwing or crashing", async () => {
      const client = new RingClient({ accessToken: "test_token" });
      const provider = new RingPlaygroundProvider(client);

      // Test 403 Forbidden
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ errors: [{ status: "403", detail: "Insufficient permissions" }] }),
      });

      const events403 = await provider.getRecentEvents("dev_forbidden", 5);
      expect(events403).toEqual([]);

      // Test 401 Unauthorized
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ errors: [{ status: "401", detail: "Unauthorized" }] }),
      });

      const events401 = await provider.getRecentEvents("dev_unauthorized", 5);
      expect(events401).toEqual([]);
    });
  });
});
