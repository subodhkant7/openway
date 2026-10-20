"use client";

import React, { useEffect, useRef } from "react";
import { DetailedVisionObservation } from "@/vision/VisionAnalyzer";
import { Evidence } from "@/evidence/types";
import { EvidenceAnalysisPanel } from "../EvidenceAnalysisPanel";
import { Brain, X } from "lucide-react";

interface VisionDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestObservation: DetailedVisionObservation | null;
  latestEvidence: Evidence | null;
  loading: boolean;
  onRunAnalysis?: () => void;
}

export function VisionDiagnosticsModal({
  isOpen,
  onClose,
  latestObservation,
  latestEvidence,
  loading,
  onRunAnalysis,
}: VisionDiagnosticsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-purple-500/30 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400 border border-purple-500/30">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="vision-dialog-title" className="text-base font-bold text-white">
                  Amazon Bedrock Multimodal Vision Intelligence
                </h2>
                <span className="rounded bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                  STRUCTURED OBSERVATION
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Model: Amazon Nova Lite (amazon.nova-lite-v1:0) &bull; Vision Inference Pipeline
              </p>
            </div>
          </div>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-xs text-slate-300 space-y-1.5">
            <strong className="text-purple-400 block font-semibold">Architectural Boundary (Rule 2):</strong>
            <p className="text-slate-400">
              Bedrock vision models provide structured statistical observations (confidence scores, detected physical features, pathway clearances). Vision AI does NOT trigger state changes or issue green assurance marks; only the deterministic state machine and restoration gatekeeper can do so.
            </p>
          </div>

          <EvidenceAnalysisPanel
            latestObservation={latestObservation}
            latestEvidence={latestEvidence}
            loading={loading}
            onRunAnalysis={onRunAnalysis}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3.5 text-xs text-slate-400">
          <span>Truthful inference status: Fails closed to UNKNOWN if Bedrock credentials are unavailable</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
