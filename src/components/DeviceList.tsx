import React, { useState } from "react";
import { RingDevice, RingImageEvidence } from "@/ring/types";
import {
  Camera,
  Video,
  Activity,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
  Battery,
  Image as ImageIcon,
  Clock,
  Zap,
} from "lucide-react";

interface DeviceListProps {
  devices: RingDevice[];
  loading: boolean;
  selectedDeviceId?: string;
  onSelectDevice?: (device: RingDevice) => void;
  activeMode: string;
}

export function DeviceList({
  devices,
  loading,
  selectedDeviceId,
  onSelectDevice,
  activeMode,
}: DeviceListProps) {
  const [snapshotLoadingId, setSnapshotLoadingId] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<RingImageEvidence | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const fetchDeviceEvidence = async (deviceId: string) => {
    setSnapshotLoadingId(deviceId);
    setSnapshotError(null);
    try {
      const res = await fetch(`/api/ring/snapshot?deviceId=${encodeURIComponent(deviceId)}&mode=${activeMode}`);
      const data = await res.json();
      const evidence = data.imageEvidence || data.snapshot;
      if (data.success && evidence) {
        setActiveEvidence(evidence);
      } else {
        setSnapshotError(data.error?.message || "Image evidence unavailable from provider.");
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to fetch image evidence");
    } finally {
      setSnapshotLoadingId(null);
    }
  };

  return (
    <section
      aria-labelledby="ring-devices-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Hardware Inventory &amp; Telemetry
          </span>
          <h2 id="ring-devices-heading" className="text-lg font-bold text-white flex items-center gap-2">
            Ring Devices
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
              {devices.length}
            </span>
          </h2>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3 p-4">
            <div className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
            <div className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
            <Camera className="h-8 w-8 mx-auto text-slate-500 mb-2" />
            <p className="font-medium text-slate-300">No Ring devices discovered</p>
            <p className="text-xs text-slate-500 mt-1">
              Verify your Ring Playground access token or ensure devices are assigned in your account.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" role="list">
            {devices.map((device) => {
              const isSelected = selectedDeviceId === device.id;
              const isOnline = device.online;

              return (
                <li
                  key={device.id}
                  className={`rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-sky-500/70 bg-slate-950/80 ring-1 ring-sky-500/40"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {/* Primary Label: User-assigned name from Ring */}
                        <h3 className="text-base font-semibold text-white">
                          {device.name}
                        </h3>
                        {/* Online/Offline status */}
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">
                            <Wifi className="h-3 w-3" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700">
                            <WifiOff className="h-3 w-3" />
                            Offline
                          </span>
                        )}
                        {activeMode === "simulator" && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                            SIMULATED
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="capitalize">Type: {device.kind.replace("_", " ")}</span>
                        {device.batteryLevel !== undefined && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Battery className="h-3.5 w-3.5 text-emerald-400" />
                            {device.batteryLevel}%
                          </span>
                        )}
                        {device.lastSeen && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(device.lastSeen).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchDeviceEvidence(device.id)}
                        disabled={snapshotLoadingId === device.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                        <span>{snapshotLoadingId === device.id ? "Downloading..." : "Image Evidence"}</span>
                      </button>

                      {onSelectDevice && (
                        <button
                          type="button"
                          onClick={() => onSelectDevice(device)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? "bg-sky-500 text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select Entrance"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Explicit Capabilities */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Capabilities:</span>
                    {device.capabilities.supports_live_video && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                        <Video className="h-3 w-3" />
                        Live Video
                      </span>
                    )}
                    {device.capabilities.supports_snapshots && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <Camera className="h-3 w-3" />
                        Snapshots
                      </span>
                    )}
                    {device.capabilities.supports_media_clips && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                        <Layers className="h-3 w-3" />
                        Media Clips
                      </span>
                    )}
                    {device.capabilities.supports_motion_events && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        <Activity className="h-3 w-3" />
                        Motion Events
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Snapshot / Image Evidence Preview */}
        {snapshotError && (
          <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            {snapshotError}
          </div>
        )}

        {activeEvidence && (
          <div className="mt-4 rounded-xl border border-sky-500/40 bg-slate-950 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Physical Observation Evidence
                </span>
                {activeEvidence.isSimulated || activeMode === "simulator" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    <Zap className="h-3 w-3" />
                    SIMULATED - LOCAL TEST EVIDENCE
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    OFFICIAL RING MEDIA DOWNLOAD
                  </span>
                )}
              </div>
              <span className="text-slate-400">
                Captured: {activeEvidence.capturedAt ? new Date(activeEvidence.capturedAt).toLocaleTimeString() : "Unverified"}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              {activeEvidence.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeEvidence.dataUrl}
                  alt="Camera observation evidence of accessible entrance"
                  className="w-full h-auto object-cover max-h-72"
                />
              ) : activeEvidence.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeEvidence.url}
                  alt="Camera observation evidence of accessible entrance"
                  className="w-full h-auto object-cover max-h-72"
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
