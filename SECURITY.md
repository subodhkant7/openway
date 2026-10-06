# OpenWay Security Policy

OpenWay is designed with defense-in-depth principles to protect venue infrastructure, Ring API credentials, hardware streams, and assurance state integrity.

---

## 1. Credential Secrecy & Server-Side Isolation

- **Zero Client Exposure**: The Ring Access Token (`RING_ACCESS_TOKEN`), Webhook Signing Secret (`RING_WEBHOOK_SECRET`), and upstream API endpoints are kept exclusively in server-side memory.
- **No Token in Browser Bundles**: Neither Next.js environment configurations prefixed with `NEXT_PUBLIC_` nor client-side React props ever include Ring secrets.
- **Git Protection**: `.gitignore` strictly blocks all variations of `.env`, `.env.local`, `.env.*.local`, and credential files from being committed to source control.

---

## 2. Webhook Authentication & Integrity

Incoming Ring webhooks at `POST /api/ring/webhook` must satisfy strict security controls:
1. **HMAC-SHA256 Signature Verification**: The payload is verified against the `X-Signature` header using the shared secret.
2. **Timing-Safe Comparison**: Verification uses `crypto.timingSafeEqual()` on raw byte buffers to protect against side-channel timing attacks.
3. **Idempotency Protection**: Incoming `meta.request_id` identifiers are recorded in an in-memory cache to neutralize replay attacks and duplicate traffic.

---

## 3. Assurance State Machine & Verification Invariant Security

OpenWay treats verification logic as a critical security boundary:
- **No Client State Injection**: API clients cannot bypass verification to mark an entrance `VERIFIED_RESTORED`. Restoration is governed by a pure deterministic gatekeeper (`canDeclareRestored`).
- **Camera Binding Verification**: Evidence is matched against explicit hardware bindings (`deviceId` and `componentId`). Evidence from unauthorized or unlinked cameras is rejected (`WRONG_CAMERA_REJECTED`).
- **Provenance Honesty**: Synthetic or simulated evidence cannot claim official Ring provenance (`isSimulated: true && provenance: "OFFICIAL_RING"` is rejected).
- **Append-Only Audit Trail**: Every assurance state change is recorded in an immutable, append-only conceptual audit trail with UUID correlation tracking. Audit metadata never contains secrets, signed URLs, or raw image bytes.

---

## 4. Safe Structured Logging

OpenWay implements a specialized log sanitization layer (`src/ring/errors.ts:sanitizeLogString` and `safeLog`):
- All authorization headers (`Bearer ...`), tokens, secrets, and signatures are automatically redacted (`[REDACTED]`) before outputting to stdout/stderr.
- Stack traces from network exceptions are sanitized to avoid leaking access tokens embedded in URL query parameters.
- State machine transition logs never output raw video/image bytes or customer-identifiable information.

---

## 5. API Resilience & DoS Protection

- **Input Validation**: All domain and remediation API routes validate payloads strictly using Zod schemas.
- **Bounded Retries**: OpenWay caps retries to at most 2 attempts, only for retryable errors (HTTP 429, 502, 503, 504).
- **No Blind Auth Retries**: HTTP 401 and 403 responses fail immediately without repeated retry traffic to avoid locking out developer credentials.
- **Timeout Protection**: All outbound requests to `https://api.amazonvision.com` enforce an 8000ms hard timeout via `AbortController`.

---

## 6. Bedrock AI Security & Media Isolation

