# OpenWay — Official Hackathon Demo Script & Video Storyboard

> **Primary Track**: Ring  
> **Mini-Challenge**: AWS Builder  
> **Presentation Website**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)  
> **Live Interactive Console**: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)  
> **System Health**: [https://main.d2qhyx9vstga35.amplifyapp.com/api/health](https://main.d2qhyx9vstga35.amplifyapp.com/api/health)

---

## 1. Product Positioning Statement

> **OpenWay is a proactive, event-driven accessibility assurance system that uses Ring evidence to detect configured, camera-observable access interruptions, coordinate remediation, and verify restoration with fresh evidence.**

### The Core Invariant
> **"Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed."**

---

## 2. Three-Minute Demo Video Script & Storyboard

The demo video is timed to strictly stay under the 3-minute threshold required by Amazon hackathon rules (total duration: **2 minutes 58 seconds**).

```text
0:00–0:15 | Opening Hook: The Accessibility Gap & Core Thesis
0:15–0:35 | Baseline State: Configured Entrance, Ring Camera Binding & Requirements
0:35–1:05 | Preemptive Interruption: Ring Motion & Bedrock Vision Detection
1:05–1:25 | Remediation Task: Operational Coordination & Staff Notification
1:25–1:45 | Staff Action Boundary: Staff Reports Fixed → RECHECKING (No False Green)
1:45–2:10 | Verification: Fresh Post-Remediation Ring Evidence → VERIFIED RESTORED
2:10–2:30 | Failure Demonstration: Missing/Unclear Evidence → UNKNOWN (Fail Closed)
2:30–2:50 | Why OpenWay is Different: Deterministic Policy vs. Simple Camera Alerts
2:50–2:58 | Closing: Ring + Amazon Bedrock + AWS Cloud Persistence
```

---

### Segment-by-Segment Script

#### [0:00 – 0:15] Opening Hook: The Problem & Solution
* **Visual**: Cut directly to the live OpenWay dashboard at [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com).
* **Voiceover**:
  > "A business can be listed as accessible while its wheelchair ramp is temporarily blocked by delivery boxes. OpenWay detects the interruption proactively, coordinates staff remediation, and refuses to declare 'restored' until fresh camera evidence proves the obstruction is gone."

#### [0:15 – 0:35] Scene 1: Baseline State & Ring Camera Binding
* **Visual**: Highlight the **Selected Entrance Assurance** card showing:
  - Entrance: **Side Accessible Entrance** at Maple Street Cafe.
  - Bound Device: **Front Ramp Camera (Ring Wired Doorbell Plus)**.
  - Configured Conditions: Pathway Clear, Obstruction Free, Door Ready.
  - Status Badge: **`ACCESS AVAILABLE`** (Green).
  - Provenance Badge: **`SIMULATED RING`**.
* **Voiceover**:
  > "Here is our configured entrance. Ring watches the physical access path. Right now, baseline conditions are verified and access is available."

#### [0:35 – 1:05] Scene 2: Preemptive Interruption
* **Visual**: Click **`1. PREEMPTIVE OBSTRUCTION`** in the Judge Demo Workbench.
  - Ring motion event fires (`motion` at `cam_front_entrance`).
  - Ring camera image is acquired into server memory.
  - Amazon Bedrock vision model analyzes the image &rarr; detects delivery boxes on the ramp (`obstructionPresent = TRUE`).
  - Status transitions: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
  - UI callout: *"Accessibility interruption detected before visitor arrival."*
* **Voiceover**:
  > "A delivery driver drops packages directly on the access ramp. Ring detects motion, Bedrock analyzes the frame, and OpenWay immediately flags an interruption before any visitor encounters it."

#### [1:05 – 1:25] Scene 3: Remediation Workflow
* **Visual**: Highlight the active Remediation Task card (`task_...`, status `OPEN`).
  - Clear task description: *"Delivery boxes detected directly on the access ramp pathway."*
  - Shows detection timestamp, bound camera, and staff action buttons.
* **Voiceover**:
  > "OpenWay automatically dispatches a remediation task to floor staff with concrete instructions to clear the pathway."

#### [1:25 – 1:45] Scene 4: Staff Complete & Strict Refusal to False Green
* **Visual**: Click **`2. STAFF REMEDIATION`** (or click "Report Fixed").
  - Task transitions to `COMPLETED`.
  - Entrance state transitions to **`RECHECKING (REQUESTING FRESH EVIDENCE)`**.
  - Notice prominent warning banner:
    > *"Staff reported completion. OpenWay does not accept staff completion as proof. Requesting fresh Ring camera evidence..."*
  - **The UI refuses to turn green.**
* **Voiceover**:
  > "Staff clicks 'Report Fixed.' In a typical system, the dashboard would turn green right here. But staff can be mistaken, distracted, or premature. OpenWay refuses to declare restoration. It moves to RECHECKING."

#### [1:45 – 2:10] Scene 5: Deterministic Fresh-Evidence Verification
* **Visual**: Click **`3. CANONICAL VERIFICATION`**.
  - System acquires new Ring camera evidence captured *after* staff completion (`capturedAt >= completedAt`).
  - Bedrock vision model verifies: Pathway Clear &check;, Obstruction Absent &check;, Door Ready &check;.
  - Status transitions to **`ACCESS RESTORED — VERIFIED`**.
  - Checkmarks appear on all 9 deterministic gatekeeper rules.
* **Voiceover**:
  > "OpenWay acquires a fresh post-remediation frame from Ring. Bedrock confirms the physical clearance, the deterministic gatekeeper verifies all invariants, and only now does OpenWay declare the entrance verified restored."

#### [2:10 – 2:30] Scene 6: The Failure Drill (Proving It's Not Hardcoded)
* **Visual**: Click **`4. FAILURE DEMO 1: UNAVAILABLE`**.
  - Simulates an upstream camera outage or network timeout during verification.
  - State cleanly transitions to **`ASSESSMENT UNKNOWN`** (Gray/Neutral).
  - Explicit UI text displayed:
    > *"OpenWay could not obtain sufficient fresh evidence. Restoration was not declared."*
  - Click **`Reset Demo Narrative`** to show clean baseline recovery.
* **Voiceover**:
  > "What if evidence is missing, blurry, or unavailable? OpenWay fails closed to UNKNOWN. It never guesses and never defaults to green."

#### [2:30 – 2:50] Architectural Differentiation
* **Visual**: Display differentiation comparison:
  ```text
  Traditional Camera AI:
  EVENT ──► DETECTION ──► ALERT ──► (Ignored / Unverified)

  OpenWay:
  EVENT ──► EVIDENCE ──► BEDROCK ──► POLICY ──► TASK ──► FRESH EVIDENCE ──► VERIFIED / UNKNOWN
  ```
* **Voiceover**:
  > "Traditional camera systems send passive alerts. OpenWay manages the entire physical assurance lifecycle—verifying configured camera-observable conditions with fresh evidence."

#### [2:50 – 2:58] Closing & AWS Builder Integration
* **Visual**: Display architecture badge: Ring Partner API + Amazon Bedrock + Amazon DynamoDB + AWS Amplify Hosting.
* **Voiceover**:
  > "Built on Ring and Amazon Bedrock, running persistently on AWS. OpenWay provides proactive accessibility assurance."

---

## 3. Ring Claim & Provenance Standards

OpenWay adheres strictly to standardized evidence categories across all documentation, UI badges, and demo outputs:

| Category | Definition | Where Used |
|---|---|---|
| **`LIVE RING VERIFIED`** | Actually executed against live Ring Developer Playground tokens or physical hardware in production. | Evaluated when live developer credentials are active. |
| **`SPEC VERIFIED`** | Conformant with official Ring Partner API v1.1 specs (JSON:API `/v1/devices`, HTTP 303 media downloads, HMAC webhooks). | Verified in unit and contract test suites. |
| **`SIMULATOR (Deterministic)`** | Deterministic synthetic evidence generated by the Ring Simulator Provider. | Default mode in the public demo sandbox for frictionless judge evaluation. |
| **`SIMULATED VISION / FALLBACK`** | Synthetic ramp image evidence analyzed by simulated vision when Amazon Bedrock access is unconfigured (fails closed to `UNKNOWN` upon model denial). | Used in public demo sandbox. |
| **`NOT AVAILABLE`** | Capability not present in evaluation environment. | Explicitly reported on unconfigured features. |

---

## 4. Deterministic Judge Walkthrough (Under 60 Seconds)

1. Open [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com).
2. Confirm **`ACCESS AVAILABLE`** baseline.
3. Click **`1. PREEMPTIVE OBSTRUCTION`** &rarr; observe **`ACCESS INTERRUPTED`**.
4. Click **`2. STAFF REMEDIATION`** &rarr; observe **`RECHECKING`** (no false green).
5. Click **`3. CANONICAL VERIFICATION`** &rarr; observe **`ACCESS RESTORED — VERIFIED`**.
6. Click **`4. FAILURE DEMO 1: UNAVAILABLE`** &rarr; observe **`ASSESSMENT UNKNOWN`**.
7. Click **`Reset Demo Narrative`** &rarr; clean reset to baseline.
