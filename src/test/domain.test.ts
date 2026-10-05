import { describe, it, expect } from "vitest";
import {
  Venue,
  Entrance,
  CameraBinding,
  AccessibilityRequirements,
  RemediationTask,
  AccessAssessment,
  AuditEvent,
} from "@/domain/types";

describe("Domain Models & Entities", () => {
  it("creates a valid Venue entity", () => {
    const venue: Venue = {
      id: "venue_123",
      name: "Maple Street Cafe",
      timezone: "America/New_York",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(venue.id).toBe("venue_123");
    expect(venue.name).toBe("Maple Street Cafe");
    expect(venue.timezone).toBe("America/New_York");
  });

  it("creates a valid Entrance entity with explicit camera binding and typed requirements", () => {
    const cameraBinding: CameraBinding = {
      deviceId: "cam_front_entrance",
      componentId: "component_video_01",
      deviceName: "Front Ramp Camera",
      notes: "Line of sight to wheelchair ramp",
    };

    const requirements: AccessibilityRequirements = {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    };

    const entrance: Entrance = {
      id: "entrance_01",
      venueId: "venue_123",
      name: "Side Accessible Entrance",
      description: "Wheelchair ramp and power-operated door",
      enabled: true,
      cameraBinding,
      requirements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(entrance.cameraBinding.deviceId).toBe("cam_front_entrance");
    expect(entrance.cameraBinding.componentId).toBe("component_video_01");
    expect(entrance.requirements.pathwayClear).toBe(true);
    expect(entrance.requirements.obstructionFree).toBe(true);
    expect(entrance.requirements.doorReady).toBe(true);
  });

  it("enforces explicit RemediationTask lifecycle statuses", () => {
    const task: RemediationTask = {
      id: "task_01",
      entranceId: "entrance_01",
      triggerAssessmentId: "assess_01",
      status: "OPEN",
      reason: "Delivery boxes blocking access ramp",
      createdAt: new Date().toISOString(),
    };

    expect(task.status).toBe("OPEN");

    // Acknowledge
    const acknowledgedTask: RemediationTask = {
      ...task,
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date().toISOString(),
    };
    expect(acknowledgedTask.status).toBe("ACKNOWLEDGED");

    // Complete
    const completedTask: RemediationTask = {
      ...acknowledgedTask,
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
      completedBy: "Alex Staff",
    };
    expect(completedTask.status).toBe("COMPLETED");
    expect(completedTask.completedBy).toBe("Alex Staff");
  });

  it("creates structured AccessAssessment and AuditEvent records", () => {
    const assessment: AccessAssessment = {
      id: "assess_99",
      entranceId: "entrance_01",
      state: "INTERRUPTED",
      reasonCode: "ACCESS_OBSTRUCTION",
      reason: "Obstruction detected on ramp",
      evidenceIds: ["ev_101"],
      observationIds: ["obs_101"],
      policyVersion: "1.0.0",
      assessedAt: new Date().toISOString(),
    };

    expect(assessment.state).toBe("INTERRUPTED");
    expect(assessment.reasonCode).toBe("ACCESS_OBSTRUCTION");

    const auditEvent: AuditEvent = {
      id: "audit_101",
      type: "ACCESS_INTERRUPTED",
      timestamp: new Date().toISOString(),
      correlationId: "corr_xyz",
      entityType: "ENTRANCE",
      entityId: "entrance_01",
      metadata: { reason: "Obstruction on ramp" },
    };

    expect(auditEvent.type).toBe("ACCESS_INTERRUPTED");
    expect(auditEvent.entityType).toBe("ENTRANCE");
  });
});
