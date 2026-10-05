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
