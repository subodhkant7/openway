# OpenWay Verification Invariants

## Core Product Principle

> **An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed.**

---

## Why "Reported Fixed" &ne; "Verified Fixed"

In traditional business facilities management and generic camera alert applications, when an alert fires, a staff member or manager clicks a button such as:

```text
[ Mark as Resolved ]
```

Once clicked, the system marks the issue "resolved" or "green", even though:
1. Staff may have resolved the wrong entrance or doorway.
2. Staff may have moved a package by two feet, still leaving the accessible path blocked.
3. Staff may have mistakenly marked the ticket as resolved before walking outside.
4. An automated robot or another delivery person may have immediately dropped a second obstacle.

In accessibility assurance, a false declaration of access creates immediate physical harm: a patron using a motorized wheelchair, walker, or guide dog arrives at the facility relying on the "Assured" status, only to find the ramp blocked.

Therefore, in OpenWay:

> **Staff reporting a task complete merely signals that remediation was attempted. It moves the system to `RECHECKING`. Access is NEVER declared restored until fresh camera evidence proves the physical state actually changed.**

---

## The 9 Mandatory Gatekeeper Invariants

The restoration gatekeeper (`canDeclareRestored`) is a pure, deterministic function with zero side effects. It requires **ALL 9** conditions to be satisfied before transitioning an entrance to `VERIFIED_RESTORED`:

| Invariant | Requirement | Violation Behavior / Reason Code | Enforced In Tests |
| :--- | :--- | :--- | :--- |
| **1. State Requirement** | Current state must be `RECHECKING`. | Cannot restore from `AVAILABLE`, `INTERRUPTED`, or `ACTION_REQUIRED`. (`INVALID_STATE`) | `restorationGatekeeper.test.ts` |
| **2. Remediation Exists** | Remediation task must exist with status `COMPLETED`. | Rejects if task is missing or still in `OPEN`/`ACKNOWLEDGED`. (`NO_REMEDIATION` / `REMEDIATION_INCOMPLETE`) | `restorationGatekeeper.test.ts` |
| **3. Temporal Sequencing** | Evidence `capturedAt` must be strictly **after** task `completedAt`. | Rejects if evidence was captured before staff completed physical action. (`TEMPORAL_INCONSISTENCY`) | `restorationGatekeeper.test.ts` |
| **4. Entrance Match** | Evidence `entranceId` and `venueId` must match entrance. | Rejects cross-entrance evidence injection. (`WRONG_ENTRANCE`) | `restorationGatekeeper.test.ts` |
| **5. Hardware Binding Match**| Evidence `deviceId` and `componentId` must match entrance's explicit camera binding. | Rejects evidence from unbound cameras (e.g. rear camera restoring front ramp). (`WRONG_CAMERA_DEVICE` / `WRONG_CAMERA_COMPONENT`) | `restorationGatekeeper.test.ts` |
| **6. Deterministic Freshness**| Verification evidence must evaluate to `FRESH` based on captured timestamp. | Rejects stale or future timestamps. (`STALE_EVIDENCE` / `INVALID_EVIDENCE`) | `restorationGatekeeper.test.ts`, `evidence.test.ts` |
| **7. Requirements Satisfied** | Structured observations must confirm all entrance requirements (`pathwayClear = TRUE`, `obstructionPresent = FALSE`, `doorReady = TRUE`). | Rejects if any condition is `FALSE` or unconfirmed. (`REQUIREMENTS_NOT_MET`) | `restorationGatekeeper.test.ts` |
| **8. Contradiction Free** | No conflicting fresh observations in the verification window. | Rejects if one analyzer reports clear and another reports obstruction. (`CONTRADICTORY_EVIDENCE`) | `restorationGatekeeper.test.ts` |
| **9. Provenance Honesty** | Evidence provenance must be authentic. | Rejects simulated evidence falsely claiming `OFFICIAL_RING`. (`INVALID_PROVENANCE`) | `restorationGatekeeper.test.ts` |

---

## Absolute Architectural Rules

### Rule 1: Ring is Evidence Infrastructure
Ring provides raw events, device context, timestamps, and media evidence. No business logic or accessibility rules exist in the Ring adapter layer.

### Rule 2: AI Does NOT Control State Transitions
AI computer vision proposes structured observations:
```typescript
{
  pathwayClear: "TRUE",
  obstructionPresent: "FALSE",
  doorReady: "TRUE",
  confidence: 0.94
}
```
AI may never directly return `VERIFIED_RESTORED`, and the application core never trusts a statistical model to execute a state transition directly.

### Rule 3: Fresh Evidence is Mandatory
Human intervention cannot bypass verification.

### Rule 4: UNKNOWN is a Valid and Safe State
When data is missing, stale, conflicting, or unverified, OpenWay transitions to `UNKNOWN`. It never converts uncertainty into a false green "Assured".

### Rule 5: Safety Against False Green
The system must be more willing to report `UNKNOWN` than to report `VERIFIED_RESTORED` when evidence quality is insufficient.
* High model confidence + stale evidence &rarr; `UNKNOWN`
* High model confidence + wrong camera &rarr; `UNKNOWN`
* High model confidence + contradictory evidence &rarr; `UNKNOWN`
* Staff completion + no fresh evidence &rarr; `RECHECKING` / `UNKNOWN`
* Fresh evidence + incomplete required fields &rarr; `UNKNOWN`

### Rule 6: Multi-Camera Safety & Explicit Component Attribution
Ring media downloads on multi-camera hardware require explicit camera component selection. A device match with a missing or mismatched component ID cannot verify an entrance and is rejected as `WRONG_CAMERA_COMPONENT` &rarr; `UNKNOWN`.
