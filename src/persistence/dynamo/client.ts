import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoConfig {
  region: string;
  tableName: string;
  endpoint?: string;
  maxRetries: number;
}

export function getDynamoConfig(): DynamoConfig {
  return {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    tableName: process.env.DYNAMODB_TABLE_NAME || "OpenWayTable",
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    maxRetries: parseInt(process.env.DYNAMODB_MAX_RETRIES || "3", 10),
  };
}

let cachedDocClient: DynamoDBDocumentClient | null = null;
let cachedRawClient: DynamoDBClient | null = null;

export function getDynamoClient(config: DynamoConfig = getDynamoConfig()): {
  client: DynamoDBClient;
  docClient: DynamoDBDocumentClient;
} {
  if (!cachedDocClient || !cachedRawClient) {
    cachedRawClient = new DynamoDBClient({
      region: config.region,
      endpoint: config.endpoint,
      maxAttempts: config.maxRetries,
    });

    cachedDocClient = DynamoDBDocumentClient.from(cachedRawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  return {
    client: cachedRawClient,
    docClient: cachedDocClient,
  };
}
