import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceRemediationControls } from "@/components/VoiceRemediationControls";
import { EntranceAssuranceCard } from "@/components/EntranceAssuranceCard";
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
import { Entrance, RemediationTask, AccessibilityRequirements } from "@/domain/types";

describe("Voice-Assisted Remediation Mode", () => {
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;

  const sampleEntrance: Entrance = {
    id: "entrance_side_accessible",
    venueId: "venue_demo_cafe",
    name: "Side Accessible Entrance",
    description: "Ramp entrance on side alley",
    enabled: true,
    cameraBinding: {
      deviceId: "device_ring_01",
      componentId: "camera_main",
      deviceName: "Side Ramp Ring Cam",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const sampleTask: RemediationTask = {
    id: "task_123",
    entranceId: "entrance_side_accessible",
    triggerAssessmentId: "assess_123",
    status: "OPEN",
    reason: "Delivery packages blocking access ramp",
    createdAt: "2026-10-06T10:00:00Z",
  };

  const defaultRequirements: AccessibilityRequirements = {
    pathwayClear: true,
    obstructionFree: true,
    doorReady: true,
  };

  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();

    // Mock Web Speech API on window
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        speaking: false,
        paused: false,
        pending: false,
        onvoiceschanged: null,
        getVoices: () => [],
        pause: vi.fn(),
        resume: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Mock SpeechSynthesisUtterance constructor
    globalThis.SpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({
      text,
      lang: "en-US",
      pitch: 1,
      rate: 1,
      volume: 1,
      onstart: null,
      onend: null,
      onerror: null,
    }));

    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Requirement 1: Speech synthesis unavailable: UI remains functional
  // --------------------------------------------------------------------------
  it("Requirement 1: handles unavailable speech synthesis gracefully without breaking UI", () => {
    // Delete speechSynthesis to simulate unsupported browser
    Object.defineProperty(window, "speechSynthesis", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
      />
    );

    expect(screen.getByText(/Speech synthesis unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Voice-Assisted Remediation")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Voice announcements default to Off
  // --------------------------------------------------------------------------
  it("Requirement 2: voice announcements default to OFF (opt-in)", () => {
    render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
      />
    );

    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Voice Announcements: OFF/i)).toBeInTheDocument();
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Enabling announcements does not replay old transitions
  // --------------------------------------------------------------------------
  it("Requirement 3: enabling announcements does not replay old/pre-existing transitions", () => {
    // Render initially in ACTION_REQUIRED with announcements OFF
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );

    expect(mockSpeak).not.toHaveBeenCalled();

    // User clicks the toggle to turn announcements ON
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Voice Announcements: ON/i)).toBeInTheDocument();

    // Must NOT replay the pre-existing ACTION_REQUIRED state!
    expect(mockSpeak).not.toHaveBeenCalled();

    // Rerender with the same state to verify it still doesn't speak
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Requirement 4: ACTION_REQUIRED produces the appropriate announcement
  // --------------------------------------------------------------------------
  it("Requirement 4: transitions to ACTION_REQUIRED announce interruption with entrance details", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);
    expect(mockSpeak).not.toHaveBeenCalled();

    // Authoritative transition to ACTION_REQUIRED
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const spokenUtterance = mockSpeak.mock.calls[0][0];
    expect(spokenUtterance.text).toBe(
      "Accessibility interruption detected at the Side Accessible Entrance. A pathway obstruction was observed. Staff remediation is required."
    );
  });

  // --------------------------------------------------------------------------
  // Requirement 5: RECHECKING explicitly says restoration is unverified
  // --------------------------------------------------------------------------
  it("Requirement 5: transitions to RECHECKING explicitly announce that restoration is unverified", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    // Staff completes task -> transitions to RECHECKING
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="RECHECKING"
        activeRemediation={{ ...sampleTask, status: "COMPLETED" }}
      />
    );

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const spokenUtterance = mockSpeak.mock.calls[0][0];
    expect(spokenUtterance.text).toBe(
      "Staff reported the obstruction cleared. Restoration has not been verified."
    );
    expect(spokenUtterance.text).not.toContain("restoration verified");
  });

  // --------------------------------------------------------------------------
  // Requirement 6: VERIFIED_RESTORED is announced only after authoritative verified state
  // --------------------------------------------------------------------------
  it("Requirement 6: VERIFIED_RESTORED announces verified restoration only following authoritative gatekeeper pass", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="RECHECKING"
        activeRemediation={{ ...sampleTask, status: "COMPLETED" }}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    // Transition to VERIFIED_RESTORED
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="VERIFIED_RESTORED"
        activeRemediation={null}
      />
    );

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const spokenUtterance = mockSpeak.mock.calls[0][0];
    expect(spokenUtterance.text).toBe(
      "Fresh evidence has passed verification. Access restoration is verified."
    );
  });

  // --------------------------------------------------------------------------
  // Requirement 7: UNKNOWN never produces a success announcement
  // --------------------------------------------------------------------------
  it("Requirement 7: UNKNOWN announcement fail-closes and never announces success", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="RECHECKING"
        activeRemediation={{ ...sampleTask, status: "COMPLETED" }}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    // Evidence fails gatekeeper -> transitions to UNKNOWN
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="UNKNOWN"
        activeRemediation={null}
      />
    );

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const spokenUtterance = mockSpeak.mock.calls[0][0];
    expect(spokenUtterance.text).toBe(
      "Restoration could not be verified. The access status remains unknown. Please inspect the entrance."
    );
    expect(spokenUtterance.text).not.toContain("restoration is verified");
    expect(spokenUtterance.text).not.toContain("success");
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Duplicate renders/events do not repeat the same announcement
  // --------------------------------------------------------------------------
  it("Requirement 8: duplicate renders or repeated polling do not trigger redundant announcements", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    // Transition to ACTION_REQUIRED -> spoken once
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // 5 repeated renders with identical state (simulating polling interval)
    for (let i = 0; i < 5; i++) {
      rerender(
        <VoiceRemediationControls
          entrance={sampleEntrance}
          assuranceStatus="ACTION_REQUIRED"
          activeRemediation={sampleTask}
        />
      );
    }

    // Call count remains strictly 1
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Stop cancels active/queued speech
  // --------------------------------------------------------------------------
  it("Requirement 9: Stop button cancels active speech synthesis immediately", () => {
    render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );

    // Click Read Task Aloud to start speech
    const readBtn = screen.getByRole("button", { name: /Read remediation task aloud/i });
    fireEvent.click(readBtn);

    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Click Stop button
    const stopBtn = screen.getByRole("button", { name: /Stop speaking immediately/i });
    fireEvent.click(stopBtn);

    expect(mockCancel).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Missing task fields do not produce fabricated details
  // --------------------------------------------------------------------------
  it("Requirement 10: missing task fields do not produce fabricated details", () => {
    // Task with missing/empty reason
    const sparseTask: RemediationTask = {
      id: "task_sparse",
      entranceId: "entrance_side_accessible",
      triggerAssessmentId: "assess_sparse",
      status: "OPEN",
      reason: "",
      createdAt: "2026-10-06T10:00:00Z",
    };

    const text = formatTaskForSpeech(sparseTask, sampleEntrance.name);

    expect(text).toContain("Location: Side Accessible Entrance.");
    expect(text).toContain("Observed obstruction: Pathway obstruction.");
    expect(text).toContain("Current status: OPEN.");
    expect(text).not.toContain("delivery box");
    expect(text).not.toContain("trash");

    // Case when no task exists
    const noTaskText = formatTaskForSpeech(null, sampleEntrance.name);
    expect(noTaskText).toBe("There is no active remediation task for this entrance.");
  });

  // --------------------------------------------------------------------------
  // Requirement 11: Changing state while speech is queued cancels stale announcements
  // --------------------------------------------------------------------------
  it("Requirement 11: changing state while speech is queued cancels prior speech before announcing", () => {
    const { rerender } = render(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="AVAILABLE"
        activeRemediation={null}
      />
    );

    // Enable announcements
    const toggle = screen.getByRole("switch", { name: /Toggle voice announcements/i });
    fireEvent.click(toggle);

    // First transition: ACTION_REQUIRED
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
      />
    );
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    mockCancel.mockClear();

    // Rapid subsequent transition to RECHECKING while speech is playing
    rerender(
      <VoiceRemediationControls
        entrance={sampleEntrance}
        assuranceStatus="RECHECKING"
        activeRemediation={{ ...sampleTask, status: "COMPLETED" }}
      />
    );

    // cancelSpeech() must have been called before new speech to drop stale speech
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(2);
    expect(mockSpeak.mock.calls[1][0].text).toBe(
      "Staff reported the obstruction cleared. Restoration has not been verified."
    );
  });

  // --------------------------------------------------------------------------
  // Requirement 12: Existing verification and remediation behavior remains unchanged
  // --------------------------------------------------------------------------
  it("Requirement 12: EntranceAssuranceCard user actions and callbacks work identically with voice integration", () => {
    const handleAcknowledge = vi.fn();
    const handleComplete = vi.fn();
    const handleVerify = vi.fn();

    render(
      <EntranceAssuranceCard
        entrance={sampleEntrance}
        assuranceStatus="ACTION_REQUIRED"
        activeRemediation={sampleTask}
        requirements={defaultRequirements}
        onAcknowledgeTask={handleAcknowledge}
        onCompleteTask={handleComplete}
        onRunVerificationCheck={handleVerify}
      />
    );

    // Voice controls are mounted and visible
    expect(screen.getByText("Voice-Assisted Remediation")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Toggle voice announcements/i })).toBeInTheDocument();

    // Standard Acknowledge button still functions
    const ackBtn = screen.getByRole("button", { name: /Acknowledge/i });
    fireEvent.click(ackBtn);
    expect(handleAcknowledge).toHaveBeenCalledWith("task_123");

    // Standard Report Fixed button still functions
    const completeBtn = screen.getByRole("button", { name: /Report Fixed/i });
    fireEvent.click(completeBtn);
    expect(handleComplete).toHaveBeenCalledWith("task_123");
  });

  // --------------------------------------------------------------------------
  // Unit tests for helper string builders in voiceSynthesis.ts
  // --------------------------------------------------------------------------
  it("voiceSynthesis string builders produce exact required wording", () => {
    // Interruption
    expect(getInterruptionAnnouncement("Side Accessible Entrance")).toBe(
      "Accessibility interruption detected at the Side Accessible Entrance. A pathway obstruction was observed. Staff remediation is required."
    );
    expect(getInterruptionAnnouncement("")).toBe(
      "Accessibility interruption detected. A pathway obstruction was observed. Staff remediation is required."
    );

    // Staff completed
    expect(getStaffCompletedAnnouncement()).toBe(
      "Staff reported the obstruction cleared. Restoration has not been verified."
    );

    // Verified restored
    expect(getVerifiedRestorationAnnouncement()).toBe(
      "Fresh evidence has passed verification. Access restoration is verified."
    );

    // Unknown
    expect(getUnknownAnnouncement()).toBe(
      "Restoration could not be verified. The access status remains unknown. Please inspect the entrance."
    );
  });

  it("handles empty speech text and speaking callbacks cleanly", () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    // Empty text should complete without speaking
    speakText("   ", { onStart, onEnd });
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();

    // Normal text invokes callbacks on utterance events
    speakText("Hello venue", { onStart, onEnd });
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];

    // Trigger onstart and onend
    utterance.onstart();
    expect(onStart).toHaveBeenCalled();

    utterance.onend();
    expect(onEnd).toHaveBeenCalledTimes(2); // once from empty text, once from end
  });
});
