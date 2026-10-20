import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStorageProvider } from "@/persistence";
import { decryptToken, RingAccountLinkingService } from "@/ring/accountLinking";
import { getRingCredentials } from "@/ring/secretProvider";
import { DEMO_IDS } from "@/persistence/bootstrap";
import { validateTenantAccess } from "@/lib/tenantAuth";
import { safeLog } from "@/ring/errors";

const VALIDATION_WINDOW_SECONDS = 600; // 10 minutes per Ring specification

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { nonce, time, venueId: reqVenueId, operatorId } = body;

    // 1. Validate presence of nonce and time
    if (!nonce || typeof nonce !== "string" || nonce.trim().length === 0) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Missing or empty nonce parameter.",
        },
        { status: 400 }
      );
    }

    if (time === undefined || time === null) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Missing timestamp parameter.",
        },
        { status: 400 }
      );
    }

    // 2. Validate timestamp freshness window (600s, not future-dated)
    const numTime = typeof time === "string" ? parseInt(time, 10) : Number(time);
    if (isNaN(numTime)) {
      return NextResponse.json(
        {
          error: "MALFORMED_TIMESTAMP",
          message: "Timestamp parameter must be an epoch millisecond integer.",
        },
        { status: 400 }
      );
    }

    const nowMs = Date.now();
    const timeDeltaSeconds = (nowMs - numTime) / 1000;

    if (timeDeltaSeconds > VALIDATION_WINDOW_SECONDS) {
      safeLog("warn", "Ring account link rejected: expired timestamp", { timeDeltaSeconds });
      return NextResponse.json(
        {
          error: "NONCE_EXPIRED",
          message: `Account linking request expired (${Math.round(timeDeltaSeconds)}s old, exceeds 600s limit).`,
        },
        { status: 400 }
      );
    }

    if (timeDeltaSeconds < -5) {
      safeLog("warn", "Ring account link rejected: future timestamp", { timeDeltaSeconds });
      return NextResponse.json(
        {
          error: "FUTURE_TIMESTAMP",
          message: "Account linking timestamp cannot be in the future.",
        },
        { status: 400 }
      );
    }

    // 3. Enforce OpenWay Tenant Authorization
    const targetVenueId = reqVenueId || DEMO_IDS.VENUE_ID;
    const authCheck = validateTenantAccess({ venueId: targetVenueId });
    if (!authCheck.allowed) {
      safeLog("warn", "Unauthorized cross-tenant account linking attempt rejected", {
        targetVenueId,
      });
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: authCheck.error || "Access denied: Unauthorized tenant.",
        },
        { status: authCheck.statusCode || 403 }
      );
    }

    const authenticatedUserId = operatorId || `operator_${targetVenueId}`;

    // 4. Validate Server-Side HMAC Signing Key (supports runtime Secrets Manager & local env)
    const credentials = await getRingCredentials().catch(() => null);
    const hmacKey = credentials?.hmacSigningKey || process.env.RING_HMAC_SIGNING_KEY || process.env.RING_WEBHOOK_SECRET;
    const tokenEncryptionKey = credentials?.tokenEncryptionKey;

    if (!hmacKey) {
      safeLog("error", "Ring account link failed: RING_HMAC_SIGNING_KEY is not configured");
      return NextResponse.json(
        {
          error: "CONFIGURATION_ERROR",
          message: "Server environment lacks configured Ring HMAC signing key.",
        },
        { status: 500 }
      );
    }

    // 5. Query Bounded Unclaimed Tokens from Storage
    const storage = getStorageProvider();
    const unclaimedTokens = await storage.accountLinks.listUnclaimedTokens();

    if (!unclaimedTokens || unclaimedTokens.length === 0) {
      safeLog("warn", "No unclaimed Ring tokens available to match nonce");
      return NextResponse.json(
        {
          error: "NO_UNCLAIMED_TOKENS",
          message: "No unclaimed Ring authorization tokens found. Please restart the link flow from the Ring AppStore.",
        },
        { status: 404 }
      );
    }

    // 6. Match Nonce against Unclaimed Tokens using Constant-Time Comparison
    // Algorithm: HMAC-SHA256(hmacKey, `${time}:${account_id}`) encoded as URL-safe Base64 without padding
    const cleanReceivedNonce = nonce.trim();
    let matchedTokenRecord: typeof unclaimedTokens[0] | null = null;

    for (const tokenRecord of unclaimedTokens) {
      const payload = `${numTime}:${tokenRecord.ringAccountId}`;
      const computedNonce = crypto
        .createHmac("sha256", hmacKey)
        .update(payload, "utf8")
        .digest("base64url"); // URL-safe base64 without padding

      const expectedBuf = Buffer.from(computedNonce, "utf8");
      const receivedBuf = Buffer.from(cleanReceivedNonce, "utf8");

      if (expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
        matchedTokenRecord = tokenRecord;
        break;
      }
    }

    if (!matchedTokenRecord) {
      safeLog("warn", "Nonce verification failed: received nonce did not match any unclaimed Ring account");
      return NextResponse.json(
        {
          error: "NONCE_MISMATCH",
          message: "Cryptographic HMAC nonce does not match any unclaimed Ring account.",
        },
        { status: 400 }
      );
    }

    // 7. Atomically Claim the Matched Token for the Authenticated User & Venue
    let claimedRecord;
    try {
      claimedRecord = await storage.accountLinks.claimToken({
        userId: authenticatedUserId,
        venueId: targetVenueId,
        ringAccountId: matchedTokenRecord.ringAccountId,
        unclaimedRecord: matchedTokenRecord,
      });
    } catch (claimErr: unknown) {
      const msg = claimErr instanceof Error ? claimErr.message : "Unknown error";
      safeLog("warn", "Token claim failed", {
        accountId: matchedTokenRecord.ringAccountId,
        error: msg,
      });

      if (msg.includes("expired")) {
        return NextResponse.json(
          {
            error: "TOKEN_EXPIRED",
            message: "Unclaimed Ring token has expired. Please restart linking from the Ring AppStore.",
          },
          { status: 410 }
        );
      }

      if (msg.includes("missing required claim-expiration")) {
        return NextResponse.json(
          {
            error: "INVALID_UNCLAIMED_TOKEN",
            message: "Unclaimed Ring token record is missing required claim expiration attributes.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "TOKEN_ALREADY_CLAIMED",
          message: "This Ring account has already been claimed or linking was completed concurrently.",
        },
        { status: 409 }
      );
    }

    // 8. Complete Ring's Documented App Integrations Sequence (POST then PATCH)
    const linkingService = new RingAccountLinkingService(storage);
    const decryptedAccessToken = decryptToken(
      claimedRecord.encryptedAccessToken,
      claimedRecord.iv,
      claimedRecord.authTag,
      tokenEncryptionKey
    );

    const maskedEmail = `operator***@${targetVenueId}.openway.org`;

    try {
      await linkingService.completeRingAppIntegration({
        accessToken: decryptedAccessToken,
        nonce: cleanReceivedNonce,
        accountIdentifier: maskedEmail,
      });
      safeLog("info", `Completed Ring App Integrations POST and PATCH for account ${matchedTokenRecord.ringAccountId}`);
    } catch (appIntErr: unknown) {
      safeLog("warn", `Ring App-Integrations confirmation call failed: ${appIntErr instanceof Error ? appIntErr.message : "Unknown"}`);
      // In staging/offline/mock environments upstream may not be reachable or mocked; record remains LINKED locally
    }

    return NextResponse.json(
      {
        success: true,
        ringAccountId: matchedTokenRecord.ringAccountId,
        partnerUserId: authenticatedUserId,
        venueId: targetVenueId,
        status: "LINKED",
        message: "Ring account successfully linked to OpenWay venue.",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    safeLog("error", "Unexpected error in Ring account link handler", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to complete account linking.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId") || DEMO_IDS.VENUE_ID;
    const userId = searchParams.get("userId") || `operator_${venueId}`;

    const authCheck = validateTenantAccess({ venueId });
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: authCheck.error },
        { status: 403 }
      );
    }

    const storage = getStorageProvider();
    const record =
      (await storage.accountLinks.findByUserId(userId)) ||
      (await storage.accountLinks.findByVenueId(venueId));

    if (!record) {
      return NextResponse.json(
        {
          linked: false,
          status: "NOT_LINKED",
          venueId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        linked: record.status === "LINKED",
        status: record.status,
        ringAccountReference: record.ringAccountReference,
        venueId: record.venueId || venueId,
        partnerUserId: record.partnerUserId,
        expiresAt: record.expiresAt,
        updatedAt: record.updatedAt,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to query link status" },
      { status: 500 }
    );
  }
}
