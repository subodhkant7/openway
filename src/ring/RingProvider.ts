import {
  RingDevice,
  RingDeviceCapabilities,
  RingEvent,
  RingProviderStatus,
  RingImageEvidence,
} from "./types";

export interface EventHistoryOptions {
  deviceId?: string;
  limit?: number;
  maxPages?: number;
  sinceTimestamp?: string;
  nextUrl?: string;
}

export interface PaginatedEventsResult {
  events: RingEvent[];
  nextUrl?: string;
  hasMore: boolean;
  pagesFetched: number;
}

/**
 * RingProvider Interface
 * Formal contract for all Ring integrations (Playground, Partner API, and Simulator).
 * Decouples Ring hardware/vendor integration from OpenWay accessibility assurance logic.
 */
export interface RingProvider {
  /**
   * Returns current provider health, configuration mode, and connectivity state.
   */
  getProviderStatus(): Promise<RingProviderStatus>;

  /**
   * Discovers and returns all configured Ring devices normalized to OpenWay models.
   * Conforms to official JSON:API /v1/devices structure.
   */
  listDevices(): Promise<RingDevice[]>;

  /**
   * Retrieves fresh operational status (online / offline) for a specific device.
   */
  getDeviceStatus(deviceId: string): Promise<RingDevice["status"]>;

  /**
   * Retrieves explicitly supported capabilities for a specific device.
   */
  getDeviceCapabilities(deviceId: string): Promise<RingDeviceCapabilities>;

  /**
   * Retrieves historical or recent events (e.g. motion, button_press).
   */
  getRecentEvents(deviceId?: string, limit?: number): Promise<RingEvent[]>;

  /**
   * Robust paginated event history retrieval following Ring API links.next.
   */
  getEventHistory?(options?: EventHistoryOptions): Promise<PaginatedEventsResult>;

  /**
   * Fetches an image observation from the camera using the official Ring Partner API endpoint:
   * POST /v1/devices/{device_id}/media/image/download
   * 
   * Returns a provider-neutral RingImageEvidence model.
   */
  getImageEvidence(
    deviceId: string,
    components?: string[]
  ): Promise<RingImageEvidence | null>;

  /**
   * Normalizes raw Ring API or webhook payloads into a safe, strongly-typed RingEvent.
   */
  normalizeEvent(rawPayload: Record<string, unknown>): RingEvent;
}

