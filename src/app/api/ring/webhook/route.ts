import { NextRequest, NextResponse } from "next/server";
import { RingWebhookHandler } from "@/ring/webhook";
import { RingProviderError, safeLog } from "@/ring/errors";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-signature") ||
      request.headers.get("X-Signature") ||
      request.headers.get("x-amazon-signature");

    // Process webhook: verify signature, validate shape, check idempotency, and normalize
    const result = RingWebhookHandler.processWebhook(rawBody, signatureHeader);

    // Return immediate 200/202 confirmation
    return NextResponse.json(
      {
        received: true,
        status: result.status,
        eventId: result.eventId,
        message: result.message,
      },
      { status: result.status === "accepted" ? 200 : 202 }
    );
  } catch (err: unknown) {
    if (err instanceof RingProviderError) {
      safeLog("warn", `Ring webhook processing failed: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
      });

      return NextResponse.json(
        {
          received: false,
          error: err.code,
          message: err.message,
        },
        { status: err.statusCode || 400 }
      );
    }

    safeLog("error", "Unexpected error in Ring webhook endpoint", {
      error: err instanceof Error ? err.message : "Unknown",
    });

    return NextResponse.json(
      {
        received: false,
        error: "INTERNAL_ERROR",
        message: "Error processing webhook",
      },
      { status: 500 }
    );
  }
}
