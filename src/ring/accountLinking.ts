import crypto from "crypto";
import { safeLog } from "./errors";
import { StorageProvider, StoredAccountLinkRecord } from "@/persistence/repositories";
import { getStorageProvider } from "@/persistence";

export interface RingAccountLinkRecord extends StoredAccountLinkRecord {}

export interface ValidTokenResult {
  accessToken?: string;
  status: "VALID" | "REFRESHED" | "ACCOUNT_RELINK_REQUIRED" | "ONBOARDING_REQUIRED";
  expiresAt?: string;
  error?: string;
}

/**
 * Validates that the token encryption key is independent and not reused from
 * HMAC signing key, OAuth client secret, or AWS credentials.
 */
export function validateIndependentTokenKey(
  candidateKey?: string,
  companionKeys?: {
    hmacKey?: string;
    clientSecret?: string;
    webhookSecret?: string;
    awsSecret?: string;
  }
): void {
  const key = candidateKey || process.env.RING_TOKEN_ENCRYPTION_KEY;
  if (!key) return;

  const hmacKey = companionKeys?.hmacKey || process.env.RING_HMAC_SIGNING_KEY;
  const webhookSecret = companionKeys?.webhookSecret || process.env.RING_WEBHOOK_SECRET;
  const clientSecret = companionKeys?.clientSecret || process.env.RING_CLIENT_SECRET;
  const awsSecret = companionKeys?.awsSecret || process.env.AWS_SECRET_ACCESS_KEY;

  if (hmacKey && key === hmacKey) {
    throw new Error(
      "SECURITY VIOLATION: RING_TOKEN_ENCRYPTION_KEY must NOT be identical to or derived from RING_HMAC_SIGNING_KEY."
    );
  }

  if (webhookSecret && key === webhookSecret) {
    throw new Error(
      "SECURITY VIOLATION: RING_TOKEN_ENCRYPTION_KEY must NOT be identical to RING_WEBHOOK_SECRET."
    );
  }

  if (clientSecret && key === clientSecret) {
    throw new Error(
      "SECURITY VIOLATION: RING_TOKEN_ENCRYPTION_KEY must NOT be identical to RING_CLIENT_SECRET."
    );
  }

  if (awsSecret && key === awsSecret) {
    throw new Error(
      "SECURITY VIOLATION: RING_TOKEN_ENCRYPTION_KEY must NOT be identical to AWS_SECRET_ACCESS_KEY."
    );
  }
}

/**
 * Derives a consistent, independent 256-bit encryption key strictly for token encryption.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  validateIndependentTokenKey(overrideKey);

  const rawKey =
    overrideKey ||
    process.env.RING_TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "test" || process.env.OPENWAY_PROVIDER === "simulator"
      ? "openway_isolated_test_token_encryption_key_256bit_value"
      : "");

  if (!rawKey) {
    throw new Error(
      "RING_TOKEN_ENCRYPTION_KEY is not configured. A dedicated 256-bit key is required for token encryption."
    );
  }

  // 1. If 64-character hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // 2. If 44-character base64 string (32 bytes)
  if (/^[A-Za-z0-9+/=]{44}$/.test(rawKey)) {
    const buf = Buffer.from(rawKey, "base64");
    if (buf.length === 32) return buf;
  }

  // 3. If exact 32-byte UTF-8 string
  const utf8Buf = Buffer.from(rawKey, "utf8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  // 4. Derive using SHA-256 to ensure exact 32-byte key length with high entropy
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts sensitive OAuth token bytes at rest using AES-256-GCM with a fresh 12-byte IV.
 */
