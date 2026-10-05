/**
 * Ring Device Capability Model
 * Explicitly models supported hardware and service features.
 */
export interface RingDeviceCapabilities {
  supports_live_video: boolean;
  supports_snapshots: boolean;
  supports_media_clips: boolean;
  supports_motion_events: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Normalized Ring Device representation.
 * Primary labels use user-assigned names, not raw IDs.
 */
export interface RingDevice {
  id: string;
  name: string; // User-assigned name
  kind: string; // e.g. "doorbell", "stickup_cam", "floodlight_cam"
  online: boolean;
  status: "online" | "offline" | "unknown";
  capabilities: RingDeviceCapabilities;
  components: string[];
  batteryLevel?: number;
  lastSeen?: string;
  firmwareVersion?: string;
  locationId?: string;
}

/**
 * Normalized Ring Event Types
 */
export type RingEventType =
  | "motion"
  | "ding"
  | "doorbell"
  | "snapshot_ready"
  | "media_clip_ready"
  | "device_online"
  | "device_offline"
  | "access_obstruction_suspected" // Domain-relevant observation
  | "access_path_clear"
  | "package_delivered"
  | string;

/**
 * Normalized Ring Event representation.
 * Provider-neutral internal model matching conceptual specification.
 */
export interface RingEvent {
  provider: "ring_api" | "ring_playground" | "simulator";
  eventId: string;
  eventType: RingEventType;
  deviceId: string;
  timestamp: string;
  componentIds: string[];
  source: string;
  receivedAt: string;
  rawReference?: Record<string, unknown>;
  summary?: string;
}

/**
 * Normalized Ring Snapshot representation
 */
export interface RingSnapshot {
  deviceId: string;
  url?: string;
  dataUrl?: string; // base64 representation if direct binary/data is fetched
  capturedAt: string;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Connection & Provider State
 */
export type ProviderState = "CONNECTED" | "NOT_CONFIGURED" | "ERROR" | "SIMULATED";

export interface RingProviderStatus {
  mode: "api" | "playground" | "simulator";
  state: ProviderState;
  isConfigured: boolean;
  baseUrl: string;
  lastCheck: string;
  details?: string;
  error?: string;
  activeDeviceCount: number;
}
