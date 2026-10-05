import { AccessibilityRequirements } from "@/domain/types";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { VisionAnalysisOutput } from "./schemas";

export interface VisionAnalysisInput {
  evidence: Evidence;
  imageBytes: Uint8Array | Buffer;
  mimeType: "image/jpeg" | "image/png";
  requirements: AccessibilityRequirements;
  entranceName?: string;
  correlationId?: string;
}

export interface DetailedVisionObservation extends AccessibilityObservation {
  evidenceQuality: "SUFFICIENT" | "INSUFFICIENT";
  observedFeatures: string[];
  modelId?: string;
  modelRegion?: string;
  isSimulated: boolean;
  timingMs?: {
    totalMs: number;
    inferenceMs?: number;
  };
}

/**
 * Provider-neutral interface for vision analysis.
 * Preserves the boundary: Ring != Vision != Policy.
 */
export interface VisionAnalyzer {
  readonly analyzerName: string;
  readonly analyzerVersion: string;

  /**
   * Analyzes camera image evidence and returns a validated, structured observation.
   * Never modifies or determines OpenWay state directly.
   */
  analyzeImage(input: VisionAnalysisInput): Promise<DetailedVisionObservation>;
}
