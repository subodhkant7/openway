import { describe, it, expect, vi, beforeEach } from "vitest";
import { RingClient } from "@/ring/RingClient";
import { RingProviderError } from "@/ring/errors";

describe("RingClient", () => {
  const originalFetch = global.fetch;

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

  it("successfully retrieves and parses JSON from API endpoint", async () => {
    const mockData = {
      devices: [
        { id: "dev_01", name: "Front Door", kind: "doorbell" },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockData,
    });

    const client = new RingClient({ accessToken: "valid_token" });
    const result = await client.request<{ devices: Array<{ id: string }> }>("/v1/devices");

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify Authorization Bearer was passed
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer valid_token");
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
      maxRetries: 0, // Zero retries to test immediate boundary response
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
});
