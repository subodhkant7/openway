import React from "react";
import Link from "next/link";
import { PRESENTATION_LINKS } from "@/lib/presentationConfig";
import { LogoMark, ExternalLink, focusRing } from "./primitives";

export function Footer() {
  return (
    <footer className="border-t border-ow-line bg-ow-ink py-12 text-xs text-ow-muted">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-ow-line/80 pb-8">
          <div className="flex items-center gap-3">
            <LogoMark className="h-8 w-8" />
            <div>
              <span className="font-semibold text-ow-paper text-base block leading-tight">
                OpenWay
              </span>
              <span className="font-mono text-[11px] text-ow-mint/80">
                Proactive Accessibility Assurance System
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <a href="#problem" className={`hover:text-ow-paper transition ${focusRing}`}>
              The Problem
            </a>
            <a href="#how-it-works" className={`hover:text-ow-paper transition ${focusRing}`}>
              How It Works
            </a>
            <a href="#walkthrough" className={`hover:text-ow-paper transition ${focusRing}`}>
              Live Walkthrough
            </a>
            <a href="#architecture" className={`hover:text-ow-paper transition ${focusRing}`}>
              Architecture
            </a>
            <a href="#safety-privacy" className={`hover:text-ow-paper transition ${focusRing}`}>
              Safety &amp; Privacy
            </a>
            <Link href="/" className={`text-ow-mint hover:underline transition ${focusRing}`}>
              Operator Console
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-ow-subtle leading-relaxed">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-ow-paper block mb-1">
              Hackathon Tracks
            </span>
            <p>
              Submitted to the <strong className="text-ow-muted">Amazon Developer Hackathon</strong>: Primary track <strong className="text-ow-muted">Ring</strong>; Mini Challenge <strong className="text-ow-muted">AWS Builder</strong>.
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-ow-paper block mb-1">
              Deterministic Foundation
            </span>
            <p>
              249 passing automated unit, adversarial, and invariant verification tests. Ephemeral in-memory image buffers with zero S3 persistence.
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-ow-paper block mb-1">
              Legal Scope Notice
            </span>
            <p>
              Verifies configured, camera-observable entrance conditions only. Does not certify general legal building-code certification or ADA compliance.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-ow-line/60 text-[11px]">
          <div>
            &copy; 2026 Subodh Kant. Released under the MIT License.
          </div>
          <div className="flex items-center gap-4">
            <ExternalLink
              href={PRESENTATION_LINKS.repository}
              className={`hover:text-ow-paper transition ${focusRing}`}
            >
              GitHub: subodhkant7/openway
            </ExternalLink>
            <span>•</span>
            <Link href="/" className={`hover:text-ow-paper transition ${focusRing}`}>
              Interactive Console
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
