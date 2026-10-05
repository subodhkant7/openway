import { RingProvider } from "./RingProvider";
import { RingClient } from "./RingClient";
import {
  RingDevice,
  RingDeviceCapabilities,
  RingEvent,
  RingProviderStatus,
  RingSnapshot,
} from "./types";
import { RingProviderError, safeLog } from "./errors";

export class RingPlaygroundProvider implements RingProvider {
  private client: RingClient;

  constructor(client?: RingClient) {
    this.client = client ?? new RingClient();
  }

  public async getProviderStatus(): Promise<RingProviderStatus> {
    const isConfigured = this.client.hasToken();
    const baseUrl = this.client.getBaseUrl();
    const now = new Date().toISOString();

    if (!isConfigured) {
      return {
        mode: "playground",
        state: "NOT_CONFIGURED",
        isConfigured: false,
        baseUrl,
        lastCheck: now,
        details: "RING_ACCESS_TOKEN is not configured. Provide a playground token in .env.local",
        activeDeviceCount: 0,
      };
    }

    try {
      const devices = await this.listDevices();
      return {
        mode: "playground",
        state: "CONNECTED",
        isConfigured: true,
        baseUrl,
        lastCheck: now,
        details: `Successfully connected to Ring Playground via ${baseUrl}`,
        activeDeviceCount: devices.filter((d) => d.online).length,
      };
    } catch (err: unknown) {
      const ringError =
        err instanceof RingProviderError
          ? err
          : new RingProviderError({
              code: "RING_API_ERROR",
              message: (err as Error).message,
            });

      return {
        mode: "playground",
        state: "ERROR",
        isConfigured: true,
        baseUrl,
        lastCheck: now,
        error: ringError.message,
        details: `Connection error (${ringError.code}): ${ringError.message}`,
        activeDeviceCount: 0,
      };
    }
  }

