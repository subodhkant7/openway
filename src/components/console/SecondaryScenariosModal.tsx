"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  X,
  AlertTriangle,
  Camera,
  HelpCircle,
  History,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { SimulatorScenarioName } from "@/workflow/simulatorWorkflow";

interface SecondaryScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntranceId?: string;
  onScenarioExecuted: () => void;
}

export function SecondaryScenariosModal({
  isOpen,
  onClose,
  selectedEntranceId = "entrance_side_accessible",
  onScenarioExecuted,
}: SecondaryScenariosModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const runScenario = async (scenario: SimulatorScenarioName) => {
    setLoading(true);
    setActiveScenario(scenario);
    setFeedback(null);
    try {
      const res = await fetch("/api/simulator/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          entranceId: selectedEntranceId,
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setFeedback(
          `${data.result.description} Result: ${data.result.resultingState} (Passed: ${data.result.passed})`
        );
        onScenarioExecuted();
      } else {
        setFeedback(`Error: ${data.error || "Scenario execution failed"}`);
      }
    } catch (err) {
      setFeedback(`Failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  };

  const secondaryScenarios: {
    id: SimulatorScenarioName;
    name: string;
    tag: string;
    icon: React.ReactNode;
    color: string;
    border: string;
    bg: string;
    description: string;
    invariantsTested: string;
    expectedResult: string;
  }[] = [
    {
      id: "SCENARIO_C_FALSE_COMPLETION",
      name: "Scenario C: False Completion Injection",
      tag: "INVARIANT 1 & 7",
      icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
      color: "text-rose-200",
      border: "border-rose-500/40",
      bg: "bg-rose-950/30",
      description: "Staff marks task complete, but physical camera evidence still detects ramp blockage.",
      invariantsTested: "Staff completion is never accepted as proof of physical restoration. Gatekeeper rejects leap to green.",
      expectedResult: "Result: ACTION_REQUIRED / Task remains unverified",
    },
    {
      id: "RUN_STALE_VERIFICATION",
      name: "Stale Pre-Remediation Evidence Injection",
      tag: "INVARIANT 3 & 6",
      icon: <Clock className="h-4 w-4 text-amber-400" />,
      color: "text-amber-200",
      border: "border-amber-500/40",
      bg: "bg-amber-950/30",
      description: "Verification receives clear evidence, but evidence was captured BEFORE staff remediation was finished.",
      invariantsTested: "Temporal consistency (capturedAt ≥ completedAt). Stale evidence fails closed.",
      expectedResult: "Result: TEMPORAL_INCONSISTENCY → UNKNOWN",
    },
    {
      id: "SCENARIO_F_WRONG_CAMERA",
      name: "Scenario F: Unbound Camera Tampering",
      tag: "INVARIANT 4 & 5",
      icon: <Camera className="h-4 w-4 text-rose-400" />,
      color: "text-rose-200",
      border: "border-rose-500/40",
      bg: "bg-rose-950/30",
      description: "Evidence received from a different, unauthorized camera or wrong component binding.",
      invariantsTested: "DeviceId and componentId must match the entrance's registered Ring camera binding.",
      expectedResult: "Result: WRONG_CAMERA_DEVICE → UNKNOWN",
    },
    {
      id: "SCENARIO_G_CONTRADICTION",
      name: "Scenario G: Contradictory Sensor Evidence",
      tag: "INVARIANT 8",
      icon: <HelpCircle className="h-4 w-4 text-amber-400" />,
      color: "text-amber-200",
      border: "border-amber-500/40",
      bg: "bg-amber-950/30",
      description: "Simultaneous clear and obstructed observations submitted within the same verification window.",
      invariantsTested: "Conflict resolution invariant. When sensor signals clash, system must fail closed.",
      expectedResult: "Result: CONTRADICTORY_OBSERVATIONS → UNKNOWN",
    },
    {
      id: "SCENARIO_H_EVENT_LOST",
      name: "Scenario H: Webhook Recovery & Replay",
      tag: "RESILIENCE",
      icon: <History className="h-4 w-4 text-purple-400" />,
      color: "text-purple-200",
      border: "border-purple-500/40",
      bg: "bg-purple-950/30",
      description: "Simulates network drop of initial Ring webhook, followed by scheduled reconciliation polling.",
      invariantsTested: "Reconciliation catches missed events and brings assurance state up to date.",
      expectedResult: "Result: Reconciled & State Synchronized",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="secondary-scenarios-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-amber-500/30 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="secondary-scenarios-title" className="text-base font-bold text-white">
                  Secondary Failure-Injection &amp; Invariant Defense Scenarios
                </h2>
                <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  ADVERSARIAL SUITE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Stress-test fail-closed invariants, temporal boundaries, and hardware bindings
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
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5 text-xs text-slate-300">
            <p className="text-slate-400">
              These scenarios demonstrate that OpenWay resists false positives, clock skew, wrong cameras, and contradictory reports. Each failure case strictly enforces fail-closed safety.
            </p>
          </div>

          <div className="space-y-3">
            {secondaryScenarios.map((scen) => (
              <div
                key={scen.id}
                className={`rounded-xl border ${scen.border} ${scen.bg} p-4 transition space-y-2`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {scen.icon}
                    <span className="font-bold text-sm text-white">{scen.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                      {scen.tag}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => runScenario(scen.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
                  >
                    <Zap className={`h-3.5 w-3.5 ${activeScenario === scen.id ? "animate-spin text-amber-400" : "text-amber-400"}`} />
                    <span>{activeScenario === scen.id ? "Injecting..." : "Inject Scenario"}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-300">{scen.description}</p>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span><strong>Invariant:</strong> {scen.invariantsTested}</span>
                  <span className="font-mono text-amber-300">{scen.expectedResult}</span>
                </div>
              </div>
            ))}
          </div>

          {feedback && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
              <strong>Scenario Output:</strong> {feedback}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3.5 text-xs text-slate-400">
          <span>Deterministic test scenarios using domain orchestrator &amp; recheck services</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close Suite
          </button>
        </div>
      </div>
    </div>
  );
}
