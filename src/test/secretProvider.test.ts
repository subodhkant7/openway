import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRingCredentials,
  resetSecretCache,
  setSecretsManagerClientForTesting,
} from "@/ring/secretProvider";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

describe("Ring Secret Provider (AWS Secrets Manager & Runtime Ingestion)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetSecretCache();
    process.env = { ...originalEnv };
    delete process.env.OPENWAY_RING_SECRET_ARN;
    delete process.env.RING_CLIENT_ID;
    delete process.env.RING_CLIENT_SECRET;
    delete process.env.RING_HMAC_SIGNING_KEY;
    delete process.env.RING_TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    setSecretsManagerClientForTesting(null);
    resetSecretCache();
  });

  it("falls back to process.env in local development/test when OPENWAY_RING_SECRET_ARN is unset", async () => {
    process.env.RING_CLIENT_ID = "env_client_id_123";
    process.env.RING_CLIENT_SECRET = "env_client_secret_xyz";
    process.env.RING_HMAC_SIGNING_KEY = "env_hmac_key_abc";
    process.env.RING_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const creds = await getRingCredentials();
    expect(creds.clientId).toBe("env_client_id_123");
    expect(creds.clientSecret).toBe("env_client_secret_xyz");
    expect(creds.hmacSigningKey).toBe("env_hmac_key_abc");
    expect(creds.tokenEncryptionKey).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  });

  it("loads and caches credentials from AWS Secrets Manager when OPENWAY_RING_SECRET_ARN is configured", async () => {
    process.env.OPENWAY_RING_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:241638332840:secret:openway/production/ring/credentials-abc";

    const mockSecretJson = JSON.stringify({
      RING_CLIENT_ID: "sm_client_id_real",
      RING_CLIENT_SECRET: "sm_client_secret_real",
      RING_HMAC_SIGNING_KEY: "sm_hmac_key_real",
      RING_TOKEN_ENCRYPTION_KEY: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    });

    const sendMock = vi.fn().mockResolvedValue({
      SecretString: mockSecretJson,
    });

    const mockClient = {
      send: sendMock,
    } as unknown as SecretsManagerClient;

    setSecretsManagerClientForTesting(mockClient);

    // First call: retrieves from mocked Secrets Manager
    const creds = await getRingCredentials();
    expect(creds.clientId).toBe("sm_client_id_real");
    expect(creds.clientSecret).toBe("sm_client_secret_real");
    expect(creds.hmacSigningKey).toBe("sm_hmac_key_real");
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Second call: served from in-memory cache
    const cached = await getRingCredentials();
    expect(cached.clientId).toBe("sm_client_id_real");
    expect(sendMock).toHaveBeenCalledTimes(1); // No additional network call

    // Resetting cache causes a fresh fetch
    resetSecretCache();
    await getRingCredentials();
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("handles Secrets Manager AccessDeniedException safely without leaking sensitive information", async () => {
    process.env.OPENWAY_RING_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:241638332840:secret:openway/production/ring/credentials-abc";

    const sendMock = vi.fn().mockRejectedValue(
      new Error("User is not authorized to perform: secretsmanager:GetSecretValue")
    );

    const mockClient = {
      send: sendMock,
    } as unknown as SecretsManagerClient;

    setSecretsManagerClientForTesting(mockClient);

    await expect(getRingCredentials()).rejects.toThrow(
      "User is not authorized to perform: secretsmanager:GetSecretValue"
    );
  });

  it("rejects malformed secret JSON documents", async () => {
    process.env.OPENWAY_RING_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:241638332840:secret:openway/production/ring/credentials-abc";

    const sendMock = vi.fn().mockResolvedValue({
      SecretString: "not_valid_json_document",
    });

    setSecretsManagerClientForTesting({ send: sendMock } as unknown as SecretsManagerClient);

    await expect(getRingCredentials()).rejects.toThrow("Failed to parse secret as valid JSON.");
  });

  it("rejects incomplete secret objects missing required keys", async () => {
    process.env.OPENWAY_RING_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:241638332840:secret:openway/production/ring/credentials-abc";

    const sendMock = vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        RING_CLIENT_ID: "only_client_id",
      }),
    });

    setSecretsManagerClientForTesting({ send: sendMock } as unknown as SecretsManagerClient);

    await expect(getRingCredentials()).rejects.toThrow(
      "Secrets Manager secret object is missing one or more required Ring credential keys."
    );
  });

  it("enforces key independence on credentials loaded from Secrets Manager", async () => {
    process.env.OPENWAY_RING_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:241638332840:secret:openway/production/ring/credentials-abc";

    const sharedKey = "shared_identical_compromised_key_value_12345678";
    const sendMock = vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        RING_CLIENT_ID: "client_id",
        RING_CLIENT_SECRET: "client_secret",
        RING_HMAC_SIGNING_KEY: sharedKey,
        RING_TOKEN_ENCRYPTION_KEY: sharedKey, // SECURITY VIOLATION: identical to HMAC key
      }),
    });

    setSecretsManagerClientForTesting({ send: sendMock } as unknown as SecretsManagerClient);

    await expect(getRingCredentials()).rejects.toThrow(
      "SECURITY VIOLATION: RING_TOKEN_ENCRYPTION_KEY must NOT be identical to or derived from RING_HMAC_SIGNING_KEY."
    );
  });
});
