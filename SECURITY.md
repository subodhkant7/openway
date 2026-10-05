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

- **No Arbitrary Media URLs**: OpenWay never permits API users or external callers to submit arbitrary media URLs for downloading.
- **Strict Ring Domain Whitelisting**: Media downloads are permitted only through official Ring API hostnames (`https://api.amazonvision.com` and authorized Amazon S3 media storage domains).
- **Asynchronous Execution Boundary**: Webhooks acknowledge immediately without executing heavy network or AI calls in the HTTP request lifecycle, preventing Denial of Service through event storms.

---

## 7. Vulnerability Reporting

If you discover a security vulnerability within OpenWay, please contact the maintainers directly via repository issue or security advisory.
