import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Server-Side Ring WHEP Session Controller
 * 
 * Safely brokers WebRTC HTTP Egress Protocol (WHEP) session establishment
 * and termination directly between the local verification client and
 * https://api.amazonvision.com.
 * 
 * Invariants:
 * - Never exposes the Ring bearer token to the client browser.
 * - Enforces strict server-to-server TLS transport.
 * - Defends against SSRF on session termination URLs.
 */
/**
 * Security Gate:
 * In production environments, live Ring WHEP session creation and teardown
 * are disabled fail-closed unless explicitly enabled via ENABLE_PRODUCTION_WHEP="true".
 * This prevents unauthorized anonymous consumption of Ring API tokens/quotas.
 */
function isProductionWhepDisabled(): boolean {
  if (process.env.FORCE_PRODUCTION_WHEP_DISABLED === "true") {
    return true;
  }
  if (process.env.NODE_ENV === "test" || process.env.OPENWAY_ENV === "test") {
    return false;
  }

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.OPENWAY_ENV === "production" ||
    process.env.AWS_EXECUTION_ENV !== undefined ||
    process.env.AMPLIFY_ENV !== undefined;

  const allowProductionWhep = process.env.ENABLE_PRODUCTION_WHEP === "true";
  return isProduction && !allowProductionWhep;
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    if (isProductionWhepDisabled()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ring WHEP live streaming is restricted to local verification environments. Production WHEP endpoints are disabled fail-closed to prevent unauthorized credential consumption.",
          code: "PRODUCTION_WHEP_DISABLED",
        },
        { status: 403 }
      );
    }

    const token =
      process.env.RING_PLAYGROUND_ACCESS_TOKEN ||
      process.env.RING_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Ring access token is not configured on the server.",
          code: "TOKEN_MISSING",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sdpOffer } = body;
    let { deviceId } = body;

    if (
      !sdpOffer ||
      typeof sdpOffer !== "string" ||
      sdpOffer.length > 65536 ||
      !sdpOffer.includes("m=video")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "sdpOffer must be a valid WebRTC SDP string under 64KB with a video m-line.",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    if (
      deviceId &&
      (typeof deviceId !== "string" ||
        deviceId.length > 256 ||
        !/^[a-zA-Z0-9._-]+$/.test(deviceId))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "deviceId contains invalid characters.",
          code: "INVALID_DEVICE_ID",
        },
        { status: 400 }
      );
    }

    // Auto-discover device if not explicitly provided
    if (!deviceId) {
      const devRes = await fetch("https://api.amazonvision.com/v1/devices", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.api+json, application/json",
          "X-Correlation-Id": correlationId,
        },
      });

      if (!devRes.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to auto-discover Ring devices: HTTP ${devRes.status}`,
            code: "DEVICE_DISCOVERY_FAILED",
          },
          { status: devRes.status }
        );
      }

      const devData = await devRes.json();
      const firstDev = devData?.data?.[0];
      if (!firstDev?.id) {
        return NextResponse.json(
          {
            success: false,
            error: "No Ring devices found on account.",
            code: "NO_DEVICES",
          },
          { status: 404 }
        );
      }
      deviceId = firstDev.id;
    }

    // Dispatch official WHEP session creation request
    const whepUrl = `https://api.amazonvision.com/v1/devices/${encodeURIComponent(
      deviceId
    )}/media/streaming/whep/sessions`;

    const whepRes = await fetch(whepUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
        Accept: "application/sdp, application/json",
        "X-Correlation-Id": correlationId,
      },
      body: sdpOffer,
    });

    if (whepRes.status === 201) {
      const sdpAnswer = await whepRes.text();
      const sessionUrl =
        whepRes.headers.get("Location") || whepRes.headers.get("location") || "";

      return NextResponse.json({
        success: true,
        status: 201,
        sdpAnswer,
        sessionUrl,
        deviceId,
        correlationId,
      });
    }

    const errText = await whepRes.text();
    return NextResponse.json(
      {
        success: false,
        status: whepRes.status,
        error: errText,
        correlationId,
      },
      { status: whepRes.status }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
        correlationId,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    if (isProductionWhepDisabled()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ring WHEP session teardown is disabled fail-closed in production environments.",
          code: "PRODUCTION_WHEP_DISABLED",
        },
        { status: 403 }
      );
    }

    const token =
      process.env.RING_PLAYGROUND_ACCESS_TOKEN ||
      process.env.RING_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token not configured." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionUrl } = body;

    if (!sessionUrl || typeof sessionUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "sessionUrl is required." },
        { status: 400 }
      );
    }

    // SSRF Check: sessionUrl must strictly target api.amazonvision.com
    const parsed = new URL(sessionUrl);
    if (parsed.origin !== "https://api.amazonvision.com") {
      return NextResponse.json(
        { success: false, error: "Invalid sessionUrl origin." },
        { status: 400 }
      );
    }

    const delRes = await fetch(sessionUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Correlation-Id": correlationId,
      },
    });

    return NextResponse.json({
      success: delRes.ok,
      status: delRes.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
