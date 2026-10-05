# OpenWay Assurance State Machine

## Overview

OpenWay operates a dedicated, deterministic finite state machine (FSM) that governs real-time physical accessibility assurance for configured entrances.

Unlike generic security camera alert platforms that toggle between binary "motion" states or rely on unverified human checkmarks, OpenWay enforces an immutable architectural invariant:

> **An alert is not a resolution. A resolution is not verified until fresh evidence proves the physical state changed.**

---

## State Definitions

| State | Description | Sensor / Operational Trigger |
| :--- | :--- | :--- |
| `AVAILABLE` | The physical entrance pathway is verified clear, unobstructed, and ready for accessible use. | Baseline clear evidence or operational reset. |
| `INTERRUPTED` | An accessible pathway condition has been violated (e.g., wheelchair ramp obstruction, blocked automatic door push plate, obstacle in entryway). | Ring camera observation detects condition violation. |
| `ACTION_REQUIRED` | The interruption has been acknowledged by the system, and a concrete remediation task is dispatched to staff/operations. | Automated or operator-initiated remediation task creation. |
| `RECHECKING` | Staff has performed physical remediation and reported the task complete. The system is actively awaiting fresh camera verification. | Staff marks task completed (`COMPLETED`). |
| `VERIFIED_RESTORED`| Fresh physical evidence captured **after** remediation has been evaluated by deterministic policy and proven clear. | Pure restoration gatekeeper (`canDeclareRestored`) evaluates to true. |
| `UNKNOWN` | Uncertainty exists due to missing evidence, stale timestamps, contradictory observations, or unverified hardware bindings. | Stale capture time, camera mismatch, or conflicting observations. |

---

## Transition Matrix

The table below defines every allowable state transition. Any transition not explicitly listed is strictly rejected by the application runtime and logged as a policy violation.

| From State | Allowable Next States | Transition Trigger / Prerequisite |
| :--- | :--- | :--- |
| `AVAILABLE` | `INTERRUPTED` | Ring observation indicates active obstruction (`obstructionPresent = TRUE` or `pathwayClear = FALSE`). |
| `AVAILABLE` | `UNKNOWN` | Evidence becomes stale without refresh, or contradictory observations are received. |
| `INTERRUPTED` | `ACTION_REQUIRED` | Remediation task dispatched to staff operations. |
| `INTERRUPTED` | `AVAILABLE` | Immediate clearing observation before remediation dispatch. |
| `INTERRUPTED` | `UNKNOWN` | Camera telemetry lost or evidence invalid. |
| `ACTION_REQUIRED` | `RECHECKING` | Staff member reports remediation completed (`TASK_COMPLETED`). |
| `ACTION_REQUIRED` | `UNKNOWN` | Stale or missing monitoring feed during active remediation. |
| `RECHECKING` | `VERIFIED_RESTORED` | Fresh post-remediation evidence passes all 9 gatekeeper conditions (`canDeclareRestored`). |
| `RECHECKING` | `ACTION_REQUIRED` | Fresh rechecking observation detects physical obstruction is still present. |
| `RECHECKING` | `INTERRUPTED` | Fresh observation detects new obstruction. |
| `RECHECKING` | `UNKNOWN` | Verification evidence is stale, contradictory, or from an unverified camera. |
| `VERIFIED_RESTORED` | `AVAILABLE` | Normal steady-state monitoring cycle. |
| `VERIFIED_RESTORED` | `INTERRUPTED` | New obstruction detected. |
| `VERIFIED_RESTORED` | `UNKNOWN` | Evidence stream interrupted or invalidated. |
| `UNKNOWN` | `AVAILABLE` | Fresh comprehensive observation satisfies all configured requirements. |
| `UNKNOWN` | `INTERRUPTED` | Fresh observation identifies confirmed obstruction. |
| `UNKNOWN` | `RECHECKING` | Active completed remediation awaits verification evidence. |

---

## Prohibited State Transitions

The state machine explicitly rejects:
1. `AVAILABLE` &rarr; `VERIFIED_RESTORED`: Restoration cannot be declared without a prior interruption and verification cycle.
2. `INTERRUPTED` &rarr; `VERIFIED_RESTORED`: Bypassing remediation and rechecking is forbidden.
3. `ACTION_REQUIRED` &rarr; `VERIFIED_RESTORED`: Staff clicking "Fixed" or reporting a task complete **never** directly restores access. It moves the system to `RECHECKING`. Only fresh post-remediation evidence evaluated by deterministic policy can produce `VERIFIED_RESTORED`.
4. Arbitrary API Client Override: External API callers cannot directly inject `VERIFIED_RESTORED` without submitting valid, fresh evidence.
5. AI Model Direct State Transition: The vision model (Amazon Bedrock or simulator) has **NO** ability to set application state. The output schema is strictly constrained to tri-state physical observations (`pathwayClear`, `obstructionPresent`, `doorReady`). Any attempt by a model to return a `state` field is rejected by Zod `.strict()` schema validation. ---

## Phase 4 Proactive Trigger & Bounded Recheck Outcomes

In Phase 4, the state machine is driven by discrete Ring events (preemptive initial detection) and explicit bounded rechecks:

### Initial Detection (Preemptive)
1. Ring motion or ding event is ingested via webhook.
2. Fresh evidence is acquired; vision analysis evaluates physical scene.
3. If obstruction is present, state transitions: `AVAILABLE → INTERRUPTED → ACTION_REQUIRED`.
4. Visitor arrival is **not** required. Obstructions are detected and queued for remediation proactively.

### Recheck Outcomes
After staff reports physical completion (`TASK_COMPLETED`), the system enters `RECHECKING` and explicitly requests fresh evidence (`capturedAt >= completedAt`):
* **Fresh clear evidence**: All 9 gatekeeper checks pass &rarr; `VERIFIED_RESTORED`.
* **Fresh blocked evidence**: Physical obstruction still observed &rarr; `ACTION_REQUIRED`.
* **Evidence unavailable**: Media download timeout or API error &rarr; `UNKNOWN` (no false green).
* **Stale evidence**: Evidence timestamp predates remediation completion &rarr; `UNKNOWN`.
* **Contradictory evidence**: Conflicting fresh observations in window &rarr; `UNKNOWN`.

---

## Structured Audit Logging

Every state transition produces an append-only `AuditEvent` record with correlation tracking and sanitized metadata:

```json
{
  "id": "audit_1791219705403",
  "type": "ACCESS_VERIFIED_RESTORED",
  "timestamp": "2026-10-05T17:01:45.403Z",
  "correlationId": "sim_scen_1791219705403",
  "entityType": "ENTRANCE",
  "entityId": "entrance_side_accessible",
  "metadata": {
    "evidenceId": "ev_fresh_1791219705403",
    "previousState": "RECHECKING",
    "nextState": "VERIFIED_RESTORED",
    "message": "Accessibility restoration verified by fresh camera observation."
  }
}
```

**Security Logging Guarantee**: Transition logs never contain Ring access tokens, signed URLs, webhook secrets, or raw media image bytes.
