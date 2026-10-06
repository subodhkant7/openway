# Amazon Ring Developer Tooling & API Friction Log

*This log documents authentic developer friction, architectural nuances, and actionable tooling suggestions encountered while building OpenWay on the official Amazon Ring Partner API and Developer Playground. Every entry represents genuine technical observations recorded during development and integration testing.*

---

## Friction Entry 1: JSON:API Compound Document Device Resolution

- **tool**: Amazon Ring Partner API `GET /v1/devices`
- **task**: Retrieve all configured Ring camera devices at a venue alongside their operational status and hardware capabilities (video streaming, snapshot download, motion detection).
- **expected behavior**: A single RESTful endpoint returning device objects with embedded capability lists and online/offline statuses in a straightforward JSON response.
- **actual behavior**: Ring Partner API adheres to JSON:API compound document formatting. Capabilities and status are omitted unless explicitly requested via `?include=status,capabilities`. Even when included, the objects are returned in a separate top-level `included: [...]` array that must be manually resolved against `data[i].relationships[type].data.id`. Developers building rapid integrations must write graph-stitching code before any device can be displayed or bound to a venue entrance.
- **severity**: Medium
- **workaround**: Implemented an explicit compound document normalizer in `RingClient.ts` that indexes `included` objects into a `Map<string, JsonApiResource>` keyed by `${type}:${id}` and stitches capabilities and status into the domain `RingDevice` representation.
- **actionable improvement**: Provide a client-friendly query parameter (e.g. `?view=expanded` or `?expand=true`) or include an official lightweight TypeScript/JavaScript SDK normalizer in the Ring Developer documentation.

---

## Friction Entry 2: Media Image Download HTTP 303 Redirect vs Binary Stream

- **tool**: Amazon Ring Partner API `POST /v1/devices/{id}/media/image/download`
- **task**: Programmatically acquire a fresh physical snapshot image from a camera to verify post-remediation clearance of an entrance ramp.
- **expected behavior**: An HTTP 200 response returning a direct binary stream with `image/jpeg` content type or a clean JSON payload containing a secure media URL.
- **actual behavior**: The official endpoint responds with an HTTP 303 See Other redirect pointing to a temporary pre-signed S3 URL. If an HTTP client does not automatically follow 303 redirects or drops authorization headers on redirect, the request fails with unexpected redirect exceptions. Conversely, if an HTTP client blindly forwards the Ring `Authorization: Bearer <token>` header to the S3 bucket URL, S3 rejects the request with HTTP 400 Bad Request because S3 signed URLs reject extraneous Bearer tokens.
- **severity**: Medium
- **workaround**: Configured the server-side `RingClient` to explicitly intercept HTTP 303 redirects, validate destination hostnames against an allowlist to prevent SSRF vulnerabilities, and strip upstream Bearer tokens before issuing the GET request to the Amazon S3 storage endpoint.
- **actionable improvement**: Explicitly document the HTTP 303 redirect behavior, typical pre-signed URL expiration windows (TTL), and security best practices for token stripping on redirect in the Ring Media API documentation.

---

## Friction Entry 3: Webhook HMAC Signature Formatting and Idempotency Keys

- **tool**: Amazon Ring Webhook Ingestion Engine (`X-Signature` HMAC-SHA256)
- **task**: Authenticate and deduplicate incoming real-time motion and doorbell webhook events dispatched from Ring hardware.
- **expected behavior**: Consistent header specification across the documentation and the Developer Playground test event dispatcher, with clear identification of the primary deduplication key.
- **actual behavior**: The documentation describes `X-Signature` as a raw hex digest, but some Developer Playground mock dispatchers send `sha256=<hex>`. Furthermore, under at-least-once delivery, retried webhooks share `meta.request_id` in the v1.1 schema while `data.id` can vary or be absent in legacy format payloads.
- **severity**: Low to Medium
- **workaround**: Created an adaptive signature parser that strips `sha256=` prefixes before executing timing-safe `crypto.timingSafeEqual` comparison, and implemented an in-memory and DynamoDB TTL deduplication cache keyed on `meta.request_id` (fallback to `data.id`).
- **actionable improvement**: Standardize signature header generation in the Developer Playground to match production specification, and highlight `meta.request_id` prominently in webhook quickstart guides as the authoritative deduplication key.

---

## Friction Entry 4: Multi-Camera Component Attribution & Sensor Disambiguation

- **tool**: Amazon Ring Media Download Endpoint & Multi-Sensor Hardware
- **task**: Correlate a Ring motion event to a specific entrance ramp and explicitly request fresh image evidence for post-remediation assurance on multi-sensor hardware.
- **expected behavior**: A unified device ID maps directly to an image of the monitored entrance, and downloading an image immediately after an event guarantees fresh post-event visual evidence from the intended camera angle.
- **actual behavior**: Multi-sensor or dual-camera Ring hardware (e.g. devices with separate ground-facing package cameras and wide-angle entry cameras) can yield images from an unintended component if the component ID is omitted or assumed. Without component scoping, assurance software may analyze the wrong camera angle and miss ramp obstructions.
- **severity**: Medium
- **workaround**: Implemented `EventCorrelator` with strict `(deviceId, componentId)` matching, allowing venues to bind entrance ramps specifically to the ground-facing package lens or doorway wide-angle lens.
- **actionable improvement**: Provide multi-camera component selection samples in the Ring Media API documentation and include explicit sensor component identifiers in webhook payload attributes.

---

## Friction Entry 5: Disconnect Between Media Download Response Time and Camera Capture Timestamp

- **tool**: Amazon Ring Partner API `POST /v1/devices/{device_id}/media/image/download` & HTTP 303 Redirect Responses
- **task**: Retrieve an image frame after staff reports completing physical remediation, and verify whether the physical obstruction has been resolved.
- **expected behavior**: Making an authenticated POST request to `/media/image/download` immediately after staff completes a task yields an image captured after that request, with an explicit, guaranteed capture timestamp in the response headers.
- **actual behavior**: The API responds with an HTTP 303 redirect to a pre-signed S3 URL pointing to the *most recently buffered frame*, which may have been recorded several minutes prior to the remediation completion time. Capture metadata is not consistently standardized across all sandbox devices (sometimes present in `x-ring-captured-at`, sometimes `Last-Modified`, and occasionally omitted in test envelopes). If a client relies on HTTP response time as physical capture time, it risks falsely declaring restoration from stale pre-remediation footage.
- **severity**: High
- **workaround**: Implemented `classifyEvidenceTemporality` and `verifyPostRemediationEvidence` to enforce strict temporal boundaries (`capturedAt >= remediation.completedAt`). If capture time cannot be proven from provider metadata, the evidence is tagged `TEMPORALLY_UNVERIFIED` and fails-closed to `UNKNOWN`.
- **actionable improvement**: Guarantee an authoritative `x-ring-captured-at` ISO-8601 header on all 200 and 303 responses from `/media/image/download`, and support an optional request parameter `min_captured_at=<timestamp>` to avoid returning pre-remediation frames from the buffer.
