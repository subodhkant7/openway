import React from "react";
import { AssuranceState, RemediationTask, AccessibilityRequirements, Entrance } from "@/domain/types";
import {
  ShieldCheck,
  AlertCircle,
  Clock,
  Link2,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Check,
} from "lucide-react";

interface EntranceAssuranceCardProps {
  entrance: Entrance | null;
  assuranceStatus: AssuranceState | "UNCONFIGURED";
  activeRemediation: RemediationTask | null;
  requirements: AccessibilityRequirements;
  onAcknowledgeTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onRunVerificationCheck?: () => void;
}

export function EntranceAssuranceCard({
  entrance,
  assuranceStatus,
  activeRemediation,
  requirements,
  onAcknowledgeTask,
  onCompleteTask,
  onRunVerificationCheck,
}: EntranceAssuranceCardProps) {
  const getAssuranceBadge = () => {
    switch (assuranceStatus) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ACCESS AVAILABLE
          </span>
        );
      case "VERIFIED_RESTORED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/50">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            VERIFIED RESTORED
          </span>
        );
      case "INTERRUPTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            ACCESS INTERRUPTED
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/40">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            ACTION REQUIRED
          </span>
        );
      case "RECHECKING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-500/40">
            <RefreshCw className="h-3.5 w-3.5 text-sky-400 animate-spin" aria-hidden="true" />
            RECHECKING (PENDING EVIDENCE)
          </span>
        );
      case "UNKNOWN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            ASSESSMENT UNKNOWN
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
            Accessibility Assurance Domain
          </span>
          <h2 id="entrance-assurance-heading" className="text-lg font-bold text-white flex items-center gap-2">
            Selected Entrance Assurance
          </h2>
        </div>
        <div>{getAssuranceBadge()}</div>
      </div>

      <div className="mt-4 space-y-4">
        {entrance ? (
          <>
            {/* Entrance & Camera Binding Details */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Entrance Name</span>
                <span className="text-base font-semibold text-white mt-0.5 block">
                  {entrance.name}
                </span>
                <span className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-sky-400" />
                  Bound Ring Camera:{" "}
                  <span className="text-sky-300 font-mono">
                    {entrance.cameraBinding.deviceName || entrance.cameraBinding.deviceId}
                  </span>{" "}
                  <span className="text-slate-500 font-mono text-[11px]">
                    (comp: {entrance.cameraBinding.componentId})
                  </span>
                </span>
              </div>

              {/* Typed Requirements Badges */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border ${
                    requirements.pathwayClear
                      ? "bg-slate-800 text-slate-200 border-slate-700"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  <Check className="h-3 w-3 text-sky-400" />
                  Pathway Clear
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border ${
                    requirements.obstructionFree
                      ? "bg-slate-800 text-slate-200 border-slate-700"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  <Check className="h-3 w-3 text-sky-400" />
                  Obstruction Free
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border ${
                    requirements.doorReady
                      ? "bg-slate-800 text-slate-200 border-slate-700"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  <Check className="h-3 w-3 text-sky-400" />
                  Door Ready
                </span>
              </div>
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
                <strong>Scope Boundary:</strong> Verifies configured, camera-observable access conditions at this specific entrance. Does not certify building-wide code or general legal compliance.
              </p>
            </div>

            {/* Active Remediation Task Card */}
            {activeRemediation && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Active Remediation Task ({activeRemediation.status})
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    ID: {activeRemediation.id}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-200">
                  {activeRemediation.reason}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-500/20">
                  <div className="text-[11px] text-slate-400">
                    {assuranceStatus === "RECHECKING" ? (
                      <span className="text-sky-300 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-sky-400" />
                        Remediation reported. Awaiting fresh Ring camera verification.
                      </span>
                    ) : (
                      <span>Action required: Clear physical access pathway</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRemediation.status === "OPEN" && onAcknowledgeTask && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeTask(activeRemediation.id)}
                        className="rounded-lg bg-sky-600/30 border border-sky-500/40 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-600/50 transition flex items-center gap-1.5"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Acknowledge Task
                      </button>
                    )}

                    {activeRemediation.status !== "COMPLETED" && onCompleteTask && (
                      <button
                        type="button"
                        onClick={() => onCompleteTask(activeRemediation.id)}
                        className="rounded-lg bg-amber-600/30 border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-600/50 transition flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Report Fixed (Initiates Rechecking)
                      </button>
                    )}

                    {assuranceStatus === "RECHECKING" && onRunVerificationCheck && (
                      <button
                        type="button"
                        onClick={onRunVerificationCheck}
                        className="rounded-lg bg-emerald-600/30 border border-emerald-500/50 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/50 transition flex items-center gap-1.5"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Evaluate Verification Gate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center">
            <span className="text-sm font-medium text-slate-300 block">
              [No Entrance Selected]
            </span>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              Please select a configured entrance to view real-time accessibility assurance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
