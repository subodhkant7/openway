"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RingDevice, RingEvent, RingProviderStatus } from "@/ring/types";
import { RingConnectionCard } from "./RingConnectionCard";
import { EntranceAssuranceCard } from "./EntranceAssuranceCard";
import { DeviceList } from "./DeviceList";
import { ObservationFeed } from "./ObservationFeed";
import { PrivacyNotice } from "./PrivacyNotice";
import { SimulatorControls } from "./SimulatorControls";
import { ShieldCheck, Video } from "lucide-react";

export function OperatorDashboard() {
  const [activeMode, setActiveMode] = useState<"simulator" | "playground" | "api">("simulator");
  const [status, setStatus] = useState<RingProviderStatus | null>(null);
  const [devices, setDevices] = useState<RingDevice[]>([]);
  const [events, setEvents] = useState<RingEvent[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RingDevice | null>(null);
  const [assuranceStatus, setAssuranceStatus] = useState<
    "ASSURED" | "INTERRUPTED" | "PENDING_VERIFICATION" | "UNCONFIGURED"
  >("UNCONFIGURED");
  const [loading, setLoading] = useState(true);

  // Fetch status, devices, and events
  const loadData = useCallback(async (mode = activeMode) => {
    setLoading(true);
    try {
      // 1. Fetch Ring Provider Status
      const statusRes = await fetch(`/api/ring/status?mode=${mode}`);
      const statusData = await statusRes.json();
      if (statusData.status) {
        setStatus(statusData.status);
      }

      // 2. Fetch Devices
      const devRes = await fetch(`/api/ring/devices?mode=${mode}`);
      const devData = await devRes.json();
      if (devData.devices) {
        setDevices(devData.devices);
        // If a device was previously selected, keep it updated
        if (selectedDevice) {
          const freshSelected = devData.devices.find((d: RingDevice) => d.id === selectedDevice.id);
          if (freshSelected) setSelectedDevice(freshSelected);
        }
      }

      // 3. Fetch Events
      const evRes = await fetch(`/api/ring/events?mode=${mode}&limit=10`);
      const evData = await evRes.json();
      if (evData.events) {
        setEvents(evData.events);
      }
    } catch (err) {
      console.error("Failed to load OpenWay dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeMode, selectedDevice]);

  useEffect(() => {
    loadData(activeMode);
  }, [activeMode, loadData]);

  // When entrance device is selected
  const handleSelectDevice = (device: RingDevice | null) => {
    setSelectedDevice(device);
    if (!device) {
      setAssuranceStatus("UNCONFIGURED");
    } else {
      setAssuranceStatus("ASSURED");
    }
  };

  const handleModeChange = (mode: "simulator" | "playground" | "api") => {
    setActiveMode(mode);
    loadData(mode);
  };

  const handleTriggerInterruption = () => {
    setAssuranceStatus("INTERRUPTED");
    // Also push a simulated obstruction event
    fetch("/api/ring/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TRIGGER_EVENT",
        eventType: "access_obstruction_suspected",
        deviceId: selectedDevice?.id,
        summary: `Temporary obstruction detected in front of ${selectedDevice?.name || "entrance"}`,
      }),
    }).then(() => loadData());
  };

  const handleResolveWithEvidence = () => {
    setAssuranceStatus("PENDING_VERIFICATION");
    // Verify fresh evidence and transition to ASSURED
    setTimeout(() => {
      fetch("/api/ring/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRIGGER_EVENT",
          eventType: "access_path_clear",
          deviceId: selectedDevice?.id,
          summary: `Fresh snapshot evidence verified: physical pathway is completely clear at ${selectedDevice?.name || "entrance"}`,
        }),
      }).then(() => {
        setAssuranceStatus("ASSURED");
        loadData();
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <main id="main-content" className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 p-2 text-white shadow-lg">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>OPENWAY</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    Phase 1
                  </span>
                </h1>
                <p className="text-sm font-medium text-slate-400 mt-0.5">
                  Accessibility Assurance &bull; Powered by Ring
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 border border-slate-800 text-xs">
              <Video className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-slate-400">Ring Runtime:</span>
              <strong className="text-slate-200 uppercase font-mono">{activeMode}</strong>
            </div>
          </div>
        </header>

        {/* Privacy Notice Component */}
        <PrivacyNotice />

        {/* Section: Ring Connection */}
        <RingConnectionCard
          status={status}
          loading={loading}
          onRefresh={() => loadData()}
          onModeChange={handleModeChange}
          activeMode={activeMode}
        />

        {/* Section: Selected Entrance */}
        <EntranceAssuranceCard
          selectedDevice={selectedDevice}
          devices={devices}
          onSelectDevice={handleSelectDevice}
          assuranceStatus={assuranceStatus}
          onTriggerInterruption={handleTriggerInterruption}
          onResolveWithEvidence={handleResolveWithEvidence}
        />

        {/* Grid layout for Devices & Observations */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            {/* Section: Ring Devices */}
            <DeviceList
              devices={devices}
              loading={loading}
              selectedDeviceId={selectedDevice?.id}
              onSelectDevice={handleSelectDevice}
              activeMode={activeMode}
            />
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Section: Latest Ring observation */}
            <ObservationFeed
              events={events}
              loading={loading}
              onRefreshEvents={() => loadData()}
              activeMode={activeMode}
            />

            {/* Simulator Controls if in Simulator mode */}
            {activeMode === "simulator" && (
              <SimulatorControls
                onTriggerAction={() => loadData()}
                selectedDeviceId={selectedDevice?.id}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-800/80 pt-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <p>
            OpenWay &bull; Real-time accessibility assurance for businesses &bull; Built for Amazon Ring
          </p>
          <div className="flex items-center gap-4">
            <span>WCAG 2.2 AA Target</span>
            <span>Server-side Ring Client</span>
            <span>MIT License</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
