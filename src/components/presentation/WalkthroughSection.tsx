"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SectionHeading, StateBadge, focusRing } from "./primitives";

interface StateWalkthroughItem {
  id: "AVAILABLE" | "ACTION_REQUIRED" | "RECHECKING" | "VERIFIED_RESTORED" | "UNKNOWN";
  label: string;
  badge: "AVAILABLE" | "ACTION_REQUIRED" | "RECHECKING" | "VERIFIED_RESTORED" | "UNKNOWN";
  imageSrc: string;
  title: string;
  description: string;
  technicalDetails: {
    stateMachine: string;
    evidenceEvaluation: string;
    gatekeeperDecision: string;
    whyItMatters: string;
  };
}

const WALKTHROUGH_ITEMS: StateWalkthroughItem[] = [
  {
    id: "AVAILABLE",
    label: "1. Baseline Assurance",
    badge: "AVAILABLE",
    imageSrc: "/presentation/baseline_available.png",
    title: "Baseline Access Available & Configured Requirements Satisfied",
    description:
      "The single-screen Assurance Workbench displays the Side Accessible Entrance with verified baseline conditions. The compact service-status strip confirms the deterministic simulator, simulated vision fallback (Bedrock unavailable), and DynamoDB persistence. All configured entrance criteria (clear pathway, absent obstruction, operational power-assist door) are green.",
    technicalDetails: {
      stateMachine: "State: AVAILABLE (Restored Baseline)",
      evidenceEvaluation:
        "Left Evidence Panel: Camera snapshot captured, freshness FRESH, bound to Front Ramp Camera (SIMULATED_LOCAL).",
      gatekeeperDecision:
        "Baseline Verified: Pathway Clear, Obstruction Absent, Door Ready confirmed by deterministic gatekeeper.",
      whyItMatters:
        "Maintains continuous, verified physical entrance accessibility before any patron in a wheelchair arrives.",
    },
  },
  {
    id: "ACTION_REQUIRED",
    label: "2. Interruption Detected",
    badge: "ACTION_REQUIRED",
    imageSrc: "/presentation/action_required.png",
    title: "Access Interruption Detected & Accountable Remediation Dispatched",
    description:
      "Simulated motion at the ramp triggers snapshot acquisition and vision evaluation. Delivery boxes are detected directly blocking the ramp pathway. The workbench immediately transitions to ACTION_REQUIRED and dispatches an accountable staff remediation task with a unique task ID.",
    technicalDetails: {
      stateMachine: "AVAILABLE → ACTION_REQUIRED",
      evidenceEvaluation:
        "Vision analyzer detects delivery boxes on ramp; obstructionPresent: true with FRESH simulated snapshot.",
      gatekeeperDecision:
        "Preemptive Alert Dispatched: Immediate staff notification before patrons encounter the physical barrier.",
      whyItMatters:
        "Proactively catches barriers before visitors with disabilities are stranded or turned away at the door.",
    },
  },
  {
    id: "RECHECKING",
    label: "3. Staff Remediation & Lock",
    badge: "RECHECKING",
    imageSrc: "/presentation/rechecking.png",
    title: "Staff Reports Fix: System Locks in RECHECKING (Safety Barrier)",
    description:
      "Staff clears the ramp and taps 'Report Remediation Complete'. OpenWay strictly enforces the Core Invariant ('Detected ≠ resolved. Resolved ≠ verified'). The workbench refuses to turn green based on human say-so alone, locking into RECHECKING while requesting fresh camera evidence.",
    technicalDetails: {
      stateMachine: "ACTION_REQUIRED → RECHECKING",
      evidenceEvaluation:
        "remediationCompletedAt recorded; system issues immediate bounded recheck request for fresh camera frame.",
      gatekeeperDecision:
        "Core Invariant Barrier: Staff say-so is treated as a claim, strictly refusing VERIFIED_RESTORED.",
      whyItMatters:
        "Eliminates false human sign-offs from leaving undetected obstacles in place in physical spaces.",
    },
  },
  {
    id: "VERIFIED_RESTORED",
    label: "4. Canonical Verification",
    badge: "VERIFIED_RESTORED",
    imageSrc: "/presentation/verified_restored.png",
    title: "Fresh Post-Remediation Camera Evidence Proves Physical Clearance",
    description:
      "A fresh camera snapshot acquired after remediation completion (capturedAt ≥ completedAt) is evaluated against all 9 gatekeeper rules. Pathway is clear, obstruction is absent, and camera binding matches. Only with fresh post-remediation evidence does the gatekeeper canonically declare access restored.",
    technicalDetails: {
      stateMachine: "RECHECKING → VERIFIED_RESTORED",
      evidenceEvaluation:
        "Temporal freshness satisfied (capturedAt ≥ completedAt); pathwayClear: true, obstructionPresent: false.",
      gatekeeperDecision:
        "GATE_PASSED: All 9 verification conditions passed. Audit entry committed to DynamoDB.",
      whyItMatters:
        "Restoration declaration backed by reproducible hardware provenance and mathematical invariants.",
    },
  },
  {
    id: "UNKNOWN",
    label: "5. Fail-Closed Failsafe",
    badge: "UNKNOWN",
    imageSrc: "/presentation/unknown.png",
    title: "Safety Invariant Enforced: Default to UNKNOWN on Unobtainable Evidence",
    description:
      "When camera evidence is unavailable, stale (captured before cleanup was finished), or sensor signals conflict, OpenWay never guesses and never defaults to green. The workbench safely transitions to UNKNOWN, withholding green assurance until physical re-evaluation.",
    technicalDetails: {
      stateMachine: "RECHECKING → UNKNOWN",
      evidenceEvaluation:
        "Missing fresh evidence, stale pre-remediation frame, or vision model access denial detected.",
      gatekeeperDecision:
        "FAIL-CLOSED INVARIANT: Green status strictly withheld; system requires inconclusive-evidence resolution.",
      whyItMatters:
        "A false green in physical accessibility can trap or injure a visitor with mobility disabilities.",
    },
  },
];

