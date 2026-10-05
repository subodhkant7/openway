import { RingProvider } from "./RingProvider";
import {
  RingDevice,
  RingDeviceCapabilities,
  RingEvent,
  RingProviderStatus,
  RingImageEvidence,
} from "./types";

export interface SimulatorState {
  connected: boolean;
  devices: RingDevice[];
  events: RingEvent[];
  lastSnapshotSvg?: string;
}

export class RingSimulatorProvider implements RingProvider {
  private static instance: RingSimulatorProvider;

  private state: SimulatorState = {
    connected: true,
    devices: [
      {
        id: "sim_device_front_ramp",
        name: "Main Accessible Ramp Entrance",
        kind: "doorbell",
        online: true,
        status: "online",
        capabilities: {
          supports_live_video: true,
          supports_snapshots: true,
          supports_media_clips: true,
          supports_motion_events: true,
        },
        components: ["camera", "doorbell", "motion_detector", "speaker"],
        batteryLevel: 94,
        lastSeen: new Date().toISOString(),
        locationId: "loc_openway_hq_entrance",
      },
      {
        id: "sim_device_side_automatic_door",
        name: "Automatic Side Access Door",
        kind: "stickup_cam",
        online: true,
        status: "online",
        capabilities: {
          supports_live_video: true,
          supports_snapshots: true,
          supports_media_clips: true,
          supports_motion_events: true,
        },
        components: ["camera", "motion_detector"],
        batteryLevel: 88,
        lastSeen: new Date().toISOString(),
        locationId: "loc_openway_hq_side",
      },
      {
        id: "sim_device_curb_cut",
        name: "Drop-off Zone & Accessible Curb Cut",
        kind: "floodlight_cam",
        online: false,
        status: "offline",
        capabilities: {
          supports_live_video: true,
          supports_snapshots: true,
          supports_media_clips: true,
          supports_motion_events: true,
        },
        components: ["camera", "floodlight", "motion_detector", "siren"],
        lastSeen: new Date(Date.now() - 3600000).toISOString(),
        locationId: "loc_openway_hq_curb",
      },
    ],
    events: [
      {
        provider: "simulator",
        eventCategory: "simulated_local",
        eventId: "sim_ev_init_01",
        eventType: "simulated_motion",
        deviceId: "sim_device_front_ramp",
        timestamp: new Date(Date.now() - 120000).toISOString(),
        componentIds: ["motion_detector"],
        source: "ring_simulator",
        receivedAt: new Date(Date.now() - 119000).toISOString(),
        summary: "SIMULATED: Motion observed at Main Accessible Ramp Entrance",
      },
    ],
  };

  public static getInstance(): RingSimulatorProvider {
    if (!RingSimulatorProvider.instance) {
      RingSimulatorProvider.instance = new RingSimulatorProvider();
    }
    return RingSimulatorProvider.instance;
  }

  public async getProviderStatus(): Promise<RingProviderStatus> {
    const now = new Date().toISOString();
    return {
      mode: "simulator",
      state: this.state.connected ? "SIMULATED" : "ERROR",
      isConfigured: true,
      baseUrl: "http://localhost:3000/simulator",
      lastCheck: now,
      details: this.state.connected
        ? "Local Deterministic Simulator active (SIMULATED mode — NOT connected to live Ring API)"
        : "Simulator set to DISCONNECTED state",
      activeDeviceCount: this.state.connected
        ? this.state.devices.filter((d) => d.online).length
        : 0,
    };
  }

  public async listDevices(): Promise<RingDevice[]> {
    if (!this.state.connected) {
      throw new Error("Ring Simulator is in DISCONNECTED state");
    }
    return [...this.state.devices];
  }

  public async getDeviceStatus(deviceId: string): Promise<RingDevice["status"]> {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    return dev ? dev.status : "unknown";
  }

  public async getDeviceCapabilities(deviceId: string): Promise<RingDeviceCapabilities> {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    return dev?.capabilities ?? {
      supports_live_video: true,
      supports_snapshots: true,
      supports_media_clips: true,
      supports_motion_events: true,
    };
  }

