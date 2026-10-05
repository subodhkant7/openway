import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";
import { DEMO_IDS } from "@/persistence/bootstrap";
import { checkRateLimit } from "@/lib/rateLimit";
import { AccessAssessment, AuditEvent } from "@/domain/types";

export async function POST(req: NextRequest) {
  // 1. Rate Limiting Protection (Max 15 resets per minute)
  const clientIp = req.headers.get("x-forwarded-for") || "local_demo_client";
  const rateLimit = checkRateLimit(`demo_reset_${clientIp}`, {
    windowMs: 60000,
    maxRequests: 15,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded for demo reset. Please wait before retrying.",
        retryAfterMs: rateLimit.resetMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimit.resetMs / 1000).toString(),
        },
      }
    );
  }

  // 2. Demo Tenant Scope Check: Ensure only demo tenant can be reset
  let requestedEntranceId = DEMO_IDS.ENTRANCE_ID;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.entranceId && body.entranceId !== DEMO_IDS.ENTRANCE_ID) {
      return NextResponse.json(
        {
          error: "Permission denied: Demo reset can only target the isolated demo entrance.",
          allowedEntranceId: DEMO_IDS.ENTRANCE_ID,
        },
        { status: 403 }
      );
    }
  } catch {
    // Empty body is acceptable
  }

  const storage = getStorageProvider();
  const now = new Date().toISOString();

  // 3. Clear any active remediation task for the demo entrance
  const activeTask = await storage.remediations.findActiveByEntranceId(requestedEntranceId);
  if (activeTask) {
    activeTask.status = "CANCELLED";
    activeTask.completedAt = now;
    await storage.remediations.save(activeTask);
  }

  // 4. Reset assessment to AVAILABLE
  const resetAssessment: AccessAssessment = {
    id: `assess_reset_${Date.now()}`,
    entranceId: requestedEntranceId,
    state: "AVAILABLE",
    reasonCode: "INITIAL_BASELINE",
    reason: "Demo reset to initial baseline assurance state. Entrance is clear and accessible.",
    evidenceIds: [],
    observationIds: [],
    policyVersion: "1.0.0",
    assessedAt: now,
  };
  await storage.assessments.save(resetAssessment);

  // 5. Append audit event
  const resetAuditEvent: AuditEvent = {
    id: `audit_reset_${Date.now()}`,
    type: "ACCESS_VERIFIED_RESTORED",
    timestamp: now,
    correlationId: `demo_reset_${Date.now()}`,
    entityType: "ENTRANCE",
    entityId: requestedEntranceId,
    metadata: {
      action: "DEMO_RESET",
      targetEntranceId: requestedEntranceId,
      reason: "Demo tenant state reset to baseline AVAILABLE by operator.",
    },
  };
  await storage.auditEvents.append(resetAuditEvent);

  return NextResponse.json({
    success: true,
    message: "Demo tenant successfully reset to baseline AVAILABLE state.",
    state: "AVAILABLE",
    entranceId: requestedEntranceId,
    timestamp: now,
  });
}
