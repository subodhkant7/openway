# OpenWay — Official Hackathon Demo Script & Judge Walkthrough

> **Primary Track**: Ring  
> **Mini-Challenge**: AWS Builder  
> **Presentation Website**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)  
> **Live Interactive Console**: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)  
> **System Health & Telemetry**: [https://main.d2qhyx9vstga35.amplifyapp.com/api/health](https://main.d2qhyx9vstga35.amplifyapp.com/api/health)

---

## 1. Product Positioning Statement

> **OpenWay is a proactive, event-driven accessibility assurance system that uses Ring evidence to detect configured, camera-observable access interruptions, coordinate staff remediation, and verify physical restoration with fresh evidence.**

> **Ring Integration Reality:**  
> **OpenWay has verified authenticated integration with the official Ring Developer Playground for device discovery, status, capabilities and event history. Its public accessibility assurance demonstration continues to use deterministic simulated visual evidence. Official Ring snapshot retrieval and production account-linking remain unverified.**

### The Core Invariant
> **"Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed."**

---

## 2. Fast 60-Second Judge Walkthrough

The live console is deployed on AWS Amplify and pre-seeded with the demo venue (**Maple Street Cafe — Side Accessible Entrance**). Evaluators need **zero AWS keys**, **zero Ring hardware**, and **zero configuration**.

Open the interactive console: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)

```text
AVAILABLE ──► ACTION_REQUIRED ──► RECHECKING ──► VERIFIED_RESTORED ──► UNKNOWN
```

### Step 1: Baseline Verification (`AVAILABLE`)
- **Action**: Look at the **Selected Entrance Assurance** card.
- **Observed State**: **`ACCESS AVAILABLE`** (Green badge).
- **Physical Conditions**: Pathway Clear &check;, Obstruction Free &check;, Power-Assist Door Ready &check;.
- **Hardware Binding**: Bound to `cam_front_entrance` (Ring Wired Doorbell Plus).

### Step 2: Preemptive Obstruction Ingestion (`AVAILABLE` &rarr; `ACTION_REQUIRED`)
- **Action**: In the **Judge Demo Workbench** (bottom panel), click **`1. PREEMPTIVE OBSTRUCTION`**.
- **System Action**: Ring motion event is ingested. Multimodal vision detects delivery boxes blocking the wheelchair ramp (`obstructionPresent = TRUE`).
- **Observed State**: Transitions from `AVAILABLE` &rarr; `INTERRUPTED` &rarr; **`ACTION_REQUIRED`** (Amber badge).
- **Dispatched Task**: A remediation task appears on the left panel: *"Delivery boxes detected directly on the access ramp pathway."*

### Step 3: Staff Remediation (`ACTION_REQUIRED` &rarr; `RECHECKING`)
- **Action**: Click **`2. STAFF REMEDIATION`** (or click **"Report Fixed"** on the active remediation task card).
- **System Action**: Task status updates to `COMPLETED`.
- **Observed State**: Transitions to **`RECHECKING (REQUESTING FRESH EVIDENCE)`** (Blue badge).
- **CRITICAL DEMO INVARIANT**: **The UI strictly refuses to turn green.** Notice the warning banner:
  > *"Staff Alex reported completion. OpenWay does not accept staff completion as proof. Requesting fresh Ring camera evidence..."*

### Step 4: Canonical Fresh-Evidence Verification (`RECHECKING` &rarr; `VERIFIED_RESTORED`)
- **Action**: Click **`3. CANONICAL VERIFICATION`**.
- **System Action**: System acquires a fresh camera frame captured *after* staff completion (`capturedAt >= completedAt`). All 9 gatekeeper rules pass.
- **Observed State**: Transitions to **`ACCESS RESTORED — VERIFIED`** (Emerald badge).
- **Explanation**: *"All 9 verification conditions passed. Physical restoration proven by fresh post-remediation evidence."*

### Step 5: Fail-Closed Proof (`UNKNOWN`)
- **Action**: Click **`4. FAILURE DEMO 1: UNAVAILABLE`** (or `5. FAILURE DEMO 2: STALE PRE-REMEDIATION`).
- **System Action**: Simulates an upstream camera outage or replay of pre-remediation footage.
- **Observed State**: Transitions cleanly to **`ASSESSMENT UNKNOWN`** (Neutral Gray badge).
- **Explanation**:
  > *"OpenWay could not obtain sufficient fresh evidence. Restoration was not declared."*
- **Significance**: Proves that OpenWay is fail-closed and will never present an unverified false green.

---

## 3. How to Inspect the Gatekeeper Decision Record

Every restoration decision in OpenWay is evaluated by the deterministic nine-point gatekeeper (`src/policy/restorationGatekeeper.ts`). Evaluators can audit the gatekeeper at any moment:

