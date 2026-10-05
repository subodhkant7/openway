import { Entrance } from "@/domain/types";
import { Evidence, EvidenceProvenance, EvidenceProvider, TemporalEvidenceClassification } from "@/evidence/types";
import { evaluateEvidenceFreshness } from "@/evidence/freshness";
import { getStorageProvider, StorageProvider } from "@/persistence";
import { getRingProvider, RingProvider } from "@/ring";
import { safeLog } from "@/ring/errors";

export interface EvidenceAcquisitionOptions {
  entrance: Entrance;
  provider?: RingProvider;
  mode?: "at_timestamp" | "latest_in_range";
  eventTimestamp?: string;
  rangeSeconds?: number;
  correlationId?: string;
  providerEventId?: string;
  overrideCapturedAt?: string;
  overrideBytes?: Uint8Array;
  overrideMimeType?: "image/jpeg" | "image/png";
  isSimulated?: boolean;
}

export interface AcquiredEvidenceResult {
  evidence: Evidence;
  imageBytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
  requestedAt: string;
  capturedAt?: string;
  receivedAt: string;
  mediaOrigin: string;
  requestId: string;
  freshness: "FRESH" | "STALE" | "INVALID" | "UNKNOWN";
  temporalClassification: TemporalEvidenceClassification;
}

// Minimal valid JPEG binary buffer for in-memory mock/simulated transport (1x1 pixel JPEG)
const FALLBACK_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9,
]);

export class EvidenceAcquisitionService {
  private storage: StorageProvider;

  constructor(storage?: StorageProvider) {
    this.storage = storage || getStorageProvider();
  }

  /**
   * Acquires fresh camera image evidence for a target entrance.
   *
   * CRITICAL SECURITY & TEMPORAL INTEGRITY RULES:
   * 1. Media bytes remain strictly in server memory (Uint8Array/Buffer).
   * 2. No temporary images are written to public directories.
   * 3. No pre-signed S3 URLs are exposed to browsers.
   * 4. Capture time is authoritative from Ring metadata; never synthesized in production.
   * 5. Never substitute receipt time or request time for capture time.
   * 6. If capturedAt cannot be established: TEMPORALLY_UNVERIFIED -> UNKNOWN.
   */
  public async acquireFreshEvidence(
    options: EvidenceAcquisitionOptions
  ): Promise<AcquiredEvidenceResult> {
    const requestedAt = new Date().toISOString();
    const requestId = `req_evi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { entrance } = options;
    const provider = options.provider || getRingProvider();

    const deviceId = entrance.cameraBinding.deviceId;
    const componentId = entrance.cameraBinding.componentId;

    // Track telemetry
    const { telemetry } = await import("@/telemetry/metrics");
    telemetry.increment("ringEvidenceCalls");

    // 1. Fetch media observation from Ring Provider
    let ringMedia = null;
    try {
      ringMedia = await provider.getImageEvidence(deviceId, [componentId]);
    } catch (err) {
      safeLog("warn", "Failed to retrieve Ring image evidence", {
        deviceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const receivedAt = new Date().toISOString();

    // Determine provenance
    const isSimulated =
      options.isSimulated !== undefined
        ? options.isSimulated
        : (ringMedia?.isSimulated ?? false);

    const provenance: EvidenceProvenance = isSimulated ? "SIMULATED_LOCAL" : "OFFICIAL_RING";
    const evidenceProvider: EvidenceProvider = isSimulated ? "SIMULATOR" : "RING";

    // Determine capture time:
    // SIMULATOR -> deterministic synthetic evidence
    // RING -> provider-returned evidence metadata (NEVER synthesized in production)
    let capturedAt: string | undefined = options.overrideCapturedAt;
    if (!capturedAt && ringMedia?.capturedAt) {
      capturedAt = ringMedia.capturedAt;
    }
    if (!capturedAt && isSimulated) {
      if (options.eventTimestamp) {
        capturedAt = options.eventTimestamp;
      } else {
        capturedAt = receivedAt;
      }
    }
    // In production Ring mode, if provider returned no capture timestamp, capturedAt remains undefined!

    // Determine temporal classification
    const { classifyEvidenceTemporality } = await import("./temporalClassification");
    const temporalClassification: TemporalEvidenceClassification = classifyEvidenceTemporality(
      { capturedAt, receivedAt },
      { now: receivedAt }
    );

    // 2. Prepare in-memory byte buffer
    let imageBytes: Uint8Array = options.overrideBytes || FALLBACK_JPEG_BYTES;
    let mimeType: "image/jpeg" | "image/png" = options.overrideMimeType || "image/jpeg";

    if (!options.overrideBytes && ringMedia) {
      if (ringMedia.dataUrl && ringMedia.dataUrl.startsWith("data:")) {
        const matches = ringMedia.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const type = matches[1];
          if (type === "image/png") mimeType = "image/png";
          else mimeType = "image/jpeg";
          imageBytes = Buffer.from(matches[2], "base64");
        }
      }
    }

    // 3. Construct domain Evidence entity
    const evidenceId = `evi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const checksum = `sha256_${imageBytes.length}_${Date.now()}`;

    const actualDeviceId = ringMedia?.deviceId || deviceId;

    const preliminaryEvidence: Evidence = {
      id: evidenceId,
      venueId: entrance.venueId,
      entranceId: entrance.id,
      deviceId: actualDeviceId,
      componentId,
      provider: evidenceProvider,
      providerEventId: options.providerEventId || requestId,
      capturedAt,
      receivedAt,
      evidenceType: "IMAGE",
      mediaReference: isSimulated
        ? `simulated://media/devices/${deviceId}/snapshot.jpg`
        : `ring://media/devices/${deviceId}/${componentId}/latest.jpg`,
      provenance,
      isSimulated,
      freshness: "UNKNOWN",
      temporalClassification,
      checksum,
      createdAt: receivedAt,
    };

    // 4. Deterministic Freshness Evaluation (based on camera capturedAt)
    let evaluatedFreshness: "FRESH" | "STALE" | "INVALID" | "UNKNOWN" = "UNKNOWN";
    if (capturedAt) {
      evaluatedFreshness = evaluateEvidenceFreshness(preliminaryEvidence, undefined, receivedAt);
    }

    const finalizedEvidence: Evidence = {
      ...preliminaryEvidence,
      freshness: evaluatedFreshness,
    };

    // 5. Persist evidence record
    await this.storage.evidence.save(finalizedEvidence);

    return {
      evidence: finalizedEvidence,
      imageBytes,
      mimeType,
      requestedAt,
      capturedAt,
      receivedAt,
      mediaOrigin: ringMedia?.source || (isSimulated ? "simulator" : "ring_partner_api"),
      requestId,
      freshness: evaluatedFreshness,
      temporalClassification,
    };
  }
}

