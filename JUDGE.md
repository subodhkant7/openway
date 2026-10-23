# OpenWay — Judge Evaluation Guide

> **Primary Track**: Ring  
> **Mini-Challenge**: AWS Builder  
> **Production Website**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)  
> **Live Interactive Console**: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)  
> **System Health & Telemetry**: [https://main.d2qhyx9vstga35.amplifyapp.com/api/health](https://main.d2qhyx9vstga35.amplifyapp.com/api/health)  
> **Developer Friction Log**: [docs/developer-friction-log.md](docs/developer-friction-log.md)  
> **Ring Live Integration Evidence**: [docs/ring-live-integration-verification.md](docs/ring-live-integration-verification.md)

> **Ring Integration Reality:**  
> **OpenWay has verified authenticated integration with the official Ring Developer Playground, including device discovery, status, capabilities, event history and WebRTC live-video playback. Its accessibility-restoration demonstration uses separately labelled simulated visual evidence. Official Ring snapshot retrieval and production account-linking remain unverified.**

---

## 1. What the System Proves

OpenWay proves that **physical accessibility assurance requires deterministic verification beyond passive camera alerts**:

1. **Detection ≠ Resolution ≠ Verification**: An environmental motion alert indicates physical change, but not resolution. When a staff member reports an obstruction cleared, OpenWay refuses to turn the dashboard green until fresh camera evidence proves the physical state changed.
2. **AI Cannot Control Domain State**: Generative and multimodal AI models (such as Amazon Bedrock Nova) are strictly subordinate evidence interpreters. They extract structured tri-state observations (`pathwayClear: TRUE | FALSE | UNKNOWN`). Only pure deterministic software rules (`RestorationGatekeeper`) may authorize state transitions.
3. **Temporal Inversion Defense**: Evidence captured even 1 millisecond before remediation completion is rejected as stale pre-remediation footage (`capturedAt < completedAt`).
4. **Defensible Fail-Closed State (`UNKNOWN`)**: When camera evidence is missing, delayed, blurry, or contradictory, OpenWay resolves to `UNKNOWN`. It never converts uncertainty into a dangerous false green.

---

## 2. Operational Reality: What is Live vs. What is Simulated

OpenWay documents its exact integration reality with complete transparency:

### Fully Operational in Production
- **AWS Amplify Hosting**: Hosts full-stack Next.js 14 App Router application with SSR, edge routing, and IAM service roles.
- **Amazon DynamoDB**: Single-table persistence (`OpenWayTable`) handling venues, entrances, assessments, tasks, and audit logs with conditional write locks (`attribute_not_exists(PK)`), optimistic locking, and atomic `TransactWriteItems`.
- **Pure Deterministic State Machine & Gatekeeper**: All 9 gatekeeper checks and 6 finite states execute live in pure TypeScript with zero external dependencies.
- **WCAG 2.2 AA Operator Workbench**: Fully interactive console with single-screen assurance cards, dynamic gatekeeper decision modal, and append-only audit timeline.
- **Reproducible Test Suite**: 316 passing tests across 38 test files (`npm run test`).

### Implemented Architecture & Integration Boundaries
- **Official Ring Developer Playground Integration**: Verified authenticated server-to-server connection to `https://api.amazonvision.com` via `RingClient` and `RingPlaygroundProvider`. Device discovery (`GET /v1/devices`), status (`GET /v1/devices/{id}/status`), capabilities (`GET /v1/devices/{id}/capabilities`), event history (`GET /v1/history/devices/{id}/events`), and WebRTC live video streaming (`POST .../whep/sessions` returning HTTP 201 Created) are fully operational and verified against a live playground token.
  - *Snapshot Retrieval Status*: Media download (`POST /v1/devices/{id}/media/image/download`) returns HTTP 403 Forbidden under playground token scope boundaries. See [docs/ring-live-integration-verification.md](docs/ring-live-integration-verification.md) for full sanitized evidence.
  - *Public Demo Configuration*: Runs against `RingSimulatorProvider` (`OPENWAY_PROVIDER=simulator`) so judges can evaluate all 7 scenarios without requiring Ring hardware or developer credentials.
- **Amazon Bedrock Multimodal Vision**: Complete Converse API integration (`BedrockVisionAnalyzer.ts`) utilizing `amazon.nova-lite-v1:0` with strict Zod tool-use schema parsing.
  - *Current Status in Public Demo*: In the public Amplify deployment where Bedrock model invocation is rejected with upstream Error 002 (account-level model access restriction), OpenWay operates in simulated vision fallback (`SimulatorVisionAnalyzer.ts`) and fails closed to `UNKNOWN` when conclusive evidence is absent.

---

## 3. Fast 60-Second Judge Walkthrough

Open [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console):

1. **Confirm Baseline (`AVAILABLE`)**: Side Accessible Entrance displays green badge.
2. **Click `1. PREEMPTIVE OBSTRUCTION`**: State moves to **`ACTION_REQUIRED`**; remediation task dispatched.
3. **Click `2. STAFF REMEDIATION`** (or click "Report Fixed"): State moves to **`RECHECKING`**. **The UI refuses to turn green.**
4. **Click `3. CANONICAL VERIFICATION`**: Fresh post-remediation evidence evaluated; state moves to **`ACCESS RESTORED — VERIFIED`**.
5. **Click `4. FAILURE DEMO 1: UNAVAILABLE`**: Upstream camera outage simulated; state safely falls closed to **`UNKNOWN`**.
6. **Inspect Gatekeeper**: Click **"View Nine-Point Gatekeeper Audit Report"** to inspect the 9 verified rules.
7. **Inspect Audit Trail**: Click the **Timeline** tab to inspect the immutable historical event log.
8. **Click `Reset Demo Narrative`**: Restores the demo tenant cleanly to baseline `AVAILABLE`.

---

## 4. Reproducible Automated Test Suite

OpenWay provides 100% reproducible test verification locally:

```bash
git clone https://github.com/subodhkant7/openway.git
cd openway
npm ci
npm run test
```

### Verified Test Metrics (October 2026)
- **Test Files**: 37 passed (37)
- **Tests**: 306 passed (306)
- **Duration**: ~7.7s
- **Suites Covered**:
  - `restorationGatekeeper.test.ts` (12 tests): Invariant verification, stale evidence rejection, temporal ordering.
  - `liveRingContract.test.ts` (11 tests): Official Ring Partner API history endpoint `/v1/history/devices/{id}/events`, JSON:API normalization, empty collection and 401/403 error safety.
  - `ringClient.test.ts` (10 tests): HTTP 303 redirect handling, SSRF origin validation, capture timestamp extraction.
  - `ringOneWayAccountLinking.test.ts` (23 tests): OAuth 2.0 PKCE, state nonces, AES-256-GCM token encryption.
  - `dynamoPersistence.test.ts` (6 tests): Single-table operations, optimistic locking, conditional write idempotency.
  - `bedrockProductionFailure.test.ts` (8 tests): Fail-closed behavior on Error 002, timeout, and model rejection.
  - `tenantIsolation.test.ts` (10 tests): Multi-tenant boundary enforcement and cross-venue request rejection.
  - `mediaSecurity.test.ts` (11 tests): SSRF IP restrictions (169.254.169.254 blocking) and protocol validation.

---

## 5. Known Limitations & Non-Goals

1. **Camera-Observable Conditions Only**: OpenWay verifies physical pathway clearance and door orientation; it cannot certify municipal building code compliance or legal ADA conformity.
2. **Event-Driven**: Detection relies on observable Ring events (motion, doorbell rings, scheduled rechecks) rather than high-cost continuous video streaming.
3. **Fail-Closed to UNKNOWN**: In the absence of conclusive fresh evidence, OpenWay refuses to guess or show green.
4. **No Direct Actuation**: OpenWay coordinates staff remediation; it does not autonomously actuate door motors.
5. **No Unsupported AI Accuracy Claims**: Multimodal models provide structured statistical observations; they are never trusted to make domain decisions.
