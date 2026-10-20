import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
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
  AssuranceTransactionContext,
} from "../repositories";
import { DynamoKeys, DYNAMO_INDEXES } from "./schema";
import { getDynamoClient, DynamoConfig, getDynamoConfig } from "./client";
import { OptimisticLockError } from "./concurrency";
import { DynamoIdempotencyRepository } from "./idempotency";

export class DynamoStorageProvider implements StorageProvider {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  public readonly idempotency: DynamoIdempotencyRepository;

  constructor(config: DynamoConfig = getDynamoConfig()) {
    const { docClient } = getDynamoClient(config);
    this.docClient = docClient;
    this.tableName = config.tableName;
    this.idempotency = new DynamoIdempotencyRepository(this.docClient, this.tableName);
  }

  public venues: VenueRepository = {
    findById: async (id: string): Promise<Venue | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.venuePk(id),
            SK: DynamoKeys.venueSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as Venue;
    },

    listAll: async (): Promise<Venue[]> => {
      const res = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "entityType = :entityType",
          ExpressionAttributeValues: {
            ":entityType": "VENUE",
          },
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as Venue);
    },

    save: async (venue: Venue): Promise<Venue> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.venuePk(venue.id),
            SK: DynamoKeys.venueSk(),
            entityType: "VENUE",
            ...venue,
          },
        })
      );
      return venue;
    },
  };

  public entrances: EntranceRepository = {
    findById: async (id: string): Promise<Entrance | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.entrancePk(id),
            SK: DynamoKeys.entranceSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as Entrance;
    },

    listByVenueId: async (venueId: string): Promise<Entrance[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.entranceGsi1Pk(venueId),
            ":prefix": "ENTRANCE#",
          },
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as Entrance);
    },

    listAll: async (): Promise<Entrance[]> => {
      const res = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "entityType = :entityType",
          ExpressionAttributeValues: {
            ":entityType": "ENTRANCE",
          },
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as Entrance);
    },

    save: async (entrance: Entrance): Promise<Entrance> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.entrancePk(entrance.id),
            SK: DynamoKeys.entranceSk(),
            GSI1PK: DynamoKeys.entranceGsi1Pk(entrance.venueId),
            GSI1SK: DynamoKeys.entranceGsi1Sk(entrance.id),
            entityType: "ENTRANCE",
            ...entrance,
          },
        })
      );
      return entrance;
    },
  };

  public evidence: EvidenceRepository = {
    findById: async (id: string): Promise<Evidence | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.evidencePk(id),
            SK: DynamoKeys.evidenceSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as Evidence;
    },

    listByEntranceId: async (entranceId: string, limit = 20): Promise<Evidence[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.evidenceGsi1Pk(entranceId),
            ":prefix": "EVIDENCE#",
          },
          ScanIndexForward: false, // Descending order (newest first)
          Limit: limit,
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as Evidence);
    },

    save: async (evidence: Evidence): Promise<Evidence> => {
      const sortTimestamp = evidence.capturedAt || evidence.receivedAt;
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.evidencePk(evidence.id),
            SK: DynamoKeys.evidenceSk(),
            GSI1PK: DynamoKeys.evidenceGsi1Pk(evidence.entranceId),
            GSI1SK: DynamoKeys.evidenceGsi1Sk(sortTimestamp, evidence.id),
            entityType: "EVIDENCE",
            ...evidence,
          },
        })
      );
      return evidence;
    },
  };

  public observations: ObservationRepository = {
    findById: async (id: string): Promise<AccessibilityObservation | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.observationPk(id),
            SK: DynamoKeys.observationSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as AccessibilityObservation;
    },

    listByEvidenceId: async (evidenceId: string): Promise<AccessibilityObservation[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.observationGsi1Pk(evidenceId),
            ":prefix": "OBSERVATION#",
          },
          ScanIndexForward: false,
        })
      );
      return (res.Items || []).map(
        ({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as AccessibilityObservation
      );
    },

    listByEntranceId: async (entranceId: string, limit = 20): Promise<AccessibilityObservation[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.observationEntranceGsi1Pk(entranceId),
            ":prefix": "OBSERVATION#",
          },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
      return (res.Items || []).map(
        ({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as AccessibilityObservation
      );
    },

    save: async (obs: AccessibilityObservation): Promise<AccessibilityObservation> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.observationPk(obs.id),
            SK: DynamoKeys.observationSk(),
            GSI1PK: DynamoKeys.observationEntranceGsi1Pk(obs.entranceId),
            GSI1SK: DynamoKeys.observationEntranceGsi1Sk(obs.observedAt, obs.id),
            entityType: "OBSERVATION",
            ...obs,
          },
        })
      );
      return obs;
    },
  };

  public assessments: AssessmentRepository = {
    findById: async (id: string): Promise<AccessAssessment | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.assessmentPk(id),
            SK: DynamoKeys.assessmentSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as AccessAssessment;
    },

    findLatestByEntranceId: async (entranceId: string): Promise<AccessAssessment | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.currentAssessmentPk(entranceId),
            SK: DynamoKeys.currentAssessmentSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as AccessAssessment;
    },

    listByEntranceId: async (entranceId: string, limit = 20): Promise<AccessAssessment[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.assessmentGsi1Pk(entranceId),
            ":prefix": "ASSESSMENT#",
          },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as AccessAssessment);
    },

    save: async (assessment: AccessAssessment): Promise<AccessAssessment> => {
      // Single-table write: historical item + current pointer updated together via batch or transaction
      const historicalItem = {
        PK: DynamoKeys.assessmentPk(assessment.id),
        SK: DynamoKeys.assessmentSk(),
        GSI1PK: DynamoKeys.assessmentGsi1Pk(assessment.entranceId),
        GSI1SK: DynamoKeys.assessmentGsi1Sk(assessment.assessedAt, assessment.id),
        entityType: "ASSESSMENT",
        ...assessment,
      };

      const currentPointerItem = {
        PK: DynamoKeys.currentAssessmentPk(assessment.entranceId),
        SK: DynamoKeys.currentAssessmentSk(),
        entityType: "CURRENT_ASSESSMENT",
        ...assessment,
      };

      try {
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.tableName,
                  Item: historicalItem,
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: currentPointerItem,
                },
              },
            ],
          })
        );
      } catch (err: unknown) {
        if (
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "TransactionCanceledException"
        ) {
          throw new OptimisticLockError(
            "Failed to save assessment due to concurrent update.",
            assessment.id
          );
        }
        throw err;
      }

      return assessment;
    },
  };

  public remediations: RemediationTaskRepository = {
    findById: async (id: string): Promise<RemediationTask | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.taskPk(id),
            SK: DynamoKeys.taskSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as RemediationTask;
    },

    findActiveByEntranceId: async (entranceId: string): Promise<RemediationTask | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.activeTaskPk(entranceId),
            SK: DynamoKeys.activeTaskSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as RemediationTask;
    },

    listByEntranceId: async (entranceId: string, limit = 20): Promise<RemediationTask[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.taskGsi1Pk(entranceId),
            ":prefix": "TASK#",
          },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as RemediationTask);
    },

    save: async (task: RemediationTask): Promise<RemediationTask> => {
      const historicalItem = {
        PK: DynamoKeys.taskPk(task.id),
        SK: DynamoKeys.taskSk(),
        GSI1PK: DynamoKeys.taskGsi1Pk(task.entranceId),
        GSI1SK: DynamoKeys.taskGsi1Sk(task.createdAt, task.id),
        entityType: "TASK",
        ...task,
      };

      const isActive = task.status === "OPEN" || task.status === "ACKNOWLEDGED";

      if (isActive) {
        // Update active pointer
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.tableName,
                  Item: historicalItem,
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: {
                    PK: DynamoKeys.activeTaskPk(task.entranceId),
                    SK: DynamoKeys.activeTaskSk(),
                    entityType: "ACTIVE_TASK",
                    ...task,
                  },
                },
              },
            ],
          })
        );
      } else {
        // Task completed or cancelled: update historical, and clear active pointer if it matched this task
        const activeRes = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              PK: DynamoKeys.activeTaskPk(task.entranceId),
              SK: DynamoKeys.activeTaskSk(),
            },
          })
        );

        const currentActiveId = activeRes.Item?.id;
        if (currentActiveId === task.id) {
          await this.docClient.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: this.tableName,
                    Item: historicalItem,
                  },
                },
                {
                  Delete: {
                    TableName: this.tableName,
                    Key: {
                      PK: DynamoKeys.activeTaskPk(task.entranceId),
                      SK: DynamoKeys.activeTaskSk(),
                    },
                  },
                },
              ],
            })
          );
        } else {
          await this.docClient.send(
            new PutCommand({
              TableName: this.tableName,
              Item: historicalItem,
            })
          );
        }
      }

      return task;
    },
  };

  public auditEvents: AuditEventRepository = {
    findById: async (id: string): Promise<AuditEvent | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.auditPk(id),
            SK: DynamoKeys.auditSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      return rest as AuditEvent;
    },

    listByEntranceId: async (entranceId: string, limit = 50): Promise<AuditEvent[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.auditGsi1Pk(entranceId),
            ":prefix": "AUDIT#",
          },
          ScanIndexForward: false,
          Limit: limit,
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as AuditEvent);
    },

    listByCorrelationId: async (correlationId: string): Promise<AuditEvent[]> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.auditCorrelationGsi1Pk(correlationId),
            ":prefix": "AUDIT#",
          },
          ScanIndexForward: false,
        })
      );
      return (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as AuditEvent);
    },

    append: async (event: AuditEvent): Promise<AuditEvent> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.auditPk(event.id),
            SK: DynamoKeys.auditSk(),
            GSI1PK: DynamoKeys.auditGsi1Pk(event.entityId),
            GSI1SK: DynamoKeys.auditGsi1Sk(event.timestamp, event.id),
            ...event,
          },
        })
      );
      return event;
    },
  };

  public accountLinks: AccountLinkRepository = {
    saveUnclaimedToken: async (record: RingUnclaimedTokenRecord): Promise<void> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.unclaimedAccountPk(record.ringAccountId),
            SK: DynamoKeys.unclaimedAccountSk(),
            GSI1PK: DynamoKeys.unclaimedAccountGsi1Pk(),
            GSI1SK: DynamoKeys.unclaimedAccountGsi1Sk(record.createdAt, record.ringAccountId),
            entityType: "RING_UNCLAIMED_TOKEN",
            ...record,
          },
        })
      );
    },

    listUnclaimedTokens: async (): Promise<RingUnclaimedTokenRecord[]> => {
      const nowSec = Math.floor(Date.now() / 1000);
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.unclaimedAccountGsi1Pk(),
          },
        })
      );
      const items = (res.Items || []).map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest as RingUnclaimedTokenRecord);
      return items.filter((item) => {
        const expiry = item.claimExpiresAtEpoch ?? (item.claimExpiresAt ? Math.floor(new Date(item.claimExpiresAt).getTime() / 1000) : item.ttl);
        return typeof expiry === "number" && expiry > nowSec;
      });
    },

    findUnclaimedTokenByAccountId: async (ringAccountId: string): Promise<RingUnclaimedTokenRecord | null> => {
      const res = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.unclaimedAccountPk(ringAccountId),
            SK: DynamoKeys.unclaimedAccountSk(),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Item;
      const record = rest as RingUnclaimedTokenRecord;
      const nowSec = Math.floor(Date.now() / 1000);
      const expiry = record.claimExpiresAtEpoch ?? (record.claimExpiresAt ? Math.floor(new Date(record.claimExpiresAt).getTime() / 1000) : record.ttl);
      if (typeof expiry !== "number" || expiry <= nowSec) {
        return null;
      }
      return record;
    },

    claimToken: async (params: {
      userId: string;
      venueId?: string;
      ringAccountId: string;
      unclaimedRecord: RingUnclaimedTokenRecord;
    }): Promise<StoredAccountLinkRecord> => {
      const now = new Date();
      const nowEpoch = Math.floor(now.getTime() / 1000);

      // 1. Verify that unclaimedRecord has an explicit claim-expiration attribute
      const hasExpiryAttr =
        params.unclaimedRecord.claimExpiresAtEpoch !== undefined ||
        Boolean(params.unclaimedRecord.claimExpiresAt);
      if (!hasExpiryAttr) {
        throw new Error(
          `Unclaimed token for Ring account ${params.ringAccountId} is missing required claim-expiration attribute.`
        );
      }

      // 2. Reject if client-side check shows already expired
      const claimExpiryEpoch =
        params.unclaimedRecord.claimExpiresAtEpoch ??
        (params.unclaimedRecord.claimExpiresAt
          ? Math.floor(new Date(params.unclaimedRecord.claimExpiresAt).getTime() / 1000)
          : 0);

      if (claimExpiryEpoch <= nowEpoch) {
        throw new Error(`Unclaimed token for Ring account ${params.ringAccountId} has expired.`);
      }

      const nowIso = now.toISOString();
      const claimedRecord: StoredAccountLinkRecord = {
        partnerUserId: params.userId,
        ringAccountReference: params.ringAccountId,
        encryptedAccessToken: params.unclaimedRecord.encryptedAccessToken,
        encryptedRefreshToken: params.unclaimedRecord.encryptedRefreshToken,
        iv: params.unclaimedRecord.iv,
        authTag: params.unclaimedRecord.authTag,
        expiresAt: params.unclaimedRecord.expiresAt,
        status: "LINKED",
        createdAt: params.unclaimedRecord.createdAt || nowIso,
        updatedAt: nowIso,
        venueId: params.venueId,
      };

      try {
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: this.tableName,
                  Key: {
                    PK: DynamoKeys.unclaimedAccountPk(params.ringAccountId),
                    SK: DynamoKeys.unclaimedAccountSk(),
                  },
                  // Atomically verify that record exists, is not already claimed, has the claim-expiration attribute, and has not expired
                  ConditionExpression:
                    "attribute_exists(PK) AND attribute_exists(#claimExpiresAtEpoch) AND #claimExpiresAtEpoch > :nowEpoch",
                  ExpressionAttributeNames: {
                    "#claimExpiresAtEpoch": "claimExpiresAtEpoch",
                  },
                  ExpressionAttributeValues: {
                    ":nowEpoch": nowEpoch,
                  },
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: {
                    PK: DynamoKeys.accountLinkPk(params.userId),
                    SK: DynamoKeys.accountLinkSk(params.ringAccountId),
                    ...(params.venueId
                      ? {
                          GSI1PK: DynamoKeys.accountLinkVenueGsi1Pk(params.venueId),
                          GSI1SK: DynamoKeys.accountLinkVenueGsi1Sk(params.ringAccountId),
                        }
                      : {}),
                    entityType: "RING_ACCOUNT_LINK",
                    ...claimedRecord,
                  },
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              },
            ],
          })
        );
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || "";
        if (
          errorMsg.includes("ConditionalCheckFailed") ||
          (err as { name?: string })?.name === "TransactionCanceledException"
        ) {
          throw new Error(
            `Ring account ${params.ringAccountId} has already been claimed, has expired, or is missing required claim-expiration attribute.`
          );
        }
        throw err;
      }

      return claimedRecord;
    },

    findByUserId: async (userId: string): Promise<StoredAccountLinkRecord | null> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": DynamoKeys.accountLinkPk(userId),
            ":skPrefix": "RING_ACCOUNT#",
          },
        })
      );
      if (!res.Items || res.Items.length === 0) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Items[0];
      return rest as StoredAccountLinkRecord;
    },

    findByVenueId: async (venueId: string): Promise<StoredAccountLinkRecord | null> => {
      const res = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: DYNAMO_INDEXES.GSI1,
          KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":gsi1pk": DynamoKeys.accountLinkVenueGsi1Pk(venueId),
            ":skPrefix": "RING_ACCOUNT#",
          },
        })
      );
      if (!res.Items || res.Items.length === 0) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Items[0];
      return rest as StoredAccountLinkRecord;
    },

    findByRingAccountId: async (ringAccountId: string): Promise<StoredAccountLinkRecord | null> => {
      const res = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "entityType = :entityType AND ringAccountReference = :ref",
          ExpressionAttributeValues: {
            ":entityType": "RING_ACCOUNT_LINK",
            ":ref": ringAccountId,
          },
          Limit: 1,
        })
      );
      if (!res.Items || res.Items.length === 0) return null;
      const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = res.Items[0];
      return rest as StoredAccountLinkRecord;
    },

    saveClaimed: async (record: StoredAccountLinkRecord): Promise<StoredAccountLinkRecord> => {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.accountLinkPk(record.partnerUserId),
            SK: DynamoKeys.accountLinkSk(record.ringAccountReference),
            ...(record.venueId
              ? {
                  GSI1PK: DynamoKeys.accountLinkVenueGsi1Pk(record.venueId),
                  GSI1SK: DynamoKeys.accountLinkVenueGsi1Sk(record.ringAccountReference),
                }
              : {}),
            entityType: "RING_ACCOUNT_LINK",
            ...record,
          },
        })
      );
      return record;
    },

    delete: async (userId: string, ringAccountId: string): Promise<boolean> => {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.accountLinkPk(userId),
            SK: DynamoKeys.accountLinkSk(ringAccountId),
          },
        })
      );
      return true;
    },
  };

  /**
   * Executes operations within an atomic DynamoDB transaction boundary.
   */
  async transaction<T>(fn: (tx: AssuranceTransactionContext) => Promise<T>): Promise<T> {
    const stageItems: TransactWriteCommandInput["TransactItems"] = [];

    // Transaction-scoped context collecting items for atomic batch commit
    const txContext: AssuranceTransactionContext = {
      entrances: this.entrances,
      evidence: this.evidence,
      observations: this.observations,
      assessments: {
        ...this.assessments,
        save: async (assessment: AccessAssessment) => {
          stageItems.push(
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: DynamoKeys.assessmentPk(assessment.id),
                  SK: DynamoKeys.assessmentSk(),
                  GSI1PK: DynamoKeys.assessmentGsi1Pk(assessment.entranceId),
                  GSI1SK: DynamoKeys.assessmentGsi1Sk(assessment.assessedAt, assessment.id),
                  entityType: "ASSESSMENT",
                  ...assessment,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: DynamoKeys.currentAssessmentPk(assessment.entranceId),
                  SK: DynamoKeys.currentAssessmentSk(),
                  entityType: "CURRENT_ASSESSMENT",
                  ...assessment,
                },
              },
            }
          );
          return assessment;
        },
      },
      remediations: {
        ...this.remediations,
        save: async (task: RemediationTask) => {
          const isActive = task.status === "OPEN" || task.status === "ACKNOWLEDGED";
          stageItems.push({
            Put: {
              TableName: this.tableName,
              Item: {
                PK: DynamoKeys.taskPk(task.id),
                SK: DynamoKeys.taskSk(),
                GSI1PK: DynamoKeys.taskGsi1Pk(task.entranceId),
                GSI1SK: DynamoKeys.taskGsi1Sk(task.createdAt, task.id),
                entityType: "TASK",
                ...task,
              },
            },
          });

          if (isActive) {
            stageItems.push({
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: DynamoKeys.activeTaskPk(task.entranceId),
                  SK: DynamoKeys.activeTaskSk(),
                  entityType: "ACTIVE_TASK",
                  ...task,
                },
              },
            });
          }
          return task;
        },
      },
      auditEvents: {
        ...this.auditEvents,
        append: async (event: AuditEvent) => {
          stageItems.push({
            Put: {
              TableName: this.tableName,
              Item: {
                PK: DynamoKeys.auditPk(event.id),
                SK: DynamoKeys.auditSk(),
                GSI1PK: DynamoKeys.auditGsi1Pk(event.entityId),
                GSI1SK: DynamoKeys.auditGsi1Sk(event.timestamp, event.id),
                ...event,
              },
            },
          });
          return event;
        },
      },
    };

    const result = await fn(txContext);

    if (stageItems.length > 0) {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: stageItems,
        })
      );
    }

    return result;
  }
}
