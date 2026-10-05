export interface BedrockConfig {
  region: string;
  modelId: string;
  guardrailId?: string;
  guardrailVersion?: string;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Loads Bedrock configuration from environment variables with sensible defaults.
 * AWS credentials are read automatically by the AWS SDK from standard environment
 * (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN) or IAM role credentials.
 */
export function getBedrockConfig(): BedrockConfig {
  return {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    // Default multimodal model: amazon.nova-lite-v1:0 (fast, cost-effective multimodal vision)
    modelId: process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0",
    guardrailId: process.env.BEDROCK_GUARDRAIL_ID || undefined,
    guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || undefined,
    timeoutMs: parseInt(process.env.BEDROCK_TIMEOUT_MS || "15000", 10),
    maxRetries: parseInt(process.env.BEDROCK_MAX_RETRIES || "2", 10),
  };
}
