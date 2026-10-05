export type VisionErrorCode =
  | "BEDROCK_AUTH_ERROR"
  | "BEDROCK_THROTTLED"
  | "BEDROCK_TIMEOUT"
  | "BEDROCK_UNAVAILABLE"
  | "INVALID_MODEL_OUTPUT"
  | "UNSUPPORTED_MODEL_CAPABILITY"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_INVALID"
  | "INSUFFICIENT_EVIDENCE"
  | "VISION_NETWORK_ERROR";

export class VisionAnalysisError extends Error {
  public readonly code: VisionErrorCode;
  public readonly statusCode?: number;
  public readonly details?: unknown;
  public readonly retryable: boolean;

  constructor(options: {
    code: VisionErrorCode;
    message: string;
    statusCode?: number;
    details?: unknown;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "VisionAnalysisError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Maps upstream AWS Bedrock exceptions into normalized VisionAnalysisError.
 */
export function mapBedrockError(err: unknown): VisionAnalysisError {
  if (err instanceof VisionAnalysisError) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();
  const name = err instanceof Error ? err.name : "";

  // Throttling / Rate limits
  if (
    lowerMsg.includes("throttl") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("too many requests") ||
    name === "ThrottlingException"
  ) {
    return new VisionAnalysisError({
      code: "BEDROCK_THROTTLED",
      message: "Amazon Bedrock API rate limit exceeded.",
      statusCode: 429,
      retryable: true,
      cause: err,
    });
  }

  // Authentication & Permission errors
  if (
    lowerMsg.includes("accessdenied") ||
    lowerMsg.includes("unauthorized") ||
    lowerMsg.includes("security token") ||
    lowerMsg.includes("credential") ||
    lowerMsg.includes("not authorized") ||
    name === "AccessDeniedException"
  ) {
    return new VisionAnalysisError({
      code: "BEDROCK_AUTH_ERROR",
      message: "Amazon Bedrock authentication failed or permissions missing.",
      statusCode: 403,
      retryable: false,
      cause: err,
    });
  }

  // Timeout errors
  if (lowerMsg.includes("timeout") || lowerMsg.includes("aborted") || name === "TimeoutError") {
    return new VisionAnalysisError({
      code: "BEDROCK_TIMEOUT",
      message: "Amazon Bedrock vision inference request timed out.",
      statusCode: 504,
      retryable: true,
      cause: err,
    });
  }

  // Model not found or unavailable
  if (
    lowerMsg.includes("resourcenotfound") ||
    lowerMsg.includes("model not available") ||
    name === "ResourceNotFoundException"
  ) {
    return new VisionAnalysisError({
      code: "BEDROCK_UNAVAILABLE",
      message: `Configured Bedrock model is unavailable in this region: ${message}`,
      statusCode: 503,
      retryable: false,
      cause: err,
    });
  }

  // Service unavailable / 5xx
  if (lowerMsg.includes("serviceunavailable") || name === "ServiceUnavailableException") {
    return new VisionAnalysisError({
      code: "BEDROCK_UNAVAILABLE",
      message: "Amazon Bedrock service is temporarily unavailable.",
      statusCode: 503,
      retryable: true,
      cause: err,
    });
  }

  // Image size or validation
  if (lowerMsg.includes("validationexception") || lowerMsg.includes("image size")) {
    return new VisionAnalysisError({
      code: "IMAGE_INVALID",
      message: `Bedrock rejected image payload: ${message}`,
      statusCode: 400,
      retryable: false,
      cause: err,
    });
  }

  // Generic fallback error
  return new VisionAnalysisError({
    code: "VISION_NETWORK_ERROR",
    message: `Amazon Bedrock vision inference failed: ${message}`,
    statusCode: 500,
    retryable: true,
    cause: err,
  });
}
