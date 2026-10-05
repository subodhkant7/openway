import { NextRequest, NextResponse } from "next/server";
import { getRingProvider } from "@/ring";
import { RingProviderError, safeLog } from "@/ring/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modeParam = searchParams.get("mode");
    const deviceId = searchParams.get("deviceId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const provider = getRingProvider(modeParam || undefined);
    const events = await provider.getRecentEvents(deviceId, limit);

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (err: unknown) {
    safeLog("error", "Error fetching Ring events", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    if (err instanceof RingProviderError) {
      return NextResponse.json(
        {
          success: false,
          error: err.toSafeJSON(),
          events: [],
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
        events: [],
      },
      { status: 500 }
    );
  }
}
