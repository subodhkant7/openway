import { NextResponse } from "next/server";
import { z } from "zod";
import { runSimulatorScenario, SimulatorScenarioName } from "@/workflow/simulatorWorkflow";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEMO_IDS } from "@/persistence/bootstrap";

const ScenarioRequestSchema = z.object({
  scenario: z.enum([
    "SCENARIO_1_NORMAL",
    "SCENARIO_2_OBSTRUCTION",
    "SCENARIO_3_STAFF_FALSE_CLAIM",
    "SCENARIO_4_FRESH_CLEAR_EVIDENCE",
    "SCENARIO_5_STALE_CLEAR_EVIDENCE",
    "SCENARIO_6_CONTRADICTORY_EVIDENCE",
    "SCENARIO_7_WRONG_CAMERA",
    "SCENARIO_A_PREEMPTIVE_OBSTRUCTION",
    "SCENARIO_B_RESOLUTION",
    "SCENARIO_C_FALSE_COMPLETION",
    "SCENARIO_D_VERIFICATION_UNAVAILABLE",
    "SCENARIO_E_STALE_EVIDENCE",
    "SCENARIO_F_WRONG_CAMERA",
    "SCENARIO_G_CONTRADICTION",
    "SCENARIO_H_EVENT_LOST",
    "RUN_PREEMPTIVE_OBSTRUCTION",
    "RUN_STAFF_REMEDIATION",
    "RUN_VERIFICATION",
    "RUN_STALE_VERIFICATION",
    "RUN_UNKNOWN_VERIFICATION",
  ]),
  entranceId: z.string().optional(),
});

export async function POST(request: Request) {
  // 1. Rate Limiting Protection (Max 30 scenarios per minute per client)
  const clientIp = request.headers.get("x-forwarded-for") || "local_demo_client";
  const rateLimit = checkRateLimit(`scenario_${clientIp}`, {
    windowMs: 60000,
    maxRequests: 30,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded for simulation workbench. Please slow down.",
        retryAfterMs: rateLimit.resetMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimit.resetMs / 1000).toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = ScenarioRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // 2. Demo Tenant Scope Guard: In public/demo mode, only allow demo entrance manipulation
    const targetEntranceId = parsed.data.entranceId || DEMO_IDS.ENTRANCE_ID;
    if (parsed.data.entranceId && parsed.data.entranceId !== DEMO_IDS.ENTRANCE_ID) {
      return NextResponse.json(
        {
          error: "Permission denied: Simulation scenarios are restricted to the demo tenant.",
          allowedEntranceId: DEMO_IDS.ENTRANCE_ID,
        },
        { status: 403 }
      );
    }

    const result = await runSimulatorScenario(
      parsed.data.scenario as SimulatorScenarioName,
      targetEntranceId
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal simulation error",
        requestId: `req_${Date.now()}`,
      },
      { status: 500 }
    );
  }
}
