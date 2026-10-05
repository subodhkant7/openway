# OpenWay Phase 2 — Interactive Demo Script

This script walks through a complete, deterministic demonstration of OpenWay's Phase 2 accessibility assurance state machine, verification gatekeeper, and evidence timeline.

---

## Prerequisites

- Development server running: `npm run dev`
- Browser open to: [http://localhost:3000](http://localhost:3000)

---

## The Core Product Narrative

```text
AVAILABLE
  └── obstruction detected
        ↓
INTERRUPTED
  └── remediation task dispatched
        ↓
ACTION REQUIRED
  └── staff reports fixed
        ↓
RECHECKING (Verification Pending)
  ├── stale evidence / contradiction  ──>  UNKNOWN
  └── fresh post-remediation evidence ──>  VERIFIED RESTORED
```

---

## Step-by-Step Demonstration Flow

### 1. View Configured Entrance & Baseline Assurance
1. Open [http://localhost:3000](http://localhost:3000).
2. Review the **Selected Entrance Assurance** card:
   - Configured Entrance: **Side Accessible Entrance** at Maple Street Cafe.
   - Bound Ring Camera: **Front Ramp Camera (cam_front_entrance / component_video_01)**.
   - Typed Requirements: Pathway Clear, Obstruction Free, Door Ready.
   - Assurance Badge: **`ACCESS AVAILABLE`**.
3. Point out the **Evidence & Assurance Timeline**:
   - Initial baseline audit event timestamped and logged.

---

### 2. Trigger Scenario 2: Ramp Obstruction
1. Under **Phase 2 Deterministic Simulator Scenarios**, click:
   - **`2. Obstruction: INTERRUPTED`**
2. Observe immediate state transitions:
   - Entrance transitions to `INTERRUPTED` then **`ACTION REQUIRED`**.
   - An active **Remediation Task** appears: *"Clear delivery boxes blocking access ramp"*.
   - The **Evidence & Assurance Timeline** records:
     - `ACCESS INTERRUPTED`
     - `REMEDIATION TASK CREATED`
3. Point out the operator options:
   - Staff can click **"Acknowledge Task"** to claim assignment.

---

### 3. Trigger Scenario 3: Staff Claims "Fixed" (The Critical Invariant)
1. In the **Simulator Workbench**, click:
   - **`3. Staff Claims Fixed: RECHECKING`**
   *(Or click "Report Fixed" on the active remediation card)*.
2. **Key Product Differentiator**:
   - Notice the state transitions to **`RECHECKING (PENDING EVIDENCE)`**.
   - **It does NOT show "Restored ✓"!**
   - The UI explicitly highlights:
     > *"Remediation reported. Verification required. Awaiting fresh Ring camera verification."*
   - Timeline records:
     - `STAFF REPORTED COMPLETE`
     - `VERIFICATION INITIATED`

---

### 4. Trigger Scenario 4: Fresh Post-Remediation Verification
1. Click **`4. Fresh Evidence: VERIFIED RESTORED`** (or "Evaluate Verification Gate").
2. The pure restoration gatekeeper (`canDeclareRestored`) evaluates all 9 conditions:
   - Current state is `RECHECKING`.
   - Completed remediation exists.
   - Evidence `capturedAt` is strictly **after** task `completedAt`.
   - Evidence matches entrance camera binding (`cam_front_entrance`).
   - Evidence is `FRESH`.
   - Requirements confirmed: `pathwayClear = TRUE`, `obstructionPresent = FALSE`, `doorReady = TRUE`.
   - No contradictions detected.
   - Provenance is verified and honest.
3. State transitions to **`VERIFIED RESTORED`** in emerald green!
4. The timeline updates with `ACCESS RESTORED — VERIFIED`.

---

### 5. Demonstrate Safe Failure Paths

OpenWay does not optimize only for a happy-path demo. Demonstrate safe handling of uncertainty:

#### A. Stale Evidence (Scenario 5)
1. Click **`5. Stale Evidence: UNKNOWN`**.
2. An observation is clear, but captured 15 minutes ago.
3. OpenWay refuses to declare restoration and transitions to **`ASSESSMENT UNKNOWN`**.
4. Timeline logs: *"Evidence is stale. Fresh observation is required to assure accessibility."*

#### B. Contradictory Evidence (Scenario 6)
1. Click **`6. Contradictory: UNKNOWN`**.
2. Two computer vision analyzers report conflicting findings (one reports clear, one reports obstruction) in the same window.
3. OpenWay refuses to pick a convenient guess and safely transitions to **`ASSESSMENT UNKNOWN`**.

#### C. Wrong Camera Rejection (Scenario 7)
1. Click **`7. Wrong Camera: REJECTED`**.
2. Valid clear evidence is submitted from an unbound camera (`cam_unbound_back_dock`).
3. The restoration gatekeeper strictly rejects the evidence (`WRONG_CAMERA_DEVICE`).
4. Assurance state remains protected and the timeline logs: `UNBOUND CAMERA REJECTED`.

---

### 6. Demonstrate Phase 3 Multimodal Vision Analysis

Point out the dedicated **Evidence Analysis** panel on the operator dashboard:

1. **Simulated vs. Bedrock Inference**:
   - The headline clearly displays the analyzed engine: `AMAZON BEDROCK` (when using AWS) or `SIMULATOR VISION` (when using local test harness).
   - Provenance tag shows `OFFICIAL RING` or `SIMULATED LOCAL`.
2. **Structured Environmental Conditions**:
   - **Pathway**: `CLEAR` or `BLOCKED`
   - **Obstruction**: `ABSENT` or `PRESENT`
   - **Door**: `READY` or `BLOCKED`
   - **Evidence Quality**: `SUFFICIENT` or `INSUFFICIENT`
3. **Observed Features**:
   - Shows recognized physical elements: e.g. `["accessible ramp", "concrete path", "entrance doorway"]` or `["delivery box", "handrail"]`.
4. **Factual Explanation**:
   - Evidence-oriented description without legal/ADA claims.
5. **Bedrock Unavailable / Degraded Input**:
   - In case of network timeout, darkness, or occluded lens, the panel displays:
     > `EVIDENCE INSUFFICIENT — Accessible pathway is not visible. OpenWay cannot safely assess this observation.`

---

## 3-Minute Demo Summary

| Phase Step | State | Key Takeaway |
| :--- | :--- | :--- |
| **Baseline** | `AVAILABLE` | Venue entrance explicitly bound to Ring hardware. |
| **Interruption** | `ACTION_REQUIRED` | Obstruction detected; concrete staff remediation task opened. |
| **Multimodal AI**| Tri-State Observation | Bedrock observes physical conditions (`"TRUE" \| "FALSE" \| "UNKNOWN"`), not state. |
| **Human Claim** | `RECHECKING` | Staff claims fixed &ne; verified fixed. System demands fresh proof. |
| **Restoration** | `VERIFIED_RESTORED` | Only fresh post-remediation evidence unlocks restoration. |
| **Failure Cases** | `UNKNOWN` / `REJECTED` | Stale data, contradictions, and wrong cameras never compromise safety. |
