"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SectionHeading, StateBadge, focusRing } from "./primitives";

interface StateWalkthroughItem {
  id: "ACTION_REQUIRED" | "RECHECKING" | "VERIFIED_RESTORED" | "UNKNOWN";
  label: string;
  badge: "ACTION_REQUIRED" | "RECHECKING" | "VERIFIED_RESTORED" | "UNKNOWN";
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
    id: "ACTION_REQUIRED",
    label: "1. Interruption Detected",
    badge: "ACTION_REQUIRED",
    imageSrc: "/presentation/action_required.png",
    title: "Access Interruption Detected & Remediation Task Created",
    description:
      "A Ring motion event triggers snapshot capture and vision evaluation. Delivery boxes are detected directly on the wheelchair ramp. OpenWay immediately dispatches an accountable remediation task.",
    technicalDetails: {
      stateMachine: "AVAILABLE → ACTION_REQUIRED",
      evidenceEvaluation: "Vision model observes obstructionPresent: true on bound ramp camera.",
      gatekeeperDecision: "Alert dispatched immediately; task assigned status OPEN.",
      whyItMatters: "Preemptive warning before a patron in a wheelchair is stranded at the entrance.",
    },
  },
  {
    id: "RECHECKING",
    label: "2. Staff Remediation & Lock",
    badge: "RECHECKING",
    imageSrc: "/presentation/rechecking.png",
    title: "Staff Reports Fixed: System Locks in RECHECKING",
    description:
      "Staff clears the ramp and taps 'Report Fixed'. OpenWay strictly refuses to declare the entrance restored based on human say-so alone. The entrance locks into RECHECKING while fresh camera evidence is requested.",
    technicalDetails: {
      stateMachine: "ACTION_REQUIRED → RECHECKING",
      evidenceEvaluation: "completedAt recorded; system issues recheck request for fresh camera frame.",
      gatekeeperDecision: "Refuses VERIFIED_RESTORED transition; staff claims are unverified hypotheses.",
      whyItMatters: "Prevents false signoffs from leaving undetected obstacles in place.",
    },
  },
  {
    id: "VERIFIED_RESTORED",
    label: "3. Canonical Verification",
    badge: "VERIFIED_RESTORED",
    imageSrc: "/presentation/verified_restored.png",
    title: "Fresh Camera Evidence Proves Physical Condition Changed",
    description:
      "A fresh snapshot captured after remediation completion is evaluated by the 9-point gatekeeper. Pathway is clear, obstruction is absent, and camera binding matches. Only then is access verified restored.",
    technicalDetails: {
      stateMachine: "RECHECKING → VERIFIED_RESTORED",
      evidenceEvaluation: "capturedAt ≥ completedAt; pathwayClear: true, obstructionPresent: false.",
      gatekeeperDecision: "GATE_PASSED: All 9 conditions satisfied. Green assurance restored.",
      whyItMatters: "A restoration declaration backed by cryptographic hardware provenance.",
    },
  },
  {
    id: "UNKNOWN",
    label: "4. Fail-Closed Failsafe",
    badge: "UNKNOWN",
    imageSrc: "/presentation/unknown.png",
    title: "Safety Invariant Enforced: Default to UNKNOWN",
    description:
      "When camera evidence is unavailable, stale (captured before cleanup), or ambiguous, OpenWay never defaults to green. It transitions safely to UNKNOWN, requesting physical verification.",
    technicalDetails: {
      stateMachine: "RECHECKING → UNKNOWN",
      evidenceEvaluation: "Missing fresh evidence, stale timestamp, or vision error encountered.",
      gatekeeperDecision: "FAIL-CLOSED: Never declare AVAILABLE or VERIFIED_RESTORED without proof.",
      whyItMatters: "A false green in physical accessibility can trap or injure a visitor.",
    },
  },
];

export function WalkthroughSection() {
  const [activeTab, setActiveTab] = useState<StateWalkthroughItem["id"]>("ACTION_REQUIRED");

  const current = WALKTHROUGH_ITEMS.find((item) => item.id === activeTab) || WALKTHROUGH_ITEMS[0];

  return (
    <section id="walkthrough" className="relative py-20 sm:py-28 border-b border-ow-line bg-ow-navy/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="walkthrough-heading"
          eyebrow="Real Interface States"
          title={
            <>
              Interactive Walkthrough:{" "}
              <span className="text-ow-muted font-normal block sm:inline">
                Four phases of the assurance console.
              </span>
            </>
          }
          lead="Direct captures from the deployed OpenWay console showing how the entrance assurance card presents each phase of the workflow to operators in real time."
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
                  Console State: {current.id}
                </span>
                <span className="font-mono text-[10px] text-ow-subtle">
                  Captured from AWS us-east-1 Deployment
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
                Unedited screenshot of <code className="text-ow-muted">EntranceAssuranceCard.tsx</code> rendered in production.
              </p>
            </div>
          </div>

          {/* Detailed Explanations */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-ow-line bg-ow-panel p-6 shadow-lg">
              <div className="flex items-center gap-2">
                <StateBadge state={current.badge} />
                <span className="font-mono text-[11px] text-ow-subtle">Workflow State</span>
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
