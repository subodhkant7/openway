# OpenWay Security Policy

OpenWay is designed with defense-in-depth principles to protect venue infrastructure, Ring API credentials, and hardware streams.

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
3. **Idempotency Protection**: Incoming `event_id` identifiers are recorded in an in-memory cache to neutralize replay attacks and duplicate traffic.

---

## 3. Safe Structured Logging

OpenWay implements a specialized log sanitization layer (`src/ring/errors.ts:sanitizeLogString` and `safeLog`):
- All authorization headers (`Bearer ...`), tokens, secrets, and signatures are automatically redacted (`[REDACTED]`) before outputting to stdout/stderr.
- Stack traces from network exceptions are sanitized to avoid leaking access tokens embedded in URL query parameters.

---

## 4. API Resilience & DoS Protection

- **Bounded Retries**: OpenWay caps retries to at most 2 attempts, only for retryable errors (HTTP 429, 502, 503, 504).
- **No Blind Auth Retries**: HTTP 401 and 403 responses fail immediately without repeated retry traffic to avoid locking out developer credentials.
- **Timeout Protection**: All outbound requests to `https://api.amazonvision.com` enforce an 8000ms hard timeout via `AbortController`.

---

## 5. Vulnerability Reporting

If you discover a security vulnerability within OpenWay, please contact the maintainers directly via repository issue or security advisory.
