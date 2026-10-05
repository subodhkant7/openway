import { NextResponse } from "next/server";
import { z } from "zod";
import { runSimulatorScenario, SimulatorScenarioName } from "@/workflow/simulatorWorkflow";

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
  try {
    const body = await request.json();
    const parsed = ScenarioRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await runSimulatorScenario(
      parsed.data.scenario as SimulatorScenarioName,
      parsed.data.entranceId
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[API] Failed to run scenario:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
