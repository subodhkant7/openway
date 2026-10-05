# OpenWay Phase 4 — Interactive Demo Script

This script walks through a complete, live demonstration of OpenWay's **Phase 4 proactive accessibility assurance workflow**: from preemptive Ring event detection to automated remediation coordination and fresh-evidence verification.

---

## Prerequisites

- Development server running: `npm run dev`
- Browser open to: [http://localhost:3000](http://localhost:3000)

---

## The Product Story

> A delivery event changes the environment. OpenWay notices the change before an accessibility-dependent visitor encounters it, checks fresh Ring evidence, alerts staff, and refuses to declare the entrance restored until new evidence proves the obstruction is gone.

```text
Ring detects environmental change (motion / ding)
        ↓
OpenWay obtains fresh evidence (latest_in_range)
        ↓
Vision produces structured observations (Bedrock Multimodal Analysis)
        ↓
Deterministic policy evaluates access condition
        ↓
ACCESS INTERRUPTION (AVAILABLE → INTERRUPTED → ACTION_REQUIRED)
        ↓
Staff remediation workflow (RemediationTask dispatched)
        ↓
OpenWay requests fresh post-remediation evidence (Explicit API request)
        ↓
Vision produces new observation
        ↓
Deterministic restoration gate (Evaluates all 9 gatekeeper conditions)
        ↓
VERIFIED_RESTORED (Proven physical restoration)
```

---

## Step-by-Step Demonstration Flow

### 1. View Baseline Entrance Assurance
1. Open [http://localhost:3000](http://localhost:3000).
2. Review the **Selected Entrance Assurance** card:
   - Configured Entrance: **Side Accessible Entrance** at Maple Street Cafe.
   - Bound Ring Camera: **Front Ramp Camera (cam_ring_library_01 / comp: component_video_01)**.
   - Typed Requirements: Pathway Clear, Obstruction Free, Door Ready.
   - Assurance Badge: **`ACCESS AVAILABLE`**.
3. Point out the **Evidence & Assurance Timeline** showing baseline assurance audit events.

---

### 2. Run Preemptive Obstruction
1. In the **Phase 4 Proactive Assurance Demo Workbench**, click:
   - **`1. RUN PREEMPTIVE OBSTRUCTION`**
2. Observe immediate automated workflow:
   - Ring motion event is ingested.
   - Fresh Ring evidence is explicitly acquired.
   - Bedrock vision analysis detects delivery boxes on the wheelchair ramp.
   - State machine transitions: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
   - An active **Remediation Task** is created with concrete physical description:
     *"Delivery boxes detected directly on the access ramp pathway."*
   - Operator console reflects `ACCESS INTERRUPTION DETECTED` with detection timestamp and provenance.
   - Timeline records: `RING EVENT → FRESH EVIDENCE → OBSERVATION → ACCESS INTERRUPTED → TASK CREATED`.

---

### 3. Run Staff Remediation
1. Click:
   - **`2. RUN STAFF REMEDIATION`** (or click "Report Fixed" on the active task card).
2. Observe the state transition and strict security boundary:
   - Task transitions to `COMPLETED` by Staff Operator.
   - Entrance state moves to **`RECHECKING (REQUESTING FRESH EVIDENCE)`**.
   - Notice the prominent system callout:
     > **"OpenWay does not accept staff completion as proof. Requesting fresh Ring camera evidence..."**
   - The entrance **refuses to turn green**.
   - Timeline records: `STAFF ACKNOWLEDGED → REMEDIATION REPORTED → VERIFICATION STARTED`.

---

### 4. Run Verification (Verified Restored)
1. Click:
   - **`3. RUN VERIFICATION`** (or click "Evaluate Fresh Ring Evidence Now").
2. Observe the restoration gate evaluation:
   - OpenWay explicitly requests new Ring image evidence.
   - Temporal integrity check confirms `capturedAt >= completedAt`.
   - Vision analysis verifies pathway is clear of obstacles.
   - All 9 deterministic conditions pass in `RestorationGatekeeper`.
   - Entrance state transitions to **`ACCESS RESTORED — VERIFIED`**.
   - Console displays checkmarks:
     - *Pathway clear ✓*
     - *Obstruction absent ✓*
     - *Door ready ✓*
   - Timeline records: `FRESH EVIDENCE → ACCESS RESTORED — VERIFIED`.

---

### 5. Prove Defense Against False Green

#### A. Stale Evidence Verification
1. Click **`4. RUN STALE VERIFICATION`**.
2. Staff completed a task, but evidence provided was captured *before* completion.
3. The deterministic gatekeeper rejects the stale evidence (`TEMPORAL_INCONSISTENCY`).
4. Resulting State: **`ASSESSMENT UNKNOWN`**. No false green is declared.

#### B. Evidence Unavailable
1. Click **`5. RUN UNKNOWN VERIFICATION`**.
2. Simulates upstream camera outage or network failure during recheck.
3. OpenWay refuses to restore from stale cached observations.
4. Resulting State: **`ASSESSMENT UNKNOWN`**.

#### C. False Staff Completion (Scenario C)
1. Click **`Scenario C: False Complete`**.
2. Staff claimed the ramp was cleared, but new camera evidence shows boxes still present.
3. Resulting State: Returns immediately to **`ACTION REQUIRED`**.

#### D. Wrong Camera Defense (Scenario F)
1. Click **`Scenario F: Wrong Camera`**.
2. Evidence returned belongs to an unbound camera (`cam_unbound_back_dock_99`).
3. Gatekeeper rejects mismatched device ID (`WRONG_CAMERA_DEVICE`).
4. Resulting State: **`ASSESSMENT UNKNOWN`**.

#### E. Event Lost & Replay (Scenario H)
1. Click **`Scenario H: Event Recovery & Replay`**.
2. Simulates a transient webhook delivery interruption.
3. Event reconciliation queries Ring event history, discovers missed motion event, and idempotently replays it through the assurance pipeline.

---

## Surveillance Boundary Statement

OpenWay does **NOT** perform continuous video surveillance. Every observation is triggered by discrete, documented Ring events (motion, button press, device state) and bounded post-remediation verification requests.
