"use client";

import React, { useEffect, useRef } from "react";
import { RingProviderStatus, RingDevice, RingEvent } from "@/ring/types";
import { RingConnectionCard } from "../RingConnectionCard";
import { DeviceList } from "../DeviceList";
import { ObservationFeed } from "../ObservationFeed";
import { Video, X } from "lucide-react";

interface RingTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: RingProviderStatus | null;
  devices: RingDevice[];
  events: RingEvent[];
  loading: boolean;
  activeMode: "simulator" | "playground" | "api";
  onModeChange: (mode: "simulator" | "playground" | "api") => void;
  onRefresh: () => void;
  selectedDeviceId?: string;
  onSelectDevice?: (device: RingDevice) => void;
}

export function RingTelemetryModal({
  isOpen,
  onClose,
  status,
  devices,
  events,
  loading,
  activeMode,
  onModeChange,
  onRefresh,
  selectedDeviceId,
  onSelectDevice,
}: RingTelemetryModalProps) {
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
      aria-labelledby="ring-telemetry-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-sky-500/30 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-2 text-sky-400 border border-sky-500/30">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ring-telemetry-dialog-title" className="text-base font-bold text-white">
                  Ring Hardware Inventory &amp; Telemetry Stream
                </h2>
                <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                  {devices.length} DEVICES REGISTERED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Ring Partner API &amp; Local Simulator Integration
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <RingConnectionCard
            status={status}
            loading={loading}
            onRefresh={onRefresh}
            onModeChange={onModeChange}
            activeMode={activeMode}
          />

          <DeviceList
            devices={devices}
            loading={loading}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={onSelectDevice}
            activeMode={activeMode}
          />

          <ObservationFeed
            events={events}
            loading={loading}
            onRefreshEvents={onRefresh}
            activeMode={activeMode}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-3.5 text-xs text-slate-400">
          <span>Boundary: Ring Partner API / Sandbox / Deterministic Simulator</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
}