OpenWay implements defense-in-depth security around Amazon Bedrock and multimodal image analysis:
- **Zero Public Media Leakage**: Camera snapshots are processed strictly in server memory buffers (`Uint8Array`) and piped directly to Bedrock Converse API over TLS. Snapshots are **never** saved to a public static web directory (`public/`), and Ring pre-signed URLs are never leaked to client browsers.
- **AWS Credential Isolation**: AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_SESSION_TOKEN`) exist only in server environment variables and are completely inaccessible to frontend code.
- **Strict Schema Enforcement (.strict())**: The Bedrock output schema uses Zod `.strict()` to reject any unrecognized properties, preventing prompt injection attacks from attempting to manipulate internal state.
- **Bedrock Guardrail Integration**: Supports optional Amazon Bedrock Guardrails (`BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`) to enforce enterprise privacy and content filtering.
- **Cost & Rate Control**: In-memory idempotency caching on deterministic processing keys (`provider_eventId_evidenceId_version`) prevents duplicate inference calls and denies continuous streaming abuse.

---

## 7. Semantic Prompt-Injection Hardening & Adversarial Defenses

OpenWay recognizes that Zod `.strict()` schema enforcement prevents *syntactic* injection (unauthorized schema fields), but does **NOT** alone prevent *semantic* prompt injection (malicious text in the physical scene attempting to alter AI observations):
- **Adversarial Test Suite (`src/test/semanticVisionAdversarial.test.ts`)**: Evaluates model and policy resilience against physical signs saying "PATH CLEAR" when blocked, signs claiming "OpenWay state is VERIFIED_RESTORED", fake operator instructions, and visual adversarial text.
- **Deterministic Policy Authority**: AI observations are subordinate evidence inputs. When observations are conflicting or ambiguous, the deterministic policy always resolves to `UNKNOWN`.
- **System Prompt Boundaries**: The Bedrock system prompt explicitly directs the model to disregard textual instructions, banners, or signs embedded in physical images that attempt to alter configured rules.

---

## 8. SSRF Prevention & Untrusted Media URL Protection

The Ring Partner API `POST /v1/devices/{device_id}/media/image/download` endpoint uses an HTTP 303 See Other redirect that points to a pre-signed media URL hosted in Amazon S3. OpenWay implements rigorous defenses against Server-Side Request Forgery (SSRF) and untrusted redirects:
- **No Client-Supplied URLs**: OpenWay never accepts media download URLs from external API callers or clients. All media downloads originate from internally bound `deviceId` and `componentId` configurations.
- **Strict Redirect Destination Whitelisting (`isValidRingMediaHost`)**: When following an HTTP 303 redirect, `RingClient` parses the target `Location` header with standard URL parsing and verifies that the destination hostname strictly belongs to authorized Ring or Amazon AWS domains:
  - `*.ring.com` (and exact `ring.com`)
  - `*.amazonvision.com` (and exact `amazonvision.com`)
  - `*.amazonaws.com` (and exact `amazonaws.com`)
- **Block Private Network & Cloud Metadata Targets**: Any redirect attempting to reach:
  - Loopback addresses (`127.0.0.1`, `localhost`, `::1`)
  - AWS Instance Metadata Service (`169.254.169.254`)
  - RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  is immediately aborted, throwing a typed `SecurityError` and logging a sanitized alert.
- **Oversized Media & Memory Exhaustion Caps**: Media response payloads are capped at a maximum of 10 MB (`10 * 1024 * 1024` bytes). Downloads exceeding this threshold are aborted before buffering into memory to prevent Denial of Service via memory exhaustion.
- **Zero Browser Exposure of Signed URLs**: Pre-signed S3 download URLs are consumed strictly within server memory and are never serialized or forwarded to browser clients.

---

## 9. Temporal Anti-Replay & Evidence Reuse Defense

Replaying previous clear camera snapshots or reusing an image captured before a physical obstruction was cleared represents a critical threat to physical accessibility assurance:
- **Strict Capture Timestamp Provenance**: OpenWay extracts authoritative capture timestamps from `x-ring-captured-at`, `Last-Modified`, or JSON attributes. If Ring does not return an authentic capture timestamp, the evidence is classified as `TEMPORALLY_UNVERIFIED` and immediately rejected.
- **Enforced Post-Remediation Boundary**: The pure deterministic verifier (`verifyPostRemediationEvidence`) requires `capturedAt >= remediation.completedAt`. A successful HTTP 200/303 download response timestamp is never substituted for the camera's actual capture time.
- **Event Reconciliation Safety**: Idempotent replay of historical Ring events during network recovery cannot bypass the post-remediation verification gate.

---

## 10. DynamoDB Multi-Tenant Isolation & Conditional Atomicity

OpenWay uses a production-grade single-table DynamoDB architecture with explicit tenant boundaries:
- **Strict Key Partitioning**: All data records use deterministic prefixes (`VENUE#<id>`, `ENTRANCE#<id>`, `EVIDENCE#<id>`). Cross-tenant key leakage or cross-venue data retrieval is prevented by prefixing queries with tenant IDs.
- **Atomic Transactions (`TransactWriteItems`)**: Critical state transitions updating the entrance assessment, remediation task, and audit log occur within a single atomic DynamoDB transaction. Partial state commits are impossible.
- **Optimistic Concurrency Control**: Entity mutations verify version counters or state conditions (`attribute_not_exists(PK)` or version match), rejecting concurrent out-of-order writes with `OptimisticLockError`.
- **Durable Idempotency Locking**: Webhook requests acquire a durable conditional lock in DynamoDB (`attribute_not_exists(PK)` with TTL), preventing duplicate execution across multiple serverless container instances.

