import React from "react";
import clsx from "clsx";

/**
 * Workflow state chip for the presentation site.
 * Labels mirror the real AssuranceState identifiers used by the application.
 */
export type PresentationState =
  | "AVAILABLE"
  | "ACTION_REQUIRED"
  | "RECHECKING"
  | "VERIFIED_RESTORED"
  | "UNKNOWN";

const STYLES: Record<PresentationState, { dot: string; chip: string }> = {
  AVAILABLE: {
    dot: "bg-ow-mint/70",
    chip: "border-ow-mint/25 bg-ow-mint/[0.06] text-ow-mint/90",
  },
  ACTION_REQUIRED: {
    dot: "bg-ow-amber",
    chip: "border-ow-amber/35 bg-ow-amber/[0.08] text-ow-amber",
  },
  RECHECKING: {
    dot: "bg-ow-recheck",
    chip: "border-ow-recheck/35 bg-ow-recheck/[0.08] text-ow-recheck",
  },
  VERIFIED_RESTORED: {
    dot: "bg-ow-mint-strong",
    chip: "border-ow-mint/45 bg-ow-mint/[0.12] text-ow-mint",
  },
  UNKNOWN: {
    dot: "bg-ow-unknown",
    chip: "border-ow-unknown/30 bg-ow-unknown/[0.07] text-ow-unknown",
  },
};

export function StateBadge({
  state,
  size = "md",
  className,
}: {
  state: PresentationState;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = STYLES[state];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-medium tracking-tight whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-xs",
        s.chip,
        className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {state}
    </span>
  );
}

/** OpenWay mark: an open doorway with a verification tick. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0D3328" stroke="#7FE3B8" strokeOpacity="0.35" />
      <path d="M10 25V9.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 22 9.5V25" fill="none" stroke="#F4F0E6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 25h18" stroke="#F4F0E6" strokeOpacity="0.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.8 16.6l2.4 2.4 4.2-4.6" fill="none" stroke="#7FE3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={clsx("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ow-mint/80">{eyebrow}</p>
      <h2 id={id} className="mt-4 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] text-ow-paper sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {lead && <p className="mt-5 text-base leading-relaxed text-ow-muted sm:text-lg">{lead}</p>}
    </div>
  );
}

/** External link with an accessible "opens in a new tab" hint. */
export function ExternalLink({
  href,
  className,
  children,
  id,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <a id={id} href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ow-mint focus-visible:ring-offset-2 focus-visible:ring-offset-ow-navy";
