"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Server,
  Zap,
  CheckCircle2,
  XCircle,
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

      // 3. Fetch Discovered Devices
      const devRes = await fetch("/api/ring/devices");
      const devData = await devRes.json();
      if (devData.success && Array.isArray(devData.devices)) {
        setDevices(devData.devices);
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

  const isLiveMode = status?.mode === "api";
  const isSimulator = status?.mode === "simulator";
  const isLinked = linkRecord?.linked || linkRecord?.status === "LINKED";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-sm">
            OW
          </div>
          <span className="font-bold tracking-tight text-white text-base">OpenWay</span>
          <span className="text-xs text-slate-500 font-mono">/ Ring Management & Configuration</span>
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
              One-Way (Ring-Driven) Account Association & Device Discovery
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
                ) : isLiveMode ? (
                  <>
                    <Server className="h-4 w-4 text-emerald-400" />
                    <span>Official Ring Partner API</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 text-sky-400" />
                    <span>{status?.mode || "Unknown"}</span>
                  </>
                )}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                  isSimulator
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : isLiveMode
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {isSimulator ? "SIMULATOR" : "LIVE RING"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {isSimulator
                ? "Autonomous safety gates operate using deterministic mock telemetry."
                : "Live video and motion events ingested directly from Amazon Vision API."}
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
                ) : linkRecord?.status === "ACCOUNT_RELINK_REQUIRED" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <HelpCircle className="h-4 w-4 text-slate-500" />
                )}
                <span>
                  {isLinked
                    ? "Linked & Authorized"
                    : linkRecord?.status === "ACCOUNT_RELINK_REQUIRED"
                    ? "Re-link Required"
                    : "Not Connected"}
                </span>
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                  isLinked
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : linkRecord?.status === "ACCOUNT_RELINK_REQUIRED"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {linkRecord?.status || "NOT_LINKED"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 font-mono truncate" title={linkRecord?.ringAccountReference}>
              {linkRecord?.ringAccountReference
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
                <span>{devices.length} Devices Discovered</span>
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {devices.filter((d) => d.online).length} online
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Hardware discovered through <code className="font-mono text-slate-300">GET /v1/devices</code>.
            </p>
          </div>
        </div>

        {/* Linking Instructions & Actions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-400" />
                One-Way (Ring-Driven) Account Linking Workflow
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting an official Ring account to this OpenWay deployment
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://account.ring.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                id="manage-ring-connection-btn"
              >
                <span>Manage Ring Connection</span>
                <ExternalLink className="h-3.5 w-3.5 text-sky-400" />
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
              <span className="text-sky-400 font-bold block mb-1">Step 1 · Ring AppStore</span>
              <p className="text-slate-400">
                User selects OpenWay in Ring AppStore, reviews permissions, and selects shared devices.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
              <span className="text-sky-400 font-bold block mb-1">Step 2 · Token Exchange</span>
              <p className="text-slate-400">
                Ring POSTs auth code to <code className="text-slate-300">/api/ring/oauth/exchange</code>; exchanged for encrypted tokens.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
              <span className="text-sky-400 font-bold block mb-1">Step 3 · Nonce Verification</span>
              <p className="text-slate-400">
                User is redirected to <code className="text-slate-300">/ring/link</code> with HMAC-SHA256 nonce to verify ownership.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
              <span className="text-sky-400 font-bold block mb-1">Step 4 · Confirmation</span>
              <p className="text-slate-400">
                Backend completes Ring App-Integrations with POST + PATCH (<code className="text-slate-300">completed</code>).
              </p>
            </div>
          </div>

          {/* One-Way Architecture & Revocation Policy Notice */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-sky-400" />
              <span>One-Way Linking Architecture & Revocation Policy</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              OpenWay uses official One-Way (Ring-Driven) account linking. Ring’s API does not support upstream unlinking from partner applications. To completely revoke OpenWay’s authorization and halt token issuance, remove OpenWay directly from your{" "}
              <a
                href="https://account.ring.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
              >
                Ring Account Integrations <ExternalLink className="h-2.5 w-2.5" />
              </a>
              . Purging local credentials in OpenWay deletes locally stored tokens so subsequent requests cannot reuse them, but does not revoke remote Ring authorization.
            </p>
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
            <div className="text-center py-8 text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800/60">
              No devices currently discovered. Ensure a Ring account is linked and camera devices are authorized.
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
        OpenWay Autonomous Accessibility Assurance · Official Amazon Ring Partner Integration
      </footer>
    </div>
  );
}
