"use client";

import React, { useState, useEffect, useRef } from "react";
import { Entrance, AssuranceState, RemediationTask } from "@/domain/types";
import {
  isSpeechSynthesisSupported,
  speakText,
  cancelSpeech,
  getInterruptionAnnouncement,
  getStaffCompletedAnnouncement,
  getVerifiedRestorationAnnouncement,
  getUnknownAnnouncement,
  formatTaskForSpeech,
} from "@/lib/voiceSynthesis";
import { Volume2, VolumeX, Square, Volume1, AlertCircle } from "lucide-react";

interface VoiceRemediationControlsProps {
  entrance: Entrance | null;
  assuranceStatus: AssuranceState | "UNCONFIGURED";
  activeRemediation: RemediationTask | null;
  className?: string;
}

export function VoiceRemediationControls({
  entrance,
  assuranceStatus,
  activeRemediation,
  className = "",
}: VoiceRemediationControlsProps) {
  // Voice announcements default to OFF (opt-in presentation feature)
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(() => isSpeechSynthesisSupported());
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // References for tracking authoritative transitions and avoiding duplicate/stale announcements
  const lastStateRef = useRef<AssuranceState | "UNCONFIGURED" | null>(assuranceStatus);
  const lastEntranceIdRef = useRef<string | null>(entrance?.id || null);
  const isMountedRef = useRef<boolean>(false);

  // Check Web Speech API support safely on client mount
  useEffect(() => {
    setIsSupported(isSpeechSynthesisSupported());

    // Optional preference retrieval
    try {
      const saved = localStorage.getItem("openway_voice_announcements");
      if (saved === "true") {
        setIsEnabled(true);
      }
    } catch {
      // Storage unavailable or disabled
    }

    return () => {
      cancelSpeech();
    };
  }, []);

  // Watch for authoritative state transitions
  useEffect(() => {
    // If first run, establish baseline and exit without speaking
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      lastStateRef.current = assuranceStatus;
      lastEntranceIdRef.current = entrance?.id || null;
      return;
    }

    // If entrance changed, re-baseline to the new entrance without announcing old state
    if (entrance?.id !== lastEntranceIdRef.current) {
      lastEntranceIdRef.current = entrance?.id || null;
      lastStateRef.current = assuranceStatus;
      return;
    }

    // If announcements are disabled, simply keep baseline updated
    if (!isEnabled) {
      lastStateRef.current = assuranceStatus;
      return;
    }

    // Check if a genuine state transition occurred
    const previousState = lastStateRef.current;
    if (assuranceStatus === previousState) {
      // Duplicate render, polling, or unchanged state — do NOT repeat announcement
      return;
    }

    // Update baseline to the new state
    lastStateRef.current = assuranceStatus;

    // Immediately cancel any active/queued speech before announcing new authoritative state
    cancelSpeech();
    setIsSpeaking(false);

    // Formulate state-aware announcement
    let announcementText: string | null = null;
    switch (assuranceStatus) {
      case "ACTION_REQUIRED":
        announcementText = getInterruptionAnnouncement(entrance?.name);
        break;
      case "RECHECKING":
        announcementText = getStaffCompletedAnnouncement();
        break;
      case "VERIFIED_RESTORED":
        announcementText = getVerifiedRestorationAnnouncement();
        break;
      case "UNKNOWN":
        announcementText = getUnknownAnnouncement();
        break;
      default:
        // Other states (e.g. AVAILABLE, UNCONFIGURED) are not spontaneously narrated
        announcementText = null;
    }

    if (announcementText) {
      setFeedbackMessage("Announcing status change...");
      speakText(announcementText, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          setFeedbackMessage(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setFeedbackMessage(null);
        },
      });
    }
  }, [assuranceStatus, entrance?.id, entrance?.name, isEnabled]);

  // Handle toggling voice announcements
  const handleToggleAnnouncements = () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);

    // Crucial: When enabling, baseline the current state so old transitions are NOT replayed
    lastStateRef.current = assuranceStatus;
    lastEntranceIdRef.current = entrance?.id || null;

    if (!nextState) {
      // Stopped/disabled
      cancelSpeech();
      setIsSpeaking(false);
      setFeedbackMessage(null);
    }

    try {
      localStorage.setItem("openway_voice_announcements", nextState ? "true" : "false");
    } catch {
      // Ignored
    }
  };

  // Handle Stop button
  const handleStopSpeaking = () => {
    cancelSpeech();
    setIsSpeaking(false);
    setFeedbackMessage(null);
  };

  // Handle Read Task Aloud
  const handleReadTask = () => {
    if (!isSupported) {
      setFeedbackMessage("Voice synthesis not supported in this browser.");
      return;
    }

    const taskText = formatTaskForSpeech(activeRemediation, entrance?.name);
    setFeedbackMessage(activeRemediation ? "Reading task aloud..." : "No active task to read.");

    cancelSpeech();
    speakText(taskText, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        setFeedbackMessage(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setFeedbackMessage(null);
      },
    });
  };

  return (
    <div
      aria-label="Voice-Assisted Remediation Controls"
      className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Title & Capability Label */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-sky-950/60 border border-sky-500/30 p-1.5 text-sky-400">
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <span className="font-semibold text-slate-200 block text-[11px] uppercase tracking-wider">
              Voice-Assisted Remediation
            </span>
            <span className="text-[10px] text-slate-400">
              Native browser speech synthesis &bull; Presentation only &bull; Client-side
            </span>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isSupported ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              <AlertCircle className="h-3 w-3" />
              Speech synthesis unavailable
            </span>
          ) : (
            <>
              {/* Voice Announcements Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label="Toggle voice announcements"
                onClick={handleToggleAnnouncements}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isEnabled
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                }`}
              >
                {isEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Voice Announcements: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <span>Voice Announcements: OFF</span>
                  </>
                )}
              </button>

              {/* Read Task Aloud Button */}
              <button
                type="button"
                onClick={handleReadTask}
                aria-label="Read remediation task aloud"
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/20 border border-sky-500/30 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-600/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Volume1 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Read Task Aloud</span>
              </button>

              {/* Stop Speaking Button */}
              <button
                type="button"
                onClick={handleStopSpeaking}
                disabled={!isSpeaking}
                aria-label="Stop speaking immediately"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  isSpeaking
                    ? "bg-rose-600/20 border-rose-500/40 text-rose-300 hover:bg-rose-600/30 cursor-pointer"
                    : "bg-slate-900 border-slate-800/80 text-slate-600 cursor-not-allowed opacity-50"
                }`}
              >
                <Square className="h-3 w-3 text-rose-400" aria-hidden="true" />
                <span>Stop</span>
              </button>

              {/* Speaking Indicator */}
              {isSpeaking && (
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 motion-safe:animate-pulse"
                >
                  <Volume2 className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  Speaking...
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Visual Feedback Message */}
      {feedbackMessage && (
        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <span role="status" aria-live="polite">
            {feedbackMessage}
          </span>
          {!activeRemediation && feedbackMessage.includes("No active task") && (
            <span className="text-slate-500 italic">No physical obstruction currently recorded</span>
          )}
        </div>
      )}
    </div>
  );
}
