import { describe, it, expect, vi } from "vitest";
import { RingPlaygroundProvider } from "@/ring/RingPlaygroundProvider";
import { RingSimulatorProvider } from "@/ring/RingSimulatorProvider";
import { RingClient } from "@/ring/RingClient";
import { canDeclareRestored } from "@/domain/accessibility";

describe("RingPlaygroundProvider", () => {
  it("reports NOT_CONFIGURED state when access token is missing", async () => {
    const mockClient = new RingClient({ accessToken: "" });
    const provider = new RingPlaygroundProvider(mockClient);

    const status = await provider.getProviderStatus();

    expect(status.state).toBe("NOT_CONFIGURED");
    expect(status.isConfigured).toBe(false);
    expect(status.activeDeviceCount).toBe(0);
  });

  it("reports CONNECTED state and discovers devices with normalized capabilities", async () => {
    const mockClient = new RingClient({ accessToken: "valid_token" });
    vi.spyOn(mockClient, "request").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/v1/devices") {
        return {
          devices: [
            {
              id: "ring_cam_001",
              name: "West Ramp Access Camera",
              kind: "doorbell",
              status: { state: "online", online: true },
              capabilities: {
                supports_live_video: true,
                supports_snapshots: true,
                supports_media_clips: true,
                supports_motion_events: true,
              },
              components: ["camera", "doorbell", "motion_detector"],
            },
          ],
        };
      }
      return {};
    });

    const provider = new RingPlaygroundProvider(mockClient);
    const status = await provider.getProviderStatus();

    expect(status.state).toBe("CONNECTED");
    expect(status.activeDeviceCount).toBe(1);

    const devices = await provider.listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe("West Ramp Access Camera");
    expect(devices[0].capabilities.supports_live_video).toBe(true);
    expect(devices[0].capabilities.supports_snapshots).toBe(true);
  });

  it("reports ERROR state when upstream API returns 401 without exposing secret in details", async () => {
    const mockClient = new RingClient({ accessToken: "invalid_secret_token_abc" });
    vi.spyOn(mockClient, "request").mockRejectedValue(new Error("HTTP 401 Unauthorized"));

    const provider = new RingPlaygroundProvider(mockClient);
    const status = await provider.getProviderStatus();

    expect(status.state).toBe("ERROR");
    expect(status.error).toBeDefined();
    // Verify no secret leak in status details
    expect(JSON.stringify(status)).not.toContain("invalid_secret_token_abc");
  });
});

describe("RingSimulatorProvider", () => {
  it("provides deterministic simulated devices and SIMULATED status by default", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    simulator.setConnectionState(true);

    const status = await simulator.getProviderStatus();
    expect(status.state).toBe("SIMULATED");
    expect(status.mode).toBe("simulator");

    const devices = await simulator.listDevices();
    expect(devices.length).toBeGreaterThan(0);
    // User-assigned name used
    expect(devices[0].name).toBe("Main Accessible Ramp Entrance");
  });

  it("supports toggling device online/offline states deterministically", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    const devices = await simulator.listDevices();
    const testDev = devices[0];

    simulator.setDeviceOnlineState(testDev.id, false);
    let devStatus = await simulator.getDeviceStatus(testDev.id);
    expect(devStatus).toBe("offline");

    simulator.setDeviceOnlineState(testDev.id, true);
    devStatus = await simulator.getDeviceStatus(testDev.id);
    expect(devStatus).toBe("online");
  });

  it("generates accessible SVG snapshot data URL", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    const devices = await simulator.listDevices();

    const snapshot = await simulator.getSnapshot(devices[0].id);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.dataUrl).toContain("data:image/svg+xml");
    expect(snapshot?.deviceId).toBe(devices[0].id);
  });

  it("triggers deterministic motion and obstruction events", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    const event = simulator.triggerEvent({
      eventType: "motion",
      summary: "Patron approaching entrance ramp",
    });

    expect(event.eventType).toBe("motion");
    expect(event.provider).toBe("simulator");

    const recent = await simulator.getRecentEvents();
    expect(recent.some((e) => e.eventId === event.eventId)).toBe(true);
  });
});

describe("Domain Accessibility Assurance Rules", () => {
  it("enforces that access is not verified until fresh evidence captured AFTER interruption is provided", () => {
    const interruptionTime = "2026-10-05T10:00:00.000Z";

    // Case 1: No evidence -> cannot restore
    expect(canDeclareRestored(interruptionTime, null)).toBe(false);

    // Case 2: Evidence captured BEFORE interruption (stale) -> cannot restore
    const staleEvidence = {
      evidenceId: "ev_old",
      capturedAt: "2026-10-05T09:55:00.000Z",
      deviceId: "cam_1",
      mediaType: "snapshot" as const,
      provedPhysicalStateChange: true,
      notes: "Before event",
    };
    expect(canDeclareRestored(interruptionTime, staleEvidence)).toBe(false);

    // Case 3: Fresh evidence after interruption, but did NOT prove physical state changed -> cannot restore
    const unprovenEvidence = {
      evidenceId: "ev_unproven",
      capturedAt: "2026-10-05T10:05:00.000Z",
      deviceId: "cam_1",
      mediaType: "snapshot" as const,
      provedPhysicalStateChange: false,
      notes: "Door still blocked",
    };
    expect(canDeclareRestored(interruptionTime, unprovenEvidence)).toBe(false);

    // Case 4: Fresh evidence captured AFTER interruption proving physical state changed -> RESTORED
    const validEvidence = {
      evidenceId: "ev_fresh_proof",
      capturedAt: "2026-10-05T10:05:00.000Z",
      deviceId: "cam_1",
      mediaType: "snapshot" as const,
      provedPhysicalStateChange: true,
      notes: "Obstruction removed and path completely clear",
    };
    expect(canDeclareRestored(interruptionTime, validEvidence)).toBe(true);
  });
});
