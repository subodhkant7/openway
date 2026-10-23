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
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
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

    if (!sdpOffer || typeof sdpOffer !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "sdpOffer string is required in request body.",
          code: "INVALID_REQUEST",
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
