/**
 * OpenWay DynamoDB Single-Table Schema Definition & Access Pattern Key Helpers
 *
 * Primary Table:
 * - Partition Key: PK (String)
 * - Sort Key:      SK (String)
 *
 * Global Secondary Index 1 (GSI1):
 * - Partition Key: GSI1PK (String)
 * - Sort Key:      GSI1SK (String)
 */

export const DYNAMO_INDEXES = {
  GSI1: "GSI1",
} as const;

export const DynamoKeys = {
  // Venue
  venuePk: (venueId: string) => `VENUE#${venueId}`,
  venueSk: () => "METADATA",

  // Entrance
  entrancePk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  entranceSk: () => "METADATA",
  entranceGsi1Pk: (venueId: string) => `VENUE#${venueId}`,
  entranceGsi1Sk: (entranceId: string) => `ENTRANCE#${entranceId}`,

  // Evidence
  evidencePk: (evidenceId: string) => `EVIDENCE#${evidenceId}`,
  evidenceSk: () => "METADATA",
  evidenceGsi1Pk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  evidenceGsi1Sk: (timestamp: string, evidenceId: string) => `EVIDENCE#${timestamp}#${evidenceId}`,

  // Observation
  observationPk: (observationId: string) => `OBSERVATION#${observationId}`,
  observationSk: () => "METADATA",
  observationGsi1Pk: (evidenceId: string) => `EVIDENCE#${evidenceId}`,
  observationGsi1Sk: (timestamp: string, observationId: string) => `OBSERVATION#${timestamp}#${observationId}`,
  observationEntranceGsi1Pk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  observationEntranceGsi1Sk: (timestamp: string, observationId: string) => `OBSERVATION#${timestamp}#${observationId}`,

  // Assessment (Historical record & current pointer)
  assessmentPk: (assessmentId: string) => `ASSESSMENT#${assessmentId}`,
  assessmentSk: () => "METADATA",
  assessmentGsi1Pk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  assessmentGsi1Sk: (timestamp: string, assessmentId: string) => `ASSESSMENT#${timestamp}#${assessmentId}`,
  currentAssessmentPk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  currentAssessmentSk: () => "ASSESSMENT#CURRENT",

  // Remediation Task (Historical record & active pointer)
  taskPk: (taskId: string) => `TASK#${taskId}`,
  taskSk: () => "METADATA",
  taskGsi1Pk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  taskGsi1Sk: (timestamp: string, taskId: string) => `TASK#${timestamp}#${taskId}`,
  activeTaskPk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  activeTaskSk: () => "TASK#ACTIVE",

  // Audit Event
  auditPk: (eventId: string) => `AUDIT#${eventId}`,
  auditSk: () => "METADATA",
  auditGsi1Pk: (entranceId: string) => `ENTRANCE#${entranceId}`,
  auditGsi1Sk: (timestamp: string, eventId: string) => `AUDIT#${timestamp}#${eventId}`,
  auditCorrelationGsi1Pk: (correlationId: string) => `CORRELATION#${correlationId}`,
  auditCorrelationGsi1Sk: (timestamp: string, eventId: string) => `AUDIT#${timestamp}#${eventId}`,

  // Idempotency Record
  idempotencyPk: (key: string) => `IDEMPOTENCY#${key}`,
  idempotencySk: () => "RECORD",

  // Account Linking (Scaffolding)
  accountLinkPk: (userId: string) => `USER#${userId}`,
  accountLinkSk: (ringAccountRef: string) => `RING_ACCOUNT#${ringAccountRef}`,
};

export interface DynamoBaseItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  entityType: string;
  version?: number;
  createdAt: string;
  updatedAt?: string;
}
