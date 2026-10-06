# OpenWay Public & Protected API Surface Inventory

This document enumerates every reachable HTTP API route within OpenWay, documenting authentication mechanisms, tenant boundaries, state mutations, and associated threat mitigations.

---

## 1. Complete API Route Inventory

| Endpoint | Method | Public? | Auth | Tenant Scope | Mutation? | Risk & Security Mitigations |
|---|---|---|---|---|---|---|
| `/api/health` | `GET` | Yes | None | Global (read-only) | No | **Low**: Exposes system operational state (`APPLICATION_HEALTHY`, `DEPENDENCY_DEGRADED`, `CONFIGURATION_ERROR`). Strips table ARNs, AWS Account IDs, credentials, and sensitive configuration. |
| `/api/demo/reset` | `POST` | Yes (Demo) | Public Demo Sandbox | `entrance_side_accessible` only | Yes | **Medium**: Rate limited (15 req/min). Strictly scoped to demo entrance `entrance_side_accessible`. Rejects non-demo tenants with `403 Forbidden`. Cannot affect production or cross-tenant records. |
| `/api/simulator/scenario` | `POST` | Yes (Demo) | Public Demo Sandbox | `entrance_side_accessible` only | Yes | **Medium**: Rate limited (30 req/min). Strict enum validation (`SimulatorScenarioName`). Rejects targeting arbitrary or private tenant entrances with `403 Forbidden`. |
| `/api/ring/webhook` | `POST` | Yes | HMAC-SHA256 Signature + Timestamp Verification | Ingest & Device Correlation Binding | Yes | **High**: Ingestion point for external Ring push events. Enforces 1MB payload cap, 5-minute replay window, constant-time HMAC check, idempotent in-memory & durable event deduplication. Unbound devices log audit warnings without mutating assurance state. |
| `/api/venues` | `GET` | Yes | Tenant Auth | Caller's authorized venues | No | **Low**: Enumerates configured venue records. In demo mode, scoped to `venue_maple_cafe`. |
| `/api/entrances` | `GET` | Yes | Tenant Auth | Caller's authorized entrances | No | **Low**: Lists entrances for authorized venues. |
| `/api/entrances/[id]/assurance` | `GET` | Yes | Tenant Guard (`validateTenantAccess`) | Single entrance (`id` validated) | No | **Low**: Rejects unauthorized entrance IDs with `403 Forbidden`. IDOR protected. |
| `/api/entrances/[id]/timeline` | `GET` | Yes | Tenant Guard (`validateTenantAccess`) | Single entrance (`id` validated) | No | **Low**: Returns audit log events for specified entrance. IDOR protected. Excludes raw media payloads or pre-signed URLs. |
| `/api/entrances/[id]/remediation` | `POST` | Yes | Tenant Guard (`validateTenantAccess`) | Single entrance (`id` validated) | Yes | **Medium**: Manually dispatches staff remediation task. Enforces optimistic lock; cannot overwrite ongoing verification. |
| `/api/remediation/[id]/acknowledge` | `POST` | Yes | IDOR Tenant Guard | Task owner entrance | Yes | **Medium**: Acknowledges active remediation task. Enforces entrance tenant validation. Rejects tasks belonging to other tenants with `403 Forbidden`. |
| `/api/remediation/[id]/complete` | `POST` | Yes | IDOR Tenant Guard | Task owner entrance | Yes | **Medium**: Staff reports physical remediation complete. Transitions state to `RECHECKING` (NEVER `VERIFIED_RESTORED`). Rejects unauthorized tenant tasks with `403 Forbidden`. |
| `/api/remediation/[id]/verify` | `POST` | Yes | IDOR Tenant Guard | Task owner entrance | Yes | **High**: Triggers bounded camera evidence acquisition and multimodal vision verification. Rejects non-demo tasks with `403`. Fails closed to `UNKNOWN` on missing/unavailable evidence. |
| `/api/vision/analyze` | `POST` | Yes | Tenant Guard (`validateTenantAccess`) | `entrance_side_accessible` only | No (Inference) | **High**: Runs multimodal visual inference on image snapshot. In production, simulator vision is strictly prohibited (`403 Forbidden`). Synthetic test evidence is tagged `SIMULATED_LOCAL`, never `OFFICIAL_RING`. |
| `/api/ring/status` | `GET` | Yes | None | Global (read-only) | No | **Low**: Reports whether Ring provider is active, authenticated, and in simulator or live mode. Zero credentials or tokens exposed. |
| `/api/ring/devices` | `GET` | Yes | Tenant Guard | Authorized user devices | No | **Low**: Lists paired Ring doorbell/camera devices. In simulator mode, returns deterministic mock devices. |
| `/api/ring/events` | `GET` | Yes | Tenant Guard | Authorized entrance events | No | **Low**: Returns recent correlated Ring events. |
| `/api/ring/snapshot` | `POST` | Yes | Tenant Guard | Bound device | Yes | **Medium**: Requests on-demand live snapshot from Ring API. Rate-limited and bounded. |
| `/api/ring/simulate` | `POST` | Yes (Demo) | Public Demo Sandbox | Bound demo device | Yes | **Medium**: Injects synthetic motion/ding event for live demonstration workbench. |
| `/api/reconciliation` | `POST` | Yes | Tenant Guard | Authorized entrance | Yes | **Medium**: Triggers state-machine deterministic reconciliation against latest evidence timestamp. Optimistic concurrency control prevents stale overwrites. |
| `/api/assessments` | `GET` | Yes | Tenant Guard | Authorized entrance | No | **Low**: Lists recent historical assessment records. Filtered by tenant. |

---

## 2. Invariant Protection Summary

1. **AI Cannot Declare Final State**: `/api/vision/analyze` produces only structured visual observations (`pathwayClear`, `obstructionPresent`, `doorReady`). It never mutates or sets `AssuranceState`.
2. **Staff Cannot Declare Restoration**: `/api/remediation/[id]/complete` strictly transitions entrance state to `RECHECKING`. Only fresh camera evidence passing all 9 gatekeeper rules can transition to `VERIFIED_RESTORED`.
3. **IDOR & Cross-Tenant Defense**: All dynamic route parameters (`/api/entrances/[id]/*`, `/api/remediation/[id]/*`) enforce `validateTenantAccess()`. Attempts to read or mutate non-authorized tenant objects result in immediate `403 Forbidden`.
4. **Simulator Mode Isolation**: Public demo callers cannot trigger live Ring OAuth or Partner API credential calls; public simulator operations are strictly pinned to `entrance_side_accessible`.
5. **No Credential Leakage**: No route exposes Ring bearer tokens, AWS credentials, internal database table names, or pre-signed S3 URLs.