  public async getRecentEvents(deviceId?: string, limit = 10): Promise<RingEvent[]> {
    let list = this.state.events;
    if (deviceId) {
      list = list.filter((e) => e.deviceId === deviceId);
    }
    return list.slice(-limit).reverse();
  }

  /**
   * Generates a simulated local test evidence image with honest labeling.
   */
  public async getImageEvidence(deviceId: string): Promise<RingImageEvidence | null> {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) return null;

    const capturedAt = new Date().toISOString();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" style="background:#090d16;font-family:system-ui,sans-serif;">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#grad)"/>
        <!-- Ramp perspective lines -->
        <polygon points="120,360 220,180 420,180 520,360" fill="#334155" opacity="0.4"/>
        <line x1="220" y1="180" x2="420" y2="180" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4"/>
        <line x1="120" y1="360" x2="220" y2="180" stroke="#38bdf8" stroke-width="2"/>
        <line x1="520" y1="360" x2="420" y2="180" stroke="#38bdf8" stroke-width="2"/>
        <!-- Accessible Entrance Door Outline -->
        <rect x="250" y="80" width="140" height="100" fill="#1e293b" stroke="#10b981" stroke-width="2" rx="4"/>
        <text x="320" y="135" fill="#10b981" font-size="12" text-anchor="middle" font-weight="600">ACCESSIBLE ENTRANCE</text>
        <!-- Overlay Badges - Explicitly Honest Simulation Labels -->
        <rect x="20" y="20" width="240" height="28" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="#f59e0b" stroke-width="1"/>
        <circle cx="32" cy="34" r="5" fill="#f59e0b"/>
        <text x="46" y="38" fill="#fef3c7" font-size="11" font-weight="700">SIMULATED - LOCAL TEST EVIDENCE</text>
        <text x="20" y="340" fill="#94a3b8" font-size="11">CAMERA: ${dev.name} [MOCK]</text>
        <text x="620" y="340" fill="#94a3b8" font-size="11" text-anchor="end">${capturedAt.replace("T", " ").slice(0, 19)} UTC</text>
      </svg>
    `.trim();

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return {
      deviceId,
      dataUrl,
      capturedAt,
      width: 640,
      height: 360,
      format: "image/svg+xml",
      source: "simulator",
      isSimulated: true,
    };
  }

  public normalizeEvent(raw: Record<string, unknown>): RingEvent {
    return {
      provider: "simulator",
      eventCategory: "simulated_local",
      eventId: String(raw.event_id || `sim_${Date.now()}`),
      eventType: String(raw.event_type || "simulated_motion"),
      deviceId: String(raw.device_id || "sim_device_front_ramp"),
      timestamp: String(raw.timestamp || new Date().toISOString()),
      componentIds: ["motion_detector"],
      source: "ring_simulator",
      receivedAt: new Date().toISOString(),
      summary: `SIMULATED: ${raw.event_type || "event"} received`,
      rawReference: raw,
    };
  }

  // Simulator control methods:

  public setConnectionState(connected: boolean): void {
    this.state.connected = connected;
  }

  public setDeviceOnlineState(deviceId: string, online: boolean): void {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (dev) {
      dev.online = online;
      dev.status = online ? "online" : "offline";
      dev.lastSeen = new Date().toISOString();
      this.triggerEvent({
        eventType: online ? "simulated_device_online" : "simulated_device_offline",
        deviceId,
        summary: `Simulator: ${dev.name} is now ${online ? "ONLINE" : "OFFLINE"}`,
      });
    }
  }

  public triggerEvent(params: {
    eventType: string;
    deviceId?: string;
    summary?: string;
  }): RingEvent {
    const targetDevice =
      this.state.devices.find((d) => d.id === params.deviceId) || this.state.devices[0];

    const event: RingEvent = {
      provider: "simulator",
      eventCategory: "simulated_local",
      eventId: `sim_ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: params.eventType,
      deviceId: targetDevice.id,
      timestamp: new Date().toISOString(),
      componentIds: targetDevice.components,
      source: "ring_simulator",
      receivedAt: new Date().toISOString(),
      summary:
        params.summary ||
        `SIMULATED: ${params.eventType} observed on ${targetDevice.name}`,
    };

    this.state.events.push(event);
    return event;
  }
}
