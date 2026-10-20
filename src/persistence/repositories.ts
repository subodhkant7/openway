import {
  Venue,
  Entrance,
  RemediationTask,
  AccessAssessment,
  AuditEvent,
} from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";

export interface VenueRepository {
  findById(id: string): Promise<Venue | null>;
  listAll(): Promise<Venue[]>;
  save(venue: Venue): Promise<Venue>;
}

export interface EntranceRepository {
  findById(id: string): Promise<Entrance | null>;
  listByVenueId(venueId: string): Promise<Entrance[]>;
  listAll(): Promise<Entrance[]>;
  save(entrance: Entrance): Promise<Entrance>;
}

export interface EvidenceRepository {
  findById(id: string): Promise<Evidence | null>;
  listByEntranceId(entranceId: string, limit?: number): Promise<Evidence[]>;
  save(evidence: Evidence): Promise<Evidence>;
}

export interface ObservationRepository {
  findById(id: string): Promise<AccessibilityObservation | null>;
  listByEvidenceId(evidenceId: string): Promise<AccessibilityObservation[]>;
  listByEntranceId(entranceId: string, limit?: number): Promise<AccessibilityObservation[]>;
  save(observation: AccessibilityObservation): Promise<AccessibilityObservation>;
}

export interface AssessmentRepository {
  findById(id: string): Promise<AccessAssessment | null>;
  findLatestByEntranceId(entranceId: string): Promise<AccessAssessment | null>;
  listByEntranceId(entranceId: string, limit?: number): Promise<AccessAssessment[]>;
  save(assessment: AccessAssessment): Promise<AccessAssessment>;
}

export interface RemediationTaskRepository {
  findById(id: string): Promise<RemediationTask | null>;
  findActiveByEntranceId(entranceId: string): Promise<RemediationTask | null>;
  listByEntranceId(entranceId: string, limit?: number): Promise<RemediationTask[]>;
  save(task: RemediationTask): Promise<RemediationTask>;
}

export interface AuditEventRepository {
  findById(id: string): Promise<AuditEvent | null>;
  listByEntranceId(entranceId: string, limit?: number): Promise<AuditEvent[]>;
  listByCorrelationId(correlationId: string): Promise<AuditEvent[]>;
  append(event: AuditEvent): Promise<AuditEvent>;
}

export interface RingUnclaimedTokenRecord {
  ringAccountId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
  expiresAt: string; // OAuth access-token expiration ISO string
  createdAt: string;
  ttl: number; // numeric Unix epoch seconds for DynamoDB TTL
  claimExpiresAt: string; // Explicit unclaimed-token claim expiration ISO timestamp
  claimExpiresAtEpoch: number; // Explicit claim expiration numeric Unix-epoch seconds for atomic comparison
}

export interface StoredAccountLinkRecord {
  partnerUserId: string;
  ringAccountReference: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
  expiresAt: string;
  status: "LINKED" | "ONBOARDING_REQUIRED" | "ACCOUNT_RELINK_REQUIRED" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
  venueId?: string;
}

export interface AccountLinkRepository {
  saveUnclaimedToken(record: RingUnclaimedTokenRecord): Promise<void>;
  listUnclaimedTokens(): Promise<RingUnclaimedTokenRecord[]>;
  findUnclaimedTokenByAccountId(ringAccountId: string): Promise<RingUnclaimedTokenRecord | null>;
  claimToken(params: {
    userId: string;
    venueId?: string;
    ringAccountId: string;
    unclaimedRecord: RingUnclaimedTokenRecord;
  }): Promise<StoredAccountLinkRecord>;
  findByUserId(userId: string): Promise<StoredAccountLinkRecord | null>;
  findByVenueId(venueId: string): Promise<StoredAccountLinkRecord | null>;
  findByRingAccountId(ringAccountId: string): Promise<StoredAccountLinkRecord | null>;
  saveClaimed(record: StoredAccountLinkRecord): Promise<StoredAccountLinkRecord>;
  delete(userId: string, ringAccountId: string): Promise<boolean>;
}

/**
 * Transactional Context for atomic state transitions.
 * Ensures assessment update + audit event + remediation task change succeed or roll back together.
 */
export interface AssuranceTransactionContext {
  assessments: AssessmentRepository;
  remediations: RemediationTaskRepository;
  auditEvents: AuditEventRepository;
  evidence: EvidenceRepository;
  observations: ObservationRepository;
  entrances: EntranceRepository;
}

export interface StorageProvider {
  venues: VenueRepository;
  entrances: EntranceRepository;
  evidence: EvidenceRepository;
  observations: ObservationRepository;
  assessments: AssessmentRepository;
  remediations: RemediationTaskRepository;
  auditEvents: AuditEventRepository;
  accountLinks: AccountLinkRepository;

  /**
   * Executes operations within an atomic transaction boundary.
   * If any operation fails, state is rolled back.
   */
  transaction<T>(fn: (tx: AssuranceTransactionContext) => Promise<T>): Promise<T>;
}

