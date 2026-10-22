import React from "react";
import Link from "next/link";
import { RingProviderStatus } from "@/ring/types";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Server,
  Zap,
  ExternalLink,
} from "lucide-react";

interface RingConnectionCardProps {
  status: RingProviderStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onModeChange: (mode: "simulator" | "playground" | "api") => void;
  activeMode: string;
}

export function RingConnectionCard({
  status,
  loading,
  onRefresh,
  onModeChange,
  activeMode,
}: RingConnectionCardProps) {
  const state = status?.state ?? "NOT_CONFIGURED";
  const isLiveConnected = (status?.mode === "api" || status?.mode === "playground") && state === "CONNECTED";
  const isSimulatorActive = status?.mode === "simulator" || state === "SIMULATED";

  const getStatusBadge = () => {
    if (isLiveConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          CONNECTED (REAL RING)
        </span>
      );
    }
    if (isSimulatorActive) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/40">
          <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          SIMULATED
        </span>
      );
    }
    if (state === "ERROR") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ERROR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/40 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-600/50">
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        NOT CONFIGURED
      </span>
    );
  };

  return (
    <section
      aria-labelledby="ring-connection-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Hardware Provider Layer
          </span>
          <h2 id="ring-connection-heading" className="text-lg font-bold text-white flex items-center gap-2">
            Ring Connection
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh Ring connection status"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
            <span>Verify</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
          <span className="text-slate-400 font-medium block">Active Mode</span>
          <span className="mt-1 font-semibold text-slate-100 flex items-center gap-1.5 capitalize">
            <Server className="h-3.5 w-3.5 text-sky-400" />
            {status?.mode === "playground"
              ? "Ring Playground (Access Token)"
              : status?.mode === "api"
              ? "Ring Partner API (Production)"
              : "Deterministic Simulator"}
          </span>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
          <span className="text-slate-400 font-medium block">Endpoint / Gateway</span>
          <span className="mt-1 font-mono text-slate-300 truncate block" title={status?.baseUrl}>
            {status?.baseUrl || "Not configured"}
          </span>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/60">
          <span className="text-slate-400 font-medium block">Active Online Devices</span>
          <span className="mt-1 font-semibold text-emerald-400">
            {status?.activeDeviceCount ?? 0} online
          </span>
        </div>
      </div>

      {status?.details && (
        <div className="mt-3 rounded-lg bg-slate-800/40 px-3 py-2 text-xs text-slate-300 border border-slate-800">
          <span className="font-medium text-slate-400">Diagnostic Details: </span>
          {status.details}
        </div>
      )}

      {status?.error && (
        <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <strong className="font-semibold">Provider Communication Issue:</strong> {status.error}
          </div>
        </div>
      )}

      {/* Mode Switcher for operator testing */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400">Switch Provider Boundary:</span>
        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
          {(["simulator", "playground", "api"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeMode === mode
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode === "simulator"
                ? "Simulator"
                : mode === "playground"
                ? "Playground"
                : "Partner API"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Ring account not connected? See the One-Way linking guide.</span>
        <Link
          href="/ring/config"
          className="text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
        >
          <span>Ring Config &amp; Guide</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
