import { describe, it, expect, beforeEach } from "vitest";
import { EventCorrelator } from "../workflow/eventCorrelator";
import { resetGlobalStorage, getStorageProvider } from "../persistence";
import { Entrance, Venue } from "../domain/types";
import { RingEvent } from "../ring/types";

describe("EventCorrelator (Hardware Binding & Routing)", () => {
  let correlator: EventCorrelator;
  const storage = getStorageProvider();

  const venue: Venue = {
    id: "venue_test_101",
    name: "Civic Center",
    timezone: "America/New_York",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const frontEntrance: Entrance = {
    id: "entrance_front_ramp",
    venueId: venue.id,
    name: "Front Accessible Ramp",
    description: "Main accessible ramp at front entrance",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_ring_doorbell_01",
      componentId: "main_sensor",
      deviceName: "Front Doorbell Cam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const disabledEntrance: Entrance = {
    id: "entrance_seasonal_patio",
    venueId: venue.id,
    name: "Patio Entrance",
    description: "Seasonal ramp closed for winter",
    enabled: false, // Disabled!
    cameraBinding: {
      deviceId: "cam_ring_patio_02",
      componentId: "patio_sensor",
      deviceName: "Patio Cam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const multiCamEntranceRamp: Entrance = {
    id: "entrance_dock_ramp",
    venueId: venue.id,
    name: "Loading Dock Ramp",
    description: "Side delivery ramp",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_ring_multicam_03",
      componentId: "sensor_ramp_wide",
      deviceName: "Dock Multicam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const multiCamEntranceDoor: Entrance = {
    id: "entrance_dock_door",
    venueId: venue.id,
    name: "Loading Dock Door",
    description: "Dock automatic push door",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_ring_multicam_03",
      componentId: "sensor_door_ptz",
      deviceName: "Dock Multicam",
    },
    requirements: {
      pathwayClear: false,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    resetGlobalStorage();
    correlator = new EventCorrelator(storage);
    await storage.venues.save(venue);
    await storage.entrances.save(frontEntrance);
    await storage.entrances.save(disabledEntrance);
    await storage.entrances.save(multiCamEntranceRamp);
    await storage.entrances.save(multiCamEntranceDoor);
  });

  it("correlates exact device and component to configured entrance", async () => {
    const event: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId: "evt_corr_01",
      eventType: "motion",
      deviceId: "cam_ring_doorbell_01",
      timestamp: new Date().toISOString(),
      componentIds: ["main_sensor"],
      source: "ring_webhook",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("CORRELATED");
    expect(res.entrance?.id).toBe("entrance_front_ramp");
    expect(res.venue?.id).toBe("venue_test_101");
    expect(res.cameraBinding?.deviceId).toBe("cam_ring_doorbell_01");
  });

  it("correlates single-camera device when componentIds is empty or omitted", async () => {
    const event: RingEvent = {
      provider: "simulator",
      eventCategory: "simulated_local",
      eventId: "evt_corr_02",
      eventType: "motion",
      deviceId: "cam_ring_doorbell_01",
      timestamp: new Date().toISOString(),
      componentIds: [], // Empty components list for single camera
      source: "simulator",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("CORRELATED");
    expect(res.entrance?.id).toBe("entrance_front_ramp");
  });

  it("correlates correct entrance on a multi-camera device based on exact componentId", async () => {
    // Event targeting sensor_door_ptz
    const event: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId: "evt_corr_03",
      eventType: "motion",
      deviceId: "cam_ring_multicam_03",
      timestamp: new Date().toISOString(),
      componentIds: ["sensor_door_ptz"],
      source: "ring_webhook",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("CORRELATED");
    expect(res.entrance?.id).toBe("entrance_dock_door");
  });

  it("rejects unbound device with UNBOUND_DEVICE and records audit event without assessment", async () => {
    const event: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId: "evt_corr_unbound",
      eventType: "motion",
      deviceId: "cam_unbound_alleyway_99", // Unbound device!
      timestamp: new Date().toISOString(),
      componentIds: ["main"],
      source: "ring_webhook",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("UNBOUND_DEVICE");
    expect(res.entrance).toBeUndefined();

    // Verify audit log recorded UNBOUND_EVENT
    const audits = await storage.auditEvents.listByCorrelationId("corr_evt_corr_unbound");
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]?.metadata?.correlationStatus).toBe("UNBOUND_DEVICE");

    // Verify NO assessments were created
    const assessments = await storage.assessments.listByEntranceId("entrance_front_ramp");
    expect(assessments.length).toBe(0);
  });

  it("rejects unbound component on multi-camera device with UNBOUND_COMPONENT", async () => {
    const event: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId: "evt_corr_unbound_comp",
      eventType: "motion",
      deviceId: "cam_ring_multicam_03", // Device exists, but component is unconfigured
      timestamp: new Date().toISOString(),
      componentIds: ["sensor_infrared_roof_99"],
      source: "ring_webhook",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("UNBOUND_COMPONENT");
    expect(res.entrance).toBeUndefined();
  });

  it("flags disabled entrance with ENTRANCE_DISABLED without initiating checks", async () => {
    const event: RingEvent = {
      provider: "ring_api",
      eventCategory: "official_ring",
      eventId: "evt_corr_disabled",
      eventType: "motion",
      deviceId: "cam_ring_patio_02",
      timestamp: new Date().toISOString(),
      componentIds: ["patio_sensor"],
      source: "ring_webhook",
      receivedAt: new Date().toISOString(),
    };

    const res = await correlator.correlateEvent(event);
    expect(res.status).toBe("ENTRANCE_DISABLED");
    expect(res.entrance?.id).toBe("entrance_seasonal_patio");
  });

  it("rejects malformed event missing deviceId", async () => {
    const malformed = {
      provider: "ring_api",
      eventId: "bad_evt",
    } as any;

    const res = await correlator.correlateEvent(malformed);
    expect(res.status).toBe("MALFORMED_EVENT");
  });
});
