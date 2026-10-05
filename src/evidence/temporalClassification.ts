import { Evidence, TemporalEvidenceClassification } from "./types";

export interface TemporalClassificationOptions {
  remediationCompletedAt?: string;
  now?: string | Date;
  maxAgeSeconds?: number;
}

/**
 * Deterministically classifies the temporal validity of evidence.
 *
 * THREE DISTINCT TEMPORAL CONCEPTS:
 * 1. EVENT TIME: When Ring says something happened.
 * 2. CAPTURE TIME: When the media evidence was actually captured on the camera.
 * 3. RECEIPT TIME: When OpenWay obtained the evidence over HTTP.
 *
 * ABSOLUTE INVARIANTS:
 * - Never substitute receipt time for capture time.
 * - Never substitute request time for capture time.
 * - Never assume requestAt > remediation.completedAt means capturedAt > remediation.completedAt.
 * - If capturedAt cannot be established: TEMPORALLY_UNVERIFIED -> UNKNOWN.
 * - capturedAt >= remediation.completedAt is strictly required for post-remediation verification.
 */
export function classifyEvidenceTemporality(
  evidence: Pick<Evidence, "capturedAt" | "receivedAt"> | { capturedAt?: string; receivedAt?: string },
  options: TemporalClassificationOptions = {}
): TemporalEvidenceClassification {
  if (!evidence.capturedAt || typeof evidence.capturedAt !== "string" || evidence.capturedAt.trim() === "") {
    return "TEMPORALLY_UNVERIFIED";
  }

  const captureTime = new Date(evidence.capturedAt).getTime();
  if (isNaN(captureTime)) {
    return "TEMPORALLY_UNVERIFIED";
  }

  const nowMs = options.now
    ? typeof options.now === "string"
      ? new Date(options.now).getTime()
      : options.now.getTime()
    : Date.now();

  // Tolerance of 5 seconds for slight clock skew between Ring hardware and server
  if (captureTime > nowMs + 5000) {
    return "INVALID";
  }

  const maxAgeMs = (options.maxAgeSeconds ?? 180) * 1000;
  if (nowMs - captureTime > maxAgeMs) {
    return "STALE";
  }

  if (options.remediationCompletedAt) {
    const remediationMs = new Date(options.remediationCompletedAt).getTime();
    if (isNaN(remediationMs)) {
      return "TEMPORALLY_UNVERIFIED";
    }

    if (captureTime < remediationMs) {
      return "PRE_REMEDIATION";
    }

    return "POST_REMEDIATION";
  }

  return "POST_REMEDIATION";
}
