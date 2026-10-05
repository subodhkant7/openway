/**
 * OpenWay Domain Layer: Accessibility Assurance Models
 * 
 * ARCHITECTURAL RULE:
 * Ring supplies raw observations, media, and hardware events.
 * The Domain Layer translates camera observations into business accessibility states.
 * No business rules or accessibility policy logic live inside the Ring adapter.
 */

export type EntranceAssuranceStatus =
  | "ASSURED"               // Access path is clear and verified
  | "INTERRUPTED"           // Temporary obstruction/interruption detected
  | "PENDING_VERIFICATION"  // Remediation reported, awaiting fresh physical evidence
  | "UNCONFIGURED"          // Entrance not yet bound to a Ring camera device
  | "DEGRADED";             // Camera offline or obscured

export interface AccessibilityObservation {
  observationId: string;
  ringEventId?: string;
  ringDeviceId: string;
  timestamp: string;
  condition:
    | "RAMP_CLEAR"
    | "OBSTRUCTION_SUSPECTED"
    | "DOORWAY_CLEAR"
    | "DEVICE_OFFLINE"
    | "MOTION_DETECTED";
  summary: string;
  source: "ring_telemetry" | "ring_snapshot" | "ring_webhook";
}

export interface PhysicalEvidence {
  evidenceId: string;
  capturedAt: string;
  deviceId: string;
  mediaType: "snapshot" | "video_clip";
  mediaUrl?: string;
  dataUrl?: string;
  provedPhysicalStateChange: boolean;
  notes: string;
}

export interface ConfiguredEntrance {
  id: string;
  name: string;
  locationName: string;
  ringDeviceId: string | null;
  status: EntranceAssuranceStatus;
  lastObservation?: AccessibilityObservation;
  latestEvidence?: PhysicalEvidence;
  statusUpdatedAt: string;
  notes: string;
}

/**
 * Core Product Principle:
 * "An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."
 */
export function canDeclareRestored(
  interruptedSince: string,
  freshEvidence: PhysicalEvidence | null | undefined
): boolean {
  if (!freshEvidence) return false;
  if (!freshEvidence.provedPhysicalStateChange) return false;

  const interruptionTime = new Date(interruptedSince).getTime();
  const evidenceTime = new Date(freshEvidence.capturedAt).getTime();

  // Fresh evidence must strictly have been captured AFTER the interruption began
  return evidenceTime > interruptionTime;
}
