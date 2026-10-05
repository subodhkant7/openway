import { NextRequest, NextResponse } from "next/server";
import { getRingProvider } from "@/ring";
import { RingProviderError, safeLog } from "@/ring/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modeParam = searchParams.get("mode");

    const provider = getRingProvider(modeParam || undefined);
    const devices = await provider.listDevices();

    return NextResponse.json({
      success: true,
      devices,
      count: devices.length,
    });
  } catch (err: unknown) {
    safeLog("error", "Error discovering Ring devices", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    if (err instanceof RingProviderError) {
      return NextResponse.json(
        {
          success: false,
          error: err.toSafeJSON(),
          devices: [],
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
        devices: [],
      },
      { status: 500 }
    );
  }
}
