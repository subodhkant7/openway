import React, { useState } from "react";
import { Zap, CheckCircle2, AlertTriangle, UserCheck, ShieldCheck, HelpCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { SimulatorScenarioName } from "@/workflow/simulatorWorkflow";

interface SimulatorControlsProps {
  onTriggerAction: () => void;
  selectedEntranceId?: string;
}

export function SimulatorControls({ onTriggerAction, selectedEntranceId }: SimulatorControlsProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runScenario = async (scenario: SimulatorScenarioName) => {
    setLoading(true);
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
        setFeedback(`${data.result.description} Result: ${data.result.resultingState} (Passed: ${data.result.passed})`);
        onTriggerAction();
      } else {
        setFeedback(`Error: ${data.error || "Scenario failed"}`);
      }
    } catch (err) {
      setFeedback(`Failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="simulator-controls-heading"
      className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 shadow-lg backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/20 p-1.5 text-amber-400">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="simulator-controls-heading" className="text-sm font-bold text-amber-300">
              Phase 2 Deterministic Simulator Scenarios
            </h2>
            <p className="text-[11px] text-amber-400/80">
              Test &amp; demonstrate state machine transitions, verification invariants, and failure paths
            </p>
          </div>
        </div>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
          DETERMINISTIC SUITE
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_1_NORMAL")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50 transition disabled:opacity-50 text-left"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
          <span><strong>1. Normal:</strong> AVAILABLE</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_2_OBSTRUCTION")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/50 transition disabled:opacity-50 text-left"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
          <span><strong>2. Obstruction:</strong> INTERRUPTED</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_3_STAFF_FALSE_CLAIM")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/50 transition disabled:opacity-50 text-left"
        >
          <UserCheck className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
          <span><strong>3. Staff Claims Fixed:</strong> RECHECKING</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_4_FRESH_CLEAR_EVIDENCE")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/60 transition disabled:opacity-50 text-left"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 flex-shrink-0" />
          <span><strong>4. Fresh Evidence:</strong> VERIFIED RESTORED</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_5_STALE_CLEAR_EVIDENCE")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 text-left"
        >
          <HelpCircle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span><strong>5. Stale Evidence:</strong> UNKNOWN</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_6_CONTRADICTORY_EVIDENCE")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 text-left"
        >
          <HelpCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <span><strong>6. Contradictory:</strong> UNKNOWN</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => runScenario("SCENARIO_7_WRONG_CAMERA")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-600/40 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/40 transition disabled:opacity-50 text-left sm:col-span-2"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
          <span><strong>7. Wrong Camera:</strong> REJECTED (No Restoration)</span>
        </button>
      </div>

      {feedback && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-200">
          {feedback}
        </div>
      )}
    </section>
  );
}