1. On the live console, click the button **"View Nine-Point Gatekeeper Audit Report"** located directly beneath the Entrance Assurance card.
2. The modal displays:
   - Authoritative assessment timestamp and correlation ID.
   - Live checklist for all 9 invariants (State Gate, Completed Remediation, Temporal Ordering `capturedAt >= completedAt`, Entrance Scope, Camera Binding, Evidence Freshness, Requirements Satisfied, Non-Contradiction, and Honest Provenance).
   - In `VERIFIED_RESTORED`, all 9 checks display green checkmarks with verified evidence IDs.
   - In failure scenarios or `RECHECKING`, unmet checks display red rejection badges with exact diagnostic reason codes (`TEMPORAL_INCONSISTENCY`, `EVIDENCE_STALE`, etc.).

---

## 4. How to Inspect the Audit Trail

OpenWay maintains an append-only chronological event log:

1. Look at the right panel of the console and click the **Timeline** tab (next to the Scenarios tab).
2. The audit trail displays every historical event in descending chronological order:
   - Ring Webhook Ingestion events (`motion`, `doorbot_bell_ringing`).
   - Multimodal Vision Observations (`pathwayClear: true/false`, `confidence`).
   - Remediation Task Lifecycle (`OPEN` &rarr; `COMPLETED`).
   - State Machine Transitions (`AVAILABLE` &rarr; `ACTION_REQUIRED` &rarr; `RECHECKING` &rarr; `VERIFIED_RESTORED`).
   - Evaluated Gatekeeper Reports with exact reason codes.

---

## 5. How to Reset the Demo Safely

To return the demonstration environment to a pristine state at any point:
- Click the **`Reset Demo Narrative`** button in the top-right corner of the console header (or send an authenticated/sandbox `POST /api/demo/reset`).
- This executes an atomic rollback: cancels open remediation tasks, clears transient assessments, resets `entrance_side_accessible` to baseline `ACCESS AVAILABLE`, and records an audit reset marker.

---

## 6. Real Ring Integration vs. Simulated Assurance Disclosure

OpenWay maintains strict provenance transparency:

1. **Official Ring Developer Playground Integration (`src/ring/RingPlaygroundProvider.ts`)**:
   - Authenticated live connection to `https://api.amazonvision.com` using a valid Ring Developer Playground access token.
   - Successfully verified against official API endpoints:
     - `GET /v1/devices` (Device Discovery)
     - `GET /v1/devices/{id}/status` (Device Status)
     - `GET /v1/devices/{id}/capabilities` (Device Capabilities)
     - `GET /v1/history/devices/{id}/events` (Device Event History)
   - Diagnostic verification: `POST /v1/devices/{id}/media/image/download` returns `HTTP 403 Forbidden` under sandbox token boundaries.
   - Full sanitized verification evidence: [docs/ring-live-integration-verification.md](docs/ring-live-integration-verification.md).
2. **Deterministic Accessibility Assurance Demonstration (`src/ring/RingSimulatorProvider.ts`)**:
   - Active in the public evaluation console so judges can evaluate all 7 scenarios without requiring Ring hardware or short-lived developer tokens.
   - Generates deterministic mock Ring device metadata and HMAC-SHA256 webhooks matching the official Amazon Ring Partner API JSON:API v1.1 format.
   - Serves local test ramp images for clear, obstructed, and occluded physical states.
   - **Critical Rule**: Simulated accessibility evidence is never represented as official Ring camera footage.
3. **`SimulatorVisionAnalyzer` (`src/vision/SimulatorVisionAnalyzer.ts`)**:
   - Deterministic vision fallback module. When Amazon Bedrock Nova Lite returns Error 002 (account-level model access restriction), OpenWay falls back to this simulator to evaluate frames against configured requirements, failing closed to `UNKNOWN` when evidence is ambiguous.
4. **Hardware Provenance Badge**:
   - All simulated telemetry is explicitly badged as `SIMULATED RING` or `SIMULATOR (Deterministic)`. OpenWay never mislabels simulated evidence as live hardware data.

---

## 7. Revised Video Storyboard (Strictly Under 180s — 2m 48s)

```text
0:00–0:18 | 1. The Accessible-Entrance Problem & Core Invariant (Detection ≠ Resolution ≠ Verification)
0:18–0:38 | 2. Real Authenticated Ring API Integration (api.amazonvision.com + Bearer auth)
0:38–0:55 | 3. Official Device Discovery & Event History (Discovered Ring Doorbell + /v1/history/... events)
0:55–1:12 | 4. Provenance Boundary: Ring Metadata vs. Simulated Accessibility Observations
1:12–1:35 | 5. Preemptive Obstruction Detection & Staff Remediation Dispatch
1:35–1:55 | 6. Refusing False Green: Staff Report → RECHECKING (Awaiting Fresh Camera Evidence)
1:55–2:18 | 7. Canonical Nine-Point Gatekeeper Verification: Fresh Post-Remediation Evidence → VERIFIED RESTORED
2:18–2:35 | 8. Fail-Closed UNKNOWN: Missing/Stale Evidence Never Shows Green
2:35–2:48 | Conclusion: Ring + Amazon Bedrock + AWS Amplify & MIT Open-Source Availability
```
