import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = getStorageProvider();
    const venues = await storage.venues.listAll();
    return NextResponse.json({ venues });
  } catch (error) {
    console.error("[API] Failed to list venues:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
