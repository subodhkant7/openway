# OpenWay Phase 6 — Interactive Demo Script

## AWS Cloud Deployment, Durable Persistence & Judge Walkthrough

This script walks through a complete, live demonstration of OpenWay's **Phase 6 production-deployed accessibility assurance system**: establishing durable cloud persistence with Amazon DynamoDB, multimodal AI vision with Amazon Bedrock, and an uncompromised verification gate that survives browser and application reloads.

---

## Prerequisites

- Deployed Cloud Application: AWS Amplify Hosting (`https://main.d2k4o9u0v1.amplifyapp.com`) or local dev server
- Browser open to: `https://main.d2k4o9u0v1.amplifyapp.com` (or [http://localhost:3000](http://localhost:3000))
- Reference: [Hackathon Judge Guide (JUDGE.md)](JUDGE.md) | [AWS Deployment Guide](docs/deployment.md)

---

## The Product Story

> A delivery event changes the environment. OpenWay notices the change before an accessibility-dependent visitor encounters it, checks fresh Ring evidence, alerts staff, coordinates remediation, and **refuses to declare the entrance restored until new post-remediation evidence proves the physical obstruction is gone**.

```text
BASELINE
AVAILABLE
    ↓
Ring Motion Event
    ↓
Fresh Evidence
    ↓
Bedrock Observation:
obstructionPresent = TRUE
    ↓
ACCESS INTERRUPTED
    ↓
ACTION REQUIRED
    ↓
Staff Acknowledges
    ↓
Staff Reports COMPLETE
    ↓
RECHECKING
    ↓
Explicit Post-Remediation Evidence
    ↓
Bedrock Observation:
obstructionPresent = FALSE
pathwayClear = TRUE
doorReady = TRUE
    ↓
Deterministic Gate (verifyPostRemediationEvidence)
    ↓
VERIFIED RESTORED
```

---

## Critical Visual Distinctions

1. **Staff Action vs. System Verification**:
   The operator UI makes the distinction between:
   ```text
   STAFF REPORTED FIXED
   ```
   and:
   ```text
   OPENWAY VERIFIED RESTORED
   ```
   obvious and unambiguous. Staff reporting completion moves the entrance to `RECHECKING`; only fresh camera evidence captured after completion unlocks `VERIFIED RESTORED`.

2. **Real vs. Simulated Provenance Badges**:
   - `OFFICIAL RING`: Active when live Ring credentials and Partner API evidence are used.
   - `SIMULATED RING`: Active when local deterministic simulation evidence is used.
   - `SIMULATED RING + AMAZON BEDROCK`: Active when simulated image evidence is analyzed by the real Amazon Bedrock foundation model.

---

## Canonical Demo Scenario

### Step 1: Baseline Available
1. Open `https://main.d2k4o9u0v1.amplifyapp.com` (or run locally at `http://localhost:3000`).
2. Review the **Selected Entrance Assurance** card:
   - Configured Entrance: **Side Accessible Entrance** at Maple Street Cafe.
   - Bound Ring Camera: **Front Ramp Camera (`cam_ring_library_01` / comp: `component_video_01`)**.
   - Typed Requirements: Pathway Clear, Obstruction Free, Door Ready.
   - Assurance Badge: **`ACCESS AVAILABLE`**.
   - Provenance Badge: **`SIMULATED RING`** (or `OFFICIAL RING` if playground token is active).
3. Review the **Evidence & Assurance Timeline** showing baseline audit events.

### Step 2: Preemptive Obstruction
1. In the **Phase 5 Verification & Demo Workbench**, click:
   - **`1. RUN PREEMPTIVE OBSTRUCTION`**
2. Automated workflow execution:
   - Ring motion event is ingested.
   - Fresh Ring evidence is acquired.
   - Vision analysis detects delivery boxes on the wheelchair ramp (`obstructionPresent = TRUE`).
   - State machine transitions: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
   - A **Remediation Task** is created with concrete description:
     *"Delivery boxes detected directly on the access ramp pathway."*
   - Operator console reflects `ACCESS INTERRUPTION DETECTED` with detection timestamp and provenance.
   - Timeline records: `RING EVENT → FRESH EVIDENCE → BEDROCK OBSERVATION → ACCESS INTERRUPTED → TASK CREATED`.

### Step 3: Staff Remediation
1. Click:
   - **`2. RUN STAFF REMEDIATION`** (or click "Report Fixed" on the active task card).
2. Observe the state transition and strict verification boundary:
   - Task transitions to `COMPLETED` by Staff Operator.
   - Entrance state moves to **`RECHECKING (REQUESTING FRESH EVIDENCE)`**.
   - System displays prominent callout:
     > **"Staff reported completion. OpenWay does not accept staff completion as proof. Requesting fresh Ring camera evidence..."**
   - The entrance **refuses to turn green**.
   - Timeline records: `STAFF ACKNOWLEDGED → REMEDIATION REPORTED → RECHECKING`.

### Step 4: Verification (Verified Restored)
1. Click:
   - **`3. RUN VERIFICATION`** (or click "Evaluate Fresh Ring Evidence Now").
2. Observe the post-remediation verification gate:
   - OpenWay explicitly requests new Ring image evidence.
   - Temporal integrity check confirms:
     `capturedAt >= remediation.completedAt` (classified as `POST_REMEDIATION`).
   - Vision analysis verifies pathway is clear (`obstructionPresent = FALSE`, `pathwayClear = TRUE`, `doorReady = TRUE`).
   - All 10 deterministic conditions pass in `verifyPostRemediationEvidence`.
   - Entrance state transitions to **`ACCESS RESTORED — VERIFIED`**.
   - Console displays checkmarks:
     - *Pathway clear ✓*
     - *Obstruction absent ✓*
     - *Door ready ✓*
     - *Temporal verification satisfied ✓*
   - Timeline records: `POST-REMEDIATION EVIDENCE → BEDROCK OBSERVATION → DETERMINISTIC GATE → VERIFIED RESTORED`.

---

## Failure Demos

### Failure Demo 1: Upstream Media Unavailable → Recovery
This demo proves OpenWay refuses to declare restoration if Ring returns an error or no media is available.

1. First, click **`1. RUN PREEMPTIVE OBSTRUCTION`** then **`2. RUN STAFF REMEDIATION`** (entrance is now `RECHECKING`).
2. Click:
   - **`FAILURE DEMO 1: UNAVAILABLE`**
3. Workflow:
   - Recheck service requests media from Ring.
   - Ring returns 404, 416 (`MEDIA_NOT_FOUND`), or timeout.
   - OpenWay refuses to default to CLEAR.
   - Resulting State: **`UNKNOWN`** with message:
     *"No verified restoration: Ring media evidence unavailable or not found."*
4. **Recovery**:
   - Click **`3. RUN VERIFICATION`**.
   - Fresh valid post-remediation evidence is retrieved.
   - State cleanly transitions from `UNKNOWN` → `RECHECKING` → **`VERIFIED_RESTORED`**.
   - This proves robust recovery after transient camera outages.

### Failure Demo 2: Pre-Remediation Evidence Reused → Rejection
This demo proves OpenWay rejects evidence captured *before* remediation was completed, even if the image download occurred *after* completion.

1. First, click **`1. RUN PREEMPTIVE OBSTRUCTION`** then **`2. RUN STAFF REMEDIATION`** (entrance is now `RECHECKING`).
2. Click:
   - **`FAILURE DEMO 2: STALE EVIDENCE`**
3. Workflow:
   - Evidence download succeeds (`receiptAt > completedAt`).
   - However, the image was physically recorded before staff finished the task:
     `capturedAt < completedAt`.
   - Classified as: `PRE_REMEDIATION`.
   - Post-remediation verifier rejects the evidence:
     `TEMPORAL_INCONSISTENCY: Evidence capture timestamp precedes remediation completion.`
   - Resulting State: **`UNKNOWN`**.
   - Proves OpenWay does not accept old cached camera frames.

---

## Adversarial Invariant Defense Tests

| Button / Scenario | Test Condition | Expected & Enforced Outcome |
| :--- | :--- | :--- |
| **Scenario C: False Complete** | Staff clicked "Fixed", but physical boxes remain in camera view | Returns immediately to `ACTION_REQUIRED`. |
| **Scenario F: Wrong Camera** | Evidence returned from unbound camera (`cam_unbound_back_dock_99`) | Gatekeeper rejects device mismatch; transitions to `UNKNOWN`. |
| **Scenario G: Ambiguous AI** | Bedrock returns `UNKNOWN` due to heavy glare or lens obstruction | Gatekeeper refuses restoration; transitions to `UNKNOWN`. |
| **Scenario H: Event Reconciliation** | Missed Ring motion event during webhook network blip | Recovers event via paginated `links.next` history; replays idempotently. |

---

## Operator Timeline Integrity

Every event recorded in the operator timeline contains:
- **Timestamp**: Exact ISO 8601 millisecond resolution.
- **Provenance**: `OFFICIAL_RING`, `SIMULATED_LOCAL`, or `OPENWAY_DERIVED`.
- **Entity ID**: Obfuscated venue or entrance identifier (e.g., `ent_maple_front_01`).
- **Reason**: Precise operational rationale (e.g., `POST_REMEDIATION_VERIFIED`, `TEMPORAL_INCONSISTENCY_REJECTED`).
- **Privacy Assurance**: No customer personal identities, facial data, access tokens, or signed S3 URLs are ever recorded or displayed.

---

## Surveillance Boundary Statement

OpenWay does **NOT** perform continuous video surveillance. Every observation is triggered by discrete, documented Ring events (motion, button press, device state) and bounded post-remediation verification requests.
