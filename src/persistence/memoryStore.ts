import {
  Venue,
  Entrance,
  RemediationTask,
  AccessAssessment,
  AuditEvent,
} from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import {
  StorageProvider,
  AssuranceTransactionContext,
  VenueRepository,
  EntranceRepository,
  EvidenceRepository,
  ObservationRepository,
  AssessmentRepository,
  RemediationTaskRepository,
  AuditEventRepository,
  AccountLinkRepository,
  RingUnclaimedTokenRecord,
  StoredAccountLinkRecord,
} from "./repositories";

export class InMemoryStorageProvider implements StorageProvider {
  private venuesMap = new Map<string, Venue>();
  private entrancesMap = new Map<string, Entrance>();
  private evidenceMap = new Map<string, Evidence>();
  private observationsMap = new Map<string, AccessibilityObservation>();
  private assessmentsMap = new Map<string, AccessAssessment>();
  private remediationTasksMap = new Map<string, RemediationTask>();
  private auditEventsList: AuditEvent[] = [];
  private unclaimedTokensMap = new Map<string, RingUnclaimedTokenRecord>();
  private accountLinksMap = new Map<string, StoredAccountLinkRecord>();

  constructor() {
    this.seedDefaults();
  }

  public reset(): void {
    this.venuesMap.clear();
    this.entrancesMap.clear();
    this.evidenceMap.clear();
    this.observationsMap.clear();
    this.assessmentsMap.clear();
    this.remediationTasksMap.clear();
    this.auditEventsList = [];
    this.unclaimedTokensMap.clear();
    this.accountLinksMap.clear();
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();

    // 1. Seed Demo Venue
    const demoVenue: Venue = {
      id: "venue_maple_cafe",
      name: "Maple Street Cafe",
      timezone: "America/New_York",
      createdAt: now,
      updatedAt: now,
    };
    this.venuesMap.set(demoVenue.id, demoVenue);

    // 2. Seed Demo Entrance
    const demoEntrance: Entrance = {
      id: "entrance_side_accessible",
      venueId: demoVenue.id,
      name: "Side Accessible Entrance",
      description: "Dedicated step-free access ramp with power-assist door operator",
      enabled: true,
      cameraBinding: {
        deviceId: "cam_front_entrance",
        componentId: "component_video_01",
        deviceName: "Front Ramp Camera (Ring Wired Doorbell Plus)",
        notes: "Direct camera line-of-sight to wheelchair ramp and entrance threshold",
      },
      requirements: {
        pathwayClear: true,
        obstructionFree: true,
        doorReady: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    this.entrancesMap.set(demoEntrance.id, demoEntrance);

    // 3. Seed Initial Baseline Assessment
    const baselineAssessment: AccessAssessment = {
      id: "assess_init_01",
      entranceId: demoEntrance.id,
      state: "AVAILABLE",
      reasonCode: "INITIAL_BASELINE",
      reason: "Initial operational baseline established with clear entrance conditions.",
      evidenceIds: [],
      observationIds: [],
      policyVersion: "1.0.0",
      assessedAt: now,
    };
    this.assessmentsMap.set(baselineAssessment.id, baselineAssessment);

    // 4. Seed Initial Audit Event
    const baselineEvent: AuditEvent = {
      id: "audit_init_01",
      type: "ACCESS_VERIFIED_RESTORED",
      timestamp: now,
      correlationId: "init_sys_seed",
      entityType: "ENTRANCE",
      entityId: demoEntrance.id,
      metadata: {
        message: "Initial baseline verified. Accessibility conditions clear.",
        initialState: "AVAILABLE",
      },
    };
    this.auditEventsList.push(baselineEvent);
  }

  // --- Snapshot / Restore for Transaction Rollback ---
  private createSnapshot() {
    return {
      venues: new Map(this.venuesMap),
      entrances: new Map(this.entrancesMap),
      evidence: new Map(this.evidenceMap),
      observations: new Map(this.observationsMap),
      assessments: new Map(this.assessmentsMap),
      remediations: new Map(this.remediationTasksMap),
      auditEvents: [...this.auditEventsList],
    };
  }

  private restoreSnapshot(snapshot: ReturnType<typeof this.createSnapshot>) {
    this.venuesMap = snapshot.venues;
    this.entrancesMap = snapshot.entrances;
    this.evidenceMap = snapshot.evidence;
    this.observationsMap = snapshot.observations;
    this.assessmentsMap = snapshot.assessments;
    this.remediationTasksMap = snapshot.remediations;
    this.auditEventsList = snapshot.auditEvents;
  }

  public async transaction<T>(fn: (tx: AssuranceTransactionContext) => Promise<T>): Promise<T> {
    const snapshot = this.createSnapshot();
    try {
      const txContext: AssuranceTransactionContext = {
        assessments: this.assessments,
        remediations: this.remediations,
        auditEvents: this.auditEvents,
        evidence: this.evidence,
        observations: this.observations,
        entrances: this.entrances,
      };
      return await fn(txContext);
    } catch (err) {
      // Atomic rollback on error
      this.restoreSnapshot(snapshot);
      throw err;
    }
  }

  // --- Repositories ---

  public venues: VenueRepository = {
    findById: async (id: string) => this.venuesMap.get(id) || null,
    listAll: async () => Array.from(this.venuesMap.values()),
    save: async (venue: Venue) => {
      this.venuesMap.set(venue.id, { ...venue });
      return venue;
    },
  };

  public entrances: EntranceRepository = {
    findById: async (id: string) => this.entrancesMap.get(id) || null,
    listByVenueId: async (venueId: string) =>
      Array.from(this.entrancesMap.values()).filter((e) => e.venueId === venueId),
    listAll: async () => Array.from(this.entrancesMap.values()),
    save: async (entrance: Entrance) => {
      this.entrancesMap.set(entrance.id, { ...entrance });
      return entrance;
    },
  };

  public evidence: EvidenceRepository = {
    findById: async (id: string) => this.evidenceMap.get(id) || null,
    listByEntranceId: async (entranceId: string, limit = 20) =>
      Array.from(this.evidenceMap.values())
        .filter((e) => e.entranceId === entranceId)
        .sort(
          (a, b) =>
            new Date(b.capturedAt || b.receivedAt).getTime() -
            new Date(a.capturedAt || a.receivedAt).getTime()
        )
        .slice(0, limit),
    save: async (evidence: Evidence) => {
      this.evidenceMap.set(evidence.id, { ...evidence });
      return evidence;
    },
  };

  public observations: ObservationRepository = {
    findById: async (id: string) => this.observationsMap.get(id) || null,
    listByEvidenceId: async (evidenceId: string) =>
      Array.from(this.observationsMap.values()).filter((o) => o.evidenceId === evidenceId),
    listByEntranceId: async (entranceId: string, limit = 20) =>
      Array.from(this.observationsMap.values())
        .filter((o) => o.entranceId === entranceId)
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
        .slice(0, limit),
    save: async (obs: AccessibilityObservation) => {
      this.observationsMap.set(obs.id, { ...obs });
      return obs;
    },
  };

  public assessments: AssessmentRepository = {
    findById: async (id: string) => this.assessmentsMap.get(id) || null,
    findLatestByEntranceId: async (entranceId: string) => {
      const all = Array.from(this.assessmentsMap.values())
        .filter((a) => a.entranceId === entranceId)
        .sort((a, b) => {
          const diff = new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime();
          if (diff !== 0) return diff;
          return b.id.localeCompare(a.id);
        });
      return all[0] || null;
    },
    listByEntranceId: async (entranceId: string, limit = 20) =>
      Array.from(this.assessmentsMap.values())
        .filter((a) => a.entranceId === entranceId)
        .sort((a, b) => {
          const diff = new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime();
          if (diff !== 0) return diff;
          return b.id.localeCompare(a.id);
        })
        .slice(0, limit),
    save: async (assessment: AccessAssessment) => {
      this.assessmentsMap.set(assessment.id, { ...assessment });
      return assessment;
    },
  };

  public remediations: RemediationTaskRepository = {
    findById: async (id: string) => this.remediationTasksMap.get(id) || null,
    findActiveByEntranceId: async (entranceId: string) => {
      const active = Array.from(this.remediationTasksMap.values())
        .filter(
          (t) =>
            t.entranceId === entranceId &&
            (t.status === "OPEN" || t.status === "ACKNOWLEDGED")
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return active[0] || null;
    },
    listByEntranceId: async (entranceId: string, limit = 20) =>
      Array.from(this.remediationTasksMap.values())
        .filter((t) => t.entranceId === entranceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit),
    save: async (task: RemediationTask) => {
      this.remediationTasksMap.set(task.id, { ...task });
      return task;
    },
  };

  public auditEvents: AuditEventRepository = {
    findById: async (id: string) =>
      this.auditEventsList.find((e) => e.id === id) || null,
    listByEntranceId: async (entranceId: string, limit = 50) =>
      this.auditEventsList
        .filter((e) => e.entityId === entranceId || (e.metadata && e.metadata.entranceId === entranceId))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit),
    listByCorrelationId: async (correlationId: string) =>
      this.auditEventsList.filter((e) => e.correlationId === correlationId),
    append: async (event: AuditEvent) => {
      this.auditEventsList.push({ ...event });
      return event;
    },
  };

  public accountLinks: AccountLinkRepository = {
    saveUnclaimedToken: async (record: RingUnclaimedTokenRecord): Promise<void> => {
      this.unclaimedTokensMap.set(record.ringAccountId, { ...record });
    },

    listUnclaimedTokens: async (): Promise<RingUnclaimedTokenRecord[]> => {
      const nowSec = Math.floor(Date.now() / 1000);
      return Array.from(this.unclaimedTokensMap.values()).filter((r) => {
        const expiry = r.claimExpiresAtEpoch ?? (r.claimExpiresAt ? Math.floor(new Date(r.claimExpiresAt).getTime() / 1000) : r.ttl);
        return typeof expiry === "number" && expiry > nowSec;
      });
    },

    findUnclaimedTokenByAccountId: async (ringAccountId: string): Promise<RingUnclaimedTokenRecord | null> => {
      const rec = this.unclaimedTokensMap.get(ringAccountId);
      if (!rec) return null;
      const nowSec = Math.floor(Date.now() / 1000);
      const expiry = rec.claimExpiresAtEpoch ?? (rec.claimExpiresAt ? Math.floor(new Date(rec.claimExpiresAt).getTime() / 1000) : rec.ttl);
      if (typeof expiry !== "number" || expiry <= nowSec) {
        this.unclaimedTokensMap.delete(ringAccountId);
        return null;
      }
      return { ...rec };
    },

    claimToken: async (params: {
      userId: string;
      venueId?: string;
      ringAccountId: string;
      unclaimedRecord: RingUnclaimedTokenRecord;
    }): Promise<StoredAccountLinkRecord> => {
      // 1. Enforce explicit claim-expiration attribute presence on parameter
      const hasParamExpiry =
        params.unclaimedRecord?.claimExpiresAtEpoch !== undefined ||
        Boolean(params.unclaimedRecord?.claimExpiresAt);
      if (!hasParamExpiry) {
        throw new Error(
          `Unclaimed token for Ring account ${params.ringAccountId} is missing required claim-expiration attribute.`
        );
      }

      // 2. Verify existence in unclaimed storage
      const rec = this.unclaimedTokensMap.get(params.ringAccountId);
      if (!rec) {
        throw new Error(
          `Unclaimed token for Ring account ${params.ringAccountId} has already been claimed or does not exist.`
        );
      }

      // 3. Enforce explicit claim-expiration attribute presence on stored record
      const hasStoredExpiry = rec.claimExpiresAtEpoch !== undefined || Boolean(rec.claimExpiresAt);
      if (!hasStoredExpiry) {
        throw new Error(
          `Unclaimed token for Ring account ${params.ringAccountId} is missing required claim-expiration attribute.`
        );
      }

      // 3. Enforce expiration timestamp
      const nowSec = Math.floor(Date.now() / 1000);
      const expirySec = rec.claimExpiresAtEpoch ?? (rec.claimExpiresAt ? Math.floor(new Date(rec.claimExpiresAt).getTime() / 1000) : 0);
      if (expirySec <= nowSec) {
        this.unclaimedTokensMap.delete(params.ringAccountId);
        throw new Error(`Unclaimed token for Ring account ${params.ringAccountId} has expired.`);
      }

      // 4. Duplicate claim guard
      const existing = this.accountLinksMap.get(params.userId);
      if (existing && existing.ringAccountReference === params.ringAccountId) {
        throw new Error(`Ring account ${params.ringAccountId} has already been claimed by user ${params.userId}.`);
      }

      // 5. Atomic claim
      this.unclaimedTokensMap.delete(params.ringAccountId);

      const now = new Date().toISOString();
      const claimedRecord: StoredAccountLinkRecord = {
        partnerUserId: params.userId,
        ringAccountReference: params.ringAccountId,
        encryptedAccessToken: params.unclaimedRecord.encryptedAccessToken,
        encryptedRefreshToken: params.unclaimedRecord.encryptedRefreshToken,
        iv: params.unclaimedRecord.iv,
        authTag: params.unclaimedRecord.authTag,
        expiresAt: params.unclaimedRecord.expiresAt,
        status: "LINKED",
        createdAt: params.unclaimedRecord.createdAt || now,
        updatedAt: now,
        venueId: params.venueId,
      };

      this.accountLinksMap.set(params.userId, claimedRecord);
      return claimedRecord;
    },

    findByUserId: async (userId: string): Promise<StoredAccountLinkRecord | null> => {
      const rec = this.accountLinksMap.get(userId);
      return rec ? { ...rec } : null;
    },

    findByVenueId: async (venueId: string): Promise<StoredAccountLinkRecord | null> => {
      for (const rec of this.accountLinksMap.values()) {
        if (rec.venueId === venueId) {
          return { ...rec };
        }
      }
      return null;
    },

    findByRingAccountId: async (ringAccountId: string): Promise<StoredAccountLinkRecord | null> => {
      for (const rec of this.accountLinksMap.values()) {
        if (rec.ringAccountReference === ringAccountId) {
          return { ...rec };
        }
      }
      return null;
    },

    saveClaimed: async (record: StoredAccountLinkRecord): Promise<StoredAccountLinkRecord> => {
      this.accountLinksMap.set(record.partnerUserId, { ...record });
      return record;
    },

    delete: async (userId: string, ringAccountId: string): Promise<boolean> => {
      const existing = this.accountLinksMap.get(userId);
      if (existing && existing.ringAccountReference === ringAccountId) {
        this.accountLinksMap.delete(userId);
        return true;
      }
      return false;
    },
  };
}
