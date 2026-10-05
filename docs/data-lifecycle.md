# OpenWay — Data Lifecycle & Privacy Retention Policy

## Core Principle: Data Minimization for Physical Accessibility Assurance

OpenWay observes configured accessibility conditions (such as wheelchair ramps, automatic entrance doors, and curb cuts). It never tracks individuals, performs facial recognition, or records customer identities.

---

## 1. Storage Architecture & Classification

| Data Category | Primary Storage | Retention Period | Deletion / Expiration Mechanism |
| :--- | :--- | :--- | :--- |
| **Raw Ring Image Frames** | Transient Memory (`Uint8Array`) | In-memory only (Duration of HTTP request lifecycle) | Ephemeral buffer dropped immediately after inference. Never persisted to disk or S3 by default. |
| **Observation Metadata** | AWS DynamoDB (`OpenWayTable`) | 30 Days | DynamoDB TTL (`expiresAt` epoch timestamp) |
| **Evidence Metadata & Timestamps** | AWS DynamoDB (`OpenWayTable`) | 30 Days | Stores only `capturedAt`, `receivedAt`, SHA-256 checksum, provenance, device ID, component ID. |
| **Remediation Tasks** | AWS DynamoDB (`OpenWayTable`) | 90 Days | Historical tasks retained for accessibility auditing, then pruned via TTL. |
| **Audit Events** | AWS DynamoDB (`OpenWayTable`) | 180 Days | Immutable compliance log for dispute resolution. Contains zero customer identities or media bytes. |
| **Idempotency Records** | AWS DynamoDB (`OpenWayTable`) | 24 Hours | DynamoDB Native TTL on `expiresAt` |
| **Demo Tenant Data** | Isolated DynamoDB Namespace (`venue_maple_cafe`) | Ephemeral / Reset on demand | Cleared and restored to baseline via `POST /api/demo/reset`. |

---

## 2. In-Memory Ephemeral Media Invariant

- Ring camera images downloaded via `POST /v1/devices/{id}/media/image/download` are streamed directly into server memory (`Uint8Array`).
- Images are passed in-memory over TLS to the Amazon Bedrock Converse API (`amazon.nova-lite-v1:0`).
- No image files are written to public web directories (`public/`) or temporary filesystems (`/tmp`).
- Pre-signed S3 download URLs returned by Ring 303 redirects are consumed server-side and never forwarded to browser clients or serialized in audit logs.

---

## 3. Audit Metadata Sanitization

Every `AuditEvent` recorded in OpenWay must satisfy strict data sanitization rules:
- **No Personal Identifiers**: No visitor faces, patron names, license plates, or demographics.
- **No Token Material**: Authorization headers, Bearer tokens, and HMAC signing secrets are redacted (`[REDACTED]`).
- **No Signed URLs**: S3 pre-signed URLs with credentials in query parameters are omitted.
- **Structured Fields Only**: Records only state transitions (`previousState -> nextState`), trigger names, entity IDs, timestamps, and reason codes.

---

## 4. Demo Tenant Data Erasure

To allow hackathon judges and operators to cleanly re-test the verification sequence:
- The demo tenant (`venue_maple_cafe` / `entrance_side_accessible`) can be reset at any time via `POST /api/demo/reset`.
- Active remediation tasks are cancelled and archived.
- The entrance assessment is restored to `AVAILABLE` (`INITIAL_BASELINE`).
- A clean `DEMO_RESET` audit marker is appended.

---

## 5. Security & Encryption Standards

- **Encryption at Rest**: AWS DynamoDB tables are encrypted at rest using AWS KMS (Key Management Service).
- **Encryption in Transit**: All communication between the browser, OpenWay application servers, Amazon Ring Partner API (`api.amazonvision.com`), and Amazon Bedrock Runtime is encrypted via TLS 1.3 / 1.2.
- **OAuth Token Encryption**: Account-linking refresh tokens are encrypted at rest using AES-256-GCM before database insertion (`RingAccountLinkingService`).
