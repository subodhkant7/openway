import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const entranceId = params.id;
    const storage = getStorageProvider();

    const entrance = await storage.entrances.findById(entranceId);
    if (!entrance) {
      return NextResponse.json({ error: "Entrance not found" }, { status: 404 });
    }

    const currentAssessment = await storage.assessments.findLatestByEntranceId(entranceId);
    const activeRemediation = await storage.remediations.findActiveByEntranceId(entranceId);
    const recentEvidence = await storage.evidence.listByEntranceId(entranceId, 1);
    const latestEvidence = recentEvidence[0] || null;
    const recentObservations = await storage.observations.listByEntranceId(entranceId, 1);
    const latestObservation = recentObservations[0] || null;

    return NextResponse.json({
      entrance,
      state: currentAssessment?.state || "UNKNOWN",
      currentAssessment,
      activeRemediation,
      latestEvidence,
      latestObservation,
      requirements: entrance.requirements,
    });
  } catch (error) {
    console.error("[API] Failed to get assurance state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