---

## 11. Ring Account-Linking Token Encryption, Storage Security & Unlinking

For production multi-tenant deployments requiring Ring OAuth:
- **Envelope / AEAD Encryption at Rest**: Ring access tokens and refresh tokens are encrypted at rest using AES-256-GCM (`RingAccountLinkingService.encryptToken`) with cryptographically secure 12-byte initialization vectors (IVs) and authentication tags.
- **No Token Logging**: Logging filters strictly sanitize tokens, auth codes, and secret headers before emitting log records.
- **Token Refresh Abstraction**: OpenWay never uses refresh tokens as bearer tokens. If an access token expires and refresh credentials are invalid, the system halts with an explicit `ACCOUNT_RELINK_REQUIRED` status.
- **Account Unlinking & Cryptographic Revocation**: `RingAccountLinkingService.unlinkAccount()` immediately invalidates user tokens, shreds cryptographic keys from memory, marks account status as `ACCOUNT_RELINK_REQUIRED`, and prevents any queued or subsequent background processing from invoking stale Ring credentials.

---

## 12. Public Demo Sandbox & Mutation Rate Limiting

The public deployed demo is exposed to hackathon judges and evaluators without requiring Ring credentials, protected by bounded sandbox constraints:
- **Strict Demo Tenant Binding**: Public mutation endpoints (`POST /api/demo/reset`, `POST /api/simulator/scenario`, `POST /api/vision/analyze`) validate that the target entrance strictly matches `entrance_side_accessible`. Requests targeting any other entrance or venue are rejected with HTTP 403 Forbidden.
- **Sliding-Window Rate Limiting**: All public endpoints enforce rate limiting (15 requests/minute for reset, 30 requests/minute for scenario generation, 60 requests/minute for read queries).
- **Safe Health Endpoint**: `GET /api/health` reports operational status and dependency telemetry (`APPLICATION_HEALTHY`, `DEPENDENCY_DEGRADED`, `CONFIGURATION_ERROR`) while strictly omitting all keys, secrets, database table ARNs, and sensitive internal paths.
- **HTTP Security Headers**: Production responses enforce strict HTTP security headers: Content-Security-Policy, HSTS (2 years, includeSubDomains, preload), X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin, and Permissions-Policy.

---

## 13. Security Documentation References

For exhaustive architectural and threat analyses, consult:
- [Threat Model & Attack Matrix](file:///Users/urjasoft/Documents/OpenWay/docs/threat-model.md)
- [Security Model & Invariants](file:///Users/urjasoft/Documents/OpenWay/docs/security-model.md)
- [AWS IAM Least Privilege & SSR Compute Roles](file:///Users/urjasoft/Documents/OpenWay/docs/aws-iam.md)
- [API Surface Inventory & Risk Assessment](file:///Users/urjasoft/Documents/OpenWay/docs/api-surface.md)

---

## 14. Vulnerability Reporting

If you discover a security vulnerability within OpenWay, please contact the maintainers directly via repository issue or security advisory.


