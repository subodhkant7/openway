import { NextResponse } from "next/server";
import { RecheckService } from "@/workflow/recheckService";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const body = await request.json().catch(() => ({}));

    const recheckService = new RecheckService();
    const result = await recheckService.startVerification(taskId, {
      maxAttempts: body.maxAttempts ?? 3,
      initialDelayMs: body.initialDelayMs ?? 0,
      overrideCapturedAt: body.overrideCapturedAt,
    });

    return NextResponse.json({
      success: result.success,
      taskId: result.taskId,
      entranceId: result.entranceId,
      previousState: result.previousState,
      finalState: result.finalState,
      attempts: result.attempts,
      explanation: result.explanation,
      gatekeeperResult: result.gatekeeperResult,
      observation: result.observation,
      evidenceUsed: result.evidenceUsed,
    });
  } catch (error) {
    console.error("[API] Failed to run post-remediation verification:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
