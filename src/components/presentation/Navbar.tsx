import React from "react";
import Link from "next/link";
import { PRESENTATION_LINKS } from "@/lib/presentationConfig";
import { LogoMark, ExternalLink, focusRing } from "./primitives";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-ow-line/80 bg-ow-navy/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={`flex items-center gap-3 rounded-lg ${focusRing}`}
          aria-label="OpenWay Presentation Home"
        >
          <LogoMark className="h-8 w-8" />
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-ow-paper text-base leading-tight">
              OpenWay
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ow-mint/80">
              Accessibility Assurance
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-ow-muted">
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
        </nav>

        <div className="flex items-center gap-3">
          <ExternalLink
            href={PRESENTATION_LINKS.repository}
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-ow-line bg-ow-panel px-3 py-1.5 text-xs font-medium text-ow-paper hover:border-ow-muted/40 hover:bg-ow-raised transition ${focusRing}`}
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
          </ExternalLink>

          <Link
            href="/console"
            className={`inline-flex items-center gap-1.5 rounded-lg border border-ow-mint/50 bg-ow-mint-deep px-3.5 py-1.5 text-xs font-semibold text-ow-mint hover:bg-ow-mint/[0.18] transition shadow-sm ${focusRing}`}
          >
            <span>Console</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
