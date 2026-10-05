import { NextResponse } from "next/server";
import { EventReconciliationService } from "@/workflow/eventReconciliation";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const service = new EventReconciliationService();
    const report = await service.reconcileMissedEvents({
      lookbackMinutes: body.lookbackMinutes,
      sinceTimestamp: body.sinceTimestamp,
      limit: body.limit,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("[API] Failed to run event reconciliation:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const service = new EventReconciliationService();
  return NextResponse.json({
    lastReconciliationTimestamp: service.getLastReconciliationTimestamp(),
  });
}
