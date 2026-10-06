import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorageProvider } from "@/persistence";
import { VisionPipelineService } from "@/vision/VisionPipelineService";
import { BedrockVisionAnalyzer } from "@/vision/BedrockVisionAnalyzer";
import { SimulatorVisionAnalyzer, SimulatorVisionMode } from "@/vision/SimulatorVisionAnalyzer";
import { Evidence } from "@/evidence/types";

export const dynamic = "force-dynamic";

const AnalyzeRequestSchema = z.object({
  entranceId: z.string().min(1, "entranceId is required"),
  evidenceId: z.string().optional(),
  analyzerType: z.enum(["bedrock", "simulator"]).default("simulator"),
  simulatorMode: z.enum(["CLEAR", "BLOCKED", "UNCERTAIN", "CONTRADICTORY"]).optional(),
  correlationId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { entranceId, evidenceId, analyzerType, simulatorMode, correlationId } = parsed.data;
    const isProduction = process.env.OPENWAY_ENV === "production";

    // Tenant isolation: public calls restricted to demo entrance
    if (entranceId !== "entrance_side_accessible") {
      return NextResponse.json(
        { error: "Access denied: Target entrance is outside public demo sandbox." },
        { status: 403 }
      );
    }

    if (isProduction && analyzerType === "simulator") {
      return NextResponse.json(
        { error: "Simulator analyzer is strictly prohibited in production environment." },
        { status: 403 }
      );
    }

    const storage = getStorageProvider();

    // 1. Resolve Entrance
    const entrance = await storage.entrances.findById(entranceId);
    if (!entrance) {
      return NextResponse.json({ error: "Entrance not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    // 2. Resolve or create Evidence
    let evidence: Evidence | null = null;
    if (evidenceId) {
      evidence = await storage.evidence.findById(evidenceId);
    }

    if (!evidence) {
      const recent = await storage.evidence.listByEntranceId(entranceId, 1);
      evidence = recent[0] || null;
    }

    if (!evidence) {
      // Invariant: Synthetic or test-triggered evidence cannot claim OFFICIAL_RING provenance
      evidence = {
        id: `ev_test_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: nowIso,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };
      await storage.evidence.save(evidence);
    }

    // 3. Resolve Analyzer
    const analyzer =
      analyzerType === "bedrock"
        ? new BedrockVisionAnalyzer()
        : new SimulatorVisionAnalyzer((simulatorMode as SimulatorVisionMode) || "CLEAR");

    // Sample 1x1 transparent JPEG byte buffer for demo/testing transport
    const sampleJpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);

    // 4. Run Pipeline Service
    const pipeline = VisionPipelineService.getInstance();
    const result = await pipeline.processEvidence({
      evidence,
      imageBytes: sampleJpegBytes,
      mimeType: "image/jpeg",
      entrance,
      analyzer,
      correlationId: correlationId || `vis_${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[API] Vision analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
