import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/ring/accountLinking";
import { getStorageProvider } from "@/persistence";
import { safeLog } from "@/ring/errors";

export async function POST(request: NextRequest) {
  try {
    let code: string | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      code = body.code || body.authorization_code || null;
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        code = (formData.get("code") as string) || (formData.get("authorization_code") as string) || null;
      }
    } else {
      // Fallback: try parsing as text/JSON or search query params
      const rawText = await request.text().catch(() => "");
      try {
        const parsed = JSON.parse(rawText);
        code = parsed.code || parsed.authorization_code || null;
      } catch {
        const searchParams = new URLSearchParams(rawText);
        code = searchParams.get("code") || searchParams.get("authorization_code");
      }
    }

    // 1. Validate authorization code
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      safeLog("warn", "Ring token exchange rejected: missing or empty authorization code");
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Missing required authorization code in token exchange request.",
        },
        { status: 400 }
      );
    }

    const cleanCode = code.trim();

    // 2. Validate server-side OAuth credentials
    const clientId = process.env.RING_CLIENT_ID;
    const clientSecret = process.env.RING_CLIENT_SECRET;
    const oauthBaseUrl = (process.env.RING_OAUTH_BASE_URL || "https://oauth.ring.com").replace(/\/+$/, "");
    const apiBaseUrl = (process.env.RING_API_BASE_URL || "https://api.amazonvision.com").replace(/\/+$/, "");

    if (!clientId || !clientSecret) {
      safeLog("error", "Ring token exchange failed: RING_CLIENT_ID or RING_CLIENT_SECRET not configured on server");
      return NextResponse.json(
        {
          error: "CONFIGURATION_ERROR",
          message: "Server environment lacks configured Ring Partner OAuth credentials.",
        },
        { status: 500 }
      );
    }

    // 3. Exchange code promptly at https://oauth.ring.com/oauth/token
    safeLog("info", "Exchanging Ring authorization code for OAuth tokens");

    const tokenResponse = await fetch(`${oauthBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: cleanCode,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const status = tokenResponse.status;
      safeLog("warn", `Ring token endpoint returned error status ${status}`);
      return NextResponse.json(
        {
          error: "UPSTREAM_TOKEN_EXCHANGE_FAILED",
          message: `Ring OAuth token exchange failed with upstream status ${status}.`,
        },
        { status: status >= 500 ? 502 : 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresInSec = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 14400; // ~4 hours

    if (!accessToken || !refreshToken) {
      safeLog("error", "Ring OAuth response missing access_token or refresh_token");
      return NextResponse.json(
        {
          error: "INVALID_UPSTREAM_RESPONSE",
          message: "Ring OAuth token exchange response did not contain required tokens.",
        },
        { status: 502 }
      );
    }

    // 4. Retrieve Ring Account ID through authenticated Ring API: GET /v1/users/me
    safeLog("info", "Retrieving Ring Account ID via GET /v1/users/me");

    const userMeResponse = await fetch(`${apiBaseUrl}/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.api+json, application/json",
      },
    });

    if (!userMeResponse.ok) {
      safeLog("warn", `GET /v1/users/me failed with status ${userMeResponse.status}`);
      return NextResponse.json(
        {
          error: "USER_VERIFICATION_FAILED",
          message: "Failed to verify Ring account identity from authenticated users API.",
        },
        { status: 502 }
      );
    }

    const userData = await userMeResponse.json();
    const ringAccountId = userData.data?.id;

    if (!ringAccountId || typeof ringAccountId !== "string") {
      safeLog("error", "GET /v1/users/me returned document without valid data.id account identifier");
      return NextResponse.json(
        {
          error: "INVALID_ACCOUNT_IDENTITY",
          message: "Could not resolve authoritative Ring Account ID.",
        },
        { status: 502 }
      );
    }

    // 5. Encrypt access and refresh tokens at rest using AES-256-GCM
    const encAccess = encryptToken(accessToken);
    const encRefresh = encryptToken(refreshToken);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSec * 1000).toISOString();
    const ttlSeconds = Math.floor(now.getTime() / 1000) + 15 * 60; // 15-minute TTL for unclaimed record

    // 6. Persist unclaimed token record into bounded, queryable storage
    const storage = getStorageProvider();
    await storage.accountLinks.saveUnclaimedToken({
      ringAccountId,
      encryptedAccessToken: encAccess.ciphertext,
      encryptedRefreshToken: encRefresh.ciphertext,
      iv: encAccess.iv,
      authTag: encAccess.authTag,
      expiresAt,
      createdAt: now.toISOString(),
      ttl: ttlSeconds,
    });

    safeLog("info", `Successfully stored unclaimed Ring tokens for account ${ringAccountId}`);

    // 7. Return documented 200 OK server-to-server acknowledgment to Ring
    return NextResponse.json(
      {
        received: true,
        status: "unclaimed_stored",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    safeLog("error", "Unexpected error in Ring token exchange endpoint", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to process token exchange request.",
      },
      { status: 500 }
    );
  }
}
