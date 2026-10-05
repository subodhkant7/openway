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

  it("correctly parses JSON:API compound document with included relationships", async () => {
    const mockClient = new RingClient({ accessToken: "valid_token" });

    // Official Ring JSON:API compound document structure
    const jsonApiResponse = {
      data: [
        {
          id: "dev_compound_01",
          type: "device",
          attributes: {
            name: "West Ramp Access Camera",
            kind: "doorbell",
            components: ["camera", "doorbell"],
          },
          relationships: {
            status: {
              data: { id: "stat_01", type: "status" },
            },
            capabilities: {
              data: { id: "caps_01", type: "capabilities" },
            },
          },
        },
      ],
      included: [
        {
          id: "stat_01",
          type: "status",
          attributes: {
            state: "online",
            online: true,
            battery_level: 91,
          },
        },
        {
          id: "caps_01",
          type: "capabilities",
          attributes: {
            supports_live_video: true,
            supports_snapshots: true,
            supports_media_clips: true,
            supports_motion_events: true,
          },
        },
      ],
    };

    vi.spyOn(mockClient, "request").mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/v1/devices")) {
        return jsonApiResponse;
      }
      return {};
    });

    const provider = new RingPlaygroundProvider(mockClient);
    const devices = await provider.listDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe("West Ramp Access Camera");
    expect(devices[0].online).toBe(true);
    expect(devices[0].status).toBe("online");
    expect(devices[0].batteryLevel).toBe(91);
    expect(devices[0].capabilities.supports_live_video).toBe(true);
    expect(devices[0].capabilities.supports_snapshots).toBe(true);
  });

  it("calls official POST /v1/devices/{id}/media/image/download for image evidence", async () => {
    const mockClient = new RingClient({ accessToken: "valid_token" });
    const spy = vi.spyOn(mockClient, "downloadImage").mockResolvedValue({
      url: "https://s3.amazonaws.com/ring-pre-signed-url.jpg",
      format: "image/jpeg",
    });

    const provider = new RingPlaygroundProvider(mockClient);
    const evidence = await provider.getImageEvidence("dev_compound_01", ["camera"]);

    expect(spy).toHaveBeenCalledWith(
      "/v1/devices/dev_compound_01/media/image/download",
      { components: ["camera"] }
    );
    expect(evidence).not.toBeNull();
    expect(evidence?.url).toBe("https://s3.amazonaws.com/ring-pre-signed-url.jpg");
    expect(evidence?.isSimulated).toBe(false);
    expect(evidence?.source).toBe("ring_media_download");
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

describe("RingSimulatorProvider & Simulator Honesty", () => {
  it("provides deterministic simulated devices and SIMULATED status by default", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    simulator.setConnectionState(true);

    const status = await simulator.getProviderStatus();
    expect(status.state).toBe("SIMULATED");
    expect(status.mode).toBe("simulator");

    const devices = await simulator.listDevices();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].name).toBe("Main Accessible Ramp Entrance");
  });

  it("generates honestly labeled simulated test evidence without claiming to be live Ring media", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    const devices = await simulator.listDevices();

    const evidence = await simulator.getImageEvidence(devices[0].id);
    expect(evidence).not.toBeNull();
    expect(evidence?.isSimulated).toBe(true);
    expect(evidence?.source).toBe("simulator");

    // Decode SVG data URL to verify honesty
    const rawSvg = decodeURIComponent(evidence?.dataUrl?.replace("data:image/svg+xml;utf8,", "") || "");
    expect(rawSvg).toContain("SIMULATED - LOCAL TEST EVIDENCE");
    // Strictly must NOT claim "RING LIVE SNAPSHOT"
    expect(rawSvg).not.toContain("RING LIVE SNAPSHOT");
  });

  it("marks simulated events with simulated_local provenance category", async () => {
    const simulator = RingSimulatorProvider.getInstance();
    const event = simulator.triggerEvent({
      eventType: "simulated_motion",
      summary: "Patron approaching entrance ramp",
    });

    expect(event.eventCategory).toBe("simulated_local");
    expect(event.provider).toBe("simulator");
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
      mediaType: "image_download" as const,
      provedPhysicalStateChange: true,
      notes: "Before event",
    };
    expect(canDeclareRestored(interruptionTime, staleEvidence)).toBe(false);

    // Case 3: Fresh evidence after interruption, but did NOT prove physical state changed -> cannot restore
    const unprovenEvidence = {
      evidenceId: "ev_unproven",
      capturedAt: "2026-10-05T10:05:00.000Z",
      deviceId: "cam_1",
      mediaType: "image_download" as const,
      provedPhysicalStateChange: false,
      notes: "Door still blocked",
    };
    expect(canDeclareRestored(interruptionTime, unprovenEvidence)).toBe(false);

    // Case 4: Fresh evidence captured AFTER interruption proving physical state changed -> RESTORED
    const validEvidence = {
      evidenceId: "ev_fresh_proof",
      capturedAt: "2026-10-05T10:05:00.000Z",
      deviceId: "cam_1",
      mediaType: "image_download" as const,
      provedPhysicalStateChange: true,
      notes: "Obstruction removed and path completely clear",
    };
    expect(canDeclareRestored(interruptionTime, validEvidence)).toBe(true);
  });
});
