import React from "react";
import { RingEvent } from "@/ring/types";
import { Activity, Bell, Sparkles, AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";

interface ObservationFeedProps {
  events: RingEvent[];
  loading: boolean;
  onRefreshEvents?: () => void;
  activeMode: string;
}

export function ObservationFeed({
  events,
  loading,
  onRefreshEvents,
  activeMode,
}: ObservationFeedProps) {
  const latest = events.length > 0 ? events[0] : null;

  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "motion":
        return <Activity className="h-4 w-4 text-amber-400" />;
      case "ding":
      case "doorbell":
        return <Bell className="h-4 w-4 text-sky-400" />;
      case "access_obstruction_suspected":
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      case "access_path_clear":
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-purple-400" />;
    }
  };

  return (
    <section
      aria-labelledby="observations-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
            Observation Stream
          </span>
          <h2 id="observations-heading" className="text-lg font-bold text-white flex items-center gap-2">
            Latest Ring Observation
          </h2>
        </div>
        {onRefreshEvents && (
          <button
            type="button"
            onClick={onRefreshEvents}
            disabled={loading}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium transition focus:ring-1 focus:ring-sky-500"
          >
            Refresh Stream
          </button>
        )}
      </div>

      <div className="mt-4">
        {/* Latest Observation Highlight */}
        {latest ? (
          <div className="rounded-xl border border-sky-500/30 bg-slate-950/70 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-200">
                {getEventIcon(latest.eventType)}
                <span className="capitalize">{latest.eventType.replace("_", " ")}</span>
              </span>
              <div className="flex items-center gap-2">
                {latest.eventCategory === "simulated_local" || latest.provider === "simulator" || activeMode === "simulator" ? (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    SIMULATED LOCAL EVENT
                  </span>
                ) : latest.eventCategory === "openway_domain" ? (
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                    DOMAIN ASSURANCE
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    RING LIVE TELEMETRY
                  </span>
                )}
                <time className="text-xs text-slate-400 font-mono">
                  {new Date(latest.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-200">
              {latest.summary || `Event observed on Ring device: ${latest.deviceId}`}
            </p>

            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4">
              <span>Event ID: {latest.eventId}</span>
              <span>Source: {latest.source}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-400">
            <ShieldAlert className="h-6 w-6 mx-auto text-slate-600 mb-1" />
            <p className="text-xs font-medium">No recent Ring observations logged yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live Ring motion, doorbell dings, or webhook signals will appear here.
            </p>
          </div>
        )}

        {/* Observation History */}
        {events.length > 1 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Recent Observation Log
            </span>
            <ul className="space-y-1.5" role="list">
              {events.slice(1, 5).map((ev) => (
                <li
                  key={ev.eventId}
                  className="flex items-center justify-between rounded-lg bg-slate-950/40 px-3 py-2 text-xs border border-slate-800/60"
                >
                  <div className="flex items-center gap-2">
                    {getEventIcon(ev.eventType)}
                    <span className="text-slate-300 font-medium capitalize">
                      {ev.eventType.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    {ev.provider === "simulator" && (
                      <span className="text-[10px] text-amber-400 font-mono">[SIM]</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
