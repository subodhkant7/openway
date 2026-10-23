import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, DELETE } from "@/app/api/ring/whep/session/route";
import { NextRequest } from "next/server";

describe("Ring WHEP Live Stream Controller (Phase R3)", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("POST /api/ring/whep/session", () => {
    it("returns 401 TOKEN_MISSING when neither token env var is configured", async () => {
      delete process.env.RING_PLAYGROUND_ACCESS_TOKEN;
      delete process.env.RING_ACCESS_TOKEN;

      const req = new NextRequest("http://localhost:3000/api/ring/whep/session", {
        method: "POST",
        body: JSON.stringify({ sdpOffer: "v=0\r\no=..." }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("TOKEN_MISSING");
    });

    it("returns 400 INVALID_REQUEST if sdpOffer is omitted", async () => {
      process.env.RING_PLAYGROUND_ACCESS_TOKEN = "valid_test_token";

      const req = new NextRequest("http://localhost:3000/api/ring/whep/session", {
        method: "POST",
        body: JSON.stringify({ deviceId: "dev_123" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("INVALID_REQUEST");
    });

    it("correctly brokers WebRTC SDP offer and parses 201 Created WHEP answer and session location", async () => {
      process.env.RING_PLAYGROUND_ACCESS_TOKEN = "valid_test_token";

      const mockSdpOffer = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n";
      const mockSdpAnswer = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendonly\r\n";
      const mockSessionLocation = "https://api.amazonvision.com/v1/sessions/whep_sess_abc123";

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/media/streaming/whep/sessions")) {
          return {
            status: 201,
            ok: true,
            headers: new Headers({
              Location: mockSessionLocation,
              "Content-Type": "application/sdp",
            }),
            text: async () => mockSdpAnswer,
          };
        }
        return { status: 404, ok: false, text: async () => "Not found" };
      });

      const req = new NextRequest("http://localhost:3000/api/ring/whep/session", {
        method: "POST",
        body: JSON.stringify({
          deviceId: "dev_front_door_123",
          sdpOffer: mockSdpOffer,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.status).toBe(201);
      expect(json.sdpAnswer).toBe(mockSdpAnswer);
      expect(json.sessionUrl).toBe(mockSessionLocation);
      expect(json.deviceId).toBe("dev_front_door_123");

      // Verify authorization header was passed to upstream
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.amazonvision.com/v1/devices/dev_front_door_123/media/streaming/whep/sessions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer valid_test_token",
            "Content-Type": "application/sdp",
          }),
          body: mockSdpOffer,
        })
      );
    });
  });

  describe("DELETE /api/ring/whep/session", () => {
    it("enforces SSRF protection: rejects sessionUrl targeting untrusted origins", async () => {
      process.env.RING_PLAYGROUND_ACCESS_TOKEN = "valid_test_token";

      const maliciousUrls = [
        "http://localhost:3000/api/evil",
        "http://169.254.169.254/latest/meta-data/",
        "https://attacker-controlled.site/session",
      ];

      for (const url of maliciousUrls) {
        const req = new NextRequest("http://localhost:3000/api/ring/whep/session", {
          method: "DELETE",
          body: JSON.stringify({ sessionUrl: url }),
        });

        const res = await DELETE(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("Invalid sessionUrl origin.");
      }
    });

    it("terminates legitimate api.amazonvision.com session URL via HTTP DELETE", async () => {
      process.env.RING_PLAYGROUND_ACCESS_TOKEN = "valid_test_token";
      const targetSessionUrl = "https://api.amazonvision.com/v1/sessions/whep_sess_abc123";

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      });

      const req = new NextRequest("http://localhost:3000/api/ring/whep/session", {
        method: "DELETE",
        body: JSON.stringify({ sessionUrl: targetSessionUrl }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(global.fetch).toHaveBeenCalledWith(
        targetSessionUrl,
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer valid_test_token",
          }),
        })
      );
    });
  });
});
