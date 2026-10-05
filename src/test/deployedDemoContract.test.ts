import { describe, it, expect, beforeEach } from "vitest";
import { getStorageProvider, resetGlobalStorage } from "@/persistence";
import { bootstrapStorage, DEMO_IDS } from "@/persistence/bootstrap";
import { runSimulatorScenario } from "@/workflow/simulatorWorkflow";

describe("Deployed Demo Contract & Public Judge Workflow (Phase 6)", () => {
  beforeEach(async () => {
    resetGlobalStorage();
    const storage = getStorageProvider("memory");
    await bootstrapStorage(storage);
  });

  it("bootstraps demo tenant idempotently without duplicate records", async () => {
    const storage = getStorageProvider("memory");
    const result1 = await bootstrapStorage(storage);
    expect(result1.venueCreated).toBe(false); // already seeded by beforeEach

    const venue = await storage.venues.findById(DEMO_IDS.VENUE_ID);
    expect(venue).not.toBeNull();
    expect(venue?.name).toBe("Maple Street Cafe");

    const entrance = await storage.entrances.findById(DEMO_IDS.ENTRANCE_ID);
    expect(entrance).not.toBeNull();
    expect(entrance?.cameraBinding.deviceId).toBe(DEMO_IDS.CAMERA_DEVICE_ID);
  });

  it("executes the complete canonical demo sequence from baseline to verified restoration", async () => {
    const storage = getStorageProvider("memory");

    // 1. Initial State: AVAILABLE
    const initialAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(initialAssessment?.state).toBe("AVAILABLE");

    // 2. Step 1: Preemptive Obstruction (Ring motion -> Interrupted -> Action Required)
    const obstResult = await runSimulatorScenario("RUN_PREEMPTIVE_OBSTRUCTION", DEMO_IDS.ENTRANCE_ID);
    expect(obstResult.passed).toBe(true);
    expect(obstResult.resultingState).toBe("ACTION_REQUIRED");

    // Verify durable active task exists
    const activeTask = await storage.remediations.findActiveByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(activeTask).not.toBeNull();
    expect(activeTask?.status).toBe("OPEN");

    // 3. Step 2: Staff Remediation (Staff reports complete -> RECHECKING; strictly refuses green)
    const staffResult = await runSimulatorScenario("RUN_STAFF_REMEDIATION", DEMO_IDS.ENTRANCE_ID);
    expect(staffResult.passed).toBe(true);
    expect(staffResult.resultingState).toBe("RECHECKING");

    const recheckAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(recheckAssessment?.state).toBe("RECHECKING");

    // 4. Step 3: Verified Restoration (Fresh post-remediation evidence passes gatekeeper)
    const verifyResult = await runSimulatorScenario("RUN_VERIFICATION", DEMO_IDS.ENTRANCE_ID);
    expect(verifyResult.passed).toBe(true);
    expect(verifyResult.resultingState).toBe("VERIFIED_RESTORED");

    const restoredAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(restoredAssessment?.state).toBe("VERIFIED_RESTORED");

    // 5. Verify Timeline Audit Trail Persistence
    const auditEvents = await storage.auditEvents.listByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(auditEvents.length).toBeGreaterThanOrEqual(4);
  });

  it("executes failure demo 1: media unavailable safely transitions to UNKNOWN and recovers", async () => {
    const storage = getStorageProvider("memory");

    // 1. Move to RECHECKING
    await runSimulatorScenario("RUN_PREEMPTIVE_OBSTRUCTION", DEMO_IDS.ENTRANCE_ID);
    await runSimulatorScenario("RUN_STAFF_REMEDIATION", DEMO_IDS.ENTRANCE_ID);

    // 2. Run Unavailable Verification
    const unavailResult = await runSimulatorScenario("RUN_UNKNOWN_VERIFICATION", DEMO_IDS.ENTRANCE_ID);
    expect(unavailResult.passed).toBe(true);
    expect(unavailResult.resultingState).toBe("UNKNOWN");

    const unkAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(unkAssessment?.state).toBe("UNKNOWN");

    // 3. Recover with fresh valid post-remediation evidence
    const recoverResult = await runSimulatorScenario("RUN_VERIFICATION", DEMO_IDS.ENTRANCE_ID);
    expect(recoverResult.passed).toBe(true);
    expect(recoverResult.resultingState).toBe("VERIFIED_RESTORED");
  });

  it("executes failure demo 2: pre-remediation evidence reuse is rejected with UNKNOWN", async () => {
    const storage = getStorageProvider("memory");

    // 1. Move to RECHECKING
    await runSimulatorScenario("RUN_PREEMPTIVE_OBSTRUCTION", DEMO_IDS.ENTRANCE_ID);
    await runSimulatorScenario("RUN_STAFF_REMEDIATION", DEMO_IDS.ENTRANCE_ID);

    // 2. Attempt verification with stale/pre-remediation evidence
    const staleResult = await runSimulatorScenario("RUN_STALE_VERIFICATION", DEMO_IDS.ENTRANCE_ID);
    expect(staleResult.passed).toBe(true);
    expect(staleResult.resultingState).toBe("UNKNOWN");

    const unkAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
    expect(unkAssessment?.state).toBe("UNKNOWN");
    expect(unkAssessment?.reasonCode).toBe("TEMPORAL_INCONSISTENCY");
  });
});
