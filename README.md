# OpenWay

> **Proactive, Event-Driven Accessibility Assurance for Ring**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Track: Ring](https://img.shields.io/badge/Hackathon_Track-Ring-0284c7.svg)](https://developer.ring.com)
[![Mini-Challenge: AWS Builder](https://img.shields.io/badge/Mini--Challenge-AWS_Builder-ff9900.svg)](https://aws.amazon.com)
[![Tests: 235 passed](https://img.shields.io/badge/Tests-235_passed-success.svg)](src/test)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-3178c6.svg)](tsconfig.json)

---

## 1. Problem

A venue can be listed as accessible while its physical accessible entrance is temporarily blocked. Delivery parcels are dropped across wheelchair ramps, construction equipment blocks accessible door paths, and automatic door sensors malfunction silently. 

Today, venues only discover these barriers when a person with a mobility disability arrives and cannot get inside. Traditional security cameras only generate passive motion alerts that spam staff without coordinating remediation. Worse, when staff claims an issue has been resolved, existing systems mark it green without ever verifying whether the physical path is actually clear.

---

## 2. OpenWay Explanation

> **OpenWay is a proactive, event-driven accessibility assurance system that uses Ring evidence to detect configured, camera-observable access interruptions, coordinate remediation, and verify restoration with fresh evidence.**

### Core Product Invariant

> **Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed.**

When staff reports an obstruction cleared, OpenWay refuses to declare the entrance restored. It demands fresh camera evidence captured *after* the remediation timestamp, verifies physical clearance through multimodal vision and deterministic rules, and fail-closes to `UNKNOWN` if evidence is missing, stale, or contradictory.

---

## 3. Demo Links

- **Product Presentation Website**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)
- **Public Interactive Console**: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)
- **Legacy Presentation Link**: [https://main.d2qhyx9vstga35.amplifyapp.com/presentation](https://main.d2qhyx9vstga35.amplifyapp.com/presentation) *(permanently redirects to `/`)*
- **Demo Video**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com) *(See [DEMO.md](DEMO.md) for full scene-by-scene script and playback guide)*
- **Judge Quickstart**: [JUDGE.md](JUDGE.md) *(60-second self-guided evaluation sequence)*
- **Health & Telemetry**: [https://main.d2qhyx9vstga35.amplifyapp.com/api/health](https://main.d2qhyx9vstga35.amplifyapp.com/api/health)

The live interactive console opens at `/console` directly into **OpenWay Demo Café — Side Accessible Entrance** with state **ACCESS AVAILABLE**. Zero signup, zero AWS credentials, zero Ring credentials, and zero technical setup required.

---

## 4. Key Workflow

OpenWay's deterministic lifecycle enforces five distinct operational stages:

```text
DETECTED
   ↓
ACTION REQUIRED
   ↓
STAFF REPORTED FIXED
   ↓
RECHECKING
   ↓
VERIFIED RESTORED
```

and for any insufficient evidence:

```text
INSUFFICIENT EVIDENCE
   ↓
UNKNOWN
```

1. **DETECTED**: Ring detects an environmental change (motion/doorbell event) at a configured accessible entrance.
2. **ACTION REQUIRED**: OpenWay acquires camera evidence, interprets physical observations via Amazon Bedrock, evaluates deterministic venue policy, detects an interruption, and issues a structured remediation task.
3. **STAFF REPORTED FIXED**: Venue staff marks the remediation task as complete.
4. **RECHECKING**: OpenWay transitions to `RECHECKING`. **Crucially, the UI does NOT turn green.** OpenWay displays: *"Staff reported the obstruction cleared. Restoration has not been verified."*
5. **VERIFIED RESTORED**: OpenWay acquires fresh post-remediation evidence (`capturedAt >= completedAt`), validates the observation through the deterministic gatekeeper, and declares verified restoration.
6. **UNKNOWN**: If fresh evidence is unavailable, delayed, stale, or blurred, OpenWay transitions to `UNKNOWN`. **OpenWay never hides UNKNOWN.**

---

## 5. Why Ring

Physical entrance accessibility requires reliable visual evidence from cameras already deployed at venue doorways:

1. **Ubiquitous Hardware Footprint**: Millions of businesses, shops, and venues already deploy Ring Video Doorbells, Stick Up Cams, and Spotlight Cams at their entrances and ramps.
2. **Event-Driven Telemetry**: Ring provides webhook events (`motion`, `doorbot_bell_ringing`) that allow OpenWay to wake up reactively when physical activity occurs rather than requiring continuous video analysis.
3. **Official Developer Platform**: The Amazon Ring Partner API (`https://api.amazonvision.com`) and Developer Playground provide official server-to-server device discovery, status queries, media snapshot retrieval, and HMAC-SHA256 signed webhooks.

---

## 6. Why Bedrock

OpenWay uses **Amazon Bedrock** (`amazon.nova-lite-v1:0` via the AWS SDK Converse API) as a multimodal evidence interpreter:

1. **Strictly Subordinate Evidence Interpreter**: Bedrock is **never** permitted to declare the domain state or decide whether an entrance is restored. Bedrock only translates raw image pixels into structured, provider-neutral observations.
2. **Structured Tri-State Observations**: Bedrock outputs strictly validated JSON enforcing tri-state fields:
   - `pathwayClear`: `TRUE` | `FALSE` | `UNKNOWN`
   - `obstructionPresent`: `TRUE` | `FALSE` | `UNKNOWN`
   - `doorReady`: `TRUE` | `FALSE` | `UNKNOWN`
3. **Deterministic Authority**: OpenWay's pure TypeScript `RestorationGatekeeper` evaluates Bedrock's observation against venue policy rules. The AI interprets evidence; deterministic software decides state.

---

## 7. Verification Architecture & Differentiation

### Core Architectural Flow

```text
Ring
 ↓
Event
 ↓
Evidence
 ↓
Bedrock
 ↓
Observation
 ↓
Deterministic Policy
 ↓
Remediation
 ↓
Fresh Evidence
 ↓
Verified State
```

### Key Differentiator

```text
Traditional Camera AI

EVENT
 ↓
DETECTION
 ↓
ALERT


OpenWay

EVENT
 ↓
EVIDENCE
 ↓
OBSERVATION
 ↓
POLICY
 ↓
REMEDIATION
 ↓
FRESH EVIDENCE
 ↓
VERIFIED / UNKNOWN
```

Traditional systems stop at the alert. OpenWay manages the entire lifecycle through verification, enforcing that **staff reporting a fix is never accepted as proof of recovery without fresh physical evidence.**

---

## 8. Failure Behavior: Fail-Closed to UNKNOWN

OpenWay treats `UNKNOWN` as a first-class, defensible architectural state. Whenever the system lacks sufficient evidence to prove physical clearance, it transitions to `UNKNOWN` and refuses to show a false positive green status:

- **Missing Evidence**: Ring media download fails, timeouts, or returns HTTP 404/416.
- **Stale Evidence**: Image capture timestamp is older than venue's configured maximum evidence age (`maxEvidenceAgeSeconds`).
- **Temporal Inconsistency**: Image was captured *before* staff completed remediation (`capturedAt < completedAt`).
- **Camera Component Mismatch**: Evidence was retrieved from an auxiliary sensor rather than the bound entrance camera.
- **Visual Ambiguity**: Image is occluded, dark, or Bedrock reports `pathwayClear = UNKNOWN`.

In all failure cases, OpenWay explicitly displays:
> *"OpenWay could not obtain sufficient fresh evidence. Restoration was not declared."*

---

## 9. Simulator Transparency & Provenance Categories

OpenWay maintains rigorous provenance transparency across all UI displays, API payloads, and documentation. Every piece of telemetry and evidence is strictly categorized:

| Provenance Category | Exact Definition | Where Used |
| :--- | :--- | :--- |
| `LIVE RING VERIFIED` | Telemetry or evidence received from live physical Ring hardware via official Ring Partner API infrastructure. | Live Ring partner hardware deployments. |
| `SPEC VERIFIED` | Capability or endpoint implementation strictly verified against official Amazon Ring Partner API specifications. | Partner API client contracts, JSON:API normalizers, 303 media download handlers. |
| `SIMULATED` | Deterministic local or cloud mock provider modeling Ring hardware, events, and synthetic ramp imagery. | Hosted judge demo sandbox and automated integration test suite. |
| `SIMULATED RING + AMAZON BEDROCK` | Synthetic camera evidence analyzed live by Amazon Bedrock multimodal vision models. | Hosted judge workbench when Bedrock is active on simulated Ring frames. |
| `NOT AVAILABLE` | Capability not supported by hardware, or device offline / unconfigured. | Unbound cameras, missing image capability. |

OpenWay **never** collapses simulated evidence into ambiguous labels like `LIVE AI`.

---

## 10. Setup & Local Execution

### Prerequisites
- Node.js >= 18.17 (Node 20 or 22 recommended)
- npm >= 9.0

### Quickstart
```bash
# 1. Clone repository
git clone https://github.com/subodhkant7/openway.git
cd OpenWay

# 2. Install dependencies
npm ci

# 3. Run full automated test suite (235 tests across 30 suites)
npm run test

# 4. Verify TypeScript strict typecheck
npm run typecheck

# 5. Run ESLint code quality checks
npm run lint

# 6. Build Next.js production bundle
npm run build

# 7. Start local server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The default configuration runs in simulator mode with zero external credentials required.

### Optional Configuration (`.env.local`)
To test with Amazon Bedrock or the Amazon Ring Developer Playground:
```env
# Provider Mode (simulator | playground)
OPENWAY_PROVIDER=simulator

# Amazon Bedrock Credentials (Optional for local Bedrock vision)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY_ID=your_aws_secret
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0

# Ring Developer Playground Credentials (Optional for Playground mode)
RING_ACCESS_TOKEN=your_short_lived_playground_token
RING_API_BASE_URL=https://api.amazonvision.com
RING_WEBHOOK_SECRET=your_hmac_secret
```

---

## 11. Deployment

OpenWay is built for continuous production deployment using AWS serverless cloud infrastructure:

- **Hosting**: **AWS Amplify Hosting** runs the Next.js 14 App Router application with server-side rendering (SSR), automated branch previews, and edge caching.
- **Persistence**: **Amazon DynamoDB** provides single-table durable storage (`OpenWayTable`) for venues, entrances, remediation tasks, assessment history, and atomic idempotency locks (`attribute_not_exists(PK)`).
- **Vision Intelligence**: **Amazon Bedrock Runtime** (`amazon.nova-lite-v1:0`) provides ephemeral in-memory multimodal frame interpretation with zero disk persistence.
- **Deployment Guide**: See [docs/deployment.md](docs/deployment.md) for full CloudFormation / AWS CLI setup instructions.

---

## 12. Test Status & Quality Summary

The OpenWay test suite enforces all core invariants through unit, integration, concurrency, tenant isolation, and adversarial tests:

| Metric | Status | Details |
| :--- | :---: | :--- |
| **Automated Tests** | **235 PASS** | 235 passed tests across 30 test suites (`npm run test`). |
| **TypeScript** | **PASS** | Strict mode, zero `any` evasions, clean compilation (`tsc --noEmit`). |
| **Linting** | **PASS** | Zero ESLint warnings or errors (`next lint`). |
| **Production Build** | **PASS** | Optimized Next.js App Router standalone compilation (`next build`). |
| **Adversarial Tests** | **PASS** | Stale evidence, replay attacks, temporal inversion, and SSRF redirect defense. |
| **Concurrency Tests** | **PASS** | Optimistic locking, race condition mitigation, atomic deduplication. |
| **Tenant Isolation** | **PASS** | Strict venue ID boundaries; multi-tenant isolation enforced. |
| **Ring Integration** | **PASS** | SPEC VERIFIED / SIMULATED / LIVE VERIFIED contract conformance. |

---

## 13. Privacy & Security

OpenWay is engineered from the ground up on privacy-first and least-privilege principles:

1. **Environmental Observation Only**: OpenWay observes physical doorways, ramps, and pathways. It performs **zero facial recognition**, **zero biometric identification**, and **zero disability inference**.
2. **Ephemeral Memory Processing**: Raw camera images are analyzed strictly in volatile server memory buffers and dropped immediately following inference. No images are permanently stored on disk or in public buckets.
3. **SSRF Redirect Hardening**: Ring media downloads validate redirect destinations against strict allowlists (`*.ring.com`, `*.amazonvision.com`, `*.amazonaws.com`), blocking SSRF attacks against AWS metadata services (`169.254.169.254`) and internal RFC 1918 subnets.
4. **Tenant Isolation**: All database operations and API routes enforce strict venue boundaries with authenticated session checks.
5. **Security Documentation**: See [SECURITY.md](SECURITY.md), [docs/security-model.md](docs/security-model.md), [docs/threat-model.md](docs/threat-model.md), and [docs/aws-iam.md](docs/aws-iam.md).

---

## 14. Limitations

In accordance with strict hackathon engineering transparency, OpenWay documents its real-world operational boundaries:

1. **Event-Driven, Not Continuous Inspection**: OpenWay does not continuously inspect every physical state change; detection depends on observable Ring events (motion, doorbell rings, scheduled rechecks).
2. **Observable Conditions Only**: OpenWay only evaluates camera-observable physical conditions explicitly configured by the venue (e.g. ramp clearance, doorway paths). Camera observation cannot establish legal accessibility compliance or municipal code adherence.
3. **Evidence Unavailability**: When camera evidence is missing, blurred, or unavailable, OpenWay produces `UNKNOWN`. It will never guess or claim restoration without proof.
4. **Camera Tampering & Obstruction**: Physical camera lens occlusion, network outages, or camera tampering will prevent evidence capture and safely resolve the entrance state to `UNKNOWN`.
5. **No Direct Actuation**: OpenWay verifies physical status and coordinates staff remediation; it does not autonomously actuate physical door motors or remove physical obstructions.
6. **Playground Token Expiration**: Developer Playground tokens expire in ~30–60 minutes and require periodic refresh in sandbox mode.
7. **Simulation Disclosure**: All sandbox demonstration evidence is synthetic and explicitly labeled as `SIMULATED RING`.

---

## License

This project is licensed under the terms of the [MIT License](LICENSE).
