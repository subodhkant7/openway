/**
 * OpenWay Domain Model: Core Types & Accessibility Entities
 *
 * ARCHITECTURAL PRINCIPLE:
 * Ring supplies raw observations, media evidence, and hardware events.
 * The Domain Layer translates camera observations into verified access path states.
 * No business rules or accessibility policy logic live inside the Ring adapter.
 *
 * SCOPE BOUNDARY:
 * OpenWay verifies only explicitly configured, camera-observable physical conditions
 * (such as ramp clearance, doorway paths, and automatic doors).
 * It does not certify building-wide code or general legal compliance.
 */

/**
 * Explicit Assurance States for an Entrance
 */
export type AssuranceState =
  | "AVAILABLE"          // Physical entrance condition satisfied & verified
  | "INTERRUPTED"        // Interruption or obstruction detected
  | "ACTION_REQUIRED"    // Interruption confirmed, remediation task dispatched to staff
  | "RECHECKING"         // Remediation completed by staff; awaiting fresh physical verification
  | "VERIFIED_RESTORED"  // Physical restoration proven by fresh post-remediation evidence
  | "UNKNOWN";           // Missing, stale, contradictory, or unverified evidence

/**
 * Explicit Camera Binding between an Entrance and Ring hardware
 * cameraBinding must be explicit: deviceId + componentId.
 * Never infer camera binding from AI or model heuristics.
 */
export interface CameraBinding {
  deviceId: string;
  componentId: string;
  deviceName?: string;
  notes?: string;
}

/**
 * Typed Accessibility Requirements for an Entrance.
 * Camera-observable physical conditions (not municipal building codes).
 */
export interface AccessibilityRequirements {
  pathwayClear: boolean;       // Wheelchair ramp/pathway free of obstructions
  obstructionFree: boolean;    // Doorway entrance envelope clear of packages/debris
  doorReady: boolean;          // Automatic door push button/swing path accessible
  [customRequirement: string]: boolean;
}

/**
 * Venue Entity
 */
export interface Venue {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Entrance Entity
 */
export interface Entrance {
  id: string;
  venueId: string;
  name: string;
  description: string;
  enabled: boolean;
  cameraBinding: CameraBinding;
  requirements: AccessibilityRequirements;
  createdAt: string;
  updatedAt: string;
}

/**
 * Remediation Task Status
 * A COMPLETED status means staff claims the physical issue was addressed.
 * It is explicitly NOT equivalent to VERIFIED_RESTORED.
 */
export type RemediationStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "CANCELLED";

export interface RemediationTask {
  id: string;
  entranceId: string;
  triggerAssessmentId: string;
  status: RemediationStatus;
  reason: string;
  createdAt: string;
  acknowledgedAt?: string;
  completedAt?: string;
  completedBy?: string;
  assignedTo?: string;
}

/**
 * Access Assessment Record
 */
export interface AccessAssessment {
  id: string;
  entranceId: string;
  state: AssuranceState;
  reasonCode: string;
  reason: string;
  evidenceIds: string[];
  observationIds: string[];
  policyVersion: string;
  previousAssessmentId?: string;
  assessedAt: string;
}

/**
 * Append-Only Conceptual Audit Trail Event
 */
export type AuditEventType =
  | "RING_EVENT_RECEIVED"
  | "RING_EVENT_INGESTED"
  | "EVIDENCE_CAPTURED"
  | "OBSERVATION_CREATED"
  | "ACCESS_INTERRUPTED"
  | "TASK_CREATED"
  | "TASK_ACKNOWLEDGED"
  | "TASK_COMPLETED"
  | "VERIFICATION_STARTED"
  | "VERIFICATION_INITIATED"
  | "ACCESS_VERIFIED_RESTORED"
  | "ASSESSMENT_UNKNOWN"
  | "WRONG_CAMERA_REJECTED";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  correlationId: string;
  entityType: "VENUE" | "ENTRANCE" | "EVIDENCE" | "OBSERVATION" | "ASSESSMENT" | "REMEDIATION_TASK";
  entityId: string;
  metadata: Record<string, unknown>;
}