export function encryptToken(token: string, customKey?: string | Buffer): { ciphertext: string; iv: string; authTag: string } {
  const key = Buffer.isBuffer(customKey) ? customKey : getEncryptionKey(customKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return {
    ciphertext: `${ivHex}:${authTag}:${encrypted}`,
    iv: ivHex,
    authTag,
  };
}

/**
 * Decrypts sensitive OAuth token bytes from storage using AES-256-GCM.
 */
export function decryptToken(
  ciphertext: string,
  fallbackIv?: string,
  fallbackAuthTag?: string,
  customKey?: string | Buffer
): string {
  const key = Buffer.isBuffer(customKey) ? customKey : getEncryptionKey(customKey);
  let ivHex = "";
  let authTagHex = "";
  let cipherHex = ciphertext;

  if (ciphertext.includes(":")) {
    const parts = ciphertext.split(":");
    if (parts.length === 3) {
      ivHex = parts[0];
      authTagHex = parts[1];
      cipherHex = parts[2];
    }
    // If caller explicitly passed a different tag/iv (e.g. testing tamper detection)
    if (fallbackIv && fallbackIv !== parts[0]) {
      ivHex = fallbackIv;
    }
    if (fallbackAuthTag && fallbackAuthTag !== parts[1]) {
      authTagHex = fallbackAuthTag;
    }
  } else {
    ivHex = fallbackIv || "";
    authTagHex = fallbackAuthTag || "";
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Ring Account Linking & Token Refresh Service
 * Implements production token management and refresh abstraction according to current Ring Partner API specifications.
 */
export class RingAccountLinkingService {
  private storage: StorageProvider;

  constructor(storageProvider?: StorageProvider) {
    this.storage = storageProvider || getStorageProvider();
  }

  /**
   * Stores an encrypted Ring account linking record
   */
  async linkAccount(params: {
    partnerUserId: string;
    ringAccountReference: string;
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    venueId?: string;
  }): Promise<RingAccountLinkRecord> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.expiresInSeconds * 1000).toISOString();

    const encAccess = encryptToken(params.accessToken);
    const encRefresh = encryptToken(params.refreshToken);

    const record: RingAccountLinkRecord = {
      partnerUserId: params.partnerUserId,
      ringAccountReference: params.ringAccountReference,
      encryptedAccessToken: encAccess.ciphertext,
      encryptedRefreshToken: encRefresh.ciphertext,
      iv: encAccess.iv,
      authTag: encAccess.authTag,
      expiresAt,
      status: "LINKED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      venueId: params.venueId,
    };

    await this.storage.accountLinks.saveClaimed(record);
    safeLog("info", `[OpenWay AccountLinking] Successfully stored encrypted Ring credentials for user ${params.partnerUserId}`);
    return record;
  }

  /**
   * Retrieves a valid, non-expired access token for a user.
   * If token is near expiration (within 5 minutes), performs automated refresh.
   * If refresh credentials or endpoints are unavailable, safely returns ACCOUNT_RELINK_REQUIRED.
   */
  async getValidAccessToken(partnerUserId: string): Promise<ValidTokenResult> {
    let record = await this.storage.accountLinks.findByUserId(partnerUserId);

    // Fallback: check by venueId if userId matches a venue
    if (!record) {
      record = await this.storage.accountLinks.findByVenueId(partnerUserId);
    }

    if (!record) {
      return {
        status: "ONBOARDING_REQUIRED",
        error: "No Ring account link found for this user. Onboarding required.",
      };
    }

    if (record.status !== "LINKED") {
      return {
        status: record.status as "ACCOUNT_RELINK_REQUIRED" | "ONBOARDING_REQUIRED",
        error: `Ring account status is ${record.status}. Re-linking required.`,
      };
    }

    const now = Date.now();
    const expiresTimestamp = new Date(record.expiresAt).getTime();
    const bufferMs = 5 * 60 * 1000; // 5 minute refresh threshold

    // Token is still fresh
    if (expiresTimestamp - now > bufferMs) {
      try {
        const decrypted = decryptToken(record.encryptedAccessToken, record.iv, record.authTag);
        return {
          accessToken: decrypted,
          status: "VALID",
          expiresAt: record.expiresAt,
        };
      } catch {
        return {
          status: "ACCOUNT_RELINK_REQUIRED",
          error: "Failed to decrypt stored token. Account relink required.",
        };
      }
    }

    // Token is near expiry or expired: initiate token refresh
    safeLog("info", `[OpenWay AccountLinking] Access token near expiry for user ${partnerUserId}. Initiating token refresh.`);

    const oauthBaseUrl = (process.env.RING_OAUTH_BASE_URL || "https://oauth.ring.com").replace(/\/+$/, "");
    const clientId = process.env.RING_CLIENT_ID;
    const clientSecret = process.env.RING_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      record.status = "ACCOUNT_RELINK_REQUIRED";
      record.updatedAt = new Date().toISOString();
      await this.storage.accountLinks.saveClaimed(record);
      return {
        status: "ACCOUNT_RELINK_REQUIRED",
        error: "Ring Partner OAuth client credentials not provisioned. Automated token refresh requires partner onboarding.",
      };
    }

    try {
      const decryptedRefresh = decryptToken(record.encryptedRefreshToken);

      const response = await fetch(`${oauthBaseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decryptedRefresh,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        safeLog("warn", `[OpenWay AccountLinking] Token refresh failed with status ${response.status}`);
        record.status = "ACCOUNT_RELINK_REQUIRED";
        record.updatedAt = new Date().toISOString();
        await this.storage.accountLinks.saveClaimed(record);
        return {
          status: "ACCOUNT_RELINK_REQUIRED",
          error: "Upstream token refresh rejected or revoked. Re-linking required.",
        };
      }

      const tokenData = await response.json();
      const newAccessToken = tokenData.access_token;
      const newRefreshToken = tokenData.refresh_token || decryptedRefresh;
      const expiresInSec = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 14400;

      const refreshNow = Date.now();
      const newExpiresAt = new Date(refreshNow + expiresInSec * 1000).toISOString();

      const encAccess = encryptToken(newAccessToken);
      const encRefresh = encryptToken(newRefreshToken);

      record.encryptedAccessToken = encAccess.ciphertext;
      record.encryptedRefreshToken = encRefresh.ciphertext;
      record.iv = encAccess.iv;
      record.authTag = encAccess.authTag;
      record.expiresAt = newExpiresAt;
      record.status = "LINKED";
      record.updatedAt = new Date().toISOString();

      await this.storage.accountLinks.saveClaimed(record);
      safeLog("info", `[OpenWay AccountLinking] Successfully refreshed and rotated tokens for user ${partnerUserId}`);

      return {
        accessToken: newAccessToken,
        status: "REFRESHED",
        expiresAt: newExpiresAt,
      };
    } catch {
      record.status = "ACCOUNT_RELINK_REQUIRED";
      record.updatedAt = new Date().toISOString();
      await this.storage.accountLinks.saveClaimed(record);
      return {
        status: "ACCOUNT_RELINK_REQUIRED",
        error: "Token refresh network call failed. Re-linking required.",
      };
    }
  }

  /**
   * Retrieves account link status without decrypting tokens
   */
  async getAccountStatus(partnerUserId: string): Promise<RingAccountLinkRecord["status"]> {
    let record = await this.storage.accountLinks.findByUserId(partnerUserId);
    if (!record) {
      record = await this.storage.accountLinks.findByVenueId(partnerUserId);
    }
    if (!record) return "ONBOARDING_REQUIRED";
    return record.status;
  }

  /**
   * Securely unlinks a Ring account:
   * Purges stored credentials, invalidates token access, and optionally invokes upstream DELETE app-integrations.
   */
  async unlinkAccount(partnerUserId: string, ringAccountRef?: string): Promise<boolean> {
    let record = await this.storage.accountLinks.findByUserId(partnerUserId);
    if (!record) {
      record = await this.storage.accountLinks.findByVenueId(partnerUserId);
    }
    if (!record) return false;

    const accountRef = ringAccountRef || record.ringAccountReference;

    // Optional upstream App Integrations DELETE notification
    try {
      const apiBaseUrl = (process.env.RING_API_BASE_URL || "https://api.amazonvision.com").replace(/\/+$/, "");
      const decryptedToken = decryptToken(record.encryptedAccessToken, record.iv, record.authTag);
      await fetch(`${apiBaseUrl}/v1/accounts/me/app-integrations`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          Accept: "application/json",
        },
      });
    } catch {
      // Ignored: apps in one-way linking receive 403 or network errors on DELETE; local purge is authoritative
    }

    // Purge from persistent storage
    await this.storage.accountLinks.delete(record.partnerUserId, accountRef);
    safeLog("info", `[OpenWay AccountLinking] Successfully unlinked Ring account for user ${partnerUserId}`);
    return true;
  }

  /**
   * Completes Ring App-Integrations linking sequence:
   * Step 1: POST /v1/accounts/me/app-integrations (nonce verification -> status moves to awaiting)
   * Step 2: PATCH /v1/accounts/me/app-integrations (status update -> completed)
   */
  async completeRingAppIntegration(params: {
    accessToken: string;
    nonce: string;
    accountIdentifier: string;
    apiBaseUrl?: string;
  }): Promise<{ postStatus: string; patchStatus: string }> {
    const baseUrl = (params.apiBaseUrl || process.env.RING_API_BASE_URL || "https://api.amazonvision.com").replace(/\/+$/, "");

    // 1. POST /v1/accounts/me/app-integrations
    const postRes = await fetch(`${baseUrl}/v1/accounts/me/app-integrations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        account_identifier: params.accountIdentifier,
        nonce: params.nonce,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => "Unknown");
      throw new Error(`Ring POST app-integrations failed with HTTP ${postRes.status}: ${errText.slice(0, 150)}`);
    }

    // 2. PATCH /v1/accounts/me/app-integrations (status: "completed")
    const patchRes = await fetch(`${baseUrl}/v1/accounts/me/app-integrations`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        account_identifier: params.accountIdentifier,
        status: "completed",
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text().catch(() => "Unknown");
      throw new Error(`Ring PATCH app-integrations failed with HTTP ${patchRes.status}: ${errText.slice(0, 150)}`);
    }

    return {
      postStatus: "awaiting",
      patchStatus: "completed",
    };
  }
}
