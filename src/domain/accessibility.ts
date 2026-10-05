/**
 * OpenWay Domain Layer: Accessibility Assurance Models
 * 
 * ARCHITECTURAL BOUNDARY:
 * Ring supplies raw observations, media evidence, and hardware events.
 * The Domain Layer translates camera observations into verified access path states.
 * No business rules or accessibility policy logic live inside the Ring adapter.
 * 
 * SCOPE BOUNDARY:
 * OpenWay verifies only explicitly configured, camera-observable physical conditions
 * (such as ramp clearance, doorway paths, and automatic doors).
 * It does not certify building-wide code or general legal compliance.
 */

export type EntranceAssuranceStatus =
  | "ASSURED"               // Access path is clear and verified by fresh observation
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
  source: "ring_telemetry" | "ring_image_evidence" | "ring_webhook" | "simulator";
}

export interface PhysicalEvidence {
  evidenceId: string;
  capturedAt: string;
  deviceId: string;
  mediaType: "image_download" | "video_clip" | "simulator_svg";
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
