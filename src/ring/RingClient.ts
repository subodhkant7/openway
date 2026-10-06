import { RingProviderError, safeLog } from "./errors";
import crypto from "crypto";

export interface RingClientConfig {
  accessToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ImageDownloadResult {
  dataUrl?: string;
  url?: string;
  format: string;
  capturedAt?: string;
}

/**
 * SSRF Protection: Validates that pre-signed media download URLs belong
 * strictly to legitimate Ring or AWS S3 media infrastructure.
 *
 * Defends against:
 * - Localhost / Loopback (127.0.0.1, ::1, 0.0.0.0)
 * - AWS Instance Metadata Service (169.254.169.254)
 * - RFC 1918 Private Subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Non-HTTPS protocols (http, file, gopher, ftp)
 * - Userinfo embedded credentials (user:pass@host)
 * - Non-standard ports
 * - Alternative IP encodings (hex, octal, dword)
 * - Domain suffix spoofing (e.g. s3.attacker.com)
 */
export function isValidRingMediaHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);

    // 1. Strict HTTPS protocol enforcement (no HTTP, file://, ftp://, or protocol downgrades)
    if (parsed.protocol !== "https:") {
      return false;
    }

    // 2. Reject userinfo in URL (e.g. https://ring.com@attacker.com)
    if (parsed.username || parsed.password) {
      return false;
    }

    // 3. Reject non-standard ports (must be default HTTPS port 443 or empty)
    if (parsed.port && parsed.port !== "443") {
      return false;
    }

    const host = parsed.hostname.toLowerCase().trim();

    // 4. Block local, loopback, private IPv4, and IPv6 addresses
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("127.") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host === "::" ||
      host === "[::]" ||
      host.startsWith("[") ||
      host.startsWith("169.254.") || // AWS Link-Local / Metadata
      host.startsWith("10.") ||       // RFC 1918
      host.startsWith("192.168.") ||  // RFC 1918
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) // RFC 1918 172.16.0.0/12
    ) {
      return false;
    }

    // 5. Block decimal/hex/octal integer IP encodings (e.g. 2130706433, 0x7f000001, 017700000001)
    if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host) || /^0\d+/.test(host)) {
      return false;
    }

    // 6. Strict allowed domain suffixes (must strictly end with authorized Ring or AWS domain)
    const isAuthorizedDomain =
      host === "ring.com" ||
      host.endsWith(".ring.com") ||
      host === "amazonvision.com" ||
      host.endsWith(".amazonvision.com") ||
      host === "amazonaws.com" ||
      host.endsWith(".amazonaws.com");

    return isAuthorizedDomain;
  } catch {
    return false;
  }
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
        headers.set("Accept", "application/vnd.api+json, application/json");
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

        // Parse JSON / JSON:API response
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = (await response.json()) as T;
          return data;
        }

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

  /**
   * Implements official Ring Partner API image retrieval via:
   * POST /v1/devices/{device_id}/media/image/download
   * 
   * Handles 303 See Other redirects, pre-signed location URLs, and binary media streams.
   */
  public async downloadImage(
    endpoint: string,
    body: Record<string, unknown> = { components: ["camera"] }
  ): Promise<ImageDownloadResult> {
    const correlationId = crypto.randomUUID();
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    if (!this.hasToken()) {
      throw new RingProviderError({
        code: "CONFIGURATION_ERROR",
        message: "Ring access token is not configured.",
        correlationId,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      safeLog("info", "Ring media download request initiated", {
        correlationId,
        endpoint: cleanEndpoint,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "image/jpeg, image/png, application/json",
          "X-Correlation-Id": correlationId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "manual", // Intercept 303 redirect if present
      });

      clearTimeout(timer);

      // Extract capture timestamp from authoritative response headers if provided by Ring
      const capturedAtHeader =
        response.headers?.get("x-ring-captured-at") ||
        response.headers?.get("x-amz-meta-captured-at") ||
        response.headers?.get("last-modified");
      const authoritativeCapturedAt = capturedAtHeader ? new Date(capturedAtHeader).toISOString() : undefined;

      // Official Ring 303 See Other redirect with pre-signed URL in Location header
      if (response.status === 303 || response.status === 302) {
        const locationUrl = response.headers?.get("Location") || response.headers?.get("location");
        if (locationUrl) {
          // SSRF defense: Ensure redirected location is to an authorized Ring / AWS S3 media domain
          if (!isValidRingMediaHost(locationUrl)) {
            throw new RingProviderError({
              code: "SECURITY_VIOLATION",
              message: "Ring media redirect URL violates origin allowlist (potential SSRF).",
              correlationId,
              isRetryable: false,
            });
          }

          return {
            url: locationUrl,
            format: locationUrl.includes(".png") ? "image/png" : "image/jpeg",
            capturedAt: authoritativeCapturedAt,
          };
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new RingProviderError({
            code: "AUTHENTICATION_ERROR",
            message: "Ring API authentication failed during image download.",
            statusCode: 401,
            correlationId,
          });
        }
        if (response.status === 404 || response.status === 410 || response.status === 416) {
          throw new RingProviderError({
            code: "MEDIA_UNAVAILABLE",
            message: `Image snapshot media is currently unavailable (HTTP ${response.status} MEDIA_NOT_FOUND).`,
            statusCode: response.status,
            correlationId,
          });
        }
        if (response.status === 503) {
          throw new RingProviderError({
            code: "SERVICE_UNAVAILABLE",
            message: "Ring media download service is temporarily unavailable (HTTP 503).",
            statusCode: 503,
            correlationId,
            isRetryable: true,
          });
        }
        throw new RingProviderError({
          code: "RING_API_ERROR",
          message: `Image download failed with status ${response.status}`,
          statusCode: response.status,
          correlationId,
        });
      }

      const contentType = response.headers?.get("content-type") || "image/jpeg";
      const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10MB streaming cap

      // If returned binary content
      if (contentType.includes("image/")) {
        const contentLength = response.headers?.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_MEDIA_BYTES) {
          throw new RingProviderError({
            code: "MEDIA_TOO_LARGE",
            message: `Media payload size (${contentLength} bytes) exceeds the 10MB limit.`,
            correlationId,
            isRetryable: false,
          });
        }

        // Stream and count bytes progressively to defend against chunked large responses without Content-Length
        let totalBytes = 0;
        const chunks: Uint8Array[] = [];

        if (response.body && typeof response.body.getReader === "function") {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > MAX_MEDIA_BYTES) {
                await reader.cancel("Media payload exceeded 10MB limit.");
                throw new RingProviderError({
                  code: "MEDIA_TOO_LARGE",
                  message: `Media payload stream exceeded 10MB limit (${totalBytes} bytes read).`,
                  correlationId,
                  isRetryable: false,
                });
              }
              chunks.push(value);
            }
          }
        } else {
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
            throw new RingProviderError({
              code: "MEDIA_TOO_LARGE",
              message: `Media payload size (${arrayBuffer.byteLength} bytes) exceeds the 10MB limit.`,
              correlationId,
              isRetryable: false,
            });
          }
          chunks.push(new Uint8Array(arrayBuffer));
        }

        const totalBuffer = Buffer.concat(chunks);
        const base64 = totalBuffer.toString("base64");
        return {
          dataUrl: `data:${contentType};base64,${base64}`,
          format: contentType,
          capturedAt: authoritativeCapturedAt,
        };
      }

      // If returned JSON with download URL or attributes
      if (contentType.includes("json")) {
        const json = await response.json();
        const downloadUrl =
          json.url ||
          json.image_url ||
          json.data?.attributes?.url ||
          json.data?.attributes?.download_url;

        const jsonCapturedAt =
          json.captured_at ||
          json.data?.attributes?.captured_at ||
          json.data?.attributes?.created_at ||
          authoritativeCapturedAt;

        if (downloadUrl) {
          if (!isValidRingMediaHost(downloadUrl)) {
            throw new RingProviderError({
              code: "SECURITY_VIOLATION",
              message: "Ring JSON media download URL violates origin allowlist (potential SSRF).",
              correlationId,
              isRetryable: false,
            });
          }

          return {
            url: downloadUrl,
            format: "image/jpeg",
            capturedAt: jsonCapturedAt ? new Date(jsonCapturedAt).toISOString() : undefined,
          };
        }
      }

      throw new RingProviderError({
        code: "MEDIA_UNAVAILABLE",
        message: "No valid image stream or download URL received from Ring API.",
        correlationId,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof RingProviderError) throw err;
      throw new RingProviderError({
        code: "RING_API_ERROR",
        message: `Failed to download image from Ring: ${err instanceof Error ? err.message : "Unknown error"}`,
        correlationId,
      });
    }
  }
}
