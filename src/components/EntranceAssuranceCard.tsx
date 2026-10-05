import React from "react";
import { RingDevice } from "@/ring/types";
import { ShieldCheck, AlertCircle, Clock, Link2, CheckCircle2 } from "lucide-react";

interface EntranceAssuranceCardProps {
  selectedDevice: RingDevice | null;
  devices: RingDevice[];
  onSelectDevice: (device: RingDevice | null) => void;
  assuranceStatus: "ASSURED" | "INTERRUPTED" | "PENDING_VERIFICATION" | "UNCONFIGURED";
  onTriggerInterruption?: () => void;
  onResolveWithEvidence?: () => void;
}

export function EntranceAssuranceCard({
  selectedDevice,
  devices,
  onSelectDevice,
  assuranceStatus,
  onTriggerInterruption,
  onResolveWithEvidence,
}: EntranceAssuranceCardProps) {
  const getAssuranceBadge = () => {
    switch (assuranceStatus) {
      case "ASSURED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ACCESS ASSURED &amp; VERIFIED
          </span>
        );
      case "INTERRUPTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            ACCESS INTERRUPTED — REMEDIATION NEEDED
          </span>
        );
      case "PENDING_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30">
            <Clock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            PENDING FRESH PHYSICAL EVIDENCE
          </span>
        );
      case "UNCONFIGURED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400 border border-slate-700">
            [not configured yet]
          </span>
        );
    }
  };

  return (
    <section
      aria-labelledby="entrance-assurance-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
            Assurance Domain Layer
          </span>
          <h2 id="entrance-assurance-heading" className="text-lg font-bold text-white flex items-center gap-2">
            Selected Entrance
          </h2>
        </div>
        <div>{getAssuranceBadge()}</div>
      </div>

      <div className="mt-4">
        {selectedDevice ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Configured Entrance Name</span>
                <span className="text-base font-semibold text-white mt-0.5 block">
                  {selectedDevice.name}
                </span>
                <span className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-sky-400" />
                  Observable via Ring device: <span className="text-sky-300">{selectedDevice.name}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectDevice(null)}
                className="text-xs text-slate-400 hover:text-slate-200 underline focus:ring-1 focus:ring-sky-400"
              >
                Change entrance binding
              </button>
            </div>

            {/* Core Principle Callout */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 text-xs text-slate-300">
              <strong className="text-emerald-400 block font-semibold mb-1">
                Core Assurance Principle:
              </strong>
              <blockquote className="italic text-slate-400">
                &ldquo;An alert is not a resolution. A resolution is not verified until new evidence
                proves the physical state changed.&rdquo;
              </blockquote>
              <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-800/80 pt-1.5">
                <strong>Scope:</strong> Verifies configured, camera-observable access conditions at this specific entrance. Does not certify building-wide code or legal compliance.
              </p>
            </div>

            {/* Interactive demonstration actions for operator */}
            <div className="flex flex-wrap gap-2 pt-1">
              {assuranceStatus === "ASSURED" && onTriggerInterruption && (
                <button
                  type="button"
                  onClick={onTriggerInterruption}
                  className="rounded-lg bg-rose-600/20 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition"
                >
                  Simulate Ramp Obstruction (Interruption)
                </button>
              )}
              {(assuranceStatus === "INTERRUPTED" || assuranceStatus === "PENDING_VERIFICATION") &&
                onResolveWithEvidence && (
                  <button
                    type="button"
                    onClick={onResolveWithEvidence}
                    className="rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify Restored with Fresh Ring Evidence
                  </button>
                )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center">
            <span className="text-sm font-medium text-slate-300 block">
              [not configured yet]
            </span>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              Select an observable Ring camera below to bind and monitor real-time accessibility conditions for this entrance.
            </p>
            {devices.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {devices.map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => onSelectDevice(dev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Bind &quot;{dev.name}&quot;
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
