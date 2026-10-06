import React, { useState } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  HelpCircle,
  ShieldAlert,
  Clock,
  Play,
  History,
  Camera,
} from "lucide-react";
import { SimulatorScenarioName } from "@/workflow/simulatorWorkflow";

interface SimulatorControlsProps {
  onTriggerAction: () => void;
  selectedEntranceId?: string;
}

export function SimulatorControls({ onTriggerAction, selectedEntranceId }: SimulatorControlsProps) {
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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
          entranceId: selectedEntranceId || "entrance_side_accessible",
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setFeedback(
          `${data.result.description} Result: ${data.result.resultingState} (Passed: ${data.result.passed})`
        );
        onTriggerAction();
      } else {
        setFeedback(`Error: ${data.error || "Scenario failed"}`);
      }
    } catch (err) {
      setFeedback(`Failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  };

  const resetDemo = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entranceId: selectedEntranceId || "entrance_side_accessible",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback("Demo reset cleanly: Entrance restored to initial baseline AVAILABLE state.");
        onTriggerAction();
      } else {
        setFeedback(`Error resetting demo: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setFeedback(`Failed to reset demo: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="simulator-controls-heading"
      className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 shadow-lg backdrop-blur-md space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/20 p-1.5 text-amber-400">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="simulator-controls-heading" className="text-sm font-bold text-amber-300">
              Hackathon Judge Demo &amp; Assurance Workbench
            </h2>
            <p className="text-[11px] text-amber-400/80">
              One-click deterministic walkthrough: Baseline &rarr; Interruption &rarr; Remediation &rarr; Verification &rarr; Failure Proof
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={resetDemo}
            className="rounded bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 border border-slate-600/50 transition disabled:opacity-50"
            title="Reset demo tenant to baseline AVAILABLE state"
          >
            Reset Demo Narrative
          </button>
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
            AWS PERSISTENT DEMO
          </span>
        </div>
      </div>

      {/* Primary One-Click Demo Story Sequence */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
          Primary Product Story Sequence
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("RUN_PREEMPTIVE_OBSTRUCTION")}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 p-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 transition disabled:opacity-50 text-left shadow-sm"
          >
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <div>
              <span className="block font-bold">1. PREEMPTIVE OBSTRUCTION</span>
              <span className="text-[10px] text-rose-300/80 font-normal">
                Ring motion &rarr; Fresh evidence &rarr; INTERRUPTED &rarr; Task OPEN
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("RUN_STAFF_REMEDIATION")}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-950/50 p-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/60 transition disabled:opacity-50 text-left shadow-sm"
          >
            <UserCheck className="h-4 w-4 text-sky-400 flex-shrink-0" />
            <div>
              <span className="block font-bold">2. STAFF REMEDIATION</span>
              <span className="text-[10px] text-sky-300/80 font-normal">
                Staff reports complete &rarr; RECHECKING (never assumes success)
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("RUN_VERIFICATION")}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/50 p-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60 transition disabled:opacity-50 text-left shadow-sm sm:col-span-2"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="block font-bold">3. CANONICAL VERIFICATION & RESTORATION</span>
              <span className="text-[10px] text-emerald-300/80 font-normal">
                Explicit fresh evidence &ge; completedAt &rarr; Deterministic Gate &rarr; VERIFIED_RESTORED
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("RUN_UNKNOWN_VERIFICATION")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50 text-left shadow-sm"
          >
            <HelpCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <div>
              <span className="block font-bold">4. FAILURE DEMO 1: UNAVAILABLE &rarr; UNKNOWN</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Ring returns no valid evidence &rarr; UNKNOWN (No green). Recover with Step 3!
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("RUN_STALE_VERIFICATION")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50 text-left shadow-sm"
          >
            <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div>
              <span className="block font-bold">5. FAILURE DEMO 2: STALE PRE-REMEDIATION</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Evidence captured before completion &rarr; TEMPORAL_INCONSISTENCY &rarr; UNKNOWN
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Safety Invariants Suite (Scenarios C, F, G, H) */}
      <div className="space-y-2 border-t border-amber-500/20 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
          Invariant Defense Scenarios
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("SCENARIO_C_FALSE_COMPLETION")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-950/40 transition disabled:opacity-50 text-left"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
            <span><strong>Scenario C:</strong> False Complete &rarr; ACTION_REQUIRED</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("SCENARIO_F_WRONG_CAMERA")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-950/40 transition disabled:opacity-50 text-left"
          >
            <Camera className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
            <span><strong>Scenario F:</strong> Wrong Camera &rarr; UNKNOWN</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("SCENARIO_G_CONTRADICTION")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950/40 transition disabled:opacity-50 text-left"
          >
            <HelpCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <span><strong>Scenario G:</strong> Contradiction &rarr; UNKNOWN</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => runScenario("SCENARIO_H_EVENT_LOST")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-950/20 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-950/40 transition disabled:opacity-50 text-left"
          >
            <History className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
            <span><strong>Scenario H:</strong> Event Recovery &amp; Replay</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200">
          {feedback}
        </div>
      )}

      <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 flex items-center justify-between">
        <span>Runs active domain orchestrator &amp; recheck services</span>
        <span className="font-mono text-amber-400/70">PROVENANCE: SIMULATED_LOCAL</span>
      </div>
    </section>
  );
}
