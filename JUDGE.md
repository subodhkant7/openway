# OpenWay — Hackathon Judge Guide

> **Real-Time Accessibility Assurance Powered by Ring & Amazon Bedrock**  
> **Primary Track**: Ring  
> **Mini-Challenge**: AWS Builder  

Welcome, Judges! This document provides a rapid, step-by-step walkthrough to evaluate OpenWay either locally or via the deployed cloud demo.

---

## 1. What OpenWay Solves

Physical entrances (such as wheelchair ramps, automatic entrance doors, and curb cuts) frequently experience temporary obstructions: delivery boxes dropped on ramps, doors stuck open, or maintenance debris.

### The Core Problem:
> Current security systems either ignore accessibility or send passive alerts. When staff report an issue "fixed," no automated system verifies the physical truth before giving the green light.

### OpenWay Invariant:
> **"An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."**
OpenWay coordinates staff remediation, but **refuses to declare access restored** until fresh camera evidence captured *after* remediation proves the obstruction is gone.

---

## 2. Quick Demo Walkthrough (Under 3 Minutes)

Open the hosted demo application at `https://main.d2k4o9u0v1.amplifyapp.com` (or run locally at `http://localhost:3000`).

```text
PROVENANCE NOTICE:
In the public demo environment, Ring evidence is generated deterministically by the
Ring Simulator Provider (labeled SIMULATED RING) and analyzed by Amazon Bedrock
(labeled AMAZON BEDROCK), governed by OpenWay's deterministic assurance policy.
```

### Step 1: Baseline Operational State
1. Observe the **Selected Entrance Assurance** card:
   - Venue: **Maple Street Cafe** (Demo Tenant)
   - Entrance: **Side Accessible Entrance**
   - Camera: **Front Ramp Camera (Ring Wired Doorbell Plus)**
   - Status Badge: **`ACCESS AVAILABLE`** (Green)
2. Note the **Evidence & Assurance Timeline** at the bottom left displaying baseline verification.

### Step 2: Trigger Preemptive Interruption
1. In the **Phase 6 Judge Demo & Assurance Workbench** (right side), click:
   - **`1. PREEMPTIVE OBSTRUCTION`**
2. Watch the automated assurance pipeline execute:
   - Ring reports a motion event at the entrance.
   - Fresh camera snapshot is acquired.
   - Amazon Bedrock vision model analyzes the image &rarr; detects delivery boxes on the ramp (`obstructionPresent = TRUE`).
   - State Machine transitions: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
   - A **Remediation Task** is created with clear instructions: *"Delivery boxes detected directly on the access ramp pathway."*

### Step 3: Staff Action (Refusal to False Green)
1. Click **`2. STAFF REMEDIATION`** (or click "Report Fixed" on the active task card).
2. **Observe the critical boundary**:
   - The task is marked `COMPLETED` by staff.
   - The entrance moves to **`RECHECKING (REQUESTING FRESH EVIDENCE)`**.
   - Notice the prominent warning:
     > *"Staff reported completion. OpenWay does not accept staff completion as proof. Requesting fresh Ring camera evidence..."*
   - **The entrance REFUSES to turn green.**

### Step 4: Deterministic Post-Remediation Verification
1. Click **`3. VERIFY RESTORATION`**.
2. OpenWay acquires new camera evidence captured *after* staff completion:
   - Pure policy engine evaluates all 10 post-remediation conditions (`verifyPostRemediationEvidence`).
   - Temporal integrity check confirms: `capturedAt >= completedAt` (`POST_REMEDIATION`).
   - Amazon Bedrock vision analysis verifies pathway is clear (`pathwayClear = TRUE`, `obstructionPresent = FALSE`).
   - State transitions to **`ACCESS RESTORED — VERIFIED`** with checkmarks for pathway, obstruction, door readiness, and temporal integrity.

### Step 5: Test Fail-Closed Defenses (Failure Demos)
1. Click **`FAILURE DEMO 1: UNAVAILABLE`**:
   - Simulates upstream Ring camera outage (404/416/timeout).
   - OpenWay safely yields **`UNKNOWN`** ("No verified restoration"). Never guesses or defaults to clear.
   - Click **`3. VERIFY RESTORATION`** to prove clean recovery.
2. Click **`FAILURE DEMO 2: STALE EVIDENCE`**:
   - Simulates staff attempting to pass old, pre-remediation cached camera frames.
   - Gatekeeper rejects the frame (`TEMPORAL_INCONSISTENCY` &rarr; **`UNKNOWN`**).
   - Proves OpenWay does not accept old images.

### Step 6: Reset Demo Narrative
Click **"Reset Demo Narrative"** at any time to return the demo tenant to its initial clean baseline.

---

## 3. Technology Breakdown

| Component | Technology | Real / Simulated Role |
| :--- | :--- | :--- |
| **Ring Integration** | Official Ring Partner API v1.1 Webhooks, JSON:API `/v1/devices`, `POST /media/image/download` | `RingClient` handles real OAuth Bearer tokens, JSON:API compound documents, 303 redirects, and HMAC webhook validation. In demo mode, `RingSimulatorProvider` generates deterministic test frames with honest `SIMULATED_LOCAL` provenance. |
| **Amazon Bedrock** | `amazon.nova-lite-v1:0` via AWS SDK Converse API | Multimodal vision analyzer. Strictly subordinate: generates structured tri-state observations (`TRUE`, `FALSE`, `UNKNOWN`). Never controls application state or issues status verdicts. |
| **Persistence** | Amazon DynamoDB (`OpenWayTable`) | Single-table cloud persistence for venues, entrances, assessments, tasks, idempotency locks, and immutable audit logs. |
| **Hosting** | AWS Amplify Hosting | Server-side rendered (SSR) Next.js 14 application with least-privilege IAM policies. |
| **Deterministic Policy** | Pure TypeScript (`RestorationGatekeeper`) | Pure deterministic code. Enforces all 10 post-remediation verification invariants. |

---

## 4. Key Verification Invariants

1. **EVENT TIME vs CAPTURE TIME vs RECEIPT TIME**:
   OpenWay never substitutes HTTP download receipt time for the camera's actual capture timestamp.
2. **`capturedAt >= completedAt`**:
   Evidence recorded before staff completed physical action can never verify restoration.
3. **No Facial Recognition / Demographic Profiling**:
   Privacy charter strictly prohibits facial identification, biometric extraction, or disability inference.
4. **Surveillance Boundary**:
   OpenWay performs event-driven assurance, **not** continuous surveillance.

---

## 5. System Health Check

Inspect the live, safe system health report at:
```text
GET /api/health
```
Returns deployment environment, DynamoDB connectivity status, Bedrock configuration, Ring integration mode, and build version without leaking credentials or secrets.
