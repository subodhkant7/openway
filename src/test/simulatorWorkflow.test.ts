import { describe, it, expect, beforeEach } from "vitest";
import { runSimulatorScenario } from "@/workflow/simulatorWorkflow";
import { resetGlobalStorage, getStorageProvider } from "@/persistence";

describe("Phase 2 Deterministic Simulator Scenarios", () => {
  beforeEach(() => {
    resetGlobalStorage();
  });

  it("Scenario 1 — Normal baseline verification produces AVAILABLE", async () => {
    const res = await runSimulatorScenario("SCENARIO_1_NORMAL");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("AVAILABLE");
  });

  it("Scenario 2 — Obstruction produces INTERRUPTED -> ACTION_REQUIRED with open task", async () => {
    const res = await runSimulatorScenario("SCENARIO_2_OBSTRUCTION");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("ACTION_REQUIRED");
    expect(res.taskId).toBeDefined();

    const storage = getStorageProvider();
    const task = await storage.remediations.findById(res.taskId!);
    expect(task?.status).toBe("OPEN");
  });

  it("Scenario 3 — Staff falsely claiming fixed transitions to RECHECKING, NEVER VERIFIED_RESTORED", async () => {
    // First trigger obstruction
    await runSimulatorScenario("SCENARIO_2_OBSTRUCTION");

    // Staff claims fixed
    const res = await runSimulatorScenario("SCENARIO_3_STAFF_FALSE_CLAIM");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("RECHECKING");
    expect(res.resultingState).not.toBe("VERIFIED_RESTORED");
  });

  it("Scenario 4 — Fresh post-remediation evidence passes gatekeeper to VERIFIED_RESTORED", async () => {
    // 1. Obstruction
    await runSimulatorScenario("SCENARIO_2_OBSTRUCTION");
    // 2. Staff claims fixed
    await runSimulatorScenario("SCENARIO_3_STAFF_FALSE_CLAIM");
    // 3. Fresh clear evidence
    const res = await runSimulatorScenario("SCENARIO_4_FRESH_CLEAR_EVIDENCE");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("VERIFIED_RESTORED");
  });

  it("Scenario 5 — Stale clear evidence safely resolves to UNKNOWN", async () => {
    const res = await runSimulatorScenario("SCENARIO_5_STALE_CLEAR_EVIDENCE");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("UNKNOWN");
  });

  it("Scenario 6 — Contradictory evidence safely resolves to UNKNOWN", async () => {
    const res = await runSimulatorScenario("SCENARIO_6_CONTRADICTORY_EVIDENCE");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("UNKNOWN");
  });

  it("Scenario 7 — Evidence from wrong camera is strictly REJECTED without modifying assurance", async () => {
    const res = await runSimulatorScenario("SCENARIO_7_WRONG_CAMERA");
    expect(res.passed).toBe(true);
    expect(res.resultingState).toBe("REJECTED");

    // Check that wrong camera rejection was recorded in audit log
    const storage = getStorageProvider();
    const auditLogs = await storage.auditEvents.listByEntranceId("entrance_side_accessible");
    const wrongCamEvent = auditLogs.find((e) => e.type === "WRONG_CAMERA_REJECTED");
    expect(wrongCamEvent).toBeDefined();
  });
});
