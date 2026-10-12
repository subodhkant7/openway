import React from "react";
import Link from "next/link";
import { PRESENTATION_LINKS } from "@/lib/presentationConfig";
import { ExternalLink, focusRing } from "./primitives";

export function CtaSection() {
  return (
    <section className="relative py-20 sm:py-28 border-b border-ow-line bg-gradient-to-b from-ow-navy to-ow-ink">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ow-mint">
          Judge Experience &amp; Interactive Demo
        </span>

        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ow-paper sm:text-4xl lg:text-5xl">
          Test the Assurance Workbench in real time.
        </h2>

        <p className="mt-4 text-base sm:text-lg text-ow-muted max-w-2xl mx-auto leading-relaxed">
          The deployed OpenWay console features a deterministic scenario runner. You can step through the entire assurance lifecycle or attempt adversarial bypasses with one click.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-xl border border-ow-mint bg-ow-mint-strong px-6 py-3.5 text-sm font-semibold text-ow-ink hover:bg-ow-mint transition shadow-xl ${focusRing}`}
          >
            <span>Launch Operator Console</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>

          <ExternalLink
            href={PRESENTATION_LINKS.repository}
            className={`inline-flex items-center gap-2 rounded-xl border border-ow-line bg-ow-panel px-6 py-3.5 text-sm font-medium text-ow-paper hover:bg-ow-raised hover:border-ow-muted/40 transition ${focusRing}`}
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Inspect Source Code</span>
          </ExternalLink>
        </div>

        {/* 4-Step Judge Quickstart Guide */}
        <div className="mt-12 rounded-2xl border border-ow-line bg-ow-panel/80 p-6 text-left shadow-lg">
          <span className="font-mono text-xs font-bold text-ow-paper block mb-3">
            Recommended 60-Second Evaluation Sequence:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-ow-muted">
            <div className="rounded-lg bg-ow-raised/60 p-3 border border-ow-line">
              <span className="font-mono text-ow-amber font-bold block">Step 1</span>
              Click <strong className="text-ow-paper">1. PREEMPTIVE OBSTRUCTION</strong> to trigger simulated boxes on the ramp &rarr; <span className="font-mono text-ow-amber">ACTION REQUIRED</span>.
            </div>
            <div className="rounded-lg bg-ow-raised/60 p-3 border border-ow-line">
              <span className="font-mono text-ow-recheck font-bold block">Step 2</span>
              Click <strong className="text-ow-paper">2. STAFF REMEDIATION</strong> to report fix &rarr; witness lock in <span className="font-mono text-ow-recheck">RECHECKING</span> without false green.
            </div>
            <div className="rounded-lg bg-ow-raised/60 p-3 border border-ow-line">
              <span className="font-mono text-ow-mint font-bold block">Step 3</span>
              Click <strong className="text-ow-paper">3. CANONICAL VERIFICATION</strong> &rarr; fresh post-fix evidence passes gate &rarr; <span className="font-mono text-ow-mint">ACCESS RESTORED</span>.
            </div>
            <div className="rounded-lg bg-ow-raised/60 p-3 border border-ow-line">
              <span className="font-mono text-ow-unknown font-bold block">Step 4</span>
              Click <strong className="text-ow-paper">4. FAILURE DEMO 1</strong> or <strong className="text-ow-paper">Scenario F</strong> &rarr; witness defense failing closed to <span className="font-mono text-ow-unknown">UNKNOWN</span>.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
