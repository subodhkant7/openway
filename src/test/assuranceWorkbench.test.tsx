import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperatorDashboard } from "@/components/OperatorDashboard";

describe("Single-Screen Assurance Workbench (/console)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const urlStr = String(url);

        if (urlStr.includes("/api/ring/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: {
                  mode: "simulator",
                  state: "SIMULATED",
                  isConfigured: true,
                  baseUrl: "http://localhost:3000/simulator",
                  activeDeviceCount: 2,
                },
              }),
          });
        }

        if (urlStr.includes("/api/ring/devices")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                devices: [
                  {
                    id: "cam_front_entrance",
                    name: "Front Ramp Camera (Ring Wired Doorbell Plus)",
                    kind: "doorbell",
                    online: true,
                    status: "online",
                    capabilities: { supports_snapshots: true },
                    components: ["camera", "doorbell"],
                    batteryLevel: 95,
                  },
                ],
              }),
          });
        }

        if (urlStr.includes("/api/ring/events")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                events: [
                  {
                    eventId: "ev_1",
                    eventType: "motion",
                    deviceId: "cam_front_entrance",
                    timestamp: new Date().toISOString(),
                    summary: "Motion detected on accessible ramp",
                  },
                ],
              }),
          });
        }

        if (urlStr.includes("/api/entrances") && !urlStr.includes("/assurance") && !urlStr.includes("/timeline")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                entrances: [
                  {
                    id: "entrance_side_accessible",
                    venueId: "venue_demo",
                    name: "Side Accessible Entrance",
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
                  },
                ],
              }),
          });
        }

        if (urlStr.includes("/assurance")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                state: "AVAILABLE",
                currentAssessment: {
                  id: "assess_init",
                  entranceId: "entrance_side_accessible",
                  state: "AVAILABLE",
                  assessedAt: new Date().toISOString(),
                },
                activeRemediation: null,
                latestEvidence: {
                  id: "ev_init",
                  entranceId: "entrance_side_accessible",
                  deviceId: "cam_front_entrance",
                  componentId: "component_video_01",
                  capturedAt: new Date().toISOString(),
                  freshness: "FRESH",
                  provenance: "SIMULATED_LOCAL",
                  isSimulated: true,
                },
                latestObservation: {
                  id: "obs_init",
                  evidenceId: "ev_init",
                  entranceId: "entrance_side_accessible",
                  pathwayClear: "TRUE",
                  obstructionPresent: "FALSE",
                  doorReady: "TRUE",
                  confidence: 0.98,
                },
                requirements: {
                  pathwayClear: true,
                  obstructionFree: true,
                  doorReady: true,
                },
              }),
          });
        }

        if (urlStr.includes("/timeline")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                timeline: [
                  {
                    id: "audit_1",
                    type: "ACCESS_VERIFIED_RESTORED",
                    timestamp: new Date().toISOString(),
                    correlationId: "cid_1",
                    entityType: "ENTRANCE",
                    entityId: "entrance_side_accessible",
                    metadata: {
                      reason: "Baseline clear",
                      isSimulated: true,
                    },
                  },
                ],
              }),
          });
        }

        if (urlStr.includes("/api/ring/snapshot")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                imageEvidence: {
                  deviceId: "cam_front_entrance",
                  capturedAt: new Date().toISOString(),
                  dataUrl: "data:image/svg+xml;utf8,<svg></svg>",
                  isSimulated: true,
                },
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the single-screen workbench with all key regions visible", async () => {
    render(<OperatorDashboard />);

    // Top Navigation
    expect(screen.getByText("OPENWAY")).toBeInTheDocument();
    expect(screen.getByText("Accessibility Assurance for Ring")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /product overview/i })).toBeInTheDocument();

    // Truthful Service Status Strip
    expect(screen.getByText("SIMULATOR (Deterministic)")).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED \/ FALLBACK/i)).toBeInTheDocument();
    expect(screen.getByText("DYNAMODB (Operational)")).toBeInTheDocument();

    // Preselected Demo Entrance
    await waitFor(() => {
      expect(screen.getByText("Side Accessible Entrance")).toBeInTheDocument();
    });
    expect(screen.getByText("DEMO BENCHMARK ENTRANCE")).toBeInTheDocument();

    // 3 Main Columns
    expect(screen.getByText("Camera Evidence & Provenance")).toBeInTheDocument();
    expect(screen.getByText("Assurance State & Workflow Invariants")).toBeInTheDocument();
    expect(screen.getByText("Operator Action & Demo Journey")).toBeInTheDocument();

    // 4 Demo Sequence Stages
    expect(screen.getByText("1. Interruption")).toBeInTheDocument();
    expect(screen.getByText("2. Remediation")).toBeInTheDocument();
    expect(screen.getByText("3. Verify & Restore")).toBeInTheDocument();
    expect(screen.getByText("4. Fail-Closed")).toBeInTheDocument();

    // Recent Activity Strip
    expect(screen.getByText(/Recent Audit:/i)).toBeInTheDocument();
  });

  it("opens and closes the Nine-Point Gatekeeper modal", async () => {
    render(<OperatorDashboard />);

    const openBtn = screen.getByRole("button", { name: /View Nine-Point Gatekeeper Audit Report/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("dialog", { name: /Nine-Point Deterministic Restoration Gatekeeper/i })).toBeInTheDocument();
    expect(screen.getByText(/Rule 1: Workflow State Transition Rule/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule 3: Temporal Invariant/i)).toBeInTheDocument();

    // Close with Close Report button
    const closeBtn = screen.getByRole("button", { name: /Close Report/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens and closes the Full Audit Trail modal", async () => {
    render(<OperatorDashboard />);

    const openBtn = screen.getByRole("button", { name: /Full Audit Trail/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("dialog", { name: /Full Append-Only Audit Trail/i })).toBeInTheDocument();
    expect(screen.getByText("Immutable audit record backed by DynamoDB / durable memory storage")).toBeInTheDocument();

    // Close with Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens and closes the Secondary Invariants modal", async () => {
    render(<OperatorDashboard />);

    const openBtn = screen.getByRole("button", { name: /Secondary Failure Injections & Invariants/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("dialog", { name: /Secondary Failure-Injection & Invariant Defense Scenarios/i })).toBeInTheDocument();
    expect(screen.getByText(/Scenario C: False Completion Injection/i)).toBeInTheDocument();
    expect(screen.getByText(/Scenario F: Unbound Camera Tampering/i)).toBeInTheDocument();

    // Close dialog
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
