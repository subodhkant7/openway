/**
 * OpenWay — Client-Side Voice Synthesis & Announcement Services
 *
 * ARCHITECTURAL PRINCIPLE:
 * Voice is strictly a presentation and accessibility layer.
 * It NEVER:
 * - authorizes a state transition;
 * - marks a remediation task complete;
 * - triggers physical actions;
 * - bypasses policy or verification;
 * - declares restoration independently of the deterministic state machine;
 * - changes UNKNOWN into a positive state;
 * - makes claims unsupported by actual system state.
 *
 * Client-side only. Uses the browser's built-in Web Speech API (speechSynthesis).
 * Zero server-side audio processing, zero paid voice services, zero microphone access.
 */

import { RemediationTask } from "@/domain/types";

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
  cancelPrevious?: boolean;
  rate?: number;
  pitch?: number;
  lang?: string;
}

// Holds reference to active utterance to prevent garbage collection cut-off
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Checks whether the browser supports the Web Speech API speechSynthesis capability.
 * Safely handles server-side rendering (SSR) environments.
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "speechSynthesis" in window &&
    Boolean(window.speechSynthesis) &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Checks if speech is currently active.
 */
export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  try {
    return window.speechSynthesis.speaking;
  } catch {
    return false;
  }
}

/**
 * Immediately cancels all active and queued speech synthesis.
 */
export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  } catch (err) {
    console.warn("[VoiceAnnouncer] Error cancelling speech:", err);
  }
}

/**
 * Speaks text using the browser's native SpeechSynthesis API.
 */
export function speakText(text: string, options?: SpeakOptions): void {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.(new Error("Speech synthesis not supported"));
    return;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return;
  }

  try {
    if (options?.cancelPrevious !== false) {
      window.speechSynthesis.cancel();
    }

    const utterance = new window.SpeechSynthesisUtterance(trimmed);
    utterance.lang = options?.lang || "en-US";
    utterance.rate = options?.rate || 1.0;
    utterance.pitch = options?.pitch || 1.0;

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      activeUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = (event) => {
      activeUtterance = null;
      options?.onError?.(event);
      options?.onEnd?.();
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    activeUtterance = null;
    console.warn("[VoiceAnnouncer] Failed to speak utterance:", err);
    options?.onError?.(err);
    options?.onEnd?.();
  }
}

/**
 * Builds the announcement for an accessibility interruption (ACTION_REQUIRED).
 * Formula: "Accessibility interruption detected at the [entrance.name]. A pathway obstruction was observed. Staff remediation is required."
 */
export function getInterruptionAnnouncement(entranceName?: string): string {
  if (entranceName && entranceName.trim()) {
    return `Accessibility interruption detected at the ${entranceName.trim()}. A pathway obstruction was observed. Staff remediation is required.`;
  }
  return "Accessibility interruption detected. A pathway obstruction was observed. Staff remediation is required.";
}

/**
 * Builds the announcement when staff reports completion (RECHECKING).
 * Must not sound like a resolution.
 */
export function getStaffCompletedAnnouncement(): string {
  return "Staff reported the obstruction cleared. Restoration has not been verified.";
}

/**
 * Builds the announcement for verified restoration (VERIFIED_RESTORED).
 * Only announced following deterministic verification proof.
 */
export function getVerifiedRestorationAnnouncement(): string {
  return "Fresh evidence has passed verification. Access restoration is verified.";
}

/**
 * Builds the announcement for unknown outcome (UNKNOWN).
 * Fail-closed state; never sounds positive.
 */
export function getUnknownAnnouncement(): string {
  return "Restoration could not be verified. The access status remains unknown. Please inspect the entrance.";
}

/**
 * Formats a remediation task into concise, understandable speech for a busy workplace.
 * Reads actual available fields without fabricating missing details.
 */
export function formatTaskForSpeech(task: RemediationTask | null | undefined, entranceName?: string): string {
  if (!task) {
    return "There is no active remediation task for this entrance.";
  }

  const parts: string[] = [];

  if (entranceName && entranceName.trim()) {
    parts.push(`Location: ${entranceName.trim()}.`);
  }

  if (task.reason && task.reason.trim()) {
    parts.push(`Observed obstruction: ${task.reason.trim()}.`);
  } else {
    parts.push("Observed obstruction: Pathway obstruction.");
  }

  parts.push(`Current status: ${task.status}.`);
  parts.push("Remediation instructions: Clear the configured access pathway and ensure entrance is unobstructed.");

  switch (task.status) {
    case "OPEN":
      parts.push("Next action: Staff must acknowledge and clear the physical pathway.");
      break;
    case "ACKNOWLEDGED":
      parts.push("Next action: Clear the obstruction and report the task complete.");
      break;
    case "COMPLETED":
      parts.push("Next action: Awaiting fresh camera evidence verification.");
      break;
    case "CANCELLED":
      parts.push("Next action: Task cancelled. No further action required.");
      break;
    default:
      parts.push("Next action: Inspect the entrance.");
  }

  return parts.join(" ");
}
