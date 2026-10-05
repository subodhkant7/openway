# OpenWay

> **Real-Time Accessibility Assurance Powered by Ring**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Ring Track](https://img.shields.io/badge/Track-Ring-0284c7.svg)](https://developer.ring.com)
[![Accessibility Target](https://img.shields.io/badge/WCAG-2.2%20AA-10b981.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

---

## 1. What OpenWay Is

OpenWay provides **real-time accessibility assurance for businesses and commercial venues**. It observes **configured, camera-observable accessibility conditions** (such as wheelchair ramps, automatic entrance doors, and curb cuts) using Ring cameras, detects temporary physical interruptions (such as delivery boxes blocking ramps, debris accumulation, or propped-open doors), coordinates immediate remediation, and **only declares access restored after fresh physical evidence is independently verified**.

### Core Product Principle

> **"An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."**

When an accessibility obstruction is reported or remediated by staff, OpenWay does not take unverified assertions. It requests fresh visual observation evidence from the venue's Ring camera and confirms that the physical obstruction has actually cleared.

### Scope Boundary Notice

OpenWay verifies **only camera-observable physical conditions explicitly configured by the venue**. It is **not** a general legal or municipal building-code compliance engine.

---

## 2. Capability Conformance & Status Matrix

| Capability | Implementation & Official Endpoint | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Ring device discovery** | `GET /v1/devices?include=status,capabilities` (JSON:API) | **VERIFIED** | Parsed via compound documents (`data`, `attributes`, `relationships`, `included`). |
| **Ring device status** | `GET /v1/devices/{id}/status` or compound document | **VERIFIED** | Normalizes online/offline state and battery telemetry. |
| **Ring capabilities** | `GET /v1/devices/{id}/capabilities` or compound document | **VERIFIED** | Normalizes video, snapshot, clip, and motion support flags. |
| **Ring webhook ingestion** | `POST /api/ring/webhook` (Official v1.1 Schema) | **VERIFIED** | Validates `X-Signature` HMAC-SHA256, constant-time comparison, `request_id` deduplication. |
| **Ring event normalization** | `RingPlaygroundProvider.normalizeEvent()` | **VERIFIED** | Distinguishes `official_ring`, `simulated_local`, and `openway_domain` events. |
| **Ring image evidence** | `POST /v1/devices/{id}/media/image/download` | **DOCUMENTED / SPEC-VERIFIED** | Handles 303 redirects and binary data; not live-verified against physical hardware without live token. |
| **Ring media clips** | `POST /v1/devices/{id}/media/video/download` | **DOCUMENTED / DEFERRED** | Capability detection implemented; video streaming deferred to Phase 2. |
| **OAuth account linking** | `https://oauth.ring.com` OAuth 2.0 flow | **PENDING PHASE 2** | Short-lived Playground Access Token used for Phase 1. |
| **Playground simulation** | `RingSimulatorProvider` | **VERIFIED** | Local offline deterministic mock honestly labeled `SIMULATED - LOCAL TEST EVIDENCE`. |

---

## 3. Why Ring Is Required

Ensuring continuous physical accessibility requires reliable, real-world visual observations of building entrances, curb-cuts, ramps, and pathways:

1. **Ubiquitous Hardware Footprint**: Millions of businesses already deploy Ring video doorbells, Floodlight Cams, and Stick Up Cams at their entrances.
2. **High-Fidelity Telemetry**: Ring provides motion events, image snapshots, media clips, and two-way audio.
3. **Official Developer Platform**: The **Amazon Ring Partner API** (`https://api.amazonvision.com`) and **Ring Developer Playground** enable secure server-to-server device discovery, status retrieval, and event webhooks without brittle unofficial scrapers.

---

## 4. How to Configure the Ring Playground Token

All Ring credentials remain strictly server-side and are **never exposed to client JavaScript**.

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Log in to the [Amazon Ring Developer Portal](https://developer.ring.com) and navigate to the **Developer Playground**.
3. Generate a short-lived Access Token (valid for ~30–60 minutes in the Playground environment).
4. Update your `.env.local`:
   ```env
   OPENWAY_PROVIDER=playground
   RING_ACCESS_TOKEN=your_short_lived_playground_token_here
   RING_API_BASE_URL=https://api.amazonvision.com
   RING_OAUTH_BASE_URL=https://oauth.ring.com
   RING_WEBHOOK_SECRET=your_hmac_webhook_secret
   ```

---

## 5. How to Run Locally

### Prerequisites
- Node.js >= 18.17 (Node 20 or 22 recommended)
- npm >= 9.0

### Installation & Execution
```bash
# 1. Install dependencies
npm install

# 2. Run full test suite (182 tests across 22 suites)
npm run test

# 3. Verify TypeScript type safety
npm run typecheck

# 4. Run linting
npm run lint

# 5. Build production bundle
npm run build

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. How to Verify the Ring Connection & Assurance States

1. **Simulator Mode (Default)**:
   - When `OPENWAY_PROVIDER=simulator`, the UI displays `Ring Runtime: SIMULATOR` with clear badges: `SIMULATED RING` or `SIMULATED RING + AMAZON BEDROCK`.
   - All simulated evidence is honestly stamped: `SIMULATED_LOCAL`.
   - Use the **Phase 5 Verification & Demo Workbench** in the operator dashboard to execute one-click scenarios:
     - `1. RUN PREEMPTIVE OBSTRUCTION` (Ring motion → Fresh evidence → INTERRUPTED → Task OPEN)
     - `2. RUN STAFF REMEDIATION` (Staff reports complete → RECHECKING; verification actively requested)
     - `3. RUN VERIFICATION` (Explicit fresh evidence captured after completion → VERIFIED_RESTORED)
     - `FAILURE DEMO 1: UNAVAILABLE` (Ring 404/416/timeout → UNKNOWN → Recover with Step 3)
     - `FAILURE DEMO 2: STALE EVIDENCE` (Evidence captured before completion → TEMPORAL_INCONSISTENCY → UNKNOWN)
     - Invariant defense tests (Scenarios C, F, G, H).
2. **Playground Mode**:
   - Set `OPENWAY_PROVIDER=playground` with a valid token in `.env.local` (or click "Playground" in the dashboard's mode selector).
   - Click **"Verify"** in the Ring Connection card.
   - Upon successful verification, the dashboard displays `CONNECTED (OFFICIAL RING)` with live online device counts and capabilities discovered directly from `https://api.amazonvision.com/v1/devices`.
3. **Webhook Verification**:
   - Webhook endpoint is hosted at `POST /api/ring/webhook`.
   - Incoming payloads require an HMAC-SHA256 signature matching `RING_WEBHOOK_SECRET` in the `X-Signature` header.
   - Webhooks are acknowledged immediately and enqueued across an async processing boundary to trigger proactive assurance.
4. **Multimodal Bedrock Vision Analysis**:
   - Analyzes Ring camera images in server memory using Amazon Bedrock Runtime Converse API (`amazon.nova-lite-v1:0`).
   - Platform-enforced structured JSON output enforces tri-state values (`"TRUE" | "FALSE" | "UNKNOWN"`).
   - Validated against Zod `.strict()` schema before domain entry.

---

## 7. Real Ring vs. Simulated Data Matrix

| Feature | Ring Playground / Partner API | Local Simulator |
| :--- | :--- | :--- |
| **Device Discovery** | Real devices retrieved via JSON:API `GET /v1/devices?include=status,capabilities` | Deterministic mock accessibility cameras |
| **Device Status** | Real-time status via `GET /v1/devices/{id}/status` or compound document | Interactive online/offline toggle |
| **Capabilities** | Live capabilities via `GET /v1/devices/{id}/capabilities` or compound document | Full 4-capability simulation |
| **Image Evidence** | `POST /v1/devices/{id}/media/image/download` with SSRF redirect validation | Synthetic accessible ramp perspective JPEG buffer |
| **Capture Metadata** | Authoritative `x-ring-captured-at` or `Last-Modified` | Deterministic synthetic timestamp |
| **Webhooks** | Real Ring HMAC-signed webhook delivery (v1.1 schema) | Synthetic event simulation dispatch |
| **Event History** | Paginated `GET /v1/devices/{id}/events` following `links.next` | Mock paginated event list |
| **Vision Inference** | Amazon Bedrock (`amazon.nova-lite-v1:0`) | `SimulatorVisionAnalyzer` or Bedrock |
| **UI Badge** | `CONNECTED (OFFICIAL RING)` / `OFFICIAL RING` | `SIMULATED RING` / `SIMULATED RING + AMAZON BEDROCK` |

---

## 8. Phase 5 Hardened Ring Evidence Pipeline & Post-Remediation Verification

OpenWay enforces an uncompromised distinction between an event that occurred, evidence that existed, and evidence that was actually captured after remediation:

1. **Three Distinct Temporal Concepts**:
   - **EVENT TIME**: When Ring reports that an environmental change occurred.
   - **CAPTURE TIME**: When the camera sensor physically captured the media frame.
   - **RECEIPT TIME**: When OpenWay received the HTTP response.
   OpenWay **never** substitutes receipt or request time for capture time. `requestAt > completedAt` does **not** imply `capturedAt > completedAt`.
2. **Temporal Evidence Classification**:
   Every evidence artifact is deterministically classified:
   - `PRE_REMEDIATION`: Captured before staff completed the remediation task.
   - `POST_REMEDIATION`: Captured at or after remediation completion timestamp (`capturedAt >= completedAt`).
   - `TEMPORALLY_UNVERIFIED`: Capture timestamp cannot be established from provider metadata. Resolves to `UNKNOWN`.
   - `STALE`: Exceeds the venue's configured maximum evidence age (default: 300s). Resolves to `UNKNOWN`.
   - `INVALID`: Plagued by future timestamps or malformed ISO date strings.
3. **10-Point Post-Remediation Verification Rule (`verifyPostRemediationEvidence`)**:
   Mandatory requirements before declaring `VERIFIED_RESTORED`:
   1. Evidence exists;
   2. Evidence capture time is known;
   3. Capture time is at or after remediation completion (`capturedAt >= completedAt`);
   4. Evidence matches configured entrance;
   5. Evidence matches configured device;
   6. Evidence matches configured camera component;
   7. Evidence is fresh;
   8. Observation is structurally valid;
   9. Observation satisfies all configured requirements (`pathwayClear = TRUE`, `obstructionPresent = FALSE`, `doorReady = TRUE`);
   10. No contradictory current evidence exists.
   If any condition fails, the system yields `UNKNOWN` (or `ACTION_REQUIRED` if an obstruction remains visible). It **never** issues a false green.
4. **SSRF Redirect Hardening**:
   Ring's `POST /media/image/download` endpoint returns HTTP 303 pointing to an S3 pre-signed URL in the `Location` header. `RingClient` strictly validates destination hostnames against `*.ring.com`, `*.amazonvision.com`, and `*.amazonaws.com`, blocking arbitrary redirect targets, private RFC 1918 IPs, and AWS metadata endpoints (`169.254.169.254`).
5. **Event History Pagination**:
   Reconciliation follows official Ring JSON:API pagination semantics via `links.next` without hardcoding page sizes or numeric offsets.

For in-depth architectural and policy documentation, see:
- [Ring Evidence Semantics & Download Audit](docs/ring-evidence-semantics.md)
- [Live Ring Verification Status](docs/live-ring-verification.md)
- [Proactive Assurance & Remediation Workflow](docs/proactive-assurance.md)
- [Multimodal Vision Pipeline & Bedrock Integration](docs/vision-pipeline.md)
- [Assurance State Machine Specification](docs/assurance-state-machine.md)
- [Evidence & Observation Model](docs/evidence-model.md)
- [Verification Invariants & Core Principles](docs/verification-invariants.md)
- [Amazon Ring Developer Tooling Friction Log](docs/friction-log.md)
- [Architecture Blueprint](ARCHITECTURE.md)
- [Live Demonstration Guide](DEMO.md)
- [Hackathon Compliance Checklist](docs/hackathon.md)
- [Security Model](SECURITY.md)
- [Privacy Policy](PRIVACY.md)

---

## 9. Current Limitations & Scope Boundary

1. **Scope Boundary**: OpenWay only verifies camera-observable physical conditions explicitly configured by the venue (e.g. ramp clearance, doorway paths). It does **not** certify compliance with overall municipal or legal building codes.
2. **Short-Lived Playground Tokens**: Playground tokens expire in ~30–60 minutes and require manual re-issuing until the full OAuth 2.0 Account Linking flow is completed in Phase 6.
3. **No Direct Actuation**: OpenWay verifies and coordinates remediation; it does not autonomously control physical door locks or motors.

---

## 10. License

This project is licensed under the terms of the [MIT License](LICENSE).
