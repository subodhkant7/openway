import { StorageProvider } from "./repositories";
import { getStorageProvider } from "./index";
import { Venue, Entrance, AccessAssessment, AuditEvent } from "@/domain/types";

export const DEMO_IDS = {
  VENUE_ID: "venue_maple_cafe",
  VENUE_NAME: "Maple Street Cafe",
  ENTRANCE_ID: "entrance_side_accessible",
  CAMERA_DEVICE_ID: "cam_front_entrance",
  CAMERA_COMPONENT_ID: "component_video_01",
} as const;

export interface BootstrapResult {
  venueCreated: boolean;
  entranceCreated: boolean;
  baselineCreated: boolean;
}

/**
 * Deterministically and idempotently bootstraps the demo environment in storage.
 * If entities already exist, they are preserved to maintain durability.
 */
export async function bootstrapStorage(storageProvider?: StorageProvider): Promise<BootstrapResult> {
  const storage = storageProvider || getStorageProvider();
  const now = new Date().toISOString();
  let venueCreated = false;
  let entranceCreated = false;
  let baselineCreated = false;

  // 1. Check & Seed Demo Venue
  let venue = await storage.venues.findById(DEMO_IDS.VENUE_ID);
  if (!venue) {
    const demoVenue: Venue = {
      id: DEMO_IDS.VENUE_ID,
      name: DEMO_IDS.VENUE_NAME,
      timezone: "America/New_York",
      createdAt: now,
      updatedAt: now,
    };
    await storage.venues.save(demoVenue);
    venueCreated = true;
  }

  // 2. Check & Seed Demo Entrance
  let entrance = await storage.entrances.findById(DEMO_IDS.ENTRANCE_ID);
  if (!entrance) {
    const demoEntrance: Entrance = {
      id: DEMO_IDS.ENTRANCE_ID,
      venueId: DEMO_IDS.VENUE_ID,
      name: "Side Accessible Entrance",
      description: "Dedicated step-free access ramp with power-assist door operator",
      enabled: true,
      cameraBinding: {
        deviceId: DEMO_IDS.CAMERA_DEVICE_ID,
        componentId: DEMO_IDS.CAMERA_COMPONENT_ID,
        deviceName: "Front Ramp Camera (Ring Wired Doorbell Plus)",
        notes: "Direct camera line-of-sight to wheelchair ramp and entrance threshold",
      },
      requirements: {
        pathwayClear: true,
        obstructionFree: true,
        doorReady: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    await storage.entrances.save(demoEntrance);
    entranceCreated = true;
  }

  // 3. Check & Seed Initial Baseline Assessment
  const latestAssessment = await storage.assessments.findLatestByEntranceId(DEMO_IDS.ENTRANCE_ID);
  if (!latestAssessment) {
    const baselineAssessment: AccessAssessment = {
      id: `assess_init_${Date.now()}`,
      entranceId: DEMO_IDS.ENTRANCE_ID,
      state: "AVAILABLE",
      reasonCode: "INITIAL_BASELINE",
      reason: "Initial operational baseline established with clear entrance conditions.",
      evidenceIds: [],
      observationIds: [],
      policyVersion: "1.0.0",
      assessedAt: now,
    };
    await storage.assessments.save(baselineAssessment);
    baselineCreated = true;

    // 4. Seed Initial Audit Event
    const baselineEvent: AuditEvent = {
      id: `audit_init_${Date.now()}`,
      type: "ACCESS_VERIFIED_RESTORED",
      timestamp: now,
      correlationId: "init_sys_seed",
      entityType: "ENTRANCE",
      entityId: DEMO_IDS.ENTRANCE_ID,
      metadata: {
        reason: "Initial operational baseline verified clear.",
        assuranceState: "AVAILABLE",
        provenance: "SIMULATED_LOCAL",
      },
    };
    await storage.auditEvents.append(baselineEvent);
  }

  return {
    venueCreated,
    entranceCreated,
    baselineCreated,
  };
}
