"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { RingDevice, RingEvent, RingProviderStatus, RingImageEvidence } from "@/ring/types";
import {
  Entrance,
  AssuranceState,
  RemediationTask,
  AuditEvent,
  AccessibilityRequirements,
  AccessAssessment,
} from "@/domain/types";
import { Evidence } from "@/evidence/types";
import { DetailedVisionObservation } from "@/vision/VisionAnalyzer";
import { SimulatorScenarioName } from "@/workflow/simulatorWorkflow";
import { ServiceStatusStrip } from "./console/ServiceStatusStrip";
import { GatekeeperReportModal } from "./console/GatekeeperReportModal";
import { FullAuditTrailModal } from "./console/FullAuditTrailModal";
import { RingTelemetryModal } from "./console/RingTelemetryModal";
import { VisionDiagnosticsModal } from "./console/VisionDiagnosticsModal";
import { SecondaryScenariosModal } from "./console/SecondaryScenariosModal";
import {
  ShieldCheck,
  Video,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Check,
  X,
  Camera,
  History,
  Sparkles,
  Zap,
  UserCheck,
  Volume2,
  VolumeX,
  Eye,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";
import {
  isSpeechSynthesisSupported,
  speakText,
  cancelSpeech,
  formatTaskForSpeech,
} from "@/lib/voiceSynthesis";

export function OperatorDashboard() {
  const [activeMode, setActiveMode] = useState<"simulator" | "playground" | "api">("simulator");
  const [status, setStatus] = useState<RingProviderStatus | null>(null);
  const [devices, setDevices] = useState<RingDevice[]>([]);
  const [events, setEvents] = useState<RingEvent[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RingDevice | null>(null);

  // Domain & Vision States
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<Entrance | null>(null);
  const [assuranceStatus, setAssuranceStatus] = useState<AssuranceState | "UNCONFIGURED">("AVAILABLE");
  const [activeRemediation, setActiveRemediation] = useState<RemediationTask | null>(null);
  const [latestAssessment, setLatestAssessment] = useState<AccessAssessment | null>(null);
  const [latestEvidence, setLatestEvidence] = useState<Evidence | null>(null);
  const [latestObservation, setLatestObservation] = useState<DetailedVisionObservation | null>(null);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [requirements, setRequirements] = useState<AccessibilityRequirements>({
    pathwayClear: true,
    obstructionFree: true,
    doorReady: true,
  });

  // Camera Snapshot State
  const [snapshotEvidence, setSnapshotEvidence] = useState<RingImageEvidence | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Progressive Disclosure Dialog States
  const [isGatekeeperModalOpen, setIsGatekeeperModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isRingModalOpen, setIsRingModalOpen] = useState(false);
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [isScenariosModalOpen, setIsScenariosModalOpen] = useState(false);

  // UI & Action States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeScenarioName, setActiveScenarioName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"evidence" | "assurance" | "actions">("assurance");

  // Voice Announcement State
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastStateRef = useRef<AssuranceState | "UNCONFIGURED" | null>(null);
  const latestAssuranceReqRef = useRef<number>(0);
  const lastScenarioTimeRef = useRef<number>(0);

  // Fetch Camera Image Evidence
  const loadCameraSnapshot = useCallback(async (deviceId: string, mode: string) => {
    setSnapshotLoading(true);
    try {
      const res = await fetch(`/api/ring/snapshot?deviceId=${encodeURIComponent(deviceId)}&mode=${mode}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success && (data.imageEvidence || data.snapshot)) {
        setSnapshotEvidence(data.imageEvidence || data.snapshot);
      }
    } catch (err) {
      console.error("[Dashboard] Snapshot fetch error:", err);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  // Fetch entrance assurance, latest evidence, observation, and timeline
  const loadAssuranceData = useCallback(async (entranceId: string) => {
    const reqTimestamp = Date.now();
    latestAssuranceReqRef.current = reqTimestamp;

    try {
      const [assureRes, timeRes] = await Promise.all([
        fetch(`/api/entrances/${entranceId}/assurance?t=${reqTimestamp}`, { cache: "no-store" }),
        fetch(`/api/entrances/${entranceId}/timeline?limit=25&t=${reqTimestamp}`, { cache: "no-store" }),
      ]);

      // Guard against out-of-order delayed responses overwriting newer authoritative state
      if (reqTimestamp < latestAssuranceReqRef.current) {
        return;
      }

      if (assureRes.ok) {
        const assureData = await assureRes.json();
        const incomingTime = assureData.currentAssessment?.assessedAt
          ? new Date(assureData.currentAssessment.assessedAt).getTime()
          : 0;

        // If an optimistic scenario was run within the last 5 seconds and incoming assessment is older, do not regress!
        const isStaleRead =
          Date.now() - lastScenarioTimeRef.current < 5000 &&
          incomingTime < lastScenarioTimeRef.current;

        if (!isStaleRead) {
          setAssuranceStatus(assureData.state);
          setLatestAssessment(assureData.currentAssessment || null);
        }
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
        // In demo environment, preselect entrance_side_accessible if it exists
        const demoEnt = entData.entrances.find((e: Entrance) => e.id === "entrance_side_accessible");
        const currentEntrance = selectedEntrance || demoEnt || entData.entrances[0];
        setSelectedEntrance(currentEntrance);
        await loadAssuranceData(currentEntrance.id);

        if (currentEntrance.cameraBinding?.deviceId) {
          loadCameraSnapshot(currentEntrance.cameraBinding.deviceId, mode);
        }
      }
    } catch (err) {
      console.error("Failed to load OpenWay dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeMode, selectedDevice, selectedEntrance, loadAssuranceData, loadCameraSnapshot]);

  useEffect(() => {
    loadData(activeMode);
  }, [activeMode, loadData]);

  // Voice announcement handling on state transition
  useEffect(() => {
    if (!voiceEnabled || !isSpeechSynthesisSupported()) return;
    if (lastStateRef.current && lastStateRef.current !== assuranceStatus) {
      let announcement = "";
      if (assuranceStatus === "INTERRUPTED" || assuranceStatus === "ACTION_REQUIRED") {
        announcement = "Attention. Accessibility interruption detected at Side Accessible Entrance. Physical remediation required.";
      } else if (assuranceStatus === "RECHECKING") {
        announcement = "Remediation reported. Bounded verification is requesting fresh Ring camera evidence.";
      } else if (assuranceStatus === "VERIFIED_RESTORED") {
        announcement = "Accessibility restored and verified with fresh camera evidence. Entrance is clear.";
      } else if (assuranceStatus === "UNKNOWN") {
        announcement = "Assessment unknown. OpenWay has failed closed to protect safety.";
      }
      if (announcement) {
        cancelSpeech();
        speakText(announcement, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    }
    lastStateRef.current = assuranceStatus;
  }, [assuranceStatus, voiceEnabled]);

  const handleModeChange = (mode: "simulator" | "playground" | "api") => {
    setActiveMode(mode);
    loadData(mode);
  };

  const handleSelectEntrance = async (entrance: Entrance) => {
    setSelectedEntrance(entrance);
    await loadAssuranceData(entrance.id);
    if (entrance.cameraBinding?.deviceId) {
      loadCameraSnapshot(entrance.cameraBinding.deviceId, activeMode);
    }
  };

  const handleAcknowledgeTask = async (taskId: string) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      await fetch(`/api/remediation/${taskId}/acknowledge`, { method: "POST" });
      setFeedback("Remediation task acknowledged by staff operator.");
      if (selectedEntrance) await loadAssuranceData(selectedEntrance.id);
    } catch (err) {
      setFeedback(`Failed to acknowledge task: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      await fetch(`/api/remediation/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy: "Staff Operator" }),
      });
      setFeedback("Staff remediation reported complete. State transitioned to RECHECKING. Awaiting fresh evidence.");
      if (selectedEntrance) await loadAssuranceData(selectedEntrance.id);
    } catch (err) {
      setFeedback(`Failed to complete task: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunVerificationCheck = async () => {
    if (!selectedEntrance) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      if (activeRemediation?.id) {
        const res = await fetch(`/api/remediation/${activeRemediation.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxAttempts: 1 }),
        });
        const data = await res.json();
        if (data.finalState === "VERIFIED_RESTORED" || data.success) {
          setAssuranceStatus("VERIFIED_RESTORED");
          setLatestAssessment((prev) => ({
            ...(prev || {
              entranceId: selectedEntrance.id,
              policyVersion: "1.0.0",
              evidenceIds: [],
              observationIds: [],
            }),
            id: `assess_restored_${Date.now()}`,
            state: "VERIFIED_RESTORED",
            reasonCode: "VERIFIED_RESTORED",
            reason: data.explanation || "All 9 verification conditions passed.",
            assessedAt: new Date().toISOString(),
          }));
        }
        setFeedback(data.explanation || "Fresh evidence evaluated against all 9 gatekeeper rules.");
      } else {
        const res = await fetch("/api/simulator/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: "RUN_VERIFICATION",
            entranceId: selectedEntrance.id,
          }),
        });
        const data = await res.json();
        if (data.result?.resultingState === "VERIFIED_RESTORED") {
          setAssuranceStatus("VERIFIED_RESTORED");
          setLatestAssessment((prev) => ({
            ...(prev || {
              entranceId: selectedEntrance.id,
              policyVersion: "1.0.0",
              evidenceIds: [],
              observationIds: [],
            }),
            id: `assess_restored_${Date.now()}`,
            state: "VERIFIED_RESTORED",
            reasonCode: "VERIFIED_RESTORED",
            reason: data.result?.explanation || "All 9 verification conditions passed.",
            assessedAt: new Date().toISOString(),
          }));
        }
        setFeedback(data.result?.explanation || "Verification check executed.");
      }
      await loadAssuranceData(selectedEntrance.id);
      if (selectedEntrance.cameraBinding?.deviceId) {
        loadCameraSnapshot(selectedEntrance.cameraBinding.deviceId, activeMode);
      }
    } catch (err) {
      setFeedback(`Failed to run verification: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const runScenario = async (scenario: SimulatorScenarioName) => {
    if (!selectedEntrance) return;
    setActionLoading(true);
    setActiveScenarioName(scenario);
    setFeedback(null);
    try {
      const res = await fetch("/api/simulator/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          entranceId: selectedEntrance.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        lastScenarioTimeRef.current = Date.now();
        if (data.result.resultingState && data.result.resultingState !== "REJECTED") {
          const resultingState = data.result.resultingState as AssuranceState;
          setAssuranceStatus(resultingState);
          setLatestAssessment((prev) => ({
            ...(prev || {
              entranceId: selectedEntrance.id,
              policyVersion: "1.0.0",
              evidenceIds: [],
              observationIds: [],
            }),
            id: `assess_${resultingState.toLowerCase()}_${Date.now()}`,
            state: resultingState,
            reasonCode: resultingState,
            reason: data.result.explanation || data.result.description,
            assessedAt: new Date().toISOString(),
          }));
        }
        setFeedback(
          `${data.result.description} → Resulting State: ${data.result.resultingState}`
        );
        await loadAssuranceData(selectedEntrance.id);
        if (selectedEntrance.cameraBinding?.deviceId) {
          loadCameraSnapshot(selectedEntrance.cameraBinding.deviceId, activeMode);
        }
      } else {
        setFeedback(`Error: ${data.error || "Scenario failed"}`);
      }
    } catch (err) {
      setFeedback(`Failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setActionLoading(false);
      setActiveScenarioName(null);
    }
  };

  const resetDemo = async () => {
    if (!selectedEntrance) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entranceId: selectedEntrance.id }),
      });
      const data = await res.json();
      if (data.success) {
        lastScenarioTimeRef.current = Date.now();
        setAssuranceStatus("AVAILABLE");
        setLatestAssessment({
          id: `assess_reset_${Date.now()}`,
          entranceId: selectedEntrance.id,
          state: "AVAILABLE",
          reasonCode: "INITIAL_BASELINE",
          reason: "Demo baseline cleanly restored: Entrance state reset to AVAILABLE.",
          evidenceIds: [],
          observationIds: [],
          policyVersion: "1.0.0",
          assessedAt: new Date().toISOString(),
        });
        setFeedback("Demo baseline cleanly restored: Entrance state reset to AVAILABLE.");
        await loadAssuranceData(selectedEntrance.id);
        if (selectedEntrance.cameraBinding?.deviceId) {
          loadCameraSnapshot(selectedEntrance.cameraBinding.deviceId, activeMode);
        }
      } else {
        setFeedback(`Error resetting demo: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setFeedback(`Reset failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  // State Badge Rendering
  const renderAssuranceBadge = () => {
    switch (assuranceStatus) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ACCESS AVAILABLE
          </span>
        );
      case "VERIFIED_RESTORED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/50">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ACCESS RESTORED — VERIFIED
          </span>
        );
      case "INTERRUPTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            ACCESS INTERRUPTED
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/40">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            ACTION REQUIRED
          </span>
        );
      case "RECHECKING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-0.5 text-xs font-semibold text-sky-300 border border-sky-500/40">
            <RefreshCw className="h-3.5 w-3.5 text-sky-400 animate-spin" aria-hidden="true" />
            RECHECKING (REQUESTING FRESH EVIDENCE)
          </span>
        );
      case "UNKNOWN":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            ASSESSMENT UNKNOWN
          </span>
        );
    }
  };

  // Determine Primary Context-Sensitive Next Action
  const isInterrupted = assuranceStatus === "INTERRUPTED" || assuranceStatus === "ACTION_REQUIRED";
  const isRechecking = assuranceStatus === "RECHECKING";
  const isAvailable = assuranceStatus === "AVAILABLE" || assuranceStatus === "VERIFIED_RESTORED";
  const isUnknown = assuranceStatus === "UNKNOWN";

  // Recent 2 or 3 audit events for the bottom strip
  const recentAuditEvents = timeline.slice(0, 3);

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen flex flex-col bg-[#090d16] text-slate-100 lg:overflow-hidden select-none">
      <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 1. Compact Top Navigation Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 p-1.5 text-white shadow-md">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>OPENWAY</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Accessibility Assurance for Ring
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 hidden sm:inline">
                  v0.1.0
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Voice Assistant Toggle */}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                voiceEnabled
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle native browser voice announcements on state transitions"
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Voice: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Voice: OFF</span>
                </>
              )}
            </button>

            {/* Back to Presentation Link */}
            <Link
              href="/"
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
              aria-label="Product Overview"
            >
              <span aria-hidden="true">&larr;</span>
              <span>Product Overview</span>
            </Link>
          </div>
        </header>

        {/* 2. Compact Service-Status Strip */}
        <ServiceStatusStrip
          ringStatus={status}
          activeMode={activeMode}
          onOpenRingModal={() => setIsRingModalOpen(true)}
          onOpenVisionModal={() => setIsVisionModalOpen(true)}
          onResetDemo={resetDemo}
          resetLoading={actionLoading}
        />

        {/* 3. Selected-Entrance Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/40 px-4 py-2 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <span>{selectedEntrance?.name || "Side Accessible Entrance"}</span>
              <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                DEMO BENCHMARK ENTRANCE
              </span>
            </span>

            <span className="text-slate-500 hidden md:inline">&bull;</span>

            <span className="text-slate-400 hidden md:inline">
              Bound Camera:{" "}
              <strong className="text-sky-300 font-mono">
                {selectedEntrance?.cameraBinding.deviceName || selectedEntrance?.cameraBinding.deviceId}
              </strong>
            </span>

            {entrances.length > 1 && (
              <div className="flex items-center gap-1">
                {entrances.map((ent) => (
                  <button
                    key={ent.id}
                    type="button"
                    onClick={() => handleSelectEntrance(ent)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium border transition ${
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
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Last Assessed: <strong className="text-slate-200 font-mono">{formatTime(latestAssessment?.assessedAt)}</strong>
            </span>
            <div>{renderAssuranceBadge()}</div>
          </div>
        </div>

        {/* Mobile Tab Selector (Visible on < lg screens only) */}
        <div className="lg:hidden flex border-b border-slate-800 bg-slate-950 p-1 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("assurance")}
            className={`flex-1 py-1.5 font-medium rounded text-center transition ${
              mobileTab === "assurance" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Assurance State
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("actions")}
            className={`flex-1 py-1.5 font-medium rounded text-center transition ${
              mobileTab === "actions" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Operator Actions
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("evidence")}
            className={`flex-1 py-1.5 font-medium rounded text-center transition ${
              mobileTab === "evidence" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Camera Evidence
          </button>
        </div>

        {/* 4. Three-Column Main Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 p-3 overflow-y-auto lg:overflow-hidden">
          {/* ========================================================================= */}
          {/* COLUMN 1: Camera Evidence & Provenance (3.5 cols desktop) */}
          {/* ========================================================================= */}
          <section
            aria-labelledby="col1-heading"
            className={`col-span-12 lg:col-span-4 xl:col-span-3.5 flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-md min-h-0 justify-between ${
              mobileTab === "evidence" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  Camera Evidence &amp; Provenance
                </span>
                <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                  SIMULATED_LOCAL
                </span>
              </div>

              {/* Snapshot Preview Container */}
              <div className="mt-2.5 relative rounded-lg border border-slate-800 bg-slate-950 overflow-hidden aspect-video max-h-[175px] md:max-h-[190px] xl:max-h-[220px] flex items-center justify-center">
                {snapshotEvidence?.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={snapshotEvidence.dataUrl}
                    alt="Camera observation evidence of accessible entrance"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="h-8 w-8 text-sky-500/60 mb-1" />
                    <span className="text-xs font-semibold text-slate-300">
                      Front Ramp Camera Feed
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Wheelchair ramp &amp; entrance threshold observation
                    </span>
                  </div>
                )}

                {/* Honest Simulation Badge Overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="rounded bg-black/70 backdrop-blur-sm px-1.5 py-0.5 font-mono text-[9px] text-sky-300 border border-sky-500/30">
                    CAM_01: FRONT_RAMP
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="rounded bg-amber-950/80 backdrop-blur-sm px-1.5 py-0.5 font-mono text-[9px] text-amber-300 border border-amber-500/40">
                    SIMULATED LOCAL EVIDENCE
                  </span>
                </div>
              </div>

              {/* Provenance & Telemetry Metadata Strip */}
              <div className="mt-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Captured:</span>
                  <span className="font-mono text-slate-200">
                    {formatTime(latestEvidence?.capturedAt || activeRemediation?.completedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Freshness Status:</span>
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 text-[10px]">
                    {latestEvidence?.freshness || "FRESH"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hardware Binding:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[160px]">
                    {selectedEntrance?.cameraBinding.deviceId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Component Stream:</span>
                  <span className="font-mono text-slate-400 text-[11px]">
                    {selectedEntrance?.cameraBinding.componentId}
                  </span>
                </div>
              </div>
            </div>

            {/* Evidence Drawer Triggers */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
              <button
                type="button"
                onClick={() => setIsVisionModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/30 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-900/40 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Multimodal Vision Diagnostics</span>
              </button>

              <button
                type="button"
                disabled={snapshotLoading}
                onClick={() => {
                  if (selectedEntrance?.cameraBinding?.deviceId) {
                    loadCameraSnapshot(selectedEntrance.cameraBinding.deviceId, activeMode);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${snapshotLoading ? "animate-spin text-sky-400" : "text-slate-400"}`} />
                <span>{snapshotLoading ? "Refreshing Evidence..." : "Refresh Camera Evidence"}</span>
              </button>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* COLUMN 2: Current Assurance State & Safety Barrier (4.5 cols desktop) */}
          {/* ========================================================================= */}
          <section
            aria-labelledby="col2-heading"
            className={`col-span-12 lg:col-span-4 xl:col-span-4.5 flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-md min-h-0 justify-between ${
              mobileTab === "assurance" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Assurance State &amp; Workflow Invariants
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  DETERMINISTIC
                </span>
              </div>

              {/* Dynamic Context Status Box */}
              <div className="mt-2.5 space-y-2">
                {isAvailable && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>ENTRANCE OPEN &amp; FULLY ACCESSIBLE</span>
                    </div>
                    <p className="text-[11px] text-emerald-200/90">
                      Physical access pathway is clear of obstacles. Power-assist door ready. State confirmed by deterministic gatekeeper.
                    </p>
                  </div>
                )}

                {isInterrupted && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-950/25 p-3 space-y-1.5 animate-pulse">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        ACCESS INTERRUPTION DETECTED
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Task: {activeRemediation?.id || "OPEN"}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-200">
                      <strong>Observed Issue:</strong> {activeRemediation?.reason || latestObservation?.explanation || "Ramp pathway obstructed."}
                    </p>
                    <p className="text-[10px] text-amber-300">
                      Staff action required: Clear the physical obstruction, then report task completed.
                    </p>
                  </div>
                )}

                {isRechecking && (
                  <div className="rounded-lg border border-sky-500/40 bg-sky-950/25 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-300 flex items-center gap-1.5">
                        <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />
                        REMEDIATION REPORTED &mdash; RECHECKING
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatTime(activeRemediation?.completedAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-200">
                      Staff reported fix. Bounded verification is evaluating fresh Ring evidence (capturedAt &ge; completedAt).
                    </p>
                    <p className="text-[10px] text-amber-300 font-medium">
                      Invariant 1 Enforced: Staff completion is NEVER accepted as proof of physical restoration.
                    </p>
                  </div>
                )}

                {isUnknown && (
                  <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <HelpCircle className="h-4 w-4 text-slate-400" />
                      <span>ASSESSMENT UNKNOWN &mdash; FAIL-CLOSED</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      OpenWay could not verify sufficient fresh evidence or detected contradictory sensor signals.
                    </p>
                    <p className="text-[10px] text-amber-300">
                      Safety Invariant: Green status strictly withheld until conclusive evidence is obtained.
                    </p>
                  </div>
                )}
              </div>

              {/* Three Typed Requirements Badges */}
              <div className="mt-2.5">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Physical Accessibility Requirements:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div
                    className={`rounded-lg border p-1.5 text-[11px] font-medium flex flex-col items-center justify-center ${
                      requirements.pathwayClear && !isInterrupted
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {requirements.pathwayClear && !isInterrupted ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 text-rose-400" />
                      )}
                      <span>Pathway</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5">Clear</span>
                  </div>

                  <div
                    className={`rounded-lg border p-1.5 text-[11px] font-medium flex flex-col items-center justify-center ${
                      requirements.obstructionFree && !isInterrupted
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {requirements.obstructionFree && !isInterrupted ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 text-rose-400" />
                      )}
                      <span>Obstruction</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5">Absent</span>
                  </div>

                  <div
                    className={`rounded-lg border p-1.5 text-[11px] font-medium flex flex-col items-center justify-center ${
                      requirements.doorReady && !isInterrupted
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {requirements.doorReady && !isInterrupted ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <X className="h-3 w-3 text-rose-400" />
                      )}
                      <span>Door Push</span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5">Ready</span>
                  </div>
                </div>
              </div>

              {/* Core Principle Callout */}
              <div className="mt-2.5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5 text-[11px] text-slate-300">
                <strong className="text-emerald-400 block font-semibold mb-0.5">
                  Core Invariant:
                </strong>
                <blockquote className="italic text-slate-400 text-[10px]">
                  &ldquo;Detected &ne; resolved. Resolved &ne; verified. VERIFIED_RESTORED strictly requires fresh camera evidence captured after remediation completion.&rdquo;
                </blockquote>
              </div>
            </div>

            {/* Nine-Point Gatekeeper Modal Trigger */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsGatekeeperModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40 transition"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>View Nine-Point Gatekeeper Audit Report</span>
              </button>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* COLUMN 3: Context-Sensitive Operator Action & Demo Journey (4 cols desktop) */}
          {/* ========================================================================= */}
          <section
            aria-labelledby="col3-heading"
            className={`col-span-12 lg:col-span-4 xl:col-span-4 flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-md min-h-0 justify-between ${
              mobileTab === "actions" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Operator Action &amp; Demo Journey
                </span>
                <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-mono text-amber-300">
                  INTERACTIVE
                </span>
              </div>

              {/* Dominant Next Action Callout based on actual state */}
              <div className="mt-2.5 rounded-xl border border-sky-500/40 bg-slate-950/80 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    Recommended Next Action
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    State: {assuranceStatus}
                  </span>
                </div>

                {isInterrupted && activeRemediation && (
                  <div className="space-y-2">
                    {activeRemediation.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleAcknowledgeTask(activeRemediation.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-600/30 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-600/50 transition disabled:opacity-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Acknowledge Task ({activeRemediation.id})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleCompleteTask(activeRemediation.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-600/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-600/50 transition shadow-lg animate-pulse disabled:opacity-50"
                    >
                      <Check className="h-4 w-4 text-amber-400" />
                      <span>Report Remediation Complete (Move to Recheck)</span>
                    </button>
                  </div>
                )}

                {isRechecking && (
                  <div>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleRunVerificationCheck}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/30 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-600/50 transition shadow-lg animate-pulse disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span>Evaluate Fresh Ring Evidence Now</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      Evaluates fresh post-remediation evidence against all 9 gatekeeper rules.
                    </p>
                  </div>
                )}

                {isAvailable && (
                  <div>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => runScenario("RUN_PREEMPTIVE_OBSTRUCTION")}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600/25 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-600/40 transition shadow-md disabled:opacity-50"
                    >
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      <span>Trigger Interruption Demo (Inject Obstruction)</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      Entrance is available. Click to begin judge demo cycle.
                    </p>
                  </div>
                )}

                {isUnknown && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleRunVerificationCheck}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                      <span>Re-evaluate Verification Conditions</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={resetDemo}
                      className="w-full inline-flex items-center justify-center gap-1 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition"
                    >
                      <span>Reset to Clean Baseline</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Primary 4-Stage Demo Story Sequence */}
              <div className="mt-2.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Primary Product Story Sequence (1-Click)
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Step 1: Interruption */}
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => runScenario("RUN_PREEMPTIVE_OBSTRUCTION")}
                    className={`rounded-lg border p-2 text-left transition disabled:opacity-50 ${
                      isAvailable
                        ? "border-rose-500/60 bg-rose-950/40 text-rose-200 ring-1 ring-rose-500/40"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <AlertTriangle className="h-3 w-3 text-rose-400 flex-shrink-0" />
                      <span>1. Interruption</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
                      Ring motion &rarr; INTERRUPTED
                    </span>
                  </button>

                  {/* Step 2: Staff Remediation */}
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => runScenario("RUN_STAFF_REMEDIATION")}
                    className={`rounded-lg border p-2 text-left transition disabled:opacity-50 ${
                      isInterrupted
                        ? "border-sky-500/60 bg-sky-950/40 text-sky-200 ring-1 ring-sky-500/40"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <UserCheck className="h-3 w-3 text-sky-400 flex-shrink-0" />
                      <span>2. Remediation</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
                      Staff reports &rarr; RECHECKING
                    </span>
                  </button>

                  {/* Step 3: Canonical Verification & Restoration */}
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => runScenario("RUN_VERIFICATION")}
                    className={`rounded-lg border p-2 text-left transition disabled:opacity-50 ${
                      isRechecking
                        ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-500/40"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <ShieldCheck className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                      <span>3. Verify &amp; Restore</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
                      Fresh Ring evidence &rarr; VERIFIED
                    </span>
                  </button>

                  {/* Step 4: Fail-Closed UNKNOWN Failure Demo */}
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => runScenario("RUN_UNKNOWN_VERIFICATION")}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:border-slate-700 text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <HelpCircle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                      <span>4. Fail-Closed</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
                      Missing/Stale &rarr; UNKNOWN
                    </span>
                  </button>
                </div>
              </div>

              {/* Feedback Strip */}
              {feedback && (
                <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-200">
                  {feedback}
                </div>
              )}
            </div>

            {/* Secondary Invariant Suite Drawer Trigger */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsScenariosModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/30 transition"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Secondary Failure Injections &amp; Invariants (Scenarios C, F, G, H)</span>
              </button>
            </div>
          </section>
        </div>

        {/* 5. Compact Recent-Activity Strip (Bottom) */}
        <footer className="border-t border-slate-800 bg-slate-950 px-4 py-2 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1 shrink-0">
              <History className="h-3.5 w-3.5" />
              Recent Audit:
            </span>

            {recentAuditEvents.length === 0 ? (
              <span className="text-slate-500 text-[11px]">No audit events logged yet</span>
            ) : (
              recentAuditEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-1.5 rounded bg-slate-900 border border-slate-800/80 px-2 py-0.5 shrink-0"
                >
                  <span className="font-mono text-[10px] text-slate-400">{formatTime(ev.timestamp)}</span>
                  <span className="text-[10px] font-semibold text-slate-200">
                    {ev.type.replace(/_/g, " ")}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <span>Full Audit Trail ({timeline.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRingModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <Video className="h-3 w-3 text-sky-400" />
              <span>Ring Hardware ({devices.length})</span>
            </button>
          </div>
        </footer>
      </main>

      {/* ========================================================================= */}
      {/* Progressive Disclosure Dialog Overlays */}
      {/* ========================================================================= */}
      <GatekeeperReportModal
        isOpen={isGatekeeperModalOpen}
        onClose={() => setIsGatekeeperModalOpen(false)}
        entrance={selectedEntrance}
        assuranceStatus={assuranceStatus}
        activeRemediation={activeRemediation}
        latestEvidence={latestEvidence}
        latestObservation={latestObservation}
        latestAssessment={latestAssessment}
      />

      <FullAuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        timeline={timeline}
        loading={loading}
        onRefresh={() => selectedEntrance && loadAssuranceData(selectedEntrance.id)}
        entranceName={selectedEntrance?.name}
      />

      <RingTelemetryModal
        isOpen={isRingModalOpen}
        onClose={() => setIsRingModalOpen(false)}
        status={status}
        devices={devices}
        events={events}
        loading={loading}
        activeMode={activeMode}
        onModeChange={handleModeChange}
        onRefresh={() => loadData()}
        selectedDeviceId={selectedEntrance?.cameraBinding.deviceId}
        onSelectDevice={(dev) => setSelectedDevice(dev)}
      />

      <VisionDiagnosticsModal
        isOpen={isVisionModalOpen}
        onClose={() => setIsVisionModalOpen(false)}
        latestObservation={latestObservation}
        latestEvidence={latestEvidence}
        loading={actionLoading}
        onRunAnalysis={async () => {
          if (!selectedEntrance) return;
          setActionLoading(true);
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
            console.error("Vision analysis failed:", err);
          } finally {
            setActionLoading(false);
          }
        }}
      />

      <SecondaryScenariosModal
        isOpen={isScenariosModalOpen}
        onClose={() => setIsScenariosModalOpen(false)}
        selectedEntranceId={selectedEntrance?.id}
        onScenarioExecuted={() => selectedEntrance && loadAssuranceData(selectedEntrance.id)}
      />
    </div>
  );
}
