import React from "react";
import { SectionHeading } from "./primitives";

interface ComparisonItem {
  flawTitle: string;
  flawDescription: string;
  openWayTitle: string;
  openWayDescription: string;
  tag: string;
}

const COMPARISONS: ComparisonItem[] = [
  {
    tag: "TIMING",
    flawTitle: "Reactive Visitor Discovery",
    flawDescription:
      "Venues discover access barriers only when a visitor in a wheelchair arrives and cannot enter. By then, dignity is broken and attendance is delayed.",
    openWayTitle: "Preemptive Event-Driven Detection",
    openWayDescription:
      "Ring motion events at configured entrances trigger immediate analysis. When delivery packages or debris block a ramp, OpenWay alerts staff minutes before patrons arrive.",
  },
  {
    tag: "ACCOUNTABILITY",
    flawTitle: "Premature “Trust-Me” Signoff",
    flawDescription:
      "Facility tickets are routinely marked “Done” from a breakroom or without inspecting the physical ramp. Incomplete cleanups leave hazards in place.",
    openWayTitle: "Staff Cannot Declare Restoration",
    openWayDescription:
      "Staff completion only moves the entrance to RECHECKING. Access is never restored until fresh Ring camera evidence proves the physical impediment is gone.",
  },
  {
    tag: "INTEGRITY",
    flawTitle: "AI Hallucination & False Greens",
    flawDescription:
      "Generative models guess, smooth over ambiguity, and hallucinate success. In safety contexts, a false green is dangerous.",
    openWayTitle: "Deterministic 9-Point Gatekeeper",
    openWayDescription:
      "AI never declares state. A pure, deterministic state machine tests temporal freshness, camera binding, and absence of contradiction. All failure modes fail closed to UNKNOWN.",
  },
  {
    tag: "PRIVACY",
    flawTitle: "Invasive Video Surveillance",
    flawDescription:
      "Traditional video analytics record patron identities, run facial recognition, or profile mobility status, violating visitor dignity.",
    openWayTitle: "Strict Spatial Environmental Boundary",
    openWayDescription:
      "OpenWay inspects physical ramps and doorways—never people. Zero facial recognition, zero demographic inference, and ephemeral in-memory processing with zero media storage on S3.",
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative py-20 sm:py-28 border-b border-ow-line bg-ow-navy/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="problem-heading"
          eyebrow="The Operational Gap"
          title={
            <>
              Why physical accessibility fails,{" "}
              <span className="text-ow-muted font-normal block sm:inline">
                and why conventional systems cannot fix it.
              </span>
            </>
          }
          lead="Accessibility compliance is not a static building checklist; it is an active physical operational condition. Delivery drivers drop pallets on ramps, automatic door buttons fail, and work orders get prematurely closed. OpenWay solves the systemic flaws in reactive management."
        />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {COMPARISONS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-ow-line bg-ow-panel/90 p-6 sm:p-7 shadow-lg flex flex-col justify-between"
            >
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ow-subtle px-2 py-0.5 rounded bg-ow-raised border border-ow-line inline-block">
                  {item.tag}
                </span>

                {/* The Traditional Flaw */}
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                    <span className="text-rose-400 font-mono text-xs">✕</span>
                    <span>Conventional: {item.flawTitle}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-rose-200/80">
                    {item.flawDescription}
                  </p>
                </div>

                {/* The OpenWay Assurance */}
                <div className="mt-4 rounded-xl border border-ow-mint/30 bg-ow-mint-deep/30 p-4">
                  <div className="flex items-center gap-2 text-ow-mint font-semibold text-sm">
                    <span className="text-ow-mint font-mono text-xs">✓</span>
                    <span>OpenWay: {item.openWayTitle}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ow-muted">
                    {item.openWayDescription}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-ow-line/60 flex items-center justify-between text-[11px] font-mono text-ow-subtle">
                <span>INVARIANT ENFORCED</span>
                <span className="text-ow-mint">FAIL-CLOSED</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
