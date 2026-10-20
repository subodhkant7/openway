import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { validateIndependentTokenKey } from "./accountLinking";
import { safeLog } from "./errors";

export interface RingCredentials {
  clientId: string;
  clientSecret: string;
  hmacSigningKey: string;
  tokenEncryptionKey: string;
}

interface CachedCredentials {
  credentials: RingCredentials;
  expiresAt: number;
}

// Bounded in-memory cache: 1-hour TTL
const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedCredentials: CachedCredentials | null = null;
let activeSecretsManagerClient: SecretsManagerClient | null = null;

/**
 * Resets the in-memory cache (primarily used in automated tests).
 */
export function resetSecretCache(): void {
  cachedCredentials = null;
}

/**
 * Overrides the SecretsManagerClient for test mocking.
 */
export function setSecretsManagerClientForTesting(client: SecretsManagerClient | null): void {
  activeSecretsManagerClient = client;
}

/**
 * Retrieves Ring credentials from AWS Secrets Manager in production,
 * falling back to local process.env in development or testing.
 */
export async function getRingCredentials(): Promise<RingCredentials> {
  const now = Date.now();
  if (cachedCredentials && now < cachedCredentials.expiresAt) {
    return cachedCredentials.credentials;
  }

  const secretArn = process.env.OPENWAY_RING_SECRET_ARN;

  // 1. If OPENWAY_RING_SECRET_ARN is provided, retrieve from Secrets Manager at runtime
  if (secretArn && secretArn.trim().length > 0) {
    try {
      const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
      const client = activeSecretsManagerClient || new SecretsManagerClient({ region });

      const command = new GetSecretValueCommand({ SecretId: secretArn.trim() });
      const response = await client.send(command);

      if (!response.SecretString) {
        throw new Error("Secrets Manager returned an empty or binary secret value.");
      }

      let secretObj: Record<string, string>;
      try {
        secretObj = JSON.parse(response.SecretString);
      } catch {
        throw new Error("Failed to parse secret as valid JSON.");
      }

      const clientId = secretObj.RING_CLIENT_ID || "";
      const clientSecret = secretObj.RING_CLIENT_SECRET || "";
      const hmacSigningKey = secretObj.RING_HMAC_SIGNING_KEY || "";
      const tokenEncryptionKey = secretObj.RING_TOKEN_ENCRYPTION_KEY || "";

      // Validate required variables
      if (!clientId || !clientSecret || !hmacSigningKey || !tokenEncryptionKey) {
        throw new Error("Secrets Manager secret object is missing one or more required Ring credential keys.");
      }

      // Validate key independence
      validateIndependentTokenKey(tokenEncryptionKey, {
        hmacKey: hmacSigningKey,
        clientSecret,
      });

      const credentials: RingCredentials = {
        clientId,
        clientSecret,
        hmacSigningKey,
        tokenEncryptionKey,
      };

      cachedCredentials = {
        credentials,
        expiresAt: now + CACHE_TTL_MS,
      };

      safeLog("info", "[OpenWay SecretProvider] Successfully loaded Ring credentials from AWS Secrets Manager");
      return credentials;
    } catch (err: unknown) {
      safeLog("error", "[OpenWay SecretProvider] Failed to retrieve Ring credentials from Secrets Manager", {
        reason: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  // 2. Fallback to process.env (Local Development / Testing)
  const envClientId = process.env.RING_CLIENT_ID || "";
  const envClientSecret = process.env.RING_CLIENT_SECRET || "";
  const envHmacKey = process.env.RING_HMAC_SIGNING_KEY || process.env.RING_WEBHOOK_SECRET || "";
  const envTokenKey = process.env.RING_TOKEN_ENCRYPTION_KEY || "";

  if (envTokenKey) {
    validateIndependentTokenKey(envTokenKey);
  }

  const credentials: RingCredentials = {
    clientId: envClientId,
    clientSecret: envClientSecret,
    hmacSigningKey: envHmacKey,
    tokenEncryptionKey: envTokenKey,
  };

  cachedCredentials = {
    credentials,
    expiresAt: now + CACHE_TTL_MS,
  };

  return credentials;
}