  public async listDevices(): Promise<RingDevice[]> {
    if (!this.client.hasToken()) {
      throw new RingProviderError({
        code: "CONFIGURATION_ERROR",
        message: "Ring Playground token is not configured.",
      });
    }

    try {
      const response = await this.client.request<unknown>("/v1/devices");
      return this.normalizeDevicesResponse(response);
    } catch (error) {
      safeLog("error", "Failed to list Ring devices from Playground", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      throw error;
    }
  }

  public async getDeviceStatus(deviceId: string): Promise<RingDevice["status"]> {
    try {
      const response = await this.client.request<{
        state?: string;
        online?: boolean;
        status?: string;
      }>(`/v1/devices/${encodeURIComponent(deviceId)}/status`);

      if (response.online !== undefined) {
        return response.online ? "online" : "offline";
      }
      if (response.state) {
        return response.state.toLowerCase() === "online" ? "online" : "offline";
      }
      return "online";
    } catch {
      return "unknown";
    }
  }

  public async getDeviceCapabilities(deviceId: string): Promise<RingDeviceCapabilities> {
    try {
      const response = await this.client.request<Record<string, unknown>>(
        `/v1/devices/${encodeURIComponent(deviceId)}/capabilities`
      );

      return this.normalizeCapabilities(response);
    } catch {
      // Default baseline capabilities for Ring video devices
      return {
        supports_live_video: true,
        supports_snapshots: true,
        supports_media_clips: true,
        supports_motion_events: true,
      };
    }
  }

  public async getRecentEvents(deviceId?: string, limit = 10): Promise<RingEvent[]> {
    try {
      const endpoint = deviceId
        ? `/v1/devices/${encodeURIComponent(deviceId)}/events?limit=${limit}`
        : `/v1/events?limit=${limit}`;

      const response = await this.client.request<{
        events?: Array<Record<string, unknown>>;
        data?: Array<Record<string, unknown>>;
      }>(endpoint);

      const rawEvents = response.events || response.data || [];
      return rawEvents.map((raw) => this.normalizeEvent(raw));
    } catch (err) {
      safeLog("warn", "Event retrieval not supported or empty in current Playground scope", {
        deviceId,
        error: err instanceof Error ? err.message : "Unknown",
      });
      return [];
    }
  }

  public async getSnapshot(deviceId: string): Promise<RingSnapshot | null> {
    try {
      const response = await this.client.request<{
        url?: string;
        image_url?: string;
        captured_at?: string;
        timestamp?: string;
      }>(`/v1/devices/${encodeURIComponent(deviceId)}/snapshot`);

      const url = response.url || response.image_url;
      if (!url) return null;

      return {
        deviceId,
        url,
        capturedAt: response.captured_at || response.timestamp || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  public normalizeEvent(raw: Record<string, unknown>): RingEvent {
    const eventId = String(raw.id || raw.event_id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const eventType = String(raw.type || raw.event_type || "motion");
    const deviceId = String(raw.device_id || raw.deviceId || "unknown_device");
    const timestamp = String(raw.timestamp || raw.created_at || raw.recorded_at || new Date().toISOString());

    return {
      provider: "ring_playground",
      eventId,
      eventType,
      deviceId,
      timestamp,
      componentIds: Array.isArray(raw.components) ? raw.components.map(String) : [],
      source: "ring_playground_api",
      receivedAt: new Date().toISOString(),
      summary: `Playground event: ${eventType} on device ${deviceId}`,
      rawReference: {
        eventType,
        deviceId,
        timestamp,
      },
    };
  }

  private normalizeDevicesResponse(response: unknown): RingDevice[] {
    if (!response || typeof response !== "object") return [];

    let rawList: Array<Record<string, unknown>> = [];

    if (Array.isArray(response)) {
      rawList = response as Array<Record<string, unknown>>;
    } else {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj.devices)) {
        rawList = obj.devices as Array<Record<string, unknown>>;
      } else if (Array.isArray(obj.data)) {
        rawList = obj.data.map((item) => {
          const itemObj = item as Record<string, unknown>;
          return {
            id: itemObj.id,
            ...(typeof itemObj.attributes === "object" ? itemObj.attributes : {}),
            ...itemObj,
          };
        });
      }
    }

    return rawList.map((item) => {
      const id = String(item.id || item.device_id || "unknown");
      const name = String(item.name || item.description || `Ring Device ${id.slice(-4)}`);
      const kind = String(item.kind || item.device_type || item.type || "camera");
      
      let isOnline = true;
      if (item.status && typeof item.status === "object") {
        const s = item.status as Record<string, unknown>;
        if (s.online !== undefined) isOnline = Boolean(s.online);
        else if (s.state) isOnline = String(s.state).toLowerCase() === "online";
      } else if (typeof item.status === "string") {
        isOnline = item.status.toLowerCase() === "online";
      }

      return {
        id,
        name,
        kind,
        online: isOnline,
        status: isOnline ? "online" : "offline",
        capabilities: this.normalizeCapabilities(item.capabilities),
        components: Array.isArray(item.components) ? item.components.map(String) : ["camera"],
        batteryLevel: typeof item.battery_level === "number" ? item.battery_level : undefined,
        locationId: item.location_id ? String(item.location_id) : undefined,
      };
    });
  }

  private normalizeCapabilities(rawCaps: unknown): RingDeviceCapabilities {
    if (!rawCaps || typeof rawCaps !== "object") {
      return {
        supports_live_video: true,
        supports_snapshots: true,
        supports_media_clips: true,
        supports_motion_events: true,
      };
    }

    const caps = rawCaps as Record<string, unknown>;

    return {
      supports_live_video: Boolean(
        caps.supports_live_video ?? caps.live_video ?? caps.live_stream ?? true
      ),
      supports_snapshots: Boolean(
        caps.supports_snapshots ?? caps.snapshots ?? caps.snapshot ?? true
      ),
      supports_media_clips: Boolean(
        caps.supports_media_clips ?? caps.media_clips ?? caps.recorded_events ?? true
      ),
      supports_motion_events: Boolean(
        caps.supports_motion_events ?? caps.motion_events ?? caps.motion_detection ?? true
      ),
    };
  }
}
