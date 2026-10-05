import { RingProviderError, safeLog } from "./errors";
import crypto from "crypto";

export interface RingClientConfig {
  accessToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class RingClient {
  private readonly accessToken?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config?: RingClientConfig) {
    this.accessToken = config?.accessToken ?? process.env.RING_ACCESS_TOKEN;
    this.baseUrl = (config?.baseUrl ?? process.env.RING_API_BASE_URL ?? "https://api.amazonvision.com").replace(/\/+$/, "");
    this.timeoutMs = config?.timeoutMs ?? 8000;
    this.maxRetries = config?.maxRetries ?? 2;
  }

  public hasToken(): boolean {
    return Boolean(this.accessToken && this.accessToken.trim().length > 0);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Performs an authenticated server-side request to the Ring Partner API
   * with correlation tracking, timeout protection, and bounded retries.
   */
  public async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const correlationId = crypto.randomUUID();
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    if (!this.hasToken()) {
      throw new RingProviderError({
        code: "CONFIGURATION_ERROR",
        message: "Ring access token is not configured. Set RING_ACCESS_TOKEN in server environment.",
        correlationId,
        isRetryable: false,
      });
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        safeLog("info", `Ring API request initiated`, {
          correlationId,
          endpoint: cleanEndpoint,
          attempt,
        });

        const headers = new Headers(options.headers);
        headers.set("Authorization", `Bearer ${this.accessToken}`);
        headers.set("Accept", "application/json");
        headers.set("X-Correlation-Id", correlationId);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          let errorBody = "";
          try {
            errorBody = await response.text();
          } catch {
            errorBody = "Could not read error response body";
          }

          safeLog("warn", `Ring API returned HTTP error ${status}`, {
            correlationId,
            status,
            endpoint: cleanEndpoint,
          });

          // Check if rate limited
          if (status === 429) {
            const retryAfterHeader = response.headers.get("Retry-After");
            const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;

            if (attempt <= this.maxRetries) {
              const backoff = Math.min(retryAfter * 1000, 4000) + Math.random() * 200;
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }

            throw new RingProviderError({
              code: "RATE_LIMITED",
              message: `Ring API rate limit exceeded. Retry after ${retryAfter}s.`,
              statusCode: 429,
              retryAfterSeconds: retryAfter,
              correlationId,
              isRetryable: true,
            });
          }

          if (status === 401) {
            throw new RingProviderError({
              code: "AUTHENTICATION_ERROR",
              message: "Ring API authentication failed. Verify that RING_ACCESS_TOKEN is valid and has not expired.",
              statusCode: 401,
              correlationId,
              isRetryable: false,
            });
          }

          if (status === 403) {
            throw new RingProviderError({
              code: "AUTHORIZATION_ERROR",
              message: "Insufficient permissions to access the requested Ring resource or scope.",
              statusCode: 403,
              correlationId,
              isRetryable: false,
            });
          }

          // Check if 5xx server error is retryable
          if (status >= 500 && status < 600 && attempt <= this.maxRetries) {
            const backoff = Math.pow(2, attempt) * 500 + Math.random() * 200;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          throw new RingProviderError({
            code: "RING_API_ERROR",
            message: `Ring API request failed with status ${status}: ${errorBody.slice(0, 200)}`,
            statusCode: status,
            correlationId,
          });
        }

        // Parse JSON response
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json") || contentType.includes("json")) {
          const data = (await response.json()) as T;
          return data;
        }

        // If not JSON (e.g. 204 No Content), return empty object
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      } catch (err: unknown) {
        clearTimeout(timer);

        if (err instanceof RingProviderError) {
          throw err;
        }

        const isAbort = (err as Error)?.name === "AbortError" || controller.signal.aborted;
        if (isAbort) {
          safeLog("error", "Ring API request timed out", {
            correlationId,
            timeoutMs: this.timeoutMs,
            endpoint: cleanEndpoint,
          });

          if (attempt <= this.maxRetries) {
            continue;
          }

          throw new RingProviderError({
            code: "UPSTREAM_TIMEOUT",
            message: `Ring API request timed out after ${this.timeoutMs}ms.`,
            correlationId,
            isRetryable: true,
          });
        }

        lastError = err as Error;
        safeLog("error", `Network error contacting Ring API: ${(err as Error).message}`, {
          correlationId,
          endpoint: cleanEndpoint,
          attempt,
        });

        if (attempt <= this.maxRetries) {
          const backoff = Math.pow(2, attempt) * 400 + Math.random() * 150;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        break;
      }
    }

    throw new RingProviderError({
      code: "UNKNOWN_PROVIDER_ERROR",
      message: `Failed to communicate with Ring API: ${lastError?.message || "Unknown error"}`,
      correlationId,
      isRetryable: false,
    });
  }
}
