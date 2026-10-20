"use client";

import React, { useEffect, useRef, useState } from "react";
import { AuditEvent } from "@/domain/types";
import {
  History,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  Eye,
  UserCheck,
  ListTodo,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";

interface FullAuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeline: AuditEvent[];
  loading?: boolean;
  onRefresh?: () => void;
  entranceName?: string;
}

export function FullAuditTrailModal({
  isOpen,
  onClose,
  timeline,
  loading = false,
  onRefresh,
  entranceName,
}: FullAuditTrailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      closeButtonRef.current?.focus();
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEventVisuals = (type: AuditEvent["type"]) => {
    switch (type) {
      case "ACCESS_VERIFIED_RESTORED":
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
          badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          title: "ACCESS RESTORED — VERIFIED",
        };
      case "ACCESS_INTERRUPTED":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
          badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          title: "ACCESS INTERRUPTED",
        };
      case "TASK_CREATED":
        return {
          icon: <ListTodo className="h-4 w-4 text-amber-400" />,
          badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          title: "REMEDIATION TASK CREATED",
        };
      case "TASK_ACKNOWLEDGED":
        return {
          icon: <Clock className="h-4 w-4 text-sky-400" />,
          badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          title: "STAFF ACKNOWLEDGED",
        };
      case "TASK_COMPLETED":
        return {
          icon: <UserCheck className="h-4 w-4 text-indigo-400" />,
          badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
          title: "REMEDIATION REPORTED",
        };
      case "VERIFICATION_STARTED":
      case "VERIFICATION_INITIATED":
        return {
          icon: <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />,
          badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          title: "VERIFICATION STARTED",
        };
      case "RING_EVENT_RECEIVED":
        return {
          icon: <Clock className="h-4 w-4 text-purple-400" />,
          badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
          title: "RING EVENT",
        };
      case "EVIDENCE_CAPTURED":
        return {
          icon: <Eye className="h-4 w-4 text-sky-400" />,
          badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
          title: "FRESH EVIDENCE",
        };
      case "OBSERVATION_CREATED":
        return {
          icon: <Eye className="h-4 w-4 text-teal-400" />,
          badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30",
          title: "OBSERVATION",
        };
      case "ASSESSMENT_UNKNOWN":
        return {
          icon: <HelpCircle className="h-4 w-4 text-slate-400" />,
          badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
          title: "ASSESSMENT UNKNOWN",
        };
      case "WRONG_CAMERA_REJECTED":
        return {
          icon: <ShieldAlert className="h-4 w-4 text-rose-400" />,
          badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          title: "UNBOUND CAMERA REJECTED",
        };
      default:
        return {
          icon: <Eye className="h-4 w-4 text-sky-400" />,
          badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
          title: (type as string).replace(/_/g, " "),
        };
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-sky-500/30 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="audit-dialog-title" className="text-base font-bold text-white">
                  Full Append-Only Audit Trail
                </h2>
                <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                  {timeline.length} RECORDED EVENTS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Durable state transition history for {entranceName || "Configured Entrance"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Refresh timeline"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
                <span>Refresh</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No audit events recorded yet for this entrance.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((event) => {
                const visuals = getEventVisuals(event.type);
                const metadata = event.metadata || {};
                const isSimulated =
                  Boolean(metadata.isSimulated) ||
                  event.correlationId.startsWith("sim_") ||
                  event.id.startsWith("audit_init_");

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 transition hover:border-slate-700 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {visuals.icon}
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
                      <time
                        dateTime={event.timestamp}
                        className="font-mono text-[11px] text-slate-400"
                      >
                        {formatTime(event.timestamp)}
                      </time>
                    </div>

                    {/* Metadata & Message */}
                    <div className="text-slate-300">
                      {metadata.reason ? <p className="font-medium text-slate-200">{String(metadata.reason)}</p> : null}
                      {metadata.message ? <p className="text-slate-300 mt-1">{String(metadata.message)}</p> : null}
                      {metadata.notice ? (
                        <p className="text-slate-400 italic text-[11px] mt-1">
                          {String(metadata.notice)}
                        </p>
                      ) : null}
                      {metadata.completedBy ? (
                        <p className="text-slate-400 text-[11px] mt-1">
                          Reported by: <strong className="text-slate-200">{String(metadata.completedBy)}</strong>
                        </p>
                      ) : null}
                    </div>

                    {/* Identifiers & Correlation Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>
                          Event ID: <span className="text-slate-400">{event.id}</span>
                        </span>
                        <span>
                          Correlation: <span className="text-sky-300">{event.correlationId}</span>
                        </span>
                        <span>
                          Entity: <span className="text-slate-400">{event.entityType}:{event.entityId}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(event.correlationId, event.id)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                        title="Copy Correlation ID"
                      >
                        {copiedId === event.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy CID</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3.5 text-xs text-slate-400">
          <span>Immutable audit record backed by DynamoDB / durable memory storage</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
}
