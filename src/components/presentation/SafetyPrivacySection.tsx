import React from "react";
import { PLATFORM_STATUS, ComponentStatus, VerificationStatus } from "@/lib/presentationConfig";
import { SectionHeading } from "./primitives";

const STATUS_BADGES: Record<VerificationStatus, { label: string; chip: string; dot: string }> = {
  OPERATIONAL: {
    label: "OPERATIONAL",
    chip: "border-ow-mint/30 bg-ow-mint-deep/60 text-ow-mint",
    dot: "bg-ow-mint",
  },
  UNAVAILABLE: {
    label: "UNAVAILABLE (FAIL-CLOSED)",
    chip: "border-amber-500/30 bg-amber-950/40 text-amber-300",
    dot: "bg-amber-400",
  },
  UNCONFIRMED: {
    label: "UNCONFIRMED (SIMULATOR ACTIVE)",
    chip: "border-slate-700 bg-slate-900/60 text-slate-300",
    dot: "bg-slate-400",
  },
};

export function SafetyPrivacySection() {
  return (
    <section id="safety-privacy" className="relative py-20 sm:py-28 border-b border-ow-line bg-ow-navy/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="safety-privacy-heading"
          eyebrow="Integrity &amp; Disclosure"
          title={
            <>
              Privacy by construction,{" "}
              <span className="text-ow-muted font-normal block sm:inline">
                and honest platform transparency.
              </span>
            </>
          }
          lead="We believe assurance systems must be held to higher standards of honesty than ordinary software. OpenWay enforces a strict privacy charter and openly discloses the exact verified status of every runtime component."
        />

        {/* The OpenWay Privacy Charter */}
        <div className="mt-14 rounded-2xl border border-ow-mint/35 bg-ow-panel/90 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ow-line pb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ow-mint font-semibold">
                OpenWay Privacy Charter
              </span>
              <h3 className="text-xl font-bold text-ow-paper mt-1">
                “OpenWay analyzes the physical environment, not people’s identities.”
              </h3>
            </div>
            <span className="font-mono text-xs text-ow-mint bg-ow-mint-deep px-2.5 py-1 rounded border border-ow-mint/30 w-fit">
              ZERO BIOMETRICS
            </span>
          </div>

          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-ow-muted">
            Accessibility assurance requires observing configured physical conditions—such as wheelchair ramps,
            automatic entrance push buttons, and curb pathways. It <strong className="text-ow-paper">never</strong> requires
            identifying, profiling, or tracking individuals.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">1. No Facial Recognition</span>
              <p className="mt-1 text-ow-muted">
                System code contains no face detection, facial landmarks, or biometric extraction.
              </p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">2. No Disability Profiling</span>
              <p className="mt-1 text-ow-muted">
                Evaluates entrance geometry only. Never categorizes medical or mobility traits of people.
              </p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">3. Ephemeral Image Buffers</span>
              <p className="mt-1 text-ow-muted">
                Image bytes processed strictly in server RAM and discarded immediately. Zero S3 media storage.
              </p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">4. Schema-Enforced Privacy</span>
              <p className="mt-1 text-ow-muted">
                Vision JSON schema structurally restricts outputs to physical entrance properties.
              </p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">5. No Continuous Surveillance</span>
              <p className="mt-1 text-ow-muted">
                Event-driven Ring motion captures only. No 24/7 video streams or background recording.
              </p>
            </div>
            <div className="rounded-xl border border-ow-line bg-ow-raised/50 p-4">
              <span className="font-semibold text-ow-paper block">6. Transient Obscuration Rule</span>
              <p className="mt-1 text-ow-muted">
                A passing pedestrian obscuring a ramp causes safe UNKNOWN—never an obstruction alert.
              </p>
            </div>
          </div>
        </div>

        {/* Honest Platform Verification Matrix */}
        <div className="mt-12 rounded-2xl border border-ow-line bg-ow-panel/90 p-6 sm:p-8 shadow-xl">
          <div className="border-b border-ow-line pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ow-paper font-semibold">
                Runtime Verification Matrix
              </span>
              <span className="rounded bg-ow-raised px-2 py-0.5 font-mono text-[10px] text-ow-muted">
                Verified: 2026-10-12
              </span>
            </div>
            <h3 className="text-lg font-bold text-ow-paper mt-1">
              Truthful Runtime Component Status (AWS Account 241638332840)
            </h3>
            <p className="mt-1 text-xs text-ow-muted">
              Per strict hackathon rules, we do not fabricate live inference results or claim untested capabilities.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {Object.entries(PLATFORM_STATUS).map(([key, item]) => {
              const badge = STATUS_BADGES[item.status];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-ow-line bg-ow-raised/60 p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="md:w-1/3">
                    <span className="font-mono text-xs text-ow-paper font-semibold block">
                      {item.label}
                    </span>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium ${badge.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div className="md:w-2/3 md:border-l md:border-ow-line/60 md:pl-5 text-xs text-ow-muted leading-relaxed">
                    <p>{item.detail}</p>
                    {item.status === "UNAVAILABLE" && (
                      <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-200">
                        <strong className="text-amber-300">Safety Invariant in Action:</strong> Because Bedrock access is denied for this account, OpenWay&apos;s vision analyzer fails closed and returns <code className="font-mono font-bold">UNKNOWN</code>. The deterministic gatekeeper refuses to mark the entrance green, proving the system defends against unverified AI inputs.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legal & Regulatory Scope Boundary Notice */}
        <div className="mt-8 rounded-xl border border-ow-line bg-ow-panel/60 p-5 text-xs text-ow-subtle">
          <span className="font-mono text-[10px] uppercase font-bold text-ow-muted block mb-1">
            Scope Boundary &amp; Legal Notice
          </span>
          <p className="leading-relaxed">
            OpenWay verifies <strong className="text-ow-paper">explicitly configured, camera-observable entrance conditions</strong> (such as unobstructed ramp pathways, clear door swings, and operational automatic buttons). OpenWay does <strong className="text-ow-paper">not</strong> certify general building-code compliance or full legal Americans with Disabilities Act (ADA) architectural compliance.
          </p>
        </div>
      </div>
    </section>
  );
}
