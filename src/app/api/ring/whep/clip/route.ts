import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const outDir = process.env.WHEP_CLIP_OUTPUT_DIR || os.tmpdir();
    const outPath = path.join(outDir, "ring_playground_whep_stream_clip.webm");

    fs.writeFileSync(outPath, buffer);
    console.log(`Saved WHEP clip to ${outPath} (${buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      bytes: buffer.length,
      path: outPath,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save clip",
      },
      { status: 500 }
    );
  }
}
