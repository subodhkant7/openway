import React from "react";
import Image from "next/image";
import Link from "next/link";
import { PRESENTATION_LINKS } from "@/lib/presentationConfig";
import { ExternalLink, StateBadge, focusRing } from "./primitives";
import styles from "./presentation.module.css";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-ow-line">
      <div className={styles.heroBackdrop} />
      <div className={styles.grid} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Track & Challenge Eyebrow */}
        <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${styles.rise}`}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ow-mint/30 bg-ow-mint-deep/60 px-3 py-1 font-mono text-[11px] font-medium tracking-wide text-ow-mint">
            <span className="h-1.5 w-1.5 rounded-full bg-ow-mint animate-pulse" aria-hidden="true" />
            AMAZON DEVELOPER HACKATHON
          </span>
          <span className="inline-flex items-center rounded-full border border-ow-line bg-ow-panel px-2.5 py-1 font-mono text-[11px] text-ow-paper">
            Ring Track
          </span>
          <span className="inline-flex items-center rounded-full border border-ow-line bg-ow-panel px-2.5 py-1 font-mono text-[11px] text-ow-muted">
            AWS Builder Challenge
          </span>
        </div>

        {/* Headline */}
        <div className={`mt-6 max-w-4xl ${styles.rise2}`}>
          <h1 className="text-4xl font-bold tracking-tight text-ow-paper sm:text-5xl lg:text-6xl leading-[1.08]">
            Proactive accessibility assurance for physical entrances.
          </h1>
          <p className="mt-6 text-lg sm:text-xl leading-relaxed text-ow-muted max-w-3xl">
            OpenWay uses configured, camera-observable Ring evidence to detect physical entrance interruptions,
            coordinate accountable remediation, and deterministically verify restoration using fresh evidence.
          </p>
        </div>

        {/* Canonical Invariant Callout */}
        <div className={`mt-8 max-w-3xl rounded-xl border border-ow-mint/35 bg-ow-mint-deep/30 p-4 sm:p-5 shadow-lg backdrop-blur-sm ${styles.rise2}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-ow-mint/20 p-1 text-ow-mint flex-shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ow-mint/90 font-semibold">
                Core Architectural Invariant
              </p>
              <blockquote className="mt-1 text-sm sm:text-base font-medium text-ow-paper italic">
                &ldquo;Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed.&rdquo;
              </blockquote>
              <p className="mt-2 text-xs text-ow-muted">
                Staff cannot declare restoration. AI cannot assert green without fresh camera proof. Unproven states fail closed to <span className="font-mono text-ow-unknown font-semibold">UNKNOWN</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Actions */}
        <div className={`mt-8 flex flex-wrap items-center gap-4 ${styles.rise3}`}>
          <Link
            href="/console"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-ow-mint bg-ow-mint-strong px-5 py-3 text-sm font-semibold text-ow-ink hover:bg-ow-mint transition shadow-lg ${focusRing}`}
          >
            <span>Launch Live Interactive Console</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>

          <ExternalLink
            href={PRESENTATION_LINKS.repository}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-ow-line bg-ow-panel px-5 py-3 text-sm font-medium text-ow-paper hover:bg-ow-raised hover:border-ow-muted/40 transition ${focusRing}`}
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub Repository</span>
          </ExternalLink>

          <a
            href="#how-it-works"
            className={`inline-flex items-center justify-center gap-1 text-sm font-medium text-ow-muted hover:text-ow-paper px-3 py-2 transition ${focusRing}`}
          >
            <span>Read How It Works</span>
            <span aria-hidden="true">&darr;</span>
          </a>
        </div>

        {/* Live UI Console Preview */}
        <div className={`mt-14 relative ${styles.rise3}`}>
          <div className="rounded-2xl border border-ow-line bg-ow-panel p-2 sm:p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-ow-line px-3 py-2 text-xs text-ow-muted">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 font-mono text-[11px] text-ow-paper">
                  OpenWay Single-Screen Assurance Workbench
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 font-mono text-[10px]">
                <span className="text-ow-mint">● AWS us-east-1</span>
                <span>● DynamoDB Connected</span>
                <span>● Fail-Closed Engine</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-ow-ink mt-2">
              <Image
                src="/presentation/console_overview.png"
                alt="OpenWay Single-Screen Assurance Workbench interface showing camera evidence provenance, assurance state invariants, and operator action demo journey"
                width={1280}
                height={780}
                priority
                className="w-full h-auto object-cover rounded-xl"
              />
            </div>
          </div>

          {/* Floating Key Invariant Badges below hero image */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-ow-line bg-ow-panel/90 p-3">
              <span className="font-mono text-[10px] uppercase text-ow-mint block">Trigger</span>
              <p className="mt-1 text-xs font-semibold text-ow-paper">Ring Doorbell Motion</p>
              <p className="text-[11px] text-ow-muted">Camera-observable events</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-panel/90 p-3">
              <span className="font-mono text-[10px] uppercase text-ow-amber block">Interruption</span>
              <p className="mt-1 text-xs font-semibold text-ow-paper">Preemptive Dispatch</p>
              <p className="text-[11px] text-ow-muted">Staff alerted before visitors arrive</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-panel/90 p-3">
              <span className="font-mono text-[10px] uppercase text-ow-recheck block">Safety Barrier</span>
              <p className="mt-1 text-xs font-semibold text-ow-paper">Locked in RECHECKING</p>
              <p className="text-[11px] text-ow-muted">Staff claims cannot declare green</p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-panel/90 p-3">
              <span className="font-mono text-[10px] uppercase text-ow-mint-strong block">Verification</span>
              <p className="mt-1 text-xs font-semibold text-ow-paper">9-Point Pure Gate</p>
              <p className="text-[11px] text-ow-muted">Fresh evidence proves restored</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
