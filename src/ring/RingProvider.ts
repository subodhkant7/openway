import {
  RingDevice,
  RingDeviceCapabilities,
  RingEvent,
  RingProviderStatus,
  RingSnapshot,
} from "./types";

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
   * Retrieves historical or recent events (e.g. motion, ding, state changes).
   */
  getRecentEvents(deviceId?: string, limit?: number): Promise<RingEvent[]>;

  /**
   * Fetches an image snapshot observation from the camera if supported.
   */
  getSnapshot(deviceId: string): Promise<RingSnapshot | null>;

  /**
   * Normalizes raw Ring API or webhook payloads into a safe, strongly-typed RingEvent.
   */
  normalizeEvent(rawPayload: Record<string, unknown>): RingEvent;
}
