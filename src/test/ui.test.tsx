import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RingConnectionCard } from "@/components/RingConnectionCard";
import { DeviceList } from "@/components/DeviceList";
import { EntranceAssuranceCard } from "@/components/EntranceAssuranceCard";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { RingDevice, RingProviderStatus } from "@/ring/types";

describe("OpenWay Operator UI Components", () => {
  it("renders RingConnectionCard in NOT_CONFIGURED state", () => {
    const status: RingProviderStatus = {
      mode: "playground",
      state: "NOT_CONFIGURED",
      isConfigured: false,
      baseUrl: "https://api.amazonvision.com",
      lastCheck: new Date().toISOString(),
      details: "Token missing",
      activeDeviceCount: 0,
    };

    render(
      <RingConnectionCard
        status={status}
        loading={false}
        onRefresh={vi.fn()}
        onModeChange={vi.fn()}
        activeMode="playground"
      />
    );

    expect(screen.getByText("NOT CONFIGURED")).toBeInTheDocument();
    expect(screen.getByText("Token missing")).toBeInTheDocument();
  });

  it("renders RingConnectionCard in CONNECTED state", () => {
    const status: RingProviderStatus = {
      mode: "playground",
      state: "CONNECTED",
      isConfigured: true,
      baseUrl: "https://api.amazonvision.com",
      lastCheck: new Date().toISOString(),
      details: "Connected to Ring",
      activeDeviceCount: 2,
    };

    render(
      <RingConnectionCard
        status={status}
        loading={false}
        onRefresh={vi.fn()}
        onModeChange={vi.fn()}
        activeMode="playground"
      />
    );

    expect(screen.getByText("CONNECTED (REAL RING)")).toBeInTheDocument();
    expect(screen.getByText("2 online")).toBeInTheDocument();
  });

  it("renders RingConnectionCard in ERROR state with diagnostic message", () => {
    const status: RingProviderStatus = {
      mode: "api",
      state: "ERROR",
      isConfigured: true,
      baseUrl: "https://api.amazonvision.com",
      lastCheck: new Date().toISOString(),
      error: "Authentication token expired",
      activeDeviceCount: 0,
    };

    render(
      <RingConnectionCard
        status={status}
        loading={false}
        onRefresh={vi.fn()}
        onModeChange={vi.fn()}
        activeMode="api"
      />
    );

    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText(/Authentication token expired/i)).toBeInTheDocument();
  });

  it("renders RingConnectionCard in SIMULATED state", () => {
    const status: RingProviderStatus = {
      mode: "simulator",
      state: "SIMULATED",
      isConfigured: true,
      baseUrl: "http://localhost:3000/simulator",
      lastCheck: new Date().toISOString(),
      activeDeviceCount: 1,
    };

    render(
      <RingConnectionCard
        status={status}
        loading={false}
        onRefresh={vi.fn()}
        onModeChange={vi.fn()}
        activeMode="simulator"
      />
    );

    expect(screen.getByText("SIMULATED")).toBeInTheDocument();
  });

  it("renders DeviceList loading state", () => {
    render(
      <DeviceList
        devices={[]}
        loading={true}
        activeMode="simulator"
      />
    );

    const region = screen.getByRole("region", { name: /ring devices/i });
    expect(region).toBeInTheDocument();
    expect(region.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders DeviceList empty state when no devices are present", () => {
    render(
      <DeviceList
        devices={[]}
        loading={false}
        activeMode="simulator"
      />
    );

    expect(screen.getByText("No Ring devices discovered")).toBeInTheDocument();
  });

  it("renders DeviceList with user-assigned names, online status, and capability badges", () => {
    const mockDevices: RingDevice[] = [
      {
        id: "cam_ramp_99",
        name: "Main Entrance Accessible Ramp",
        kind: "doorbell",
        online: true,
        status: "online",
        batteryLevel: 92,
        capabilities: {
          supports_live_video: true,
          supports_snapshots: true,
          supports_media_clips: true,
          supports_motion_events: true,
        },
        components: ["camera", "doorbell"],
      },
    ];

    render(
      <DeviceList
        devices={mockDevices}
        loading={false}
        activeMode="playground"
      />
    );

    // Prominent user-assigned name
    expect(screen.getByText("Main Entrance Accessible Ramp")).toBeInTheDocument();
    // Online badge
    expect(screen.getByText("Online")).toBeInTheDocument();
    // Capabilities
    expect(screen.getByText("Live Video")).toBeInTheDocument();
    expect(screen.getByText("Snapshots")).toBeInTheDocument();
    expect(screen.getByText("Media Clips")).toBeInTheDocument();
    expect(screen.getByText("Motion Events")).toBeInTheDocument();
    // Action button
    expect(screen.getByText("Image Evidence")).toBeInTheDocument();
  });

  it("renders EntranceAssuranceCard with [not configured yet] empty state", () => {
    render(
      <EntranceAssuranceCard
        entrance={null}
        assuranceStatus="UNCONFIGURED"
        activeRemediation={null}
        requirements={{ pathwayClear: true, obstructionFree: true, doorReady: true }}
      />
    );

    expect(screen.getAllByText("[not configured yet]").length).toBeGreaterThan(0);
  });

  it("renders EntranceAssuranceCard with configured entrance and AVAILABLE state", () => {
    const mockEntrance = {
      id: "ent_01",
      venueId: "ven_01",
      name: "Side Ramp Entrance",
      description: "Dedicated step-free ramp",
      enabled: true,
      cameraBinding: {
        deviceId: "cam_front",
        componentId: "comp_vid",
        deviceName: "Front Camera",
      },
      requirements: {
        pathwayClear: true,
        obstructionFree: true,
        doorReady: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(
      <EntranceAssuranceCard
        entrance={mockEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
        requirements={mockEntrance.requirements}
      />
    );

    expect(screen.getByText("ACCESS AVAILABLE")).toBeInTheDocument();
    expect(screen.getByText("Side Ramp Entrance")).toBeInTheDocument();
    expect(screen.getByText(/Front Camera/)).toBeInTheDocument();
    expect(screen.getByText("Pathway Clear")).toBeInTheDocument();
  });

  it("renders PrivacyNotice with zero facial tracking guarantee", () => {
    render(<PrivacyNotice />);
    expect(screen.getByText("Privacy-By-Design Assurance")).toBeInTheDocument();
    expect(screen.getByText("Zero Facial Tracking")).toBeInTheDocument();
    expect(screen.getByText(/never people's identities/i)).toBeInTheDocument();
  });
});
