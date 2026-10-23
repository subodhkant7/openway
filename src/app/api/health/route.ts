import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";
import { DEMO_IDS } from "@/persistence/bootstrap";

export async function GET() {
  const timestamp = new Date().toISOString();
  const environment = process.env.OPENWAY_ENV || process.env.NODE_ENV || "development";
  const version = process.env.OPENWAY_VERSION || "0.1.0";
  const commitSha = process.env.GIT_COMMIT_SHA || "27911e0";

  const storageProvider = process.env.OPENWAY_STORAGE === "dynamo" ? "dynamo" : "memory";

  let dbStatus: "CONNECTED" | "UNAVAILABLE" = "CONNECTED";
  let dbDetails: string = "Operational";

  try {
    const storage = getStorageProvider();
    // Safe connectivity check
    await storage.venues.findById(DEMO_IDS.VENUE_ID);
  } catch (err: unknown) {
    dbStatus = "UNAVAILABLE";
    dbDetails = err instanceof Error ? err.message : "Database error";
  }

  // Safe Bedrock status (no secrets)
  const bedrockConfigured =
    Boolean(process.env.AWS_REGION) ||
    Boolean(process.env.AWS_DEFAULT_REGION) ||
    Boolean(process.env.BEDROCK_MODEL_ID);

  const bedrockStatus = bedrockConfigured ? "CONFIGURED" : "DEFAULT_REGION";

  // Safe Ring status (no tokens or credentials)
  const ringProvider = process.env.OPENWAY_PROVIDER || "simulator";
  const ringStatus =
    ringProvider === "playground"
      ? "PLAYGROUND_ACTIVE"
      : ringProvider === "api"
      ? "PARTNER_API_ACTIVE"
      : "SIMULATOR_ACTIVE";

  // Configuration validation for production
  let configError: string | null = null;
  if (environment === "production") {
    if (storageProvider !== "dynamo") {
      configError = "Production environment requires DynamoDB durable storage (OPENWAY_STORAGE=dynamo).";
    } else if (!process.env.DYNAMODB_TABLE_NAME) {
      configError = "Production DynamoDB table name (DYNAMODB_TABLE_NAME) is unconfigured.";
    }
  }

  let overallStatus: "APPLICATION_HEALTHY" | "DEPENDENCY_DEGRADED" | "CONFIGURATION_ERROR";
  let httpStatusCode: number;

  if (configError) {
    overallStatus = "CONFIGURATION_ERROR";
    httpStatusCode = 500;
  } else if (dbStatus !== "CONNECTED") {
    overallStatus = "DEPENDENCY_DEGRADED";
    httpStatusCode = 503;
  } else {
    overallStatus = "APPLICATION_HEALTHY";
    httpStatusCode = 200;
  }

  return NextResponse.json(
    {
      status: overallStatus,
      environment,
      version,
      commitSha,
      timestamp,
      ...(configError ? { configurationError: configError } : {}),
      storage: {
        provider: storageProvider,
        status: dbStatus,
        details: dbDetails,
      },
      bedrock: {
        configured: bedrockConfigured,
        status: bedrockStatus,
        modelId: process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0",
        region: process.env.AWS_REGION || "us-east-1",
      },
      ring: {
        provider: ringProvider,
        status: ringStatus,
        documentationRef: "https://developer.ring.com",
      },
    },
    {
      status: httpStatusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
