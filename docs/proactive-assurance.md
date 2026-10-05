# Proactive Accessibility Assurance Architecture & Operational Workflow

OpenWay is:
> A proactive accessibility assurance system that detects environmental changes that may interrupt configured, camera-observable access conditions, coordinates remediation, and refuses to declare restoration until fresh evidence proves the condition has been resolved.

Core invariant:
> **Detected &ne; resolved. Resolved &ne; verified.**

---

## 1. Executive Summary & Surveillance Boundary Notice

OpenWay **DOES NOT claim or perform continuous video surveillance**. 

Operating continuous real-time video surveillance streams across physical venues would create severe privacy intrusions, excessive bandwidth consumption, and prohibitive inference costs. Instead, OpenWay operates as an **event-driven assurance system** built upon Amazon Ring's official webhook model:

```text
Ring detects a relevant environmental change (motion, ding, device status)
        ↓
OpenWay obtains fresh evidence (latest_in_range / at_timestamp)
        ↓
Vision produces structured observations (Bedrock Multimodal Analysis)
        ↓
Deterministic policy evaluates access condition (No LLM hallucinations)
        ↓
ACCESS INTERRUPTION (Transition: AVAILABLE → INTERRUPTED → ACTION_REQUIRED)
        ↓
Staff remediation workflow (RemediationTask dispatched & tracked)
        ↓
OpenWay requests fresh post-remediation evidence (Explicit Ring API request)
        ↓
Vision produces a new observation (Post-remediation assessment)
        ↓
Deterministic restoration gate (Evaluates all 9 gatekeeper invariants)
        ↓
VERIFIED_RESTORED (Proven physical restoration)
```

The initial detection is **preemptive**: OpenWay detects and coordinates the removal of physical obstructions **before** a visitor with mobility requirements encounters the blocked doorway or ramp.

---

## 2. Event-Driven Lifecycle

### Step 1: Webhook Ingestion (`src/app/api/ring/webhook/route.ts`)
- The webhook receiver is lightweight and non-blocking.
- It normalizes incoming Ring webhooks into typed `RingEvent` records.
- It offloads Bedrock vision inference and policy processing across an asynchronous execution boundary (`AccessAssuranceOrchestrator.enqueueEvent`).

### Step 2: Deterministic Event Correlation (`src/workflow/eventCorrelator.ts`)
- Maps incoming events strictly to configured entrances via `deviceId` and `componentId`.
- Never infers camera bindings from scene semantics or room names.
- Discards unmapped devices cleanly with `UNBOUND_DEVICE` and audit logging.

### Step 3: Fresh Evidence Acquisition (`src/evidence/evidenceAcquisition.ts`)
- Queries Ring's media endpoint using `latest_in_range` surrounding the event timestamp.
- Evaluates freshness strictly based on media capture time (`capturedAt`), never database receipt time or model execution time.
- Holds image binary bytes in transient server memory; never writes raw bytes to public storage or client bundles.

### Step 4: Vision Analysis via Amazon Bedrock (`src/vision/BedrockVisionAnalyzer.ts`)
- Analyzes physical accessibility criteria: `pathwayClear`, `obstructionPresent`, `doorReady`.
- AI produces **observations only**, never state transitions.

### Step 5: Deterministic Policy Evaluation (`src/workflow/stateMachine.ts`)
- Evaluates aggregated observations against configured entrance requirements.
- On obstruction, executes deterministic state transition: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
- Automatically dispatches an actionable remediation task with specific physical instructions.

---

## 3. Remediation Workflow & Post-Remediation Recheck

### The Remediation Task
```text
ACCESS INTERRUPTION DETECTED
Entrance: Side Accessible Entrance
Trigger Evidence: OFFICIAL RING (cam_ring_library_01)
Observed issue: Delivery boxes detected directly on the access ramp pathway.
Required action: Clear the configured access path.
Verification: Fresh Ring evidence required after remediation.
```

### Staff Action Contract
1. **Acknowledge:** Staff notes receipt of task.
2. **Complete:** Staff reports physical action has been performed.

> **CRITICAL INVARIANT:** Staff completion is a report of human action, NOT proof of physical restoration.
> `COMPLETE` transitions state to `RECHECKING` and immediately triggers bounded fresh evidence acquisition.

### Verification Evidence Window & Recheck Service (`src/workflow/recheckService.ts`)
1. **Temporal Invariant:** `capturedAt >= completedAt`. Evidence captured even one second before staff completion is strictly rejected (`TEMPORAL_INCONSISTENCY`).
2. **Hardware Identity Invariant:** Evidence must match the entrance's exact `deviceId` and `componentId`. Evidence from another camera or wrong component cannot verify restoration.
3. **Contradiction Defense:** Contradictory observations within the verification window immediately default to `UNKNOWN`.
4. **Bounded Retry Strategy:** Attempts verification with exponential backoff (e.g. attempt 1 immediate, attempt 2 at 1.5s, attempt 3 at 2.25s). If fresh conclusive evidence is unavailable, the gate defaults safely to `UNKNOWN` without declaring false green.

---

## 4. Reconciliation Strategy (`src/workflow/eventReconciliation.ts`)

To recover from transient network outages or lost webhook deliveries, OpenWay provides an idempotent event-history recovery service:
```text
Ring Event History
        ↓
Compare with last processed reconciliation timestamp
        ↓
Discover missed events
        ↓
Idempotent deduplication replay
        ↓
Normal assurance pipeline
```
**Architecture Rule:** Event-driven first, reconciliation second. Reconciliation runs on operator demand or scheduled low-frequency recovery.

---

## 5. Summary of Assurance States

| State | Definition | Permitted Next States |
|---|---|---|
| **AVAILABLE** | Baseline verified clear and accessible | INTERRUPTED, UNKNOWN |
| **INTERRUPTED** | Fresh evidence established obstruction or inaccessible condition | ACTION_REQUIRED, UNKNOWN, AVAILABLE |
| **ACTION_REQUIRED** | Active remediation task created for physical staff action | RECHECKING, UNKNOWN |
| **RECHECKING** | Staff reported remediation; active bounded recheck in progress | VERIFIED_RESTORED, ACTION_REQUIRED, UNKNOWN, INTERRUPTED |
| **VERIFIED_RESTORED** | Strict post-remediation evidence evaluated and passed by gatekeeper | AVAILABLE, INTERRUPTED, UNKNOWN |
| **UNKNOWN** | Evidence stale, unavailable, contradictory, or insufficient | AVAILABLE, INTERRUPTED, RECHECKING |
