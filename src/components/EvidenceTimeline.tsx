import React from "react";
import { AuditEvent } from "@/domain/types";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
  Eye,
  UserCheck,
  ListTodo,
} from "lucide-react";

interface EvidenceTimelineProps {
  timeline: AuditEvent[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function EvidenceTimeline({ timeline, loading, onRefresh }: EvidenceTimelineProps) {
  const getEventVisuals = (type: AuditEvent["type"]) => {
    switch (type) {
      case "ACCESS_VERIFIED_RESTORED":
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
          badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          title: "ACCESS RESTORED — VERIFIED",
        };
      case "ACCESS_INTERRUPTED":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden="true" />,
          badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          title: "ACCESS INTERRUPTED",
        };
      case "TASK_CREATED":
        return {
          icon: <ListTodo className="h-4 w-4 text-amber-400" aria-hidden="true" />,
          badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          title: "REMEDIATION TASK CREATED",
        };
      case "TASK_ACKNOWLEDGED":
        return {
          icon: <Clock className="h-4 w-4 text-sky-400" aria-hidden="true" />,
          badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          title: "TASK ACKNOWLEDGED BY STAFF",
        };
      case "TASK_COMPLETED":
        return {
          icon: <UserCheck className="h-4 w-4 text-indigo-400" aria-hidden="true" />,
          badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
          title: "STAFF REPORTED COMPLETE",
        };
      case "VERIFICATION_STARTED":
        return {
          icon: <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" aria-hidden="true" />,
          badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          title: "VERIFICATION INITIATED",
        };
      case "ASSESSMENT_UNKNOWN":
        return {
          icon: <HelpCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />,
          badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
          title: "ASSESSMENT UNKNOWN",
        };
      case "WRONG_CAMERA_REJECTED":
        return {
          icon: <ShieldAlert className="h-4 w-4 text-rose-400" aria-hidden="true" />,
          badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          title: "UNBOUND CAMERA REJECTED",
        };
      case "OBSERVATION_CREATED":
      case "EVIDENCE_CAPTURED":
      case "RING_EVENT_RECEIVED":
      default:
        return {
          icon: <Eye className="h-4 w-4 text-sky-400" aria-hidden="true" />,
          badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
          title: type.replace(/_/g, " "),
        };
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <section
      aria-labelledby="evidence-timeline-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Audit Trail
          </span>
          <h2 id="evidence-timeline-heading" className="text-base font-bold text-white flex items-center gap-2">
            Evidence &amp; Assurance Timeline
          </h2>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh timeline"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="mt-4">
        {timeline.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No audit events recorded yet for this entrance.
          </p>
        ) : (
          <ol className="relative border-l border-slate-800 ml-3 space-y-5 py-2">
            {timeline.map((event) => {
              const visuals = getEventVisuals(event.type);
              const metadata = event.metadata || {};
              const isSimulated =
                Boolean(metadata.isSimulated) ||
                event.correlationId.startsWith("sim_") ||
                event.id.startsWith("audit_init_");

              return (
                <li key={event.id} className="ml-5">
                  <div className="absolute -left-2.5 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-slate-700">
                    {visuals.icon}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <time
                      dateTime={event.timestamp}
                      className="font-mono text-xs font-semibold text-slate-400"
                    >
                      {formatTime(event.timestamp)}
                    </time>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${visuals.badgeClass}`}
                    >
                      {visuals.title}
                    </span>
                    {isSimulated && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-400">
                        SIMULATED LOCAL
                      </span>
                    )}
                  </div>

                  {/* Metadata display */}
                  <div className="mt-1 text-xs text-slate-300">
                    {metadata.reason ? String(metadata.reason) : null}
                    {metadata.message ? String(metadata.message) : null}
                    {metadata.notice ? (
                      <p className="text-slate-400 italic text-[11px] mt-0.5">
                        {String(metadata.notice)}
                      </p>
                    ) : null}
                    {metadata.completedBy ? (
                      <span className="text-slate-400 block text-[11px] mt-0.5">
                        Reported by: <strong className="text-slate-200">{String(metadata.completedBy)}</strong>
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
