# OpenWay

> **Real-Time Accessibility Assurance Powered by Ring**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Ring Track](https://img.shields.io/badge/Track-Ring-0284c7.svg)](https://developer.ring.com)
[![Accessibility Target](https://img.shields.io/badge/WCAG-2.2%20AA-10b981.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

---

## 1. What OpenWay Is

OpenWay provides **real-time accessibility assurance for businesses and venues**. It observes configured accessibility conditions using Ring cameras and doorbells, detects temporary interruptions (such as delivery boxes blocking wheelchair ramps, snow accumulation on access paths, or propped-open fire doors), coordinates immediate remediation, and **only declares access restored after fresh physical evidence is independently verified**.

### Core Product Principle

> **"An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."**

When an accessibility obstruction is reported or remediated by staff, OpenWay does not take anyone's word for it. It requests a fresh visual observation from the venue's Ring camera and confirms that the physical obstruction has actually cleared.

---

## 2. Why Ring Is Required

Ensuring continuous physical accessibility requires reliable, real-world visual observations of building entrances, curb-cuts, ramps, and pathways:

1. **Ubiquitous Hardware Footprint**: Millions of businesses and commercial buildings already deploy Ring video doorbells, Floodlight Cams, and Stick Up Cams at their entrances.
2. **High-Fidelity Telemetry**: Ring provides motion events, video snapshots, media clips, and two-way audio.
3. **Official Developer Platform**: The **Amazon Ring Partner API** (`https://api.amazonvision.com`) and **Ring Developer Playground** enable secure server-to-server device discovery, status retrieval, WebRTC streaming, and event webhooks without brittle unofficial scrapers.

---

## 3. What Is Currently Implemented (Phase 1)

Phase 1 establishes the production-grade application skeleton and proves a **real Ring integration path**:

- [x] **Ring Provider Abstraction (`src/ring/RingProvider.ts`)**: Decouples Ring vendor hardware APIs from OpenWay's domain accessibility policy.
- [x] **Ring Developer Playground Integration (`src/ring/RingPlaygroundProvider.ts`)**: Server-side client utilizing short-lived access tokens from the official Ring Developer Playground.
- [x] **Production Ring Partner API Client (`src/ring/RingApiProvider.ts` & `src/ring/RingClient.ts`)**: Server-to-server HTTP client with correlation IDs, timeout protection, bounded exponential backoff retries, and strict secret masking.
- [x] **Deterministic Local Simulator (`src/ring/RingSimulatorProvider.ts`)**: Full offline mock provider simulating Ring hardware events (`MOTION_EVENT`, `PACKAGE_EVENT`, `DEVICE_ONLINE`, `DEVICE_OFFLINE`, SVG live snapshots).
- [x] **Ring Webhook Ingestion Engine (`src/ring/webhook.ts` & `POST /api/ring/webhook`)**: Validates HMAC-SHA256 signatures (`X-Signature`), implements idempotent deduplication caching, normalizes incoming events into provider-neutral models, and responds in <50ms.
- [x] **Operator Interface**: Accessible, WCAG 2.2 AA compliant dashboard displaying connection status, discovered Ring devices, capability badges, entrance assurance status, and live Ring observation streams.
- [x] **Automated Test Suite**: 35 unit and integration tests across Ring clients, HMAC webhooks, API routes, and React components.

---

## 4. How to Configure the Ring Playground Token

All Ring credentials remain strictly server-side and are **never exposed to the browser client**.

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Log in to the [Amazon Ring Developer Portal](https://developer.ring.com) and navigate to the **Developer Playground**.
3. Generate a short-lived Access Token (typically valid for ~30 minutes).
4. Update your `.env.local`:
   ```env
   OPENWAY_PROVIDER=playground
   RING_ACCESS_TOKEN=your_short_lived_playground_token_here
   RING_API_BASE_URL=https://api.amazonvision.com
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

# 2. Run test suite
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

## 6. How to Verify the Ring Connection

1. **Simulator Mode (Default)**:
   - When `OPENWAY_PROVIDER=simulator`, the UI displays `Ring Connection: SIMULATED` with amber badges.
   - Use the **Deterministic Simulator Workbench** in the UI to trigger motion, delivery obstructions, or toggle devices online/offline.
2. **Playground Mode**:
   - Set `OPENWAY_PROVIDER=playground` with a valid token in `.env.local` (or click "Playground" in the dashboard's mode selector).
   - Click **"Verify"** in the Ring Connection card.
   - Upon successful verification, the dashboard displays `CONNECTED (REAL RING)` with live online device counts and capabilities discovered directly from `https://api.amazonvision.com/v1/devices`.
3. **Webhook Verification**:
   - Webhook endpoint is hosted at `POST /api/ring/webhook`.
   - Incoming payloads require an HMAC-SHA256 signature matching `RING_WEBHOOK_SECRET` in the `X-Signature` header.

---

## 7. Real Ring vs. Simulated Data Matrix

| Feature | Ring Playground / Partner API | Local Simulator |
| :--- | :--- | :--- |
| **Device Discovery** | Real devices retrieved via `GET /v1/devices` | Deterministic mock accessibility cameras |
| **Device Status** | Real-time status via `GET /v1/devices/{id}/status` | Interactive online/offline toggle |
| **Capabilities** | Live capabilities via `GET /v1/devices/{id}/capabilities` | Full 4-capability simulation |
| **Snapshots** | Camera snapshots via `GET /v1/devices/{id}/snapshot` | Synthetic accessible ramp perspective SVG |
| **Webhooks** | Real Ring HMAC-signed webhook delivery | Synthetic event simulation dispatch |
| **UI Badge** | `CONNECTED (REAL RING)` / `RING LIVE` | `SIMULATED` / `[SIM]` |

---

## 8. Current Limitations (Phase 1)

1. **Short-Lived Playground Tokens**: Playground tokens expire in ~30–60 minutes and require manual refresh until the full OAuth 2.0 Account Linking flow is completed in Phase 2.
2. **Single-Venue Scope**: Phase 1 demonstrates entrance assurance for a single configured venue.
3. **Synthetic Evidence Mock for Simulator**: In simulator mode, visual evidence uses vector SVG perspective views of accessible ramps rather than video streams.
4. **Scope Limitations**: OpenWay only verifies camera-observable physical conditions explicitly configured by the venue (e.g. ramp clearance, doorway paths). It does **not** certify compliance with overall municipal or legal building codes.

---

## 9. Planned Next Phase (Phase 2)

- **Automated Evidence AI Pipeline**: Integrate Amazon Bedrock / lightweight Vision AI to inspect fresh Ring snapshots for physical obstruction clearance.
- **Full OAuth 2.0 Account Linking**: Enable venue owners to link Ring accounts with persistent refresh tokens via Ring Appstore.
- **Dispatch & Remediation Flow**: Automated SMS/Slack notification to on-duty staff when an obstruction is detected, with a one-click "I Cleared It" verification trigger.
- **Multi-Entrance Coverage**: Simultaneous assurance across main ramps, automatic doors, elevators, and accessible parking paths.

---

## 10. License

This project is licensed under the terms of the [MIT License](LICENSE).
