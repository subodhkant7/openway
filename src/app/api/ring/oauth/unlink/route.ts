import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/persistence";
import { RingAccountLinkingService } from "@/ring/accountLinking";
import { DEMO_IDS } from "@/persistence/bootstrap";
import { validateTenantAccess } from "@/lib/tenantAuth";
import { safeLog } from "@/ring/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const venueId = body.venueId || DEMO_IDS.VENUE_ID;
    const userId = body.userId || `operator_${venueId}`;

    const authCheck = validateTenantAccess({ venueId });
    if (!authCheck.allowed) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: authCheck.error },
        { status: 403 }
      );
    }

    const storage = getStorageProvider();
    const service = new RingAccountLinkingService(storage);

    const unlinked = await service.unlinkAccount(userId);

    safeLog("info", `Ring account unlinked for tenant ${venueId} / user ${userId}`);

    return NextResponse.json(
      {
        success: true,
        unlinked,
        status: "ACCOUNT_RELINK_REQUIRED",
        message:
          "Local credentials safely purged from OpenWay. To revoke Ring authorization and token issuance, manage or remove OpenWay in your Ring Account Integrations page.",
        ringManageUrl: "https://account.ring.com/account/integrations",
        localPurged: true,
        remoteRevocationRequired: true,
        ringRevocationNotice:
          "OpenWay uses One-Way account linking. You must remove OpenWay from Ring Account Integrations to revoke remote Ring authorization.",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to unlink Ring account.",
      },
      { status: 500 }
    );
  }
}
