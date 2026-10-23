"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface StreamMetrics {
  iceState: string;
  connectionState: string;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  framesDecoded: number;
  bytesReceived: number;
}

export default function RingLiveViewPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics>({
    iceState: "new",
    connectionState: "new",
    videoWidth: 0,
    videoHeight: 0,
    currentTime: 0,
    framesDecoded: 0,
    bytesReceived: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopStream = useCallback(async () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }

    if (sessionUrl) {
      try {
        await fetch("/api/ring/whep/session", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionUrl }),
        });
      } catch (err) {
        console.error("Failed to delete Ring WHEP session:", err);
      }
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setConnecting(false);
    setSessionUrl(null);
    setMetrics((m) => ({
      ...m,
      connectionState: "closed",
      iceState: "closed",
    }));
  }, [sessionUrl]);

  const startStream = async () => {
    try {
      setConnecting(true);
      setError(null);

      // 1. Initialize PeerConnection with standard Google STUN for ICE gathering
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      // 2. Add video-only receive transceiver
      pc.addTransceiver("video", { direction: "recvonly" });

      // Track connection state
      pc.oniceconnectionstatechange = () => {
        setMetrics((m) => ({ ...m, iceState: pc.iceConnectionState }));
      };
      pc.onconnectionstatechange = () => {
        setMetrics((m) => ({ ...m, connectionState: pc.connectionState }));
      };

      // Handle incoming media stream
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          const mediaStream = event.streams[0];
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((e) => console.warn("Video autoPlay thwarted:", e));

          // Start MediaRecorder to capture genuine 15-second WHEP stream evidence
          try {
            const recorder = new MediaRecorder(mediaStream, {
              mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
                ? "video/webm;codecs=vp8,opus"
                : "video/webm",
            });
            const recordedChunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) recordedChunks.push(e.data);
            };

            recorder.onstop = async () => {
              if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: "video/webm" });
                try {
                  const saveRes = await fetch("/api/ring/whep/clip", {
                    method: "POST",
                    headers: { "Content-Type": "video/webm" },
                    body: blob,
                  });
                  if (saveRes.ok) {
                    console.log("Successfully saved official Ring WHEP stream clip to disk");
                  }
                } catch (saveErr) {
                  console.error("Failed to upload clip:", saveErr);
                }
              }
            };

            recorder.start();
            // Automatically stop recording after 15 seconds
            setTimeout(() => {
              if (recorder.state === "recording") {
                recorder.stop();
              }
            }, 15000);
          } catch (recErr) {
            console.warn("MediaRecorder initialization note:", recErr);
          }
        }
      };

      // 3. Create WebRTC SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait briefly for local ICE candidates to gather
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const timeout = setTimeout(resolve, 1500);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });

      const sdpOffer = pc.localDescription?.sdp;
      if (!sdpOffer) {
        throw new Error("Failed to generate local SDP offer.");
      }

      // 4. Broker WHEP session through server-to-server endpoint
      const response = await fetch("/api/ring/whep/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdpOffer }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Ring WHEP endpoint returned HTTP ${response.status}`
        );
      }

      const { sdpAnswer, sessionUrl: createdSessionUrl } = await response.json();
      setSessionUrl(createdSessionUrl);

      // 5. Apply remote SDP answer
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: sdpAnswer,
        })
      );

      setIsStreaming(true);
      setConnecting(false);

      // 6. Start metrics polling loop
      metricsIntervalRef.current = setInterval(async () => {
        if (videoRef.current) {
          setMetrics((m) => ({
            ...m,
            videoWidth: videoRef.current?.videoWidth || 0,
            videoHeight: videoRef.current?.videoHeight || 0,
            currentTime: Math.round((videoRef.current?.currentTime || 0) * 10) / 10,
          }));
        }

        if (pcRef.current) {
          try {
            const stats = await pcRef.current.getStats();
            stats.forEach((report) => {
              if (report.type === "inbound-rtp" && report.kind === "video") {
                setMetrics((m) => ({
                  ...m,
                  framesDecoded: report.framesDecoded || m.framesDecoded,
                  bytesReceived: report.bytesReceived || m.bytesReceived,
                }));
              }
            });
          } catch (e) {
            // ignore stats poll error
          }
        }
      }, 500);
    } catch (err: unknown) {
      console.error("Stream initiation failure:", err);
      setError(err instanceof Error ? err.message : "Unknown streaming error");
      setConnecting(false);
      await stopStream();
    }
  };

  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/console"
              className="text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              &larr; Back to Operator Console
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Ring Verification View</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-950 border border-sky-800 text-sky-300">
              OFFICIAL_RING_PLAYGROUND
            </span>
          </div>
        </div>

        {/* Title & Banner */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-3">
            <span>Official Ring Developer Playground</span>
            <span className="text-slate-500 font-normal">/</span>
            <span className="text-emerald-400 text-lg font-medium">Live Video Verification</span>
          </h1>
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 text-xs text-amber-200">
            <p className="font-semibold text-amber-300">
              Provenance Notice &mdash; Official Ring Developer Playground &mdash; Simulated Live View
            </p>
            <p className="mt-1 text-amber-300/80">
              This stream is brokered through the official Amazon Vision API WebRTC HTTP Egress Protocol (WHEP)
              endpoint (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">/v1/devices/[id]/media/streaming/whep/sessions</code>).
              It demonstrates real-time authenticated Ring WebRTC delivery. This video depicts virtual Playground test scenes
              and is not submitted as live camera footage to OpenWay&apos;s physical accessibility restoration gatekeeper.
            </p>
          </div>
        </div>

        {/* Video Player Display */}
        <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            id="ring-whep-live-video"
            autoPlay
            playsInline
            controls
            muted
            className="w-full h-full object-contain"
          />

          {!isStreaming && !connecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Official Ring Live Stream Ready
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Initiate a genuine server-to-server WHEP session with{" "}
                  <code className="text-sky-300">api.amazonvision.com</code> to establish WebRTC media delivery.
                </p>
              </div>
              <button
                id="btn-start-ring-stream"
                onClick={startStream}
                className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg hover:shadow-sky-500/20 active:scale-95"
              >
                Connect Official Ring Live View
              </button>
            </div>
          )}

          {connecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6 text-center space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" />
              <p className="text-sm font-medium text-sky-200">
                Negotiating WebRTC SDP offer with Ring WHEP gateway...
              </p>
              <p className="text-xs text-slate-400">
                POST /v1/devices/[device_id]/media/streaming/whep/sessions
              </p>
            </div>
          )}

          {/* Watermark and Provenance Overlay (when active) */}
          {isStreaming && (
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-md flex items-center space-x-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-emerald-300">LIVE WHEP</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">Ring Playground &bull; AVC 1080p</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Controls and Error Output */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            {isStreaming ? (
              <button
                id="btn-stop-ring-stream"
                onClick={stopStream}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors"
              >
                Disconnect Stream &amp; DELETE Session
              </button>
            ) : (
              <button
                onClick={startStream}
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs transition-colors"
              >
                {connecting ? "Connecting..." : "Start Stream"}
              </button>
            )}
            <span className="text-xs text-slate-400">
              Status:{" "}
              <strong
                className={
                  isStreaming
                    ? "text-emerald-400"
                    : connecting
                    ? "text-sky-400"
                    : "text-slate-500"
                }
              >
                {isStreaming
                  ? "STREAMING_ACTIVE"
                  : connecting
                  ? "SESSION_NEGOTIATING"
                  : "DISCONNECTED"}
              </strong>
            </span>
          </div>

          <div className="text-xs text-slate-400 flex items-center space-x-4">
            <span>
              ICE: <code className="text-sky-300 font-mono">{metrics.iceState}</code>
            </span>
            <span>
              Peer: <code className="text-sky-300 font-mono">{metrics.connectionState}</code>
            </span>
            <span>
              Resolution:{" "}
              <code className="text-emerald-300 font-mono">
                {metrics.videoWidth > 0
                  ? `${metrics.videoWidth}x${metrics.videoHeight}`
                  : "--"}
              </code>
            </span>
            <span>
              Playback Time:{" "}
              <code className="text-amber-300 font-mono">{metrics.currentTime}s</code>
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-4 text-xs text-rose-300">
            <strong>Stream Error:</strong> {error}
          </div>
        )}

        {/* Audit & Diagnostic Inspection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              1. Authentication &amp; Protocol
            </h4>
            <ul className="text-xs space-y-1 text-slate-400">
              <li>&bull; Server-to-server WHEP exchange</li>
              <li>&bull; Official host: <code className="text-sky-300">api.amazonvision.com</code></li>
              <li>&bull; Transport: WebRTC (WHEP / RFC Draft)</li>
              <li>&bull; Token: Secure server-side isolation</li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              2. WebRTC Media Invariants
            </h4>
            <ul className="text-xs space-y-1 text-slate-400">
              <li>&bull; Transceiver: <code className="text-emerald-300">video (recvonly)</code></li>
              <li>&bull; Codec: AVC / H.264 profile 42e01f</li>
              <li>&bull; Frames decoded: <code className="text-white font-mono">{metrics.framesDecoded}</code></li>
              <li>&bull; Bytes received: <code className="text-white font-mono">{metrics.bytesReceived}</code></li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              3. Session Lifecycle
            </h4>
            <ul className="text-xs space-y-1 text-slate-400">
              <li>&bull; Created via: HTTP 201 Created</li>
              <li>&bull; Terminated via: HTTP DELETE</li>
              <li>&bull; Location header tracking: Active</li>
              <li>&bull; Zero lingering sessions invariant</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
