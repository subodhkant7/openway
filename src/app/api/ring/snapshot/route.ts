import { NextRequest, NextResponse } from "next/server";
import { getRingProvider } from "@/ring";
import { RingProviderError, safeLog } from "@/ring/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get("deviceId");
    const modeParam = searchParams.get("mode");

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Missing deviceId query parameter",
          },
        },
        { status: 400 }
      );
    }

    const provider = getRingProvider(modeParam || undefined);
    const snapshot = await provider.getSnapshot(deviceId);

    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MEDIA_UNAVAILABLE",
            message: `Snapshot not available for device ${deviceId}`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (err: unknown) {
    safeLog("error", "Error retrieving Ring snapshot", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    if (err instanceof RingProviderError) {
      return NextResponse.json(
        {
          success: false,
          error: err.toSafeJSON(),
        },
        { status: err.statusCode || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNKNOWN_PROVIDER_ERROR",
          message: err instanceof Error ? err.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
