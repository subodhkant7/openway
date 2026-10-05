import { Entrance, CameraBinding, Venue } from "@/domain/types";
import { RingEvent } from "@/ring/types";
import { getStorageProvider, StorageProvider } from "@/persistence";

export type CorrelationStatus =
  | "CORRELATED"
  | "UNBOUND_DEVICE"
  | "UNBOUND_COMPONENT"
  | "ENTRANCE_DISABLED"
  | "MALFORMED_EVENT";

export interface EventCorrelationResult {
  status: CorrelationStatus;
  entrance?: Entrance;
  venue?: Venue;
  cameraBinding?: CameraBinding;
  matchedComponentId?: string;
  reason: string;
}

export class EventCorrelator {
  private storage: StorageProvider;

  constructor(storage?: StorageProvider) {
    this.storage = storage || getStorageProvider();
  }

  /**
   * Resolves a Ring event to a configured Entrance and CameraBinding.
   *
   * STRICT CORRELATION INVARIANTS:
   * 1. Exact deviceId match required.
   * 2. ComponentId match required when device has multiple components.
   * 3. Rejects mismatched or unconfigured devices.
   * 4. Never infers binding from scene semantics, image content, or heuristic guessing.
   * 5. Unbound events produce UNBOUND_EVENT audit records without creating accessibility assessments.
   */
  public async correlateEvent(event: RingEvent): Promise<EventCorrelationResult> {
    if (!event || !event.deviceId) {
      return {
        status: "MALFORMED_EVENT",
        reason: "Ring event missing deviceId or payload is malformed.",
      };
    }

    // 1. Fetch all configured entrances
    const allEntrances = await this.storage.entrances.listAll();

    // 2. Filter entrances with matching deviceId
    const matchingDeviceEntrances = allEntrances.filter(
      (ent) => ent.cameraBinding.deviceId === event.deviceId
    );

    if (matchingDeviceEntrances.length === 0) {
      // Record unbound device audit log
      await this.logUnboundEvent(event, "UNBOUND_DEVICE", `Device ${event.deviceId} is not bound to any entrance`);
      return {
        status: "UNBOUND_DEVICE",
        reason: `Ring device ${event.deviceId} is not bound to any configured entrance.`,
      };
    }

    // 3. Match componentId
    let resolvedEntrance: Entrance | undefined;
    let matchedComponentId: string | undefined;

    const eventComponents = event.componentIds || [];

    if (matchingDeviceEntrances.length === 1) {
      const candidate = matchingDeviceEntrances[0];
      // Single entrance bound to device: check if component matches or event has no specific component
      if (
        eventComponents.length === 0 ||
        eventComponents.includes(candidate.cameraBinding.componentId) ||
        candidate.cameraBinding.componentId === "main" ||
        candidate.cameraBinding.componentId === "default"
      ) {
        resolvedEntrance = candidate;
        matchedComponentId = candidate.cameraBinding.componentId;
      }
    } else {
      // Multi-camera device: exact componentId match required
      for (const candidate of matchingDeviceEntrances) {
        if (eventComponents.includes(candidate.cameraBinding.componentId)) {
          resolvedEntrance = candidate;
          matchedComponentId = candidate.cameraBinding.componentId;
          break;
        }
      }
    }

    if (!resolvedEntrance) {
      await this.logUnboundEvent(
        event,
        "UNBOUND_COMPONENT",
        `Device ${event.deviceId} components [${eventComponents.join(", ")}] do not match any entrance component binding`
      );
      return {
        status: "UNBOUND_COMPONENT",
        reason: `Event components [${eventComponents.join(", ")}] do not match configured entrance bindings for device ${event.deviceId}.`,
      };
    }

    // 4. Verify entrance is enabled for monitoring
    if (!resolvedEntrance.enabled) {
      return {
        status: "ENTRANCE_DISABLED",
        entrance: resolvedEntrance,
        reason: `Entrance "${resolvedEntrance.name}" (${resolvedEntrance.id}) is currently disabled for proactive monitoring.`,
      };
    }

    // 5. Fetch associated venue
    const venue = await this.storage.venues.findById(resolvedEntrance.venueId);

    return {
      status: "CORRELATED",
      entrance: resolvedEntrance,
      venue: venue || undefined,
      cameraBinding: resolvedEntrance.cameraBinding,
      matchedComponentId,
      reason: `Successfully correlated event ${event.eventId} to entrance "${resolvedEntrance.name}" (${resolvedEntrance.id}).`,
    };
  }

  private async logUnboundEvent(
    event: RingEvent,
    status: CorrelationStatus,
    reason: string
  ): Promise<void> {
    try {
      await this.storage.auditEvents.append({
        id: `audit_unbound_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "RING_EVENT_INGESTED",
        timestamp: new Date().toISOString(),
        correlationId: `corr_${event.eventId}`,
        entityType: "ENTRANCE",
        entityId: "UNBOUND",
        metadata: {
          correlationStatus: status,
          reason,
          deviceId: event.deviceId,
          eventType: event.eventType,
          componentIds: event.componentIds,
          provider: event.provider,
        },
      });
    } catch {
      // Non-blocking audit failure
    }
  }
}
