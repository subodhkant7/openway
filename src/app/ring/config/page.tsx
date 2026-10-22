"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Server,
  Zap,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Camera,
  Battery,
  Wifi,
  WifiOff,
  Radio,
  Lock,
} from "lucide-react";
import { RingDevice, RingProviderStatus } from "@/ring/types";

export default function RingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [status, setStatus] = useState<RingProviderStatus | null>(null);
  const [devices, setDevices] = useState<RingDevice[]>([]);
  const [linkRecord, setLinkRecord] = useState<{
    linked: boolean;
    status: string;
    ringAccountReference?: string;
    expiresAt?: string;
    updatedAt?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Ring Provider Status
      const statusRes = await fetch("/api/ring/status");
      const statusData = await statusRes.json();
      if (statusData.success && statusData.status) {
        setStatus(statusData.status);
      }

      // 2. Fetch Account Link Record
      const linkRes = await fetch("/api/ring/oauth/link?venueId=venue_maple_cafe");
      const linkData = await linkRes.json();
      setLinkRecord(linkData);

      // 3. Fetch Discovered Devices ONLY if account link is genuinely established
      const isAccountLinked = Boolean(linkData?.linked && linkData?.status === "LINKED");
      if (isAccountLinked && statusData.status?.mode === "api") {
        const devRes = await fetch("/api/ring/devices");
        const devData = await devRes.json();
        if (devData.success && Array.isArray(devData.devices)) {
          setDevices(devData.devices);
        } else {
          setDevices([]);
        }
      } else {
        // Not linked or in simulator: no live authorized Ring devices discovered
        setDevices([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Ring configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUnlink = async () => {
    if (
      !confirm(
        "Delete local Ring credentials from OpenWay?\n\nThis purges all stored tokens in OpenWay and prevents further Ring API access. Subsequent requests will NOT be able to reuse them.\n\nNOTE: Ring-side authorization remains active until you remove OpenWay from your Ring Account Integrations page (https://account.ring.com/account/integrations)."
      )
    ) {
      return;
    }

    setUnlinking(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/ring/oauth/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: "venue_maple_cafe" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to purge local credentials.");
        return;
      }

      setSuccessMessage(
        "Local credentials successfully purged from OpenWay. To revoke Ring authorization and remote token issuance, please remove OpenWay in Ring Account Integrations."
      );
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error during local credential purge.");
    } finally {
      setUnlinking(false);
    }
  };

  // Authoritative State Evaluation
  const isLinked = Boolean(linkRecord?.linked && linkRecord?.status === "LINKED");
  const isRelinkRequired = linkRecord?.status === "ACCOUNT_RELINK_REQUIRED";
  const isLiveMode = status?.mode === "api";
  const isSimulator = status?.mode === "simulator" || (!status?.mode && !loading);
  const hasIntegrationError = Boolean(status?.state === "ERROR" || (status?.error && isLiveMode));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-sm">
            OW
          </div>
          <span className="font-bold tracking-tight text-white text-base">OpenWay</span>
          <span className="text-xs text-slate-500 font-mono">/ Ring Management &amp; Configuration</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/console"
            className="text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
          >
            Operator Console <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
          >
            Overview
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Page Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              Hardware Provider Configuration
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Ring Partner Integration
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              One-Way (Ring-Driven) Account Association &amp; Device Discovery
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Notice: </strong>
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Success: </strong>
              {successMessage}
            </div>
          </div>
        )}

        {/* Prominent Not-Linked Demo Notice Banner */}
        {!isLinked && (
          <div
            id="not-linked-banner"
            className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-4 text-xs text-sky-200 flex items-start gap-3 shadow-lg"
          >
            <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white text-sm">
                Ring account not connected. The public demo is using the deterministic simulator.
              </p>
              <p className="text-slate-300 leading-relaxed">
                In this public evaluation deployment, no real camera is connected. The operator console operates using deterministic mock hardware events and ramp images so judges can safely test all verification phases.
              </p>
            </div>
          </div>
        )}

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Operating Mode */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Runtime Provider Mode
            </span>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-base font-bold text-white flex items-center gap-2">
                {isSimulator ? (
                  <>
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span>Deterministic Simulator</span>
                  </>
                ) : isLiveMode && isLinked ? (
                  <>
                    <Server className="h-4 w-4 text-emerald-400" />
                    <span>Official Ring Partner API</span>
                  </>
                ) : isLiveMode && !isLinked ? (
                  <>
                    <Radio className="h-4 w-4 text-sky-400" />
                    <span>Ring Partner API (Not Linked)</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 text-sky-400" />
                    <span>{status?.mode || "Simulator"}</span>
                  </>
                )}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                  isSimulator
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : isLiveMode && isLinked
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : isLiveMode && !isLinked
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {isSimulator
                  ? "SIMULATOR"
                  : isLiveMode && isLinked
                  ? "LIVE RING"
                  : isLiveMode && !isLinked
                  ? "NOT_LINKED"
                  : "SIMULATOR"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {isSimulator
                ? "Autonomous safety gates operate using deterministic mock telemetry."
                : isLiveMode && isLinked
                ? "Live video and motion events ingested directly from Amazon Vision API."
                : isLiveMode && !isLinked
                ? "Ring API credentials configured. Account authorization required before live telemetry can ingest."
                : "Deterministic simulation active."}
            </p>
          </div>

          {/* Card 2: Account Link Status */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Account Association
            </span>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-base font-bold text-white flex items-center gap-2">
                {isLinked ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : isRelinkRequired ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <HelpCircle className="h-4 w-4 text-slate-500" />
                )}
                <span>
                  {isLinked
                    ? "Linked & Authorized"
                    : isRelinkRequired
                    ? "Re-link Required"
                    : "Not Connected"}
                </span>
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                  isLinked
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : isRelinkRequired
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {isLinked ? "LINKED" : linkRecord?.status || "NOT_LINKED"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 font-mono truncate" title={linkRecord?.ringAccountReference}>
              {isLinked && linkRecord?.ringAccountReference
                ? `Account: ${linkRecord.ringAccountReference}`
                : "No Ring user account currently associated."}
            </p>
          </div>

          {/* Card 3: Discovered Devices */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Authorized Hardware
            </span>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="h-4 w-4 text-sky-400" />
                <span>{isLinked ? `${devices.length} Devices Discovered` : "0 Devices Discovered"}</span>
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {isLinked ? `${devices.filter((d) => d.online).length} online` : "NOT LINKED"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {isLinked
                ? "Hardware discovered through GET /v1/devices."
                : "No authorized Ring devices discovered"}
            </p>
          </div>
        </div>

        {/* Concise "Connect a Ring test account" Instruction Panel */}
        <section
          id="connect-ring-test-account-panel"
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Ring-Driven Authorization Flow
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-400" />
                Connect a Ring test account
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                One-Way (Ring-Driven) linking begins in the Ring Developer Portal or Ring AppStore. It is not an ordinary OAuth login initiated by an OpenWay console button.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://developer.amazon.com/docs/ring/develop.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                id="ring-api-guide-link"
              >
                <span>Official Ring API Development Guide</span>
                <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
              </a>

              <a
                href="https://account.ring.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                id="manage-ring-connection-btn"
              >
                <span>Ring Account Integrations</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>

              {isLinked && (
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                  id="purge-local-credentials-btn"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Delete Local Credentials</span>
                </button>
              )}
            </div>
          </div>

          {/* 6 Concise Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 1
                </span>
                <p className="font-semibold text-slate-200 mb-1">Open Developer Portal</p>
                <p className="text-slate-400 leading-relaxed">
                  Open the registered OpenWay app in the Ring Developer Portal.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 2
                </span>
                <p className="font-semibold text-slate-200 mb-1">Navigate to Test (Phase 3)</p>
                <p className="text-slate-400 leading-relaxed">
                  Navigate to Test (Phase 3) and start the Ring authorization workflow.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 3
                </span>
                <p className="font-semibold text-slate-200 mb-1">Sign In &amp; Authorize Scope</p>
                <p className="text-slate-400 leading-relaxed">
                  Sign in and authorize the requested Ring account/device access.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 4
                </span>
                <p className="font-semibold text-slate-200 mb-1">Token Exchange</p>
                <p className="text-slate-400 leading-relaxed">
                  Allow Ring to send its authorization code to OpenWay (<code className="text-slate-300 font-mono">/api/ring/oauth/exchange</code>).
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 5
                </span>
                <p className="font-semibold text-slate-200 mb-1">Nonce Verification</p>
                <p className="text-slate-400 leading-relaxed">
                  Wait for nonce verification (<code className="text-slate-300 font-mono">/ring/link</code>) and account-link completion.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] text-sky-400 uppercase font-bold tracking-wider block mb-1">
                  Step 6
                </span>
                <p className="font-semibold text-slate-200 mb-1">Return &amp; Refresh</p>
                <p className="text-slate-400 leading-relaxed">
                  Return to OpenWay and refresh connection status and device discovery.
                </p>
              </div>
            </div>
          </div>

          {/* Action Distinction Notice */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-xs space-y-3">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              <span>Distinct Operational Actions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <strong className="text-sky-300 block mb-1">1. Start Ring Account Linking</strong>
                <p className="text-slate-400 leading-relaxed">
                  Performed through Ring&apos;s authorized Test/AppStore flow in the Ring Developer Portal. OpenWay itself cannot initiate this One-Way flow.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <strong className="text-amber-300 block mb-1">2. Manage / Revoke Authorization</strong>
                <p className="text-slate-400 leading-relaxed">
                  Performed through{" "}
                  <a
                    href="https://account.ring.com/account/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 underline inline-flex items-center gap-0.5"
                  >
                    Ring Account Integrations <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  . This halts remote token issuance and revokes partner access Ring-side.
                </p>
              </div>
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                <strong className="text-rose-300 block mb-1">3. Delete Local OpenWay Credentials</strong>
                <p className="text-slate-400 leading-relaxed">
                  Removes stored tokens in OpenWay persistence so subsequent requests cannot reuse them, but does not itself revoke upstream Ring-side authorization.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
              <strong className="text-slate-300">Public Demo Invariant: </strong>
              In the disconnected public demo, no real camera is connected. The deterministic simulator remains fully usable for judges in the{" "}
              <Link href="/console" className="text-sky-400 hover:underline">
                Operator Console
              </Link>
              .
            </div>
          </div>
        </section>

        {/* Authorized Device Discovery List */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="h-4 w-4 text-sky-400" />
                Authorized Device Inventory
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Hardware discovered from Ring API compound documents
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Endpoint: {status?.baseUrl || "https://api.amazonvision.com"}
            </span>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800/60 space-y-1.5 p-6">
              <Camera className="h-6 w-6 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No authorized Ring devices discovered</p>
              <p className="text-slate-500 max-w-md mx-auto">
                No real camera is connected in this public demo environment. Ensure a Ring test account is linked and camera devices are authorized via the Ring Developer Portal. The deterministic simulator remains usable for judges in the Operator Console.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="rounded-xl bg-slate-950 p-4 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-sky-400" />
                      <span className="font-bold text-slate-200 text-xs">{device.name}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        device.online
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      }`}
                    >
                      {device.online ? (
                        <>
                          <Wifi className="h-2.5 w-2.5" /> ONLINE
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-2.5 w-2.5" /> OFFLINE
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span className="text-slate-500 block">Device ID</span>
                      <span className="text-slate-300 truncate block">{device.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kind</span>
                      <span className="text-slate-300 capitalize block">{device.kind}</span>
                    </div>
                    {device.batteryLevel !== undefined && (
                      <div>
                        <span className="text-slate-500 block">Battery</span>
                        <span className="text-slate-300 flex items-center gap-1">
                          <Battery className="h-3 w-3 text-emerald-400" /> {device.batteryLevel}%
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block">Snapshots</span>
                      <span className="text-slate-300">
                        {device.capabilities.supports_snapshots ? "Supported" : "Unsupported"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        OpenWay Autonomous Accessibility Assurance &middot; Official Amazon Ring Partner Integration
      </footer>
    </div>
  );
}
