import React, { useState } from "react";
import { Zap, Wifi, WifiOff, Bell, Package, CheckCircle2, AlertTriangle } from "lucide-react";

interface SimulatorControlsProps {
  onTriggerAction: () => void;
  selectedDeviceId?: string;
}

export function SimulatorControls({ onTriggerAction, selectedDeviceId }: SimulatorControlsProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sendAction = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ring/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(data.message);
        onTriggerAction();
      } else {
        setFeedback(`Error: ${data.message}`);
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
              Deterministic Simulator Workbench
            </h2>
            <p className="text-[11px] text-amber-400/80">
              Trigger predictable Ring hardware events and edge cases for local testing &amp; demo
            </p>
          </div>
        </div>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
          LOCAL DEV MODE
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendAction({
              action: "MOTION_EVENT",
              deviceId: selectedDeviceId,
              summary: "Ramp Motion Detected: Patron approaching entrance ramp",
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900/50 transition disabled:opacity-50"
        >
          <Bell className="h-3.5 w-3.5 text-sky-400" />
          Trigger Motion
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendAction({
              action: "PACKAGE_EVENT",
              deviceId: selectedDeviceId,
              summary: "Delivery Package Dropped: Package left on accessible ramp pathway",
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 transition disabled:opacity-50"
        >
          <Package className="h-3.5 w-3.5 text-amber-400" />
          Trigger Delivery (Obstruction)
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendAction({
              action: "TRIGGER_EVENT",
              eventType: "access_path_clear",
              deviceId: selectedDeviceId,
              summary: "Assurance Verification: Physical ramp unobstructed and clear",
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50 transition disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Trigger Path Clear
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendAction({
              action: "DEVICE_ONLINE",
              deviceId: selectedDeviceId || "sim_device_curb_cut",
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          Set Device Online
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendAction({
              action: "DEVICE_OFFLINE",
              deviceId: selectedDeviceId || "sim_device_front_ramp",
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <WifiOff className="h-3.5 w-3.5 text-rose-400" />
          Set Device Offline
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => sendAction({ action: "DISCONNECTED" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition disabled:opacity-50"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Simulate Disconnection
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
