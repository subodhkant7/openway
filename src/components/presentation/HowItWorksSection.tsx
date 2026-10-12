import React from "react";
import { SectionHeading, StateBadge } from "./primitives";

interface Step {
  num: string;
  stateBadge: "ACTION_REQUIRED" | "RECHECKING" | "VERIFIED_RESTORED" | "UNKNOWN";
  title: string;
  subtitle: string;
  details: string[];
  invariantNote: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    stateBadge: "ACTION_REQUIRED",
    title: "Event-Driven Detection",
    subtitle: "Ring Motion & Ding Evidence",
    details: [
      "Hardware event from Ring Doorbell or Spotlight Cam triggers webhook.",
      "Webhook verified using HMAC-SHA256 with timing-safe comparison.",
      "Entrance-bound camera captures image snapshot in volatile memory.",
      "Vision analysis evaluates configured entrance criteria (ramp pathway, obstruction, door clearance).",
    ],
    invariantNote: "State transitions to ACTION_REQUIRED. Preemptive alert dispatched before visitors arrive.",
  },
  {
    num: "02",
    stateBadge: "ACTION_REQUIRED",
    title: "Accountable Remediation",
    subtitle: "Staff Dispatch & Tracking",
    details: [
      "OpenWay generates an accountable remediation task with deterministic ID.",
      "Staff receives task details: entrance ID, bound camera component, and physical impediment.",
      "Optional Voice-Assisted Remediation mode provides speech readout directly on staff devices.",
      "Staff member acknowledges task and proceeds to physical location.",
    ],
    invariantNote: "Voice assistance is presentation-only and cannot authorize state transitions or bypass policy.",
  },
  {
    num: "03",
    stateBadge: "RECHECKING",
    title: "Remediation Reported",
    subtitle: "The Safety Barrier (Locked in RECHECKING)",
    details: [
      "Staff physically clears the obstacle and reports completion with timestamp completedAt.",
      "Core Invariant Barrier: System refuses to declare restoration.",
      "Entrance state locks into RECHECKING.",
      "System issues an immediate bounded recheck request for fresh camera evidence.",
    ],
    invariantNote: "“Detected ≠ resolved. Resolved ≠ verified.” Staff completion is treated as a claim, not proof.",
  },
  {
    num: "04",
    stateBadge: "VERIFIED_RESTORED",
    title: "Deterministic Verification",
    subtitle: "9-Point Pure Gatekeeper Evaluation",
    details: [
      "Fresh Ring snapshot captured with timestamp capturedAt ≥ completedAt.",
      "Gatekeeper verifies camera binding (deviceId, componentId) and venue matching.",
      "Evaluates temporal freshness and tests for absence of contradiction.",
      "Confirms all configured accessibility requirements are explicitly satisfied.",
    ],
    invariantNote: "If all 9 pass: VERIFIED_RESTORED. If missing, stale, or contradicted: fails closed to UNKNOWN.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 border-b border-ow-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="how-it-works-heading"
          eyebrow="The Closed-Loop Assurance Cycle"
          title={
            <>
              How OpenWay verifies access,{" "}
              <span className="text-ow-mint font-normal block sm:inline">
                step by deterministic step.
              </span>
            </>
          }
          lead="Every state transition in OpenWay is governed by a pure deterministic state machine and an immutable 9-point gatekeeper. Here is how an access barrier moves from initial camera detection to verified restoration."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className="relative rounded-2xl border border-ow-line bg-ow-panel p-6 flex flex-col justify-between shadow-lg hover:border-ow-mint/40 transition"
            >
              <div>
                <div className="flex items-center justify-between border-b border-ow-line/80 pb-3">
                  <span className="font-mono text-2xl font-bold text-ow-mint/70">{step.num}</span>
                  <StateBadge state={step.stateBadge} size="sm" />
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-semibold text-ow-paper">{step.title}</h3>
                  <p className="text-xs font-mono text-ow-subtle mt-0.5">{step.subtitle}</p>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-ow-muted">
                  {step.details.map((detail, dIdx) => (
                    <li key={dIdx} className="flex items-start gap-1.5">
                      <span className="text-ow-mint font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-3 border-t border-ow-line/70">
                <p className="text-[11px] font-mono leading-relaxed text-ow-mint/90">
                  {step.invariantNote}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* The 9-point Gatekeeper Conditions Detail Card */}
        <div className="mt-12 rounded-2xl border border-ow-mint/30 bg-ow-panel/90 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ow-line pb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ow-mint font-semibold">
                Pure Deterministic Gatekeeper
              </span>
              <h3 className="text-lg font-bold text-ow-paper mt-1">
                The 9 Mandatory Verification Conditions
              </h3>
            </div>
            <div className="font-mono text-xs text-ow-muted">
              Source: <code className="text-ow-paper bg-ow-raised px-2 py-1 rounded">src/policy/restorationGatekeeper.ts</code>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">1. Valid State</span>
              <p className="mt-1 text-ow-muted">Entrance must be currently locked in <span className="font-mono text-ow-recheck">RECHECKING</span>.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">2. Task Exists</span>
              <p className="mt-1 text-ow-muted">Remediation task exists and has status <span className="font-mono text-ow-mint">COMPLETED</span>.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">3. Temporal Freshness</span>
              <p className="mt-1 text-ow-muted">Evidence capture timestamp strictly follows remediation: <code className="text-ow-paper font-mono">capturedAt ≥ completedAt</code>.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">4. Entrance Matching</span>
              <p className="mt-1 text-ow-muted">Evidence belongs to the exact entrance and tenant venue being evaluated.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">5. Camera Binding</span>
              <p className="mt-1 text-ow-muted">Hardware device ID and video component match the entrance configuration.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">6. Window Freshness</span>
              <p className="mt-1 text-ow-muted">Evidence captured within the configured freshness window (default: 300s).</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">7. Requirements Met</span>
              <p className="mt-1 text-ow-muted">Configured accessibility rules explicitly satisfied (pathway clear, obstruction free).</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">8. Zero Contradictions</span>
              <p className="mt-1 text-ow-muted">No conflicting or contradictory observations exist in the verification window.</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/60 p-3">
              <span className="font-mono text-ow-mint font-bold">9. Provenance Integrity</span>
              <p className="mt-1 text-ow-muted">Evidence provenance is valid and honest (simulated vs live credentials never conflated).</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
