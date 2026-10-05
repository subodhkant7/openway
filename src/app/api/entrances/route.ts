import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    const storage = getStorageProvider();
    const entrances = venueId
      ? await storage.entrances.listByVenueId(venueId)
      : await storage.entrances.listAll();

    return NextResponse.json({ entrances });
  } catch (error) {
    console.error("[API] Failed to list entrances:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
