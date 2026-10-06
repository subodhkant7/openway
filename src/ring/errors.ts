/**
 * Explicit Ring & OpenWay Provider Error Categories
 */
export type RingErrorCode =
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "RING_API_ERROR"
  | "RATE_LIMITED"
  | "MEDIA_UNAVAILABLE"
  | "INVALID_EVENT"
  | "SIGNATURE_INVALID"
  | "UPSTREAM_TIMEOUT"
  | "SECURITY_VIOLATION"
  | "MEDIA_TOO_LARGE"
  | "PAYLOAD_TOO_LARGE"
  | "SERVICE_UNAVAILABLE"
  | "UNKNOWN_PROVIDER_ERROR";

export interface RingErrorDetails {
  code: RingErrorCode;
  message: string;
  statusCode?: number;
  retryAfterSeconds?: number;
  correlationId?: string;
  isRetryable?: boolean;
  timestamp?: string;
}

export class RingProviderError extends Error {
  public readonly code: RingErrorCode;
  public readonly statusCode?: number;
  public readonly retryAfterSeconds?: number;
  public readonly correlationId?: string;
  public readonly isRetryable: boolean;
  public readonly timestamp: string;

  constructor(details: RingErrorDetails) {
    super(details.message);
    this.name = "RingProviderError";
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.correlationId = details.correlationId;
    this.timestamp = details.timestamp ?? new Date().toISOString();

    // Determine retryable status if not explicitly set
    if (details.isRetryable !== undefined) {
      this.isRetryable = details.isRetryable;
    } else {
      this.isRetryable =
        details.code === "RATE_LIMITED" ||
        details.code === "UPSTREAM_TIMEOUT" ||
        (details.statusCode !== undefined && details.statusCode >= 500 && details.statusCode < 600);
    }

    Object.setPrototypeOf(this, RingProviderError.prototype);
  }

  /**
   * Sanitized representation safe for logging or client exposure without leaking secrets.
   */
  public toSafeJSON(): Record<string, unknown> {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      retryAfterSeconds: this.retryAfterSeconds,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Redacts potential credentials, access tokens, and secrets from logs or strings.
 */
export function sanitizeLogString(str: string): string {
  return str
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/(token["':\s]+)[A-Za-z0-9._~+/-]{8,}/gi, "$1[REDACTED]")
    .replace(/(secret["':\s]+)[A-Za-z0-9._~+/-]{8,}/gi, "$1[REDACTED]")
    .replace(/(signature["':\s]+)[A-Za-z0-9._~+/-]{8,}/gi, "$1[REDACTED]");
}

/**
 * Structured safe logger helper
 */
export function safeLog(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  const sanitizedMeta: Record<string, unknown> = {};
  if (meta) {
    for (const [key, val] of Object.entries(meta)) {
      if (
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("auth") ||
        key.toLowerCase().includes("signature")
      ) {
        sanitizedMeta[key] = "[REDACTED]";
      } else if (typeof val === "string") {
        sanitizedMeta[key] = sanitizeLogString(val);
      } else {
        sanitizedMeta[key] = val;
      }
    }
  }

  const logPayload = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeLogString(message),
    ...sanitizedMeta,
  };

  if (level === "error") {
    console.error(JSON.stringify(logPayload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logPayload));
  } else {
    console.log(JSON.stringify(logPayload));
  }
}
