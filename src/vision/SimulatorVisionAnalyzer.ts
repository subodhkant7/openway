import { VisionAnalyzer, VisionAnalysisInput, DetailedVisionObservation } from "./VisionAnalyzer";
import { ObservationValue } from "@/evidence/types";

export type SimulatorVisionMode = "CLEAR" | "BLOCKED" | "UNCERTAIN" | "CONTRADICTORY";

export class SimulatorVisionAnalyzer implements VisionAnalyzer {
  public readonly analyzerName = "simulator";
  public readonly analyzerVersion = "1.0.0";

  private defaultMode: SimulatorVisionMode;

  constructor(defaultMode: SimulatorVisionMode = "CLEAR") {
    this.defaultMode = defaultMode;
  }

  public setMode(mode: SimulatorVisionMode): void {
    this.defaultMode = mode;
  }

  /**
   * Deterministic simulated vision analysis adhering to the exact same contract as Bedrock.
   */
  public async analyzeImage(input: VisionAnalysisInput): Promise<DetailedVisionObservation> {
    const startTime = Date.now();
    const observedAt = new Date().toISOString();

    // Determine simulation mode from input clues or current mode
    let mode: SimulatorVisionMode = this.defaultMode;
    const evId = input.evidence.id.toLowerCase();
    const desc = (input.entranceName || "").toLowerCase();

    if (evId.includes("obstr") || evId.includes("block") || desc.includes("obstr")) {
      mode = "BLOCKED";
    } else if (evId.includes("uncert") || evId.includes("stale") || evId.includes("dark")) {
      mode = "UNCERTAIN";
    } else if (evId.includes("contra")) {
      mode = "CONTRADICTORY";
    }

    let pathwayClear: ObservationValue = "TRUE";
    let obstructionPresent: ObservationValue = "FALSE";
    let doorReady: ObservationValue = "TRUE";
    let confidence = 0.98;
    let evidenceQuality: "SUFFICIENT" | "INSUFFICIENT" = "SUFFICIENT";
    let observedFeatures: string[] = ["accessible ramp", "concrete path", "entrance doorway"];
    let explanation = "Simulated vision: physical access pathway is clear and accessible.";

    switch (mode) {
      case "BLOCKED":
        pathwayClear = "FALSE";
        obstructionPresent = "TRUE";
        doorReady = "TRUE";
        confidence = 0.96;
        evidenceQuality = "SUFFICIENT";
        observedFeatures = ["cardboard delivery box", "accessible ramp surface", "ramp handrail"];
        explanation = "Simulated vision: Delivery boxes detected directly on the access ramp pathway.";
        break;

      case "UNCERTAIN":
        pathwayClear = "UNKNOWN";
        obstructionPresent = "UNKNOWN";
        doorReady = "UNKNOWN";
        confidence = 0.35;
        evidenceQuality = "INSUFFICIENT";
        observedFeatures = ["low light environment", "obscured lens"];
        explanation = "Simulated vision: Lighting is insufficient to reliably observe entrance conditions.";
        break;

      case "CONTRADICTORY":
        // Generates an uncertain observation flagged as contradictory
        pathwayClear = "UNKNOWN";
        obstructionPresent = "TRUE";
        doorReady = "UNKNOWN";
        confidence = 0.6;
        evidenceQuality = "SUFFICIENT";
        observedFeatures = ["partial obstruction suspected"];
        explanation = "Simulated vision: Conflicting environmental visual indicators detected.";
        break;

      case "CLEAR":
      default:
        pathwayClear = "TRUE";
        obstructionPresent = "FALSE";
        doorReady = "TRUE";
        confidence = 0.98;
        evidenceQuality = "SUFFICIENT";
        observedFeatures = ["clear ramp", "accessible threshold", "push plate visible"];
        explanation = "Simulated vision: Pathway is verified completely clear of obstacles.";
        break;
    }

    const totalMs = Date.now() - startTime;

    return {
      id: `obs_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      evidenceId: input.evidence.id,
      entranceId: input.evidence.entranceId,
      pathwayClear,
      obstructionPresent,
      doorReady,
      confidence,
      evidenceQuality,
      observedFeatures,
      observedAt,
      analyzer: this.analyzerName,
      analyzerVersion: this.analyzerVersion,
      modelId: "simulator-vision-engine",
      modelRegion: "local",
      isSimulated: true, // Always true for simulator
      explanation,
      timingMs: {
        totalMs,
        inferenceMs: 15,
      },
    };
  }
}
