/**
 * Official Ring Partner API Event Types (documented in Ring v1.1 Webhook spec)
 */
export type OfficialRingEventType =
  | "motion"
  | "button_press"
  | "device_online"
  | "device_offline"
  | "device_added"
  | "device_removed"
  | "media_clip_ready";

/**
 * Deterministic Local Simulator Event Types
 */
export type SimulatedRingEventType =
  | "simulated_motion"
  | "simulated_package_obstruction"
  | "simulated_path_cleared"
  | "simulated_device_online"
  | "simulated_device_offline";

/**
 * OpenWay Domain Accessibility Event Types
 */
export type OpenWayDomainEventType =
  | "access_obstruction_detected"
  | "access_restoration_verified"
  | "entrance_monitoring_degraded"
  | "entrance_assured";

/**
 * Combined Normalized Event Type union
 */
export type RingEventType =
  | OfficialRingEventType
  | SimulatedRingEventType
  | OpenWayDomainEventType
  | string;

/**
 * Explicit Event Provenance
 */
export type EventProvenanceCategory = "official_ring" | "simulated_local" | "openway_domain";

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
  name: string; // User-assigned name from Ring attributes
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
 * Normalized Ring Event representation.
 * Strictly separates official Ring telemetry from simulator and domain events.
 */
export interface RingEvent {
  provider: "ring_api" | "ring_playground" | "simulator";
  eventCategory: EventProvenanceCategory;
  eventId: string;
  eventType: RingEventType;
  deviceId: string;
  componentId?: string;
  timestamp: string;
  componentIds: string[];
  source: string;
  receivedAt: string;
  rawReference?: Record<string, unknown>;
  summary?: string;
}

/**
 * Provider-Neutral Image Evidence Representation
 * Decouples OpenWay domain layer from upstream JPEG/PNG/SVG binary delivery mechanisms.
 */
export interface RingImageEvidence {
  deviceId: string;
  url?: string;
  dataUrl?: string; // base64 representation if direct binary/data is fetched
  capturedAt: string;
  width?: number;
  height?: number;
  format: string; // "image/jpeg" | "image/png" | "image/svg+xml"
  source: "ring_media_download" | "simulator";
  isSimulated: boolean;
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

/**
 * JSON:API Standard Structures for Ring Partner API
 */
export interface JsonApiResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    {
      data?: { id: string; type: string } | Array<{ id: string; type: string }>;
      links?: Record<string, string>;
    }
  >;
  links?: Record<string, string>;
}

export interface JsonApiDocument<T = JsonApiResource | JsonApiResource[]> {
  data: T;
  included?: JsonApiResource[];
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
  errors?: Array<{
    id?: string;
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
}
