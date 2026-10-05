"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RingDevice, RingEvent, RingProviderStatus } from "@/ring/types";
import { Entrance, AssuranceState, RemediationTask, AuditEvent, AccessibilityRequirements } from "@/domain/types";
import { Evidence } from "@/evidence/types";
import { DetailedVisionObservation } from "@/vision/VisionAnalyzer";
import { RingConnectionCard } from "./RingConnectionCard";
import { EntranceAssuranceCard } from "./EntranceAssuranceCard";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { EvidenceAnalysisPanel } from "./EvidenceAnalysisPanel";
import { DeviceList } from "./DeviceList";
import { ObservationFeed } from "./ObservationFeed";
import { PrivacyNotice } from "./PrivacyNotice";
import { SimulatorControls } from "./SimulatorControls";
import { ShieldCheck, Video, Compass } from "lucide-react";

export function OperatorDashboard() {
  const [activeMode, setActiveMode] = useState<"simulator" | "playground" | "api">("simulator");
  const [status, setStatus] = useState<RingProviderStatus | null>(null);
  const [devices, setDevices] = useState<RingDevice[]>([]);
  const [events, setEvents] = useState<RingEvent[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RingDevice | null>(null);

  // Phase 2 & 3 Domain & Vision States
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<Entrance | null>(null);
  const [assuranceStatus, setAssuranceStatus] = useState<AssuranceState | "UNCONFIGURED">("AVAILABLE");
  const [activeRemediation, setActiveRemediation] = useState<RemediationTask | null>(null);
  const [latestEvidence, setLatestEvidence] = useState<Evidence | null>(null);
  const [latestObservation, setLatestObservation] = useState<DetailedVisionObservation | null>(null);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [requirements, setRequirements] = useState<AccessibilityRequirements>({
    pathwayClear: true,
    obstructionFree: true,
    doorReady: true,
  });

  const [loading, setLoading] = useState(true);
  const [visionLoading, setVisionLoading] = useState(false);

  // Fetch entrance assurance, latest evidence, observation, and timeline
  const loadAssuranceData = useCallback(async (entranceId: string) => {
    try {
      const [assureRes, timeRes] = await Promise.all([
        fetch(`/api/entrances/${entranceId}/assurance`),
        fetch(`/api/entrances/${entranceId}/timeline?limit=25`),
      ]);

      if (assureRes.ok) {
        const assureData = await assureRes.json();
        setAssuranceStatus(assureData.state);
        setActiveRemediation(assureData.activeRemediation || null);
        setLatestEvidence(assureData.latestEvidence || null);
        if (assureData.latestObservation) {
          setLatestObservation(assureData.latestObservation);
        }
        if (assureData.requirements) setRequirements(assureData.requirements);
      }

      if (timeRes.ok) {
        const timeData = await timeRes.json();
        setTimeline(timeData.timeline || []);
      }
    } catch (err) {
      console.error("[Dashboard] Error loading assurance data:", err);
    }
  }, []);

  // Fetch Ring status, devices, events, and configured entrances
  const loadData = useCallback(async (mode = activeMode) => {
    setLoading(true);
    try {
      // 1. Fetch Ring Provider Status
      const statusRes = await fetch(`/api/ring/status?mode=${mode}`);
      const statusData = await statusRes.json();
      if (statusData.status) {
        setStatus(statusData.status);
      }

      // 2. Fetch Ring Devices
      const devRes = await fetch(`/api/ring/devices?mode=${mode}`);
      const devData = await devRes.json();
      if (devData.devices) {
        setDevices(devData.devices);
        if (selectedDevice) {
          const freshSelected = devData.devices.find((d: RingDevice) => d.id === selectedDevice.id);
          if (freshSelected) setSelectedDevice(freshSelected);
        }
      }

      // 3. Fetch Ring Events
      const evRes = await fetch(`/api/ring/events?mode=${mode}&limit=10`);
      const evData = await evRes.json();
      if (evData.events) {
        setEvents(evData.events);
      }

      // 4. Fetch Configured Entrances
      const entRes = await fetch("/api/entrances");
      const entData = await entRes.json();
      if (entData.entrances && entData.entrances.length > 0) {
        setEntrances(entData.entrances);
        const currentEntrance = selectedEntrance || entData.entrances[0];
        setSelectedEntrance(currentEntrance);
        await loadAssuranceData(currentEntrance.id);
      }
    } catch (err) {
      console.error("Failed to load OpenWay dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeMode, selectedDevice, selectedEntrance, loadAssuranceData]);

  useEffect(() => {
    loadData(activeMode);
  }, [activeMode, loadData]);

  const handleModeChange = (mode: "simulator" | "playground" | "api") => {
    setActiveMode(mode);
    loadData(mode);
  };

  const handleAcknowledgeTask = async (taskId: string) => {
    try {
      await fetch(`/api/remediation/${taskId}/acknowledge`, { method: "POST" });
      if (selectedEntrance) await loadAssuranceData(selectedEntrance.id);
    } catch (err) {
      console.error("Failed to acknowledge task:", err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/remediation/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy: "Staff Operator" }),
      });
      if (selectedEntrance) await loadAssuranceData(selectedEntrance.id);
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const handleRunVerificationCheck = async () => {
    if (!selectedEntrance) return;
    try {
      await fetch("/api/simulator/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "SCENARIO_4_FRESH_CLEAR_EVIDENCE",
          entranceId: selectedEntrance.id,
        }),
      });
      await loadAssuranceData(selectedEntrance.id);
    } catch (err) {
      console.error("Failed to run verification check:", err);
    }
  };

  const handleRunVisionAnalysis = async () => {
    if (!selectedEntrance) return;
    setVisionLoading(true);
    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entranceId: selectedEntrance.id,
          analyzerType: activeMode === "simulator" ? "simulator" : "bedrock",
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setLatestObservation(data.result.observation);
        await loadAssuranceData(selectedEntrance.id);
      }
    } catch (err) {
      console.error("Failed to run vision analysis:", err);
    } finally {
      setVisionLoading(false);
    }
  };

  const handleSelectEntrance = async (entrance: Entrance) => {
    setSelectedEntrance(entrance);
    await loadAssuranceData(entrance.id);
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
                  <span className="text-xs font-semibold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    Phase 3 Bedrock
                  </span>
                </h1>
                <p className="text-sm font-medium text-slate-400 mt-0.5">
                  Multimodal Ring Evidence Intelligence &bull; Powered by Amazon Bedrock
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

        {/* Section: Entrance Selector (if multiple exist) */}
        {entrances.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Compass className="h-3.5 w-3.5 text-sky-400" />
              Entrances:
            </span>
            {entrances.map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => handleSelectEntrance(ent)}
                className={`rounded-lg px-3 py-1 text-xs font-medium border transition ${
                  selectedEntrance?.id === ent.id
                    ? "bg-sky-600/30 text-sky-200 border-sky-500/50"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                {ent.name}
              </button>
            ))}
          </div>
        )}

        {/* Section: Selected Entrance Assurance Card */}
        <EntranceAssuranceCard
          entrance={selectedEntrance}
          assuranceStatus={assuranceStatus}
          activeRemediation={activeRemediation}
          requirements={requirements}
          onAcknowledgeTask={handleAcknowledgeTask}
          onCompleteTask={handleCompleteTask}
          onRunVerificationCheck={handleRunVerificationCheck}
        />

        {/* Section: Multimodal Vision Analysis Panel (AWS Bedrock) */}
        <EvidenceAnalysisPanel
          latestObservation={latestObservation}
          latestEvidence={latestEvidence}
          loading={visionLoading}
          onRunAnalysis={handleRunVisionAnalysis}
        />

        {/* Grid layout for Timeline & Devices */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Evidence & Assurance Timeline */}
            <EvidenceTimeline
              timeline={timeline}
              loading={loading}
              onRefresh={() => selectedEntrance && loadAssuranceData(selectedEntrance.id)}
            />

            {/* Section: Ring Devices */}
            <DeviceList
              devices={devices}
              loading={loading}
              selectedDeviceId={selectedEntrance?.cameraBinding.deviceId}
              onSelectDevice={(dev) => setSelectedDevice(dev)}
              activeMode={activeMode}
            />
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Deterministic Simulator Scenario Controls */}
            <SimulatorControls
              onTriggerAction={() => selectedEntrance && loadAssuranceData(selectedEntrance.id)}
              selectedEntranceId={selectedEntrance?.id}
            />

            {/* Section: Raw Ring Events */}
            <ObservationFeed
              events={events}
              loading={loading}
              onRefreshEvents={() => loadData()}
              activeMode={activeMode}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-800/80 pt-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <p>
            OpenWay &bull; Real-time accessibility assurance for businesses &bull; Built for Amazon Ring &amp; AWS Bedrock
          </p>
          <div className="flex items-center gap-4">
            <span>Deterministic State Machine</span>
            <span>Multimodal Vision Intelligence</span>
            <span>WCAG 2.2 AA Target</span>
            <span>MIT License</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
