import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoKeys } from "./schema";

export interface IdempotencyRecord {
  idempotencyKey: string;
  operation: string;
  createdAt: string;
  expiresAt: number; // Numeric epoch seconds for DynamoDB TTL
  resultReference?: string;
  status: "IN_FLIGHT" | "COMPLETED" | "FAILED";
}

export interface IdempotencyAcquireResult {
  acquired: boolean;
  existingRecord?: IdempotencyRecord;
}

export class DynamoIdempotencyRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  /**
   * Attempts to acquire an idempotency lock for an operation.
   * Uses DynamoDB conditional write: attribute_not_exists(PK).
   * Returns true if lock was acquired, false if a concurrent or previous request already exists.
   */
  async acquire(
    idempotencyKey: string,
    operation: string,
    ttlSeconds: number = 300
  ): Promise<IdempotencyAcquireResult> {
    const now = new Date();
    const expiresAt = Math.floor(now.getTime() / 1000) + ttlSeconds;

    const record: IdempotencyRecord = {
      idempotencyKey,
      operation,
      createdAt: now.toISOString(),
      expiresAt,
      status: "IN_FLIGHT",
    };

    const item = {
      PK: DynamoKeys.idempotencyPk(idempotencyKey),
      SK: DynamoKeys.idempotencySk(),
      entityType: "IDEMPOTENCY_RECORD",
      ...record,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK)",
        })
      );
      return { acquired: true };
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: string }).name === "ConditionalCheckFailedException"
      ) {
        // Fetch existing record
        const existing = await this.get(idempotencyKey);
        return {
          acquired: false,
          existingRecord: existing || undefined,
        };
      }
      throw err;
    }
  }

  /**
   * Completes an operation and updates the idempotency record with its result reference.
   */
  async complete(
    idempotencyKey: string,
    resultReference?: string,
    ttlSeconds: number = 86400 // Keep completion record for 24h
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.idempotencyPk(idempotencyKey),
          SK: DynamoKeys.idempotencySk(),
          entityType: "IDEMPOTENCY_RECORD",
          idempotencyKey,
          status: "COMPLETED",
          resultReference,
          updatedAt: new Date().toISOString(),
          expiresAt,
        },
      })
    );
  }

  /**
   * Retrieves an idempotency record by key.
   */
  async get(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.idempotencyPk(idempotencyKey),
          SK: DynamoKeys.idempotencySk(),
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    const { PK, SK, entityType, ...rest } = result.Item;
    return rest as IdempotencyRecord;
  }
}
