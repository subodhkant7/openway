# OpenWay End-to-End Security Model & Assurance Architecture

OpenWay is built on an adversarial-by-design assurance model. Unlike conventional computer-vision alert apps that pass raw model outputs directly to status widgets, OpenWay enforces an uncompromising chain of custody and deterministic policy evaluation.

---

## 1. Core Invariants (The "Unviolables")

```text
1. AI CANNOT DECLARE OPENWAY STATE.
   The multimodal vision model produces structured observations (probabilities and features).
   The deterministic RestorationGatekeeper decides state transitions.

2. STAFF CANNOT DECLARE RESTORATION.
   Staff action can only advance state from ACTION_REQUIRED to RECHECKING.
   Only physical camera evidence captured post-remediation can declare restoration.

3. OLD EVIDENCE CANNOT PROVE NEW RESTORATION.
   Evidence captured even 1 millisecond before remediation completion is rejected (TEMPORAL_INCONSISTENCY).

4. WRONG CAMERA CANNOT PROVE RESTORATION.
   Multi-camera devices require exact deviceId and componentId matching (WRONG_CAMERA_COMPONENT).

5. WRONG TENANT CANNOT ACCESS ANOTHER TENANT.
   All data queries and mutations enforce tenant authorization. Non-authorized access returns 403 Forbidden.

6. DUPLICATE EVENTS CANNOT CREATE DUPLICATE WORKFLOW ACTIONS.
   Idempotent deduplication guarantees that N identical concurrent webhooks yield exactly 1 task.

7. UNKNOWN EVIDENCE CANNOT BECOME GREEN.
   Insufficient visual evidence, occlusion, or missing capture timestamps strictly resolve to UNKNOWN.

8. BEDROCK FAILURE CANNOT BECOME SYNCHRONOUS PROOF.
   Upstream AI failure fails closed to UNKNOWN (VISION_UNAVAILABLE). Never falls back to simulated clear.

9. SIMULATOR EVIDENCE CANNOT BECOME OFFICIAL RING EVIDENCE.
   Provenance is derived from trusted server-side provider contexts. Client provenance overrides are rejected.

10. UNAUTHORIZED PUBLIC CLIENTS CANNOT INVOKE PRIVILEGED OPERATIONS.
    Public demo mode is pinned to an isolated sandbox entrance.

11. CONCURRENCY CANNOT OVERWRITE A NEWER STATE.
    State transitions employ optimistic concurrency checks to abort stale verification workers.

12. SECRETS CANNOT REACH BROWSERS OR LOGS.
    Zero credentials, tokens, or pre-signed S3 URLs exist in client bundles, DOM nodes, or error responses.
```

---

## 2. Evidence Integrity & Provenance Architecture

```text
┌───────────────────────┐
│ Ring Camera Snapshot  │
└───────────┬───────────┘
            │ Authoritative Ring Metadata (deviceId, componentId, captureTimestamp)
            ▼
┌───────────────────────┐
│ Server Memory Ingest  │ ──► Memory limit (10MB streaming abort)
│  (Uint8Array Buffer)  │ ──► Hostname validation (Strict Ring CDN whitelist)
└───────────┬───────────┘ ──► Zero disk writes to public static directories
            │
            ▼
┌───────────────────────┐
│ Multimodal Inference  │ ──► Amazon Bedrock (Nova Lite / Claude Haiku)
│  (Structured JSON)    │ ──► Strict Zod schema parsing; non-conforming outputs rejected
└───────────┬───────────┘ ──► Upstream errors fail closed to UNKNOWN
            │
            ▼
┌───────────────────────┐
│ 9-Gate Restoration    │ ──► 1. Entrance requirements check
│      Gatekeeper       │ ──► 2. Camera deviceId & componentId binding
└───────────┬───────────┘ ──► 3. Temporal ordering: capturedAt >= completedAt
            │             ──► 4. Provenance authenticity (OFFICIAL_RING vs SIMULATED_LOCAL)
            │             ──► 5. Evidence freshness window (freshness <= TTL)
            │             ──► 6. Confidence threshold (>= 0.80)
            │             ──► 7. Evidence quality sufficiency
            │             ──► 8. Absence of conflicting observations
            │             ──► 9. Entrance operational enablement
            ▼
┌───────────────────────┐
│ Deterministic State   │
│       Machine         │
└───────────────────────┘
```

---

## 3. Defense-in-Depth Mechanisms

### 3.1 Network & Media Security (SSRF Mitigation)
All media retrieval from Ring endpoints passes through `isValidRingMediaHost()` which enforces:
- Scheme: Strictly `https:`
- Port: Strictly default port 443
- Userinfo: Rejection of any userinfo (`@`)
- IP Literals: Rejection of IPv4, IPv6, octal, hex, and decimal alternative encodings
- Private Subnets: Rejection of loopback (`127.0.0.1`), link-local / AWS metadata (`169.254.169.254`), RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Hostname Whitelist: Strict anchored regex `/(^|\.)(ring\.com|amazonvision\.com|amazonaws\.com)$/`

### 3.2 Memory Protection & Resource Exhaustion Defense
- Webhook payloads capped at 1MB (`413 Payload Too Large`).
- Media stream chunk accumulation enforces a strict 10MB memory ceiling. When the chunk stream exceeds 10MB, the stream reader is immediately aborted (`reader.cancel()`) and throws `RingProviderError("MEDIA_TOO_LARGE")`.
- Rate limiting on public demo mutation endpoints (15-30 requests/minute per client IP).

### 3.3 HTTP Security Headers
Every HTTP response in production includes defensive security headers configured in `next.config.mjs`:
- `Content-Security-Policy`: Modern restrictive CSP restricting script execution, style loading, and object embedding.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload` (2-year HSTS).
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`

---

## 4. Audit Trail Protection
Audit events are appended chronologically with immutable correlation IDs. The application data access layer provides append-only operations for audit logs:
- API routes cannot edit audit events.
- API routes cannot delete audit events.
- Timestamps and reasons are immutable once recorded.
