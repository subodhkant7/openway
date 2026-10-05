import { RingProvider } from "./RingProvider";
import { RingClient } from "./RingClient";
import {
  RingDevice,
  RingDeviceCapabilities,
  RingEvent,
  RingProviderStatus,
  RingImageEvidence,
  JsonApiResource,
  JsonApiDocument,
} from "./types";
import { RingProviderError, safeLog } from "./errors";

export class RingPlaygroundProvider implements RingProvider {
  protected client: RingClient;

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
        details: "RING_ACCESS_TOKEN is not configured. Provide a short-lived playground token in .env.local",
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
        details: `Connected to Ring Playground via ${baseUrl} (short-lived access token mode)`,
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

  /**
   * Discovers devices using JSON:API compound document request:
   * GET /v1/devices?include=status,capabilities
   */
  public async listDevices(): Promise<RingDevice[]> {
    if (!this.client.hasToken()) {
      throw new RingProviderError({
        code: "CONFIGURATION_ERROR",
        message: "Ring Playground token is not configured.",
      });
    }

    try {
      // Query devices with compound status and capabilities included
      const response = await this.client.request<JsonApiDocument<JsonApiResource[]>>(
        "/v1/devices?include=status,capabilities"
      );
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
        data?: {
          attributes?: {
            state?: string;
            online?: boolean;
            status?: string;
          };
        };
        state?: string;
        online?: boolean;
      }>(`/v1/devices/${encodeURIComponent(deviceId)}/status`);

      const attrs = response.data?.attributes || response;
      if (attrs.online !== undefined) {
        return attrs.online ? "online" : "offline";
      }
      if (attrs.state) {
        return attrs.state.toLowerCase() === "online" ? "online" : "offline";
      }
      return "online";
    } catch {
      return "unknown";
    }
  }

  public async getDeviceCapabilities(deviceId: string): Promise<RingDeviceCapabilities> {
    try {
      const response = await this.client.request<
        JsonApiDocument<JsonApiResource> | Record<string, unknown>
      >(`/v1/devices/${encodeURIComponent(deviceId)}/capabilities`);

      const resource = (response as JsonApiDocument<JsonApiResource>).data;
      const attrs = resource?.attributes || (response as Record<string, unknown>);

      return this.normalizeCapabilities(attrs);
    } catch {
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
        data?: Array<Record<string, unknown>>;
        events?: Array<Record<string, unknown>>;
      }>(endpoint);

      const rawEvents = response.data || response.events || [];
      return rawEvents.map((raw) => this.normalizeEvent(raw));
    } catch (err) {
      safeLog("warn", "Event retrieval not supported or empty in current Playground scope", {
        deviceId,
        error: err instanceof Error ? err.message : "Unknown",
      });
      return [];
    }
  }

  /**
   * Conforms to official Ring Partner API Image Download specification:
   * POST /v1/devices/{device_id}/media/image/download
   */
  public async getImageEvidence(
    deviceId: string,
    components: string[] = ["camera"]
  ): Promise<RingImageEvidence | null> {
    try {
      const endpoint = `/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`;
      const result = await this.client.downloadImage(endpoint, { components });

      return {
        deviceId,
        url: result.url,
        dataUrl: result.dataUrl,
        capturedAt: new Date().toISOString(),
        format: result.format,
        source: "ring_media_download",
        isSimulated: false,
      };
    } catch (err) {
      safeLog("warn", "Image download not available for device", {
        deviceId,
        error: err instanceof Error ? err.message : "Unknown",
      });
      return null;
    }
  }

  public normalizeEvent(raw: Record<string, unknown>): RingEvent {
    // Check if JSON:API resource envelope is present
    const resource = (raw.data as Record<string, unknown>) || raw;
    const attributes = (resource.attributes as Record<string, unknown>) || resource;

    const eventId = String(
      resource.id || raw.id || raw.event_id || `ev_${Date.now()}`
    );
    const eventType = String(
      resource.type || attributes.event_type || attributes.type || raw.type || raw.event_type || "motion"
    );
    const deviceId = String(
      attributes.source || attributes.device_id || raw.device_id || raw.deviceId || "unknown_device"
    );
    const timestamp = String(
      attributes.timestamp || raw.timestamp || raw.created_at || new Date().toISOString()
    );

    return {
      provider: "ring_playground",
      eventCategory: "official_ring",
      eventId,
      eventType,
      deviceId,
      timestamp,
      componentIds: Array.isArray(raw.components) ? raw.components.map(String) : ["camera"],
      source: "ring_playground_api",
      receivedAt: new Date().toISOString(),
      summary: `Ring official event: ${eventType} on device ${deviceId}`,
      rawReference: raw,
    };
  }

  /**
   * JSON:API Normalization Engine:
   * Correctly resolves `data`, `attributes`, `relationships`, and compound `included` resources.
   */
  private normalizeDevicesResponse(response: unknown): RingDevice[] {
    if (!response || typeof response !== "object") return [];

    const doc = response as JsonApiDocument<JsonApiResource[]>;

    // Index compound included resources by "type:id"
    const includedMap = new Map<string, Record<string, unknown>>();
    if (Array.isArray(doc.included)) {
      for (const item of doc.included) {
        if (item.id && item.type) {
          includedMap.set(`${item.type}:${item.id}`, item.attributes || {});
        }
      }
    }

    let rawList: JsonApiResource[] = [];

    if (Array.isArray(doc.data)) {
      rawList = doc.data;
    } else if (Array.isArray((response as Record<string, unknown>).devices)) {
      // Legacy fallback
      rawList = ((response as Record<string, unknown>).devices as Array<Record<string, unknown>>).map((d) => ({
        id: String(d.id),
        type: "device",
        attributes: d,
      }));
    } else if (Array.isArray(response)) {
      rawList = response as JsonApiResource[];
    }

    return rawList.map((item) => {
      const id = String(item.id);
      const attrs = item.attributes || {};
      const rels = item.relationships || {};

      // Name: prioritize user-assigned name
      const name = String(
        attrs.name || attrs.description || attrs.user_name || `Ring Camera ${id.slice(-4)}`
      );
      const kind = String(attrs.kind || attrs.device_type || attrs.model || item.type || "camera");

      // Resolve status relationship from compound included document
      let statusAttrs: Record<string, unknown> = {};
      const statusRel = rels.status?.data;
      if (statusRel && !Array.isArray(statusRel) && statusRel.id) {
        statusAttrs = includedMap.get(`status:${statusRel.id}`) || {};
      }

      // Check online status from status relationship or direct attributes
      let isOnline = true;
      if (statusAttrs.online !== undefined) {
        isOnline = Boolean(statusAttrs.online);
      } else if (statusAttrs.state) {
        isOnline = String(statusAttrs.state).toLowerCase() === "online";
      } else if (attrs.online !== undefined) {
        isOnline = Boolean(attrs.online);
      } else if (attrs.status && typeof attrs.status === "object") {
        const s = attrs.status as Record<string, unknown>;
        isOnline = s.online !== undefined ? Boolean(s.online) : String(s.state).toLowerCase() === "online";
      }

      // Resolve capabilities relationship from compound included document
      let capsAttrs: unknown = attrs.capabilities;
      const capsRel = rels.capabilities?.data;
      if (capsRel && !Array.isArray(capsRel) && capsRel.id) {
        capsAttrs = includedMap.get(`capabilities:${capsRel.id}`) || capsAttrs;
      }

      const battery =
        typeof statusAttrs.battery_level === "number"
          ? statusAttrs.battery_level
          : typeof attrs.battery_level === "number"
          ? attrs.battery_level
          : undefined;

      return {
        id,
        name,
        kind,
        online: isOnline,
        status: isOnline ? "online" : "offline",
        capabilities: this.normalizeCapabilities(capsAttrs),
        components: Array.isArray(attrs.components) ? attrs.components.map(String) : ["camera"],
        batteryLevel: battery,
        locationId: attrs.location_id ? String(attrs.location_id) : undefined,
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
