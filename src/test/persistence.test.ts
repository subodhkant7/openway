import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryStorageProvider } from "@/persistence/memoryStore";
import { Venue, Entrance, AccessAssessment, RemediationTask, AuditEvent } from "@/domain/types";

describe("Persistence Layer & Transactional Consistency", () => {
  let storage: InMemoryStorageProvider;

  beforeEach(() => {
    storage = new InMemoryStorageProvider();
  });

  it("loads pre-seeded demo venue and demo entrance", async () => {
    const venues = await storage.venues.listAll();
    expect(venues.length).toBeGreaterThanOrEqual(1);
    expect(venues[0].name).toBe("Maple Street Cafe");

    const entrances = await storage.entrances.listAll();
    expect(entrances.length).toBeGreaterThanOrEqual(1);
    expect(entrances[0].name).toBe("Side Accessible Entrance");
    expect(entrances[0].cameraBinding.deviceId).toBe("cam_front_entrance");
  });

  it("persists and retrieves new Venue and Entrance entities", async () => {
    const newVenue: Venue = {
      id: "venue_liberty",
      name: "Liberty Public Library",
      timezone: "America/Chicago",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.venues.save(newVenue);

    const loadedVenue = await storage.venues.findById("venue_liberty");
    expect(loadedVenue).not.toBeNull();
    expect(loadedVenue?.name).toBe("Liberty Public Library");

    const newEntrance: Entrance = {
      id: "entrance_liberty_ramp",
      venueId: "venue_liberty",
      name: "West Ramp Entrance",
      description: "ADA ramp to main lobby",
      enabled: true,
      cameraBinding: {
        deviceId: "cam_west",
        componentId: "comp_01",
      },
      requirements: {
        pathwayClear: true,
        obstructionFree: true,
        doorReady: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.entrances.save(newEntrance);

    const loadedEntrance = await storage.entrances.findById("entrance_liberty_ramp");
    expect(loadedEntrance?.cameraBinding.deviceId).toBe("cam_west");
  });

  it("persists assessments and retrieves latest assessment for an entrance", async () => {
    const entranceId = "entrance_test";
    const now = Date.now();

    const a1: AccessAssessment = {
      id: "assess_1",
      entranceId,
      state: "AVAILABLE",
      reasonCode: "INIT",
      reason: "Initial",
      evidenceIds: [],
      observationIds: [],
      policyVersion: "1.0",
      assessedAt: new Date(now - 10000).toISOString(),
    };

    const a2: AccessAssessment = {
      id: "assess_2",
      entranceId,
      state: "INTERRUPTED",
      reasonCode: "OBSTRUCTION",
      reason: "Obstruction",
      evidenceIds: ["ev_1"],
      observationIds: ["obs_1"],
      policyVersion: "1.0",
      assessedAt: new Date(now).toISOString(),
    };

    await storage.assessments.save(a1);
    await storage.assessments.save(a2);

    const latest = await storage.assessments.findLatestByEntranceId(entranceId);
    expect(latest?.id).toBe("assess_2");
    expect(latest?.state).toBe("INTERRUPTED");
  });

  it("executes multi-entity atomic transaction successfully", async () => {
    const entranceId = "entrance_tx";
    const now = new Date().toISOString();

    await storage.transaction(async (tx) => {
      await tx.assessments.save({
        id: "tx_assess_01",
        entranceId,
        state: "ACTION_REQUIRED",
        reasonCode: "OBSTRUCTION",
        reason: "Box detected",
        evidenceIds: [],
        observationIds: [],
        policyVersion: "1.0",
        assessedAt: now,
      });

      await tx.remediations.save({
        id: "tx_task_01",
        entranceId,
        triggerAssessmentId: "tx_assess_01",
        status: "OPEN",
        reason: "Clear box",
        createdAt: now,
      });

      await tx.auditEvents.append({
        id: "tx_audit_01",
        type: "TASK_CREATED",
        timestamp: now,
        correlationId: "tx_corr_01",
        entityType: "REMEDIATION_TASK",
        entityId: "tx_task_01",
        metadata: { reason: "Clear box" },
      });
    });

    const assess = await storage.assessments.findById("tx_assess_01");
    const task = await storage.remediations.findById("tx_task_01");
    const audit = await storage.auditEvents.findById("tx_audit_01");

    expect(assess).not.toBeNull();
    expect(task).not.toBeNull();
    expect(audit).not.toBeNull();
  });

  it("rolls back all changes when transaction fails midway", async () => {
    const initialAssessments = (await storage.assessments.listByEntranceId("entrance_rollback")).length;

    await expect(
      storage.transaction(async (tx) => {
        // Step 1: Save assessment
        await tx.assessments.save({
          id: "rollback_assess",
          entranceId: "entrance_rollback",
          state: "INTERRUPTED",
          reasonCode: "TEMP",
          reason: "Will rollback",
          evidenceIds: [],
          observationIds: [],
          policyVersion: "1.0",
          assessedAt: new Date().toISOString(),
        });

        // Step 2: Intentional error to simulate failure
        throw new Error("Simulated storage failure during transaction");
      })
    ).rejects.toThrow("Simulated storage failure during transaction");

    // Verify rollback: assessment must NOT exist
    const assess = await storage.assessments.findById("rollback_assess");
    expect(assess).toBeNull();

    const afterCount = (await storage.assessments.listByEntranceId("entrance_rollback")).length;
    expect(afterCount).toBe(initialAssessments);
  });
});