export function WalkthroughSection() {
  const [activeTab, setActiveTab] = useState<StateWalkthroughItem["id"]>("AVAILABLE");

  const current = WALKTHROUGH_ITEMS.find((item) => item.id === activeTab) || WALKTHROUGH_ITEMS[0];

  return (
    <section id="walkthrough" className="relative py-20 sm:py-28 border-b border-ow-line bg-ow-navy/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="walkthrough-heading"
          eyebrow="Single-Screen Assurance Workbench"
          title={
            <>
              Interactive Walkthrough:{" "}
              <span className="text-ow-muted font-normal block sm:inline">
                Five phases of the assurance console.
              </span>
            </>
          }
          lead="Direct captures from the deployed OpenWay single-screen console showing how the operator workbench presents each phase of the workflow with explicit simulated-local evidence provenance."
        />

        {/* State Selection Tabs */}
        <div className="mt-10 flex flex-wrap gap-2 border-b border-ow-line pb-4" role="tablist">
          {WALKTHROUGH_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-ow-panel border border-ow-mint/50 text-ow-paper shadow-md"
                    : "bg-ow-navy/60 border border-ow-line/80 text-ow-muted hover:text-ow-paper hover:bg-ow-panel/60"
                } ${focusRing}`}
              >
                <span>{item.label}</span>
                <StateBadge state={item.badge} size="sm" />
              </button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Screenshot Display */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-ow-line bg-ow-panel p-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-ow-line px-3 py-2 text-xs text-ow-muted mb-2">
                <span className="font-mono text-[11px] text-ow-paper flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ow-mint" />
                  Workbench State: {current.id}
                </span>
                <span className="font-mono text-[10px] text-ow-subtle">
                  PROVENANCE: SIMULATED_LOCAL &middot; AWS us-east-1
                </span>
              </div>

              <div className="relative overflow-hidden rounded-xl bg-ow-ink">
                <Image
                  src={current.imageSrc}
                  alt={`OpenWay interface during ${current.title}`}
                  width={1280}
                  height={800}
                  className="w-full h-auto object-cover rounded-xl"
                />
              </div>

              <p className="mt-3 text-[11px] font-mono text-ow-subtle text-center">
                Unedited screenshot of single-screen Assurance Workbench (<code className="text-ow-muted">OperatorDashboard.tsx</code>) in production with simulated local evidence.
              </p>
            </div>
          </div>

          {/* Detailed Explanations */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-ow-line bg-ow-panel p-6 shadow-lg">
              <div className="flex items-center gap-2">
                <StateBadge state={current.badge} />
                <span className="font-mono text-[11px] text-ow-subtle">Workbench State</span>
              </div>

              <h3 className="mt-3 text-xl font-bold text-ow-paper leading-snug">
                {current.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-ow-muted">
                {current.description}
              </p>
            </div>

            <div className="rounded-2xl border border-ow-line bg-ow-panel p-6 space-y-4 text-xs shadow-lg">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ow-mint">
                Under the Hood: Deterministic Enforcement
              </h4>

              <div className="space-y-3">
                <div className="border-b border-ow-line/80 pb-2.5">
                  <span className="text-ow-subtle block font-mono text-[10px] uppercase">State Transition</span>
                  <span className="text-ow-paper font-mono font-medium">{current.technicalDetails.stateMachine}</span>
                </div>

                <div className="border-b border-ow-line/80 pb-2.5">
                  <span className="text-ow-subtle block font-mono text-[10px] uppercase">Evidence Pipeline</span>
                  <p className="text-ow-muted leading-relaxed">{current.technicalDetails.evidenceEvaluation}</p>
                </div>

                <div className="border-b border-ow-line/80 pb-2.5">
                  <span className="text-ow-subtle block font-mono text-[10px] uppercase">Gatekeeper Logic</span>
                  <p className="text-ow-muted leading-relaxed">{current.technicalDetails.gatekeeperDecision}</p>
                </div>

                <div>
                  <span className="text-ow-subtle block font-mono text-[10px] uppercase">Why It Matters</span>
                  <p className="text-ow-mint/90 font-medium leading-relaxed">{current.technicalDetails.whyItMatters}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
