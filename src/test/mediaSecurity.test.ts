import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidRingMediaHost, RingClient } from "@/ring/RingClient";
import { RingProviderError } from "@/ring/errors";

describe("Media Security, SSRF & Memory Exhaustion Defenses", () => {
  describe("isValidRingMediaHost SSRF Whitelist Validation", () => {
    it("rejects non-HTTPS protocols (HTTP, file, gopher, ftp)", () => {
      expect(isValidRingMediaHost("http://s3.amazonaws.com/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("file:///etc/passwd")).toBe(false);
      expect(isValidRingMediaHost("gopher://s3.amazonaws.com/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("ftp://s3.amazonaws.com/image.jpg")).toBe(false);
    });

    it("rejects loopback and local targets", () => {
      expect(isValidRingMediaHost("https://localhost/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://127.0.0.1/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://127.0.0.2/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://0.0.0.0/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://[::1]/image.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://[::]/image.jpg")).toBe(false);
    });

    it("rejects AWS metadata service (169.254.169.254)", () => {
      expect(isValidRingMediaHost("https://169.254.169.254/latest/meta-data")).toBe(false);
      expect(isValidRingMediaHost("http://169.254.169.254/latest/meta-data")).toBe(false);
    });

    it("rejects RFC 1918 private subnets", () => {
      expect(isValidRingMediaHost("https://10.0.0.1/snapshot.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://192.168.1.1/snapshot.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://172.16.0.1/snapshot.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://172.24.10.5/snapshot.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://172.31.255.255/snapshot.jpg")).toBe(false);
    });

    it("rejects userinfo embedded credentials in URL", () => {
      expect(isValidRingMediaHost("https://ring.com@attacker.com/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://admin:password@s3.amazonaws.com/pic.jpg")).toBe(false);
    });

    it("rejects non-standard ports", () => {
      expect(isValidRingMediaHost("https://s3.amazonaws.com:8080/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://api.amazonvision.com:8443/pic.jpg")).toBe(false);
    });

    it("rejects decimal, hex, and octal integer IP representations", () => {
      expect(isValidRingMediaHost("https://2130706433/pic.jpg")).toBe(false); // 127.0.0.1 in dword
      expect(isValidRingMediaHost("https://0x7f000001/pic.jpg")).toBe(false); // 127.0.0.1 in hex
      expect(isValidRingMediaHost("https://017700000001/pic.jpg")).toBe(false); // 127.0.0.1 in octal
    });

    it("rejects domain suffix spoofing attacks", () => {
      expect(isValidRingMediaHost("https://s3.attacker.com/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://evil-ring.com/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://evil-amazonvision.com/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://ring.com.attacker.com/pic.jpg")).toBe(false);
      expect(isValidRingMediaHost("https://amazonaws.com.malicious.net/pic.jpg")).toBe(false);
    });

    it("accepts legitimate Ring and AWS S3 media hostnames", () => {
      expect(isValidRingMediaHost("https://s3.amazonaws.com/my-bucket/pic.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://ring-camera-snapshots.s3.us-east-1.amazonaws.com/pic.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://api.amazonvision.com/v1/devices/123/media.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://media.ring.com/v1/snapshot.jpg")).toBe(true);
      expect(isValidRingMediaHost("https://ring.com/snapshot.jpg")).toBe(true);
    });
  });

  describe("Media Streaming Memory Limits (10MB Cap)", () => {
    it("rejects download immediately if Content-Length exceeds 10MB", async () => {
      const client = new RingClient({
        accessToken: "test_token_secret",
        baseUrl: "https://api.amazonvision.com",
      });

      // Mock fetch returning Content-Length > 10MB
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "image/jpeg",
          "content-length": String(15 * 1024 * 1024), // 15MB
        }),
      });

      await expect(
        client.downloadImage("/v1/devices/cam_123/media/image/download")
      ).rejects.toThrow(/exceeds the 10MB limit/);
    });

    it("aborts stream progressively when chunked stream exceeds 10MB", async () => {
      const client = new RingClient({
        accessToken: "test_token_secret",
        baseUrl: "https://api.amazonvision.com",
      });

      // Create a mock stream that yields 11 chunks of 1MB each
      let chunkCount = 0;
      const cancelSpy = vi.fn();
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkCount >= 11) {
            return { done: true, value: undefined };
          }
          chunkCount++;
          return { done: false, value: new Uint8Array(1024 * 1024) }; // 1MB chunk
        }),
        cancel: cancelSpy,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "image/jpeg",
          // No content-length header (chunked transfer)
        }),
        body: {
          getReader: () => mockReader,
        },
      });

      await expect(
        client.downloadImage("/v1/devices/cam_123/media/image/download")
      ).rejects.toThrow(/exceeded 10MB limit/);

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
