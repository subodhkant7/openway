"use client";

import React from "react";
import { RingProviderStatus } from "@/ring/types";
import { Server, Brain, Database, RefreshCw, Zap, ShieldCheck } from "lucide-react";

interface ServiceStatusStripProps {
  ringStatus: RingProviderStatus | null;
  activeMode: string;
  onOpenRingModal: () => void;
  onOpenVisionModal: () => void;
  onResetDemo: () => void;
  resetLoading?: boolean;
}

export function ServiceStatusStrip({
  ringStatus,
  activeMode,
  onOpenRingModal,
  onOpenVisionModal,
  onResetDemo,
  resetLoading = false,
}: ServiceStatusStripProps) {
  const isRingLive = activeMode === "api" && ringStatus?.state === "CONNECTED";
  const isRingPlayground = activeMode === "playground";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/60 px-4 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Ring Provider Status */}
        <button
          type="button"
          onClick={onOpenRingModal}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-slate-800/60 transition group text-left"
          title="Click to view full Ring hardware telemetry"
        >
          <span className="flex h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-slate-400">Ring:</span>
          <span className="font-mono font-bold text-amber-300 group-hover:underline">
            {isRingLive
              ? "OFFICIAL RING API"
              : isRingPlayground
              ? "PLAYGROUND"
              : "SIMULATOR (Deterministic)"}
          </span>
        </button>

        <span className="text-slate-700 hidden sm:inline">&bull;</span>

        {/* Vision Inference Engine Status */}
        <button
          type="button"
          onClick={onOpenVisionModal}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-slate-800/60 transition group text-left"
          title="Click to inspect Amazon Bedrock multimodal analyzer"
        >
          <span className="flex h-2 w-2 rounded-full bg-purple-400" />
          <span className="text-slate-400">Vision:</span>
          <span className="font-mono font-bold text-purple-300 group-hover:underline">
            SIMULATED / FALLBACK (Bedrock unavailable)
          </span>
        </button>

        <span className="text-slate-700 hidden sm:inline">&bull;</span>

        {/* Persistence Provider Status */}
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Persistence:</span>
          <span className="font-mono font-bold text-emerald-300">
            DYNAMODB (Operational)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 font-mono text-[10px] text-sky-300 hidden md:inline">
          PROVENANCE: SIMULATED_LOCAL
        </span>
        <button
          type="button"
          disabled={resetLoading}
          onClick={onResetDemo}
          className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition disabled:opacity-50"
          title="Reset demo entrance back to clean AVAILABLE baseline"
        >
          <RefreshCw className={`h-3 w-3 ${resetLoading ? "animate-spin text-sky-400" : "text-slate-400"}`} />
          <span>Reset Demo</span>
        </button>
      </div>
    </div>
  );
}
