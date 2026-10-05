import React from "react";
import { DetailedVisionObservation } from "@/vision/VisionAnalyzer";
import { Evidence } from "@/evidence/types";
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Eye,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Layers,
} from "lucide-react";

interface EvidenceAnalysisPanelProps {
  latestObservation: DetailedVisionObservation | null;
  latestEvidence: Evidence | null;
  loading?: boolean;
  onRunAnalysis?: () => void;
}

export function EvidenceAnalysisPanel({
  latestObservation,
  latestEvidence,
  loading = false,
  onRunAnalysis,
}: EvidenceAnalysisPanelProps) {
  const isBedrock = latestObservation?.analyzer === "amazon-bedrock";
  const isSimulated = latestObservation?.isSimulated || latestEvidence?.isSimulated || false;
  const isInsufficient = latestObservation?.evidenceQuality === "INSUFFICIENT";

  const getObservationTag = (val: "TRUE" | "FALSE" | "UNKNOWN" | undefined, positiveMeaning: "TRUE" | "FALSE") => {
    if (!val || val === "UNKNOWN") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-400 border border-slate-700">
          <HelpCircle className="h-3 w-3" />
          UNKNOWN
        </span>
      );
    }

    const isGood = val === positiveMeaning;
    if (isGood) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          {val === "TRUE" ? "CLEAR / READY" : "ABSENT"}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/40">
        <AlertTriangle className="h-3 w-3 text-rose-400" />
        {val === "TRUE" ? "PRESENT (BLOCKED)" : "NOT CLEAR"}
      </span>
    );
  };

  return (
    <section
      aria-labelledby="evidence-analysis-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-gradient-to-tr from-purple-600 to-sky-500 p-2 text-white shadow-md">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                AWS Builder Integration
              </span>
              <span className="rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 text-[10px] font-mono text-purple-300">
                Bedrock Multimodal
              </span>
            </div>
            <h2 id="evidence-analysis-heading" className="text-base font-bold text-white">
              Multimodal Evidence Analysis
            </h2>
          </div>
        </div>

        {onRunAnalysis && (
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Run Bedrock Inference
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {latestObservation ? (
          <>
            {/* Provenance & Analyzer Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/70 p-3 border border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-medium">Analyzer:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-[11px] border ${
                    isBedrock
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {isBedrock ? (
                    <>
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      Amazon Bedrock ({latestObservation.modelId || "nova-lite"})
                    </>
                  ) : (
                    <>
                      <Layers className="h-3 w-3 text-sky-400" />
                      Simulator Vision Engine
                    </>
                  )}
                </span>

                {latestObservation.modelRegion && (
                  <span className="text-slate-500 font-mono text-[10px]">
                    region: {latestObservation.modelRegion}
                  </span>
                )}
              </div>

              <div>
                {isSimulated ? (
                  <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    SIMULATED LOCAL EVIDENCE
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                    OFFICIAL RING EVIDENCE
                  </span>
                )}
              </div>
            </div>

            {/* Quality & Observation Headline */}
            {isInsufficient ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <strong className="text-xs font-bold uppercase tracking-wider">
                    EVIDENCE QUALITY INSUFFICIENT
                  </strong>
                </div>
                <p className="text-xs text-amber-200">
                  {latestObservation.explanation ||
                    "Accessible pathway is not clearly visible in camera field of view. OpenWay cannot safely assess conditions from this evidence."}
                </p>
                <div className="pt-1 text-[11px] text-slate-400 border-t border-amber-500/20">
                  <strong>Safe Decision:</strong> State remains governed by deterministic policy (UNKNOWN).
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 block">Pathway Condition</span>
                  <div>{getObservationTag(latestObservation.pathwayClear, "TRUE")}</div>
                </div>

                <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 block">Obstruction Check</span>
                  <div>{getObservationTag(latestObservation.obstructionPresent, "FALSE")}</div>
                </div>

                <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 block">Door Push/Swing Ready</span>
                  <div>{getObservationTag(latestObservation.doorReady, "TRUE")}</div>
                </div>
              </div>
            )}

            {/* Features & Explanation */}
            <div className="rounded-xl bg-slate-950/40 p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400 font-medium">Observed Features:</span>
                <span className="text-[11px] text-slate-500">
                  Confidence Score: <strong className="text-slate-300 font-mono">{(latestObservation.confidence * 100).toFixed(0)}%</strong> (Informational)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {latestObservation.observedFeatures && latestObservation.observedFeatures.length > 0 ? (
                  latestObservation.observedFeatures.map((feat, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300"
                    >
                      {feat}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">No specific physical features extracted</span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 block font-medium mb-0.5">Observation Summary:</span>
                <p className="text-slate-300 italic">{latestObservation.explanation}</p>
              </div>
            </div>

            {/* Architectural Rule Callout */}
            <p className="text-[11px] text-slate-500 text-center">
              <strong>Rule 2 &amp; Rule 3:</strong> Bedrock supplies structured observations. Deterministic policy and fresh post-remediation evidence govern state restoration.
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
            <Eye className="h-6 w-6 mx-auto text-slate-600 mb-2" />
            <span className="block font-medium text-slate-300">No Multimodal Observation Run Yet</span>
            <p className="mt-1 max-w-sm mx-auto text-slate-500 text-[11px]">
              Select an entrance and trigger Bedrock vision analysis or execute a simulator scenario to inspect camera evidence.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
