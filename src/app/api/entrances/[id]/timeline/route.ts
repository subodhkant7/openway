import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const entranceId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const storage = getStorageProvider();
    const entrance = await storage.entrances.findById(entranceId);
    if (!entrance) {
      return NextResponse.json({ error: "Entrance not found" }, { status: 404 });
    }

    const timeline = await storage.auditEvents.listByEntranceId(entranceId, limit);
    return NextResponse.json({ entranceId, timeline });
  } catch (error) {
    console.error("[API] Failed to get entrance timeline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
