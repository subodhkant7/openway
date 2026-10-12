import React from "react";
import { SectionHeading } from "./primitives";

interface ArchLayer {
  layer: string;
  technology: string;
  badge: string;
  description: string;
  securityFeatures: string[];
}

const LAYERS: ArchLayer[] = [
  {
    layer: "01. Hardware & Ingestion",
    technology: "Ring Webhook & Event Telemetry",
    badge: "RING INTEGRATION",
    description:
      "Captures motion and doorbell ding events directly from bound Ring hardware components.",
    securityFeatures: [
      "HMAC-SHA256 signature validation with crypto.timingSafeEqual against timing attacks.",
      "Webhook idempotency ledger rejects duplicate or replayed delivery attempts.",
      "Cryptographic SHA-256 evidence hashing for verifiable provenance.",
    ],
  },
  {
    layer: "02. Vision & Privacy Barrier",
    technology: "Amazon Bedrock (Nova Lite) & Ephemeral Buffers",
    badge: "AWS BEDROCK",
    description:
      "Inspects physical accessibility requirements (pathway clearance, ramps, automated doors).",
    securityFeatures: [
      "Ephemeral in-memory buffers: raw frames discarded immediately after inference; zero S3 storage.",
      "Strict Privacy Charter: model schema structurally excludes facial recognition or identity tracking.",
      "Transient pedestrians trigger UNKNOWN for obscured views—never false obstruction.",
    ],
  },
  {
    layer: "03. State & Gatekeeper Engine",
    technology: "Pure Deterministic Policy & Finite State Machine",
    badge: "DETERMINISTIC CORE",
    description:
      "Enforces the core product invariant across all state transitions and remediation cycles.",
    securityFeatures: [
      "9-point restoration gatekeeper evaluates temporal ordering (capturedAt ≥ completedAt).",
      "Camera component binding check ensures evidence matches the configured entrance.",
      "Fail-Closed: all ambiguity, timeout, or model unavailability defaults to UNKNOWN.",
    ],
  },
  {
    layer: "04. Persistence & Multi-Tenancy",
    technology: "Amazon DynamoDB (Single-Table Design)",
    badge: "AWS DYNAMODB",
    description:
      "High-throughput serverless persistence for entrance states, evidence logs, and audit records.",
    securityFeatures: [
      "Multi-tenant isolation using partitioned keys (VENUE#<venueId>).",
      "Optimistic concurrency control via ConditionExpression on version attributes.",
      "Complete append-only audit trail for operational accountability.",
    ],
  },
  {
    layer: "05. Operator UX & Voice",
    technology: "Next.js 14 & Client Web Speech API",
    badge: "AMPLIFY SSR",
    description:
      "Interactive operator console with real-time state cards and accessible speech synthesis.",
    securityFeatures: [
      "Voice assistance is presentation-only and strictly executed on the client browser.",
      "Speech cannot authorize state changes, complete tickets, or bypass policy checks.",
      "Responsive accessibility compliance adhering to WCAG 2.1 AA standards.",
    ],
  },
];

export function ArchitectureSection() {
  return (
    <section id="architecture" className="relative py-20 sm:py-28 border-b border-ow-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="architecture-heading"
          eyebrow="System Blueprint"
          title={
            <>
              Engineered for trust:{" "}
              <span className="text-ow-muted font-normal block sm:inline">
                Five layers of defense and verification.
              </span>
            </>
          }
          lead="OpenWay is not a wrapper around an LLM. It is an event-driven, production-grade assurance system built with AWS infrastructure, cryptographic Ring event verification, and pure deterministic state guarantees."
        />

        <div className="mt-14 space-y-4 sm:space-y-6">
          {LAYERS.map((layer, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-ow-line bg-ow-panel/90 p-6 sm:p-7 shadow-lg flex flex-col md:flex-row md:items-start justify-between gap-6 hover:border-ow-mint/30 transition"
            >
              <div className="md:w-1/3">
                <span className="font-mono text-xs font-bold text-ow-mint tracking-wider block">
                  {layer.layer}
                </span>
                <h3 className="mt-1 text-lg font-bold text-ow-paper">{layer.technology}</h3>
                <span className="mt-2 inline-block rounded border border-ow-line bg-ow-raised px-2 py-0.5 font-mono text-[10px] text-ow-paper">
                  {layer.badge}
                </span>
                <p className="mt-3 text-xs leading-relaxed text-ow-muted">
                  {layer.description}
                </p>
              </div>

              <div className="md:w-2/3 md:border-l md:border-ow-line/80 md:pl-6">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-ow-subtle block mb-3">
                  Security &amp; Reliability Guarantees
                </span>
                <ul className="space-y-2.5 text-xs text-ow-muted">
                  {layer.securityFeatures.map((sec, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-2">
                      <span className="text-ow-mint font-bold mt-0.5 font-mono">▸</span>
                      <span className="leading-relaxed">{sec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Verification Architecture Summary Metric Cards */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-ow-line bg-ow-panel p-4 text-center">
            <span className="font-mono text-2xl font-bold text-ow-mint">249</span>
            <p className="mt-1 text-xs text-ow-muted">Passing Automated Tests</p>
            <span className="font-mono text-[10px] text-ow-subtle">Across 31 test suites</span>
          </div>
          <div className="rounded-xl border border-ow-line bg-ow-panel p-4 text-center">
            <span className="font-mono text-2xl font-bold text-ow-mint">9/9</span>
            <p className="mt-1 text-xs text-ow-muted">Gatekeeper Checkpoints</p>
            <span className="font-mono text-[10px] text-ow-subtle">Pure deterministic logic</span>
          </div>
          <div className="rounded-xl border border-ow-line bg-ow-panel p-4 text-center">
            <span className="font-mono text-2xl font-bold text-ow-mint">0 bytes</span>
            <p className="mt-1 text-xs text-ow-muted">S3 Media Storage</p>
            <span className="font-mono text-[10px] text-ow-subtle">Ephemeral in-memory buffers</span>
          </div>
          <div className="rounded-xl border border-ow-line bg-ow-panel p-4 text-center">
            <span className="font-mono text-2xl font-bold text-ow-mint">100%</span>
            <p className="mt-1 text-xs text-ow-muted">Fail-Closed Invariant</p>
            <span className="font-mono text-[10px] text-ow-subtle">Unverified defaults to UNKNOWN</span>
          </div>
        </div>
      </div>
    </section>
  );
}
