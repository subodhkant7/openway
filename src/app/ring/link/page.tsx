"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";

function RingLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const nonce = searchParams.get("nonce") || "";
  const time = searchParams.get("time") || "";

  // Operator sign-in state
  const [operatorEmail, setOperatorEmail] = useState("operator@maplestcafe.openway.org");
  const [venueId, setVenueId] = useState("venue_maple_cafe");
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Flow execution state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);

  // Time freshness calculation
  const timeNum = time ? parseInt(time, 10) : null;
  const isTimeValid = timeNum !== null && !isNaN(timeNum);
  const ageSeconds = isTimeValid ? Math.round((Date.now() - timeNum) / 1000) : null;
  const isExpired = ageSeconds !== null && (ageSeconds > 600 || ageSeconds < -5);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonce || !time) {
      setErrorMessage("Missing nonce or time parameter from Ring redirect.");
      setStep("error");
      return;
    }

    setLoading(true);
    setStep("verifying");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ring/oauth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce,
          time,
          venueId,
          operatorId: operatorEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Failed to link Ring account.");
        setStep("error");
        setLoading(false);
        return;
      }

      setLinkedAccountId(data.ringAccountId);
      setStep("success");
      setLoading(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Network error during account linking.");
      setStep("error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-sm">
            OW
          </div>
          <span className="font-bold tracking-tight text-white text-base">OpenWay</span>
          <span className="text-xs text-slate-500 font-mono">/ Ring One-Way Link</span>
        </div>
        <Link
          href="/console"
          className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
        >
          Console <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-6 flex flex-col justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center pb-6 border-b border-slate-800">
            <div className="mx-auto w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Connect Ring Account
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Official Ring One-Way (Ring-Driven) Account Association
            </p>
          </div>

          {/* Timestamp Warning if Expired */}
          {isExpired && (
            <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Link Request Expired: </strong>
                The nonce validation window of 600 seconds has lapsed ({ageSeconds}s elapsed). Please restart the integration flow from the Ring AppStore.
              </div>
            </div>
          )}

          {/* Missing Parameters */}
          {(!nonce || !time) && (
            <div className="mt-5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Missing Nonce Parameters: </strong>
                This endpoint must be accessed through a Ring AppStore redirect containing the cryptographic <code className="font-mono text-amber-300">nonce</code> and <code className="font-mono text-amber-300">time</code>.
              </div>
            </div>
          )}

          {/* Success Card */}
          {step === "success" && (
            <div className="mt-6 text-center py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-emerald-400">
                Account Linked Successfully!
              </h2>
              <p className="mt-2 text-xs text-slate-300">
                Your Ring account is now securely bound to OpenWay tenant:
              </p>
              <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 text-left space-y-1">
                <div><span className="text-slate-500">Ring Account: </span>{linkedAccountId || "ava1.ring.account"}</div>
                <div><span className="text-slate-500">Tenant Venue: </span>{venueId}</div>
                <div><span className="text-slate-500">Integration: </span>Completed (POST + PATCH confirmed)</div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="/ring/config"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-sky-500 transition"
                >
                  Manage Ring Hardware Configuration <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/console"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  Return to Operator Console
                </Link>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {step === "error" && errorMessage && (
            <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Linking Failed: </strong>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Form: Mandatory OpenWay Sign-In / Association */}
          {step !== "success" && (
            <form onSubmit={handleClaim} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Venue / Tenant
                </label>
                <input
                  type="text"
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-400 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  OpenWay Operator Identity
                </label>
                <input
                  type="email"
                  value={operatorEmail}
                  onChange={(e) => setOperatorEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Mandatory sign-in per Ring spec to bind unclaimed token to verified operator.
                </span>
              </div>

              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Lock className="h-3.5 w-3.5 text-sky-400" />
                  Security Handshake
                </div>
                <div>Nonce Algorithm: HMAC-SHA256 (URL-safe Base64 without padding)</div>
                <div>Server-Side Validation Window: 600s</div>
              </div>

              <button
                type="submit"
                disabled={loading || isExpired || !nonce || !time}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-sky-500 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying HMAC Nonce & Completing Link...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Authenticate & Confirm Ring Link</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        OpenWay Autonomous Accessibility Assurance · Official Amazon Ring Partner Integration
      </footer>
    </div>
  );
}

export default function RingLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
          Loading Ring Linking Portal...
        </div>
      }
    >
      <RingLinkContent />
    </Suspense>
  );
}
