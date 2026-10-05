import { describe, it, expect, vi, beforeEach } from "vitest";
import { RingClient } from "@/ring/RingClient";
import { RingProviderError } from "@/ring/errors";

describe("RingClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles valid configuration and loads token from options", () => {
    const client = new RingClient({
      accessToken: "test_token_12345",
      baseUrl: "https://api.amazonvision.com",
    });

    expect(client.hasToken()).toBe(true);
    expect(client.getBaseUrl()).toBe("https://api.amazonvision.com");
  });

  it("rejects calls with CONFIGURATION_ERROR when token is missing", async () => {
    const client = new RingClient({ accessToken: "" });

    await expect(client.request("/v1/devices")).rejects.toThrowError(
      expect.objectContaining({
        code: "CONFIGURATION_ERROR",
      })
    );
  });

  it("successfully retrieves and parses JSON from API endpoint with JSON:API headers", async () => {
    const mockData = {
      data: [
        {
          id: "dev_01",
          type: "device",
          attributes: { name: "Front Door", kind: "doorbell" },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/vnd.api+json" }),
      json: async () => mockData,
    });

    const client = new RingClient({ accessToken: "valid_token" });
    const result = await client.request<{ data: Array<{ id: string }> }>("/v1/devices");

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify Authorization Bearer was passed
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer valid_token");
    expect(headers.get("Accept")).toContain("application/vnd.api+json");
    expect(headers.get("X-Correlation-Id")).toBeDefined();
  });

  it("maps HTTP 401 response to AUTHENTICATION_ERROR without blind retries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => JSON.stringify({ error: "Invalid token" }),
    });

    const client = new RingClient({ accessToken: "expired_token", maxRetries: 2 });

    await expect(client.request("/v1/devices")).rejects.toThrowError(
      expect.objectContaining({
        code: "AUTHENTICATION_ERROR",
        statusCode: 401,
        isRetryable: false,
      })
    );

    // Must NOT retry 401
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles HTTP 429 rate limit and maps to RATE_LIMITED error with retry delay", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "3" }),
      text: async () => JSON.stringify({ error: "Rate limit exceeded" }),
    });

    const client = new RingClient({
      accessToken: "valid_token",
      maxRetries: 0,
    });

    await expect(client.request("/v1/devices")).rejects.toThrowError(
      expect.objectContaining({
        code: "RATE_LIMITED",
        statusCode: 429,
        retryAfterSeconds: 3,
        isRetryable: true,
      })
    );
  });

  it("maps request timeouts to UPSTREAM_TIMEOUT error", async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error("Request aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const client = new RingClient({
      accessToken: "valid_token",
      timeoutMs: 50,
      maxRetries: 0,
    });

    await expect(client.request("/v1/devices")).rejects.toThrowError(
      expect.objectContaining({
        code: "UPSTREAM_TIMEOUT",
        isRetryable: true,
      })
    );
  });

  it("handles malformed non-JSON API error responses safely", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>502 Bad Gateway</html>",
    });

    const client = new RingClient({
      accessToken: "valid_token",
      maxRetries: 0,
    });

    await expect(client.request("/v1/devices")).rejects.toThrowError(
      expect.objectContaining({
        code: "RING_API_ERROR",
        statusCode: 502,
      })
    );
  });

  it("handles official POST /v1/devices/{id}/media/image/download with 303 redirect", async () => {
    const preSignedUrl = "https://s3.amazonaws.com/ring-media-download/image_abc123.jpg";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 303,
      headers: new Headers({
        Location: preSignedUrl,
      }),
    });

    const client = new RingClient({ accessToken: "valid_token" });
    const result = await client.downloadImage("/v1/devices/dev_123/media/image/download", {
      components: ["camera"],
    });

    expect(result.url).toBe(preSignedUrl);
    expect(result.format).toBe("image/jpeg");

    // Verify correct POST method and body
    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[1].method).toBe("POST");
    expect(JSON.parse(callArgs[1].body)).toEqual({ components: ["camera"] });
  });

  it("handles official media image download with binary content response", async () => {
    const dummyBuffer = Buffer.from("fake_image_bytes");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "image/jpeg",
      }),
      arrayBuffer: async () => dummyBuffer,
    });

    const client = new RingClient({ accessToken: "valid_token" });
    const result = await client.downloadImage("/v1/devices/dev_123/media/image/download");

    expect(result.dataUrl).toContain("data:image/jpeg;base64,");
    expect(result.format).toBe("image/jpeg");
  });

  it("maps 404 on image download to MEDIA_UNAVAILABLE", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => "Not Found",
    });

    const client = new RingClient({ accessToken: "valid_token" });
    await expect(
      client.downloadImage("/v1/devices/dev_123/media/image/download")
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "MEDIA_UNAVAILABLE",
      })
    );
  });
});
