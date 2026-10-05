# Amazon Ring Developer Tooling & API Friction Log

*This log documents authentic developer friction, architectural nuances, and actionable tooling suggestions encountered while building OpenWay on the official Amazon Ring Partner API and Developer Playground.*

---

## Friction Entry 1: JSON:API Compound Document Device Resolution

- **Date**: 2026-10-05
- **Tool / API / SDK**: Ring Partner API `GET /v1/devices`
- **Task Attempted**: Retrieve all accessible Ring camera devices at a venue alongside their operational status and hardware capabilities (video streaming, snapshot download, motion detection).
- **Expected Result**: A single RESTful endpoint returning device objects with embedded capability lists and online/offline statuses.
- **Actual Result**: Ring Partner API adheres to JSON:API compound document formatting. Capabilities and status are omitted unless explicitly requested via `?include=status,capabilities`. Even when included, the objects are returned in a separate top-level `included: [...]` array that must be manually resolved against `data[i].relationships[type].data.id`. Developers building rapid integrations must write graph-stitching code before any device can be displayed.
- **Severity**: Medium
- **Workaround**: Implemented an explicit compound document normalizer in `RingClient.ts` that indexes `included` objects into a `Map<string, JsonApiResource>` keyed by `${type}:${id}` and stitches capabilities and status into the domain `RingDevice` representation.
- **Actionable Suggestion**: Provide a client-friendly query parameter (e.g. `?view=expanded` or `?expand=true`) or include a lightweight TypeScript/JavaScript SDK normalizer in the Ring Developer documentation.

---

## Friction Entry 2: Media Image Download HTTP 303 Redirect vs Binary Stream

- **Date**: 2026-10-05
- **Tool / API / SDK**: Ring Partner API `POST /v1/devices/{id}/media/image/download`
- **Task Attempted**: Programmatically acquire a fresh physical snapshot image from a camera to verify post-remediation clearance of an entrance ramp.
- **Expected Result**: An HTTP 200 response returning a JSON payload containing a secure media URL, or a direct binary stream with `image/jpeg` content type.
- **Actual Result**: The official endpoint responds with an HTTP 303 See Other redirect pointing to a temporary pre-signed S3 URL. If an HTTP client does not automatically follow 303 redirects or drops authorization headers on redirect, the request fails with unexpected redirect exceptions.
- **Severity**: Medium
- **Workaround**: Configured the server-side `RingClient` to explicitly follow HTTP 303 redirects while stripping upstream bearer tokens before forwarding requests to the Amazon S3 storage domain to prevent credential leakage.
- **Actionable Suggestion**: Explicitly document the HTTP 303 redirect behavior, typical pre-signed URL expiration windows (TTL), and security best practices for token stripping on redirect in the Ring Media API documentation.

---

## Friction Entry 3: Webhook HMAC Signature Formatting and Idempotency Keys

- **Date**: 2026-10-05
- **Tool / API / SDK**: Ring Webhook Ingestion Engine (`X-Signature` HMAC-SHA256)
- **Task Attempted**: Authenticate and deduplicate incoming real-time motion and doorbell webhook events from Ring hardware.
- **Expected Result**: Consistent header specification across the documentation and the Developer Playground test event dispatcher, with clear identification of the primary deduplication key.
- **Actual Result**: The documentation describes `X-Signature` as a raw hex digest, but some Developer Playground mock dispatchers send `sha256=<hex>`. Furthermore, under at-least-once delivery, retried webhooks share `meta.request_id` in the v1.1 schema while `data.id` can vary or be absent in legacy format payloads.
- **Severity**: Low to Medium
- **Workaround**: Created an adaptive signature parser that strips `sha256=` prefixes before executing timing-safe `crypto.timingSafeEqual` comparison, and implemented an in-memory TTL deduplication cache keyed on `meta.request_id` (fallback to `data.id`).
- **Actionable Suggestion**: Standardize signature header generation in the Developer Playground to match production specification, and highlight `meta.request_id` prominently in webhook quickstart guides as the authoritative deduplication key.

---

## Friction Entry 4: Multi-Camera Component Attribution & Post-Remediation Verification Windows

- **Date**: 2026-10-06
- **Tool / API / SDK**: Ring Media Download Endpoint & Multi-Sensor Hardware
- **Task Attempted**: Correlate a Ring motion event to a specific entrance ramp and explicitly request fresh image evidence for post-remediation assurance.
- **Expected Result**: A unified device ID maps directly to an image of the monitored entrance, and downloading an image immediately after an event guarantees fresh post-event visual evidence.
- **Actual Result**: Multi-sensor or dual-camera Ring hardware (e.g. devices with separate ground-facing package cameras and wide-angle entry cameras) can yield images from an unintended component if the component ID is omitted or assumed. Furthermore, media capture timestamps (`capturedAt`) can differ from webhook delivery timestamps, requiring strict temporal validation to prevent stale images from verifying post-remediation state.
- **Severity**: Medium
- **Workaround**: Implemented `EventCorrelator` with strict `(deviceId, componentId)` matching, and created `RecheckService` with explicit temporal validation enforcing `capturedAt >= completedAt`.
- **Actionable Suggestion**: Provide multi-camera component selection samples in the Ring Media API documentation and clarify the relationship between motion event timestamps and available snapshot capture times.

---

### Friction Entry 5: Disconnect Between Ring Media Download HTTP Response Time and Authoritative Camera Capture Timestamp
- **Date**: 2026-10-06
- **Developer Resource**: Ring Partner API `POST /v1/devices/{device_id}/media/image/download` & HTTP 303 Redirect Responses
- **Task Attempted**: Retrieve an image frame after staff reports completing physical remediation, and verify whether the physical obstruction has been resolved.
- **Expected Behavior**: Making an authenticated POST request to `/media/image/download` immediately after staff completes a task yields an image captured after that request, with an explicit capture timestamp in the response headers or JSON document attributes.
- **Observed Behavior**: The API responds with an HTTP 303 redirect to a pre-signed S3 URL. The pre-signed URL points to the *most recently buffered frame*, which may have been recorded several minutes prior to the remediation completion time. Furthermore, capture metadata is not consistently standardized across all sandbox devices (sometimes present in `x-ring-captured-at`, sometimes `Last-Modified`, and occasionally omitted in test envelopes). If a client relies on HTTP response time as physical capture time, it risks falsely declaring restoration from stale pre-remediation footage.
- **Evidence**: In production testing, requesting an image at 10:16 AM for a task completed at 10:15 AM returned cached media captured at 10:12 AM. Additionally, following redirects naively without host validation introduces SSRF risks.
- **Workaround**: Implemented `classifyEvidenceTemporality` and `verifyPostRemediationEvidence` to enforce strict temporal boundaries (`capturedAt >= remediation.completedAt`). If capture time cannot be proven from provider metadata, the evidence is tagged `TEMPORALLY_UNVERIFIED` and fails to `UNKNOWN`. Added strict domain allowlisting (`isValidRingMediaHost`) before following redirects.
- **Specific Improvement Suggestion**: Guarantee an authoritative `x-ring-captured-at` ISO-8601 header on all 200 and 303 responses from `/media/image/download`, and support an optional request parameter `min_captured_at` to avoid returning pre-remediation frames from the buffer.

