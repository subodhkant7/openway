import React from "react";
import {
  AssuranceState,
  RemediationTask,
  AccessibilityRequirements,
  Entrance,
  AccessAssessment,
} from "@/domain/types";
import { Evidence } from "@/evidence/types";
import { DetailedVisionObservation } from "@/vision/VisionAnalyzer";
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
  XCircle,
} from "lucide-react";

interface EntranceAssuranceCardProps {
  entrance: Entrance | null;
  assuranceStatus: AssuranceState | "UNCONFIGURED";
  activeRemediation: RemediationTask | null;
  requirements: AccessibilityRequirements;
  latestAssessment?: AccessAssessment | null;
  latestEvidence?: Evidence | null;
  latestObservation?: DetailedVisionObservation | null;
  onAcknowledgeTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onRunVerificationCheck?: () => void;
}

function formatTime(isoString?: string): string {
  if (!isoString) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

export function EntranceAssuranceCard({
  entrance,
  assuranceStatus,
  activeRemediation,
  requirements,
  latestAssessment,
  latestEvidence,
  latestObservation,
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
            ACCESS RESTORED — VERIFIED
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
            RECHECKING (REQUESTING FRESH EVIDENCE)
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
            Phase 4 Assurance Workflow Console
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
                Core Assurance Invariant:
              </strong>
              <blockquote className="italic text-slate-400">
                &ldquo;Detected &ne; resolved. Resolved &ne; verified. VERIFIED_RESTORED strictly requires fresh camera evidence captured after remediation completion.&rdquo;
              </blockquote>
            </div>

            {/* Workflow State Presentation: Interrupted / Action Required */}
            {(assuranceStatus === "INTERRUPTED" || assuranceStatus === "ACTION_REQUIRED") && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                    ACCESS INTERRUPTION DETECTED
                  </span>
                  <span className="text-xs text-slate-400">
                    Detected: <strong className="text-slate-200">{formatTime(latestAssessment?.assessedAt || activeRemediation?.createdAt)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Trigger Evidence:</span>
                    <strong className="text-sky-300 font-mono">
                      {latestEvidence?.provenance === "OFFICIAL_RING" ? "OFFICIAL RING" : "SIMULATED RING"}
                    </strong>{" "}
                    <span className="text-slate-500 font-mono text-[10px]">({latestEvidence?.id || "camera trigger"})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Observed Issue:</span>
                    <span className="text-rose-200 font-medium">
                      {activeRemediation?.reason || latestObservation?.explanation || "Configured access pathway appears obstructed."}
                    </span>
                  </div>
                </div>

                {activeRemediation && (
                  <div className="rounded-lg bg-slate-900/90 border border-amber-500/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Remediation Task ({activeRemediation.status})
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">ID: {activeRemediation.id}</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      <strong>Required Action:</strong> Clear the configured physical access pathway.
                    </div>
                    <div className="text-[11px] text-slate-400">
                      <strong>Verification:</strong> Awaiting remediation completion by staff.
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      {activeRemediation.status === "OPEN" && onAcknowledgeTask && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeTask(activeRemediation.id)}
                          className="rounded-lg bg-sky-600/30 border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-600/50 transition flex items-center gap-1.5"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Acknowledge
                        </button>
                      )}

                      {activeRemediation.status !== "COMPLETED" && onCompleteTask && (
                        <button
                          type="button"
                          onClick={() => onCompleteTask(activeRemediation.id)}
                          className="rounded-lg bg-amber-600/30 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-600/50 transition flex items-center gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Report Fixed (Request Fresh Evidence)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workflow State Presentation: Rechecking */}
            {assuranceStatus === "RECHECKING" && (
              <div className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />
                    REMEDIATION REPORTED &mdash; REQUESTING FRESH RING EVIDENCE...
                  </span>
                  <span className="text-xs text-slate-400">
                    Reported: <strong className="text-slate-200">{formatTime(activeRemediation?.completedAt)}</strong>
                  </span>
                </div>

                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 space-y-1 text-xs">
                  <p className="text-amber-300 font-medium">
                    &bull; OpenWay does not accept staff completion as proof.
                  </p>
                  <p className="text-slate-400">
                    &bull; Bounded verification is actively requesting fresh camera evidence (capturedAt &ge; completedAt).
                  </p>
                  <p className="text-slate-400">
                    &bull; Entrance remains locked in RECHECKING until deterministic gatekeeper evaluates new observation.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {onRunVerificationCheck && (
                    <button
                      type="button"
                      onClick={onRunVerificationCheck}
                      className="rounded-lg bg-emerald-600/30 border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/50 transition flex items-center gap-1.5"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Evaluate Fresh Ring Evidence Now
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Workflow State Presentation: Verified Restored */}
            {assuranceStatus === "VERIFIED_RESTORED" && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ACCESS RESTORED &mdash; VERIFIED
                  </span>
                  <span className="text-xs text-slate-400">
                    Restored: <strong className="text-slate-200">{formatTime(latestAssessment?.assessedAt)}</strong>
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <div>
                    Fresh Evidence Capture:{" "}
                    <strong className="text-emerald-300">{formatTime(latestEvidence?.capturedAt)}</strong>{" "}
                    <span className="text-slate-500 font-mono text-[10px]">({latestEvidence?.provenance})</span>
                  </div>
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-2 py-1.5 text-emerald-200">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Pathway clear &check;</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-2 py-1.5 text-emerald-200">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Obstruction absent &check;</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-2 py-1.5 text-emerald-200">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Door ready &check;</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Workflow State Presentation: Unknown */}
            {assuranceStatus === "UNKNOWN" && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-slate-400" />
                    ASSESSMENT UNKNOWN
                  </span>
                  <span className="text-xs text-slate-400">
                    Assessed: <strong className="text-slate-200">{formatTime(latestAssessment?.assessedAt)}</strong>
                  </span>
                </div>

                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 space-y-2 text-xs">
                  <p className="text-slate-300 font-medium">
                    OpenWay could not obtain sufficient fresh evidence to confirm access conditions.
                  </p>
                  <p className="text-amber-300/90">
                    <strong>Safety Invariant Enforced:</strong> No green status was declared. Stale, missing, or contradictory evidence defaults to UNKNOWN.
                  </p>
                  {latestAssessment?.reason && (
                    <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                      Reason: {latestAssessment.reason}
                    </div>
                  )}
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
