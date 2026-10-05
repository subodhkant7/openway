# Ring Evidence Semantics & Temporal Integrity

## 1. Executive Summary

In OpenWay, evidence integrity is governed by one foundational principle:

> **A successful Ring media-download request is not, by itself, proof that a new image was captured.**

The system must never declare `VERIFIED_RESTORED` using evidence captured before remediation completion. Visual restoration assurance depends strictly on authoritative media capture timestamps, provenance verification, and deterministic policy gates.

---

## 2. Three Distinct Temporal Concepts

OpenWay enforces a strict three-way conceptual model for temporal data:

| Concept | Definition | Authoritative Source |
| :--- | :--- | :--- |
| **EVENT TIME** | When Ring reports an environmental occurrence (e.g. motion detected or doorbell ding). | Ring Webhook payload / Event record `timestamp` |
| **CAPTURE TIME** | When the camera sensor actually recorded the physical image frame. | Response header (`x-ring-captured-at`, `Last-Modified`) or media JSON attribute (`captured_at`) |
| **RECEIPT TIME** | When OpenWay server-side application layer received the HTTP response bytes. | OpenWay server clock `new Date().toISOString()` |

### Absolute Invariants:
1. **Never substitute receipt time for capture time.** HTTP transfer latency or server polling time has no bearing on when physical reality was observed.
2. **Never substitute request time for capture time.** Calling the Ring download API at $T_2$ where $T_2 > \text{remediation.completedAt}$ does **not** prove the returned image was captured after $T_1$. Ring frequently caches or returns the latest available still image.
3. **If capture time cannot be established from provider metadata:** the evidence is classified as `TEMPORALLY_UNVERIFIED` and resolves deterministically to `UNKNOWN`.

---

## 3. Evidence Classification Model

Every piece of evidence evaluated by OpenWay is deterministically categorized into an explicit classification:

```text
                               ┌───────────────────────────┐
                               │   Captured Time Known?    │
                               └─────────────┬─────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │ No                                      │ Yes
                        ▼                                         ▼
            TEMPORALLY_UNVERIFIED                     ┌───────────────────────┐
                 (UNKNOWN)                            │ Capture Time Valid?   │
                                                      └───────────┬───────────┘
                                                                  │
                                             ┌────────────────────┴────────────────────┐
                                             │ Future / Unparseable                    │ Past & Valid
                                             ▼                                         ▼
                                          INVALID                           ┌──────────────────────┐
                                         (UNKNOWN)                          │ Age > maxAgeSeconds? │
                                                                            └──────────┬───────────┘
                                                                                       │
                                                                  ┌────────────────────┴────────────────────┐
                                                                  │ Yes                                     │ No
                                                                  ▼                                         ▼
                                                                STALE                           ┌───────────────────────┐
                                                              (UNKNOWN)                         │ Active Remediation?   │
                                                                                                └──────────┬────────────┘
                                                                                                           │
                                                                                      ┌────────────────────┴────────────────────┐
                                                                                      │ capturedAt < completedAt                │ capturedAt >= completedAt
                                                                                      ▼                                         ▼
                                                                               PRE_REMEDIATION                           POST_REMEDIATION
                                                                                  (UNKNOWN)                             (Eligible for Gate)
```

---

## 4. Official Ring Media API Audit

### Endpoint
`POST /v1/devices/{device_id}/media/image/download`

### Parameters
* `components`: Array of component strings, e.g. `["camera"]` or `["camera_left"]`.
* Temporal selection modes:
  * `latest_in_range`: Requests the latest recorded frame within an allowable window.
  * `at_timestamp`: Requests the frame nearest to an exact timestamp.

### Authoritative Metadata Extraction
* **303 See Other / 302 Found Redirects**: The Ring API returns a `Location` header containing a short-lived pre-signed Amazon S3 URL. OpenWay intercepts this redirect, validates that the hostname matches authorized Ring/AWS S3 media domains (SSRF defense), and extracts capture timestamps from `x-ring-captured-at` or `Last-Modified`.
* **JSON Envelope**: When Ring returns JSON, `data.attributes.captured_at` represents authoritative capture time.
* **Direct Binary Stream**: When returning binary media, the server inspects `x-ring-captured-at` or `Last-Modified`.
* **Missing Metadata**: If neither header nor JSON attribute contains capture time, OpenWay refuses to synthesize one. The evidence is marked `TEMPORALLY_UNVERIFIED`.

### Media Unavailability & Outages
* **HTTP 404 / 410**: Device media does not exist.
* **HTTP 416 (MEDIA_NOT_FOUND / Range Not Satisfiable)**: No snapshot available within the requested range.
* **HTTP 503 (SERVICE_UNAVAILABLE) / Timeout**: Upstream Ring media infrastructure temporarily unreachable.
* **OpenWay Policy Outcome**: In all unavailable cases, OpenWay produces `UNKNOWN`. It **never** falls back to assuming access is clear.

---

## 5. 10 Mandatory Post-Remediation Verification Rules

The core function `verifyPostRemediationEvidence(...)` enforces 10 strict checks:

1. **Evidence Exists**: Valid media buffer in server memory.
2. **Capture Time Established**: Authoritative `capturedAt` timestamp is present.
3. **Post-Remediation Provenance**: `capturedAt >= remediationTask.completedAt`.
4. **Entrance Match**: `evidence.entranceId === entrance.id`.
5. **Device Match**: `evidence.deviceId === entrance.cameraBinding.deviceId`.
6. **Component Match**: `evidence.componentId === entrance.cameraBinding.componentId`.
7. **Freshness Guarantee**: `evaluateEvidenceFreshness(evidence) === "FRESH"`.
8. **Valid Structured Observation**: Tri-state observation generated by vision analyzer.
9. **Configured Requirements Satisfied**: `pathwayClear = TRUE`, `obstructionPresent = FALSE`, `doorReady = TRUE`.
10. **Contradiction-Free**: No conflicting observations in the verification window.

If any check fails, access restoration is refused and state resolves to `UNKNOWN` (or `ACTION_REQUIRED` if an obstruction was observed).

---

## 6. Event History Pagination & Reconciliation

Ring Partner API provides newest-first event histories via JSON:API collections.

* **Pagination Links**: OpenWay follows `links.next` relative URLs.
* **Deduplication**: Reconciled events are deduplicated by `eventId`.
* **Bounded Traversal**: Traversals are capped at `maxPages` (default 5) to prevent infinite loops.
* **Reconciliation Invariant**: Replayed events entering the assurance pipeline cannot bypass post-remediation verification. A replayed event from 10 minutes ago will be tagged `PRE_REMEDIATION` and rejected for restoration.
