import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperatorDashboard } from "@/components/OperatorDashboard";
import { GatekeeperReportModal } from "@/components/console/GatekeeperReportModal";
import { Entrance, AccessAssessment } from "@/domain/types";

describe("Regression Hardening: State Integrity & Gatekeeper Reports", () => {
  const mockEntrance: Entrance = {
    id: "entrance_side_accessible",
    venueId: "venue_main",
    name: "Side Accessible Entrance",
    description: "Main accessible ramp and automatic door",
    enabled: true,
    cameraBinding: {
      deviceId: "cam_front_entrance",
      componentId: "component_video_01",
      deviceName: "Front Ramp Camera (Ring Wired Doorbell Plus)",
    },
    requirements: {
      pathwayClear: true,
      obstructionFree: true,
      doorReady: true,
    },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };

  const mockRestoredAssessment: AccessAssessment = {
    id: "assess_restored_123456",
    entranceId: "entrance_side_accessible",
    state: "VERIFIED_RESTORED",
    reasonCode: "VERIFIED_RESTORED",
    reason: "All 9 verification conditions passed. Physical restoration proven by fresh post-remediation evidence.",
    evidenceIds: ["evi_fresh_999"],
    observationIds: ["obs_clear_999"],
    policyVersion: "1.0.0",
    assessedAt: "2026-10-22T10:00:00.000Z",
  };

  describe("GatekeeperReportModal Report Fidelity", () => {
    it("displays the authentic recorded decision report (9/9 passed) when state is VERIFIED_RESTORED", () => {
      render(
        <GatekeeperReportModal
          isOpen={true}
          onClose={vi.fn()}
          entrance={mockEntrance}
          assuranceStatus="VERIFIED_RESTORED"
          activeRemediation={null}
          latestEvidence={null}
          latestObservation={null}
          latestAssessment={mockRestoredAssessment}
        />
      );

      // Verify modal title shows Decision Record
      expect(
        screen.getByRole("dialog", {
          name: /Nine-Point Deterministic Restoration Gatekeeper — Decision Record/i,
        })
      ).toBeInTheDocument();

      // Verify 9/9 passed badge is present
      expect(screen.getByText("9/9 RULES PASSED")).toBeInTheDocument();

      // Verify decision metadata is displayed
      expect(screen.getByText(/Decision ID: assess_restored_123456/i)).toBeInTheDocument();
      expect(screen.getByText(/Restoration Authorized — All 9 Invariants Satisfied/i)).toBeInTheDocument();

      // Verify decision-time rule text
      expect(screen.getByText(/Verified at decision time: Evaluated strictly from predecessor RECHECKING state/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified at decision time: capturedAt ≥ completedAt/i)).toBeInTheDocument();
    });

    it("displays current-state readiness evaluation (never misrepresenting as historical) when not restored", () => {
      render(
        <GatekeeperReportModal
          isOpen={true}
          onClose={vi.fn()}
          entrance={mockEntrance}
          assuranceStatus="ACTION_REQUIRED"
          activeRemediation={null}
          latestEvidence={null}
          latestObservation={null}
          latestAssessment={null}
        />
      );

      // Verify modal title indicates Current-State Readiness
      expect(
        screen.getByRole("dialog", {
          name: /Nine-Point Deterministic Restoration Gatekeeper — Current-State Readiness/i,
        })
      ).toBeInTheDocument();

      // Verify readiness label
      expect(screen.getByText(/RULES READY/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Live Pre-Flight Readiness Evaluation/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Current State: ACTION_REQUIRED/i)).toBeInTheDocument();
    });
  });

  describe("OperatorDashboard State Machine & Synchronization", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => {
          const urlStr = String(url);

          if (urlStr.includes("/api/ring/status")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ status: { mode: "simulator", state: "SIMULATED", activeDeviceCount: 1 } }),
            });
          }
          if (urlStr.includes("/api/ring/devices")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ devices: [mockEntrance.cameraBinding] }),
            });
          }
          if (urlStr.includes("/api/ring/events")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [] }) });
          }
          if (urlStr.includes("/api/entrances") && !urlStr.includes("assurance") && !urlStr.includes("timeline")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ entrances: [mockEntrance] }),
            });
          }
          if (urlStr.includes("/api/ring/snapshot")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
          }

          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        })
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("displays VERIFIED_RESTORED state immediately and matches authoritative scenario outcome", async () => {
      let currentMockState = "RECHECKING";

      (fetch as any).mockImplementation((url: string) => {
        const urlStr = String(url);
        if (urlStr.includes("/api/entrances/entrance_side_accessible/assurance")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                state: currentMockState,
                entrance: mockEntrance,
                currentAssessment: currentMockState === "VERIFIED_RESTORED" ? mockRestoredAssessment : null,
              }),
          });
        }
        if (urlStr.includes("/api/entrances/entrance_side_accessible/timeline")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ timeline: [] }) });
        }
        if (urlStr.includes("/api/simulator/scenario")) {
          currentMockState = "VERIFIED_RESTORED";
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                result: {
                  scenario: "RUN_VERIFICATION",
                  resultingState: "VERIFIED_RESTORED",
                  description: "Resolution / Fresh Verification: gate passes.",
                },
              }),
          });
        }
        if (urlStr.includes("/api/ring/status")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: { mode: "simulator" } }) });
        }
        if (urlStr.includes("/api/ring/devices")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ devices: [] }) });
        }
        if (urlStr.includes("/api/ring/events")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [] }) });
        }
        if (urlStr.includes("/api/entrances") && !urlStr.includes("assurance") && !urlStr.includes("timeline")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ entrances: [mockEntrance] }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<OperatorDashboard />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Side Accessible Entrance")).toBeInTheDocument();
      });

      // Click "3. Verify & Restore"
      const verifyBtn = screen.getByRole("button", { name: /3\. Verify & Restore/i });
      fireEvent.click(verifyBtn);

      // Verify that badge displays ACCESS RESTORED — VERIFIED
      await waitFor(() => {
        expect(screen.getByText("ACCESS RESTORED — VERIFIED")).toBeInTheDocument();
      });
    });

    it("displays ASSESSMENT UNKNOWN when fail-closed scenario executes, and does NOT keep green badge", async () => {
      let currentMockState = "VERIFIED_RESTORED";

      (fetch as any).mockImplementation((url: string) => {
        const urlStr = String(url);
        if (urlStr.includes("/api/entrances/entrance_side_accessible/assurance")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                state: currentMockState,
                entrance: mockEntrance,
                currentAssessment: {
                  id: "assess_unknown_999",
                  state: currentMockState,
                  assessedAt: "2026-10-22T10:05:00.000Z",
                },
              }),
          });
        }
        if (urlStr.includes("/api/entrances/entrance_side_accessible/timeline")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ timeline: [] }) });
        }
        if (urlStr.includes("/api/simulator/scenario")) {
          currentMockState = "UNKNOWN";
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                result: {
                  scenario: "RUN_UNKNOWN_VERIFICATION",
                  resultingState: "UNKNOWN",
                  description: "Verification Unavailable: safely transitions to UNKNOWN.",
                },
              }),
          });
        }
        if (urlStr.includes("/api/ring/status")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: { mode: "simulator" } }) });
        }
        if (urlStr.includes("/api/ring/devices")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ devices: [] }) });
        }
        if (urlStr.includes("/api/ring/events")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [] }) });
        }
        if (urlStr.includes("/api/entrances") && !urlStr.includes("assurance") && !urlStr.includes("timeline")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ entrances: [mockEntrance] }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<OperatorDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Side Accessible Entrance")).toBeInTheDocument();
      });

      // Click "4. Fail-Closed"
      const failClosedBtn = screen.getByRole("button", { name: /4\. Fail-Closed/i });
      fireEvent.click(failClosedBtn);

      // Verify that badge transitions to ASSESSMENT UNKNOWN and green badge is absent
      await waitFor(() => {
        expect(screen.getByText("ASSESSMENT UNKNOWN")).toBeInTheDocument();
        expect(screen.queryByText("ACCESS RESTORED — VERIFIED")).not.toBeInTheDocument();
      });
    });
  });
});
