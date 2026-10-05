import { NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";
import { DEMO_IDS } from "@/persistence/bootstrap";

export async function GET() {
  const timestamp = new Date().toISOString();
  const environment = process.env.OPENWAY_ENV || process.env.NODE_ENV || "development";
  const version = process.env.OPENWAY_VERSION || "0.1.0";
  const commitSha = process.env.GIT_COMMIT_SHA || "cd17ad6";

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

  const isHealthy = dbStatus === "CONNECTED";
  const overallStatus = isHealthy ? "APPLICATION_HEALTHY" : "DEPENDENCY_DEGRADED";

  return NextResponse.json(
    {
      status: overallStatus,
      environment,
      version,
      commitSha,
      timestamp,
      components: {
        database: {
          status: dbStatus,
          storageType: process.env.OPENWAY_STORAGE === "dynamo" ? "dynamodb" : "in_memory",
          details: dbDetails,
        },
        bedrock: {
          status: bedrockStatus,
          modelId: process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0",
          region: process.env.AWS_REGION || "us-east-1",
        },
        ring: {
          status: ringStatus,
          providerMode: ringProvider,
          documentationRef: "https://developer.ring.com",
        },
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
