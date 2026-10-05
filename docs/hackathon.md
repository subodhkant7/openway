# OpenWay — Hackathon Engineering Evaluation

**Project**: OpenWay  
**Tracks**:
- **Primary Track**: Ring
- **Mini-Challenge**: AWS Builder  
**Phase**: Phase 6 — AWS Deployment, Durable Persistence, Production Configuration & Judge-Accessible Demo  

---

## 1. Problem Statement & Track Alignment

### The Real-World Accessibility Gap
Over 1.3 billion people globally live with significant disabilities, including tens of millions who use wheelchairs, walkers, canes, and strollers. While many commercial buildings have physically compliant ramps and automatic doors, **temporary interruptions are pervasive**:
- Delivery carriers drop parcels directly on wheelchair ramps.
- Snow, leaf, or debris piles accumulate unmonitored on access slopes.
- Heavy automatic entrance doors get wedged open or malfunction silently.

### Why Ring & AWS Are the Ideal Combination
Businesses already deploy Ring cameras and doorbells at front doors, service ramps, and delivery entrances. OpenWay transforms these existing cameras into **continuous accessibility assurance guardians** by coupling Ring event telemetry with **Amazon Bedrock multimodal vision intelligence** and **Amazon DynamoDB durable cloud persistence**, deployed globally on **AWS Amplify Hosting**.

### Stage 2 Judging Criteria Alignment

| Stage 2 Criterion | Weight | OpenWay Phase 6 Implementation |
| :--- | :---: | :--- |
| **Tech Implementation** | 25% | Single-table DynamoDB cloud persistence with conditional writes, optimistic locking, pure 10-check restoration gatekeeper, server-side Bedrock Converse API multimodal analysis, and 197 automated tests across 25 suites. |
| **Design** | 25% | WCAG 2.2 AA accessible operator interface, high-contrast dark theme, semantic landmarks, visual assurance cards, and an append-only chronological evidence timeline. |
| **Potential Impact** | 25% | Solves the daily barrier of blocked ramps and inaccessible doorways for millions of people with mobility disabilities, while protecting businesses from ADA compliance violations. |
| **Quality of Idea** | 25% | Novel non-security application of Ring: moving from basic passive motion alerts to an active assurance system where "reported fixed" never equals "verified fixed" without physical proof. |

---

## 2. AWS Builder Mini-Challenge Technical Integration

OpenWay deeply integrates three core AWS cloud services in production:

```text
┌────────────────────────────────────────────────────────┐
│                   AWS Amplify Hosting                  │
│       Next.js 14 App Router SSR & Server Actions       │
│       Least-privilege IAM service role integration     │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│        Amazon DynamoDB        │ │        Amazon Bedrock         │
│  Single-Table Cloud Storage   │ │   Multimodal Vision Models    │
│  - Table: OpenWayTable        │ │   - amazon.nova-lite-v1:0     │
│  - Conditional Idempotency    │ │   - Claude 3.5 Sonnet v2      │
│  - Optimistic Concurrency     │ │   - Ephemeral in-memory image │
│  - Atomic TransactWriteItems  │ │   - Structured tool schema    │
└───────────────────────────────┘ └───────────────────────────────┘
```

1. **AWS Amplify Hosting**: Hosts the full-stack Next.js application with zero-config SSR, automatic branch preview builds, and secure server-side environment variables.
2. **Amazon DynamoDB**: Serves as the primary operational database via single-table design (`PK`, `SK`, `GSI1`). Handles venues, entrances, active remediation tasks, assessments, immutable audit trails, and atomic idempotency locks (`attribute_not_exists(PK)`).
3. **Amazon Bedrock**: Performs multimodal visual analysis of camera frames using `amazon.nova-lite-v1:0` via the AWS SDK Converse API. The model operates as a subordinate interpreter returning strict tri-state outputs (`TRUE`, `FALSE`, `UNKNOWN`).

> [!NOTE]
> **AWS Promotional Credits Notice**: Eligible entrants can request up to **$150 in AWS Promotional Credits** subject to availability. The deadline to request credits is **October 21, 2026 at 12:00 PM PT**.

---

## 3. Compliance with Hackathon Constraints & Conformance Matrix

| # | Hackathon Constraint / Capability | Implementation in OpenWay | Status |
| :-: | :--- | :--- | :-: |
| **1** | **Ring genuinely used in code** | Server-side `RingClient`, `RingPlaygroundProvider`, `RingApiProvider`, and `RingWebhookHandler` interfacing with official Amazon Ring Partner API endpoints. | **PASSED** |
| **2** | **Real runtime integration path** | Server-to-server HTTP client issues live requests to `https://api.amazonvision.com` with OAuth Bearer tokens, correlation IDs, and HMAC-SHA256 signature verification. | **PASSED** |
| **3** | **Demo shows simulator or actual device** | Complete deterministic local simulator (`RingSimulatorProvider`) and Developer Playground provider supporting live Ring devices. | **PASSED** |
| **4** | **No fake README-only integration** | 197 automated tests verifying live endpoint calls, token validation, rate limit handling, HMAC signature verification, state machine transitions, and gatekeeper invariants. | **PASSED** |
| **5** | **Server-side only API calls & credentials** | Ring and AWS credentials exist strictly in server-side Next.js route handlers; zero browser leakage verified via bundle audits. | **PASSED** |
| **6** | **Locally testable** | Deterministic mock provider runs seamlessly with `npm run dev` and `npm run test` without requiring live Ring credentials. | **PASSED** |
| **7** | **Clear setup & run instructions** | Documented step-by-step in `README.md`, `JUDGE.md`, `DEMO.md`, and `docs/deployment.md`. | **PASSED** |
| **8** | **Preserve existing MIT license** | Original MIT License by Subodh Kant preserved verbatim in [LICENSE](LICENSE). | **PASSED** |
| **9** | **Playground first, real account later** | Structured provider interface supports Playground token mode now and OAuth 2.0 Partner API scaffolding seamlessly. | **PASSED** |
| **10** | **No overreaching legal claims** | OpenWay explicitly limits scope to camera-observable physical conditions (ramps, doorways, pathways) configured by the venue. | **PASSED** |
| **11** | **Developer Tooling Friction Log** | 5 authentic entries documenting JSON:API include resolution, 303 media download redirects, webhook signature formatting, and SSRF redirect validation in `docs/friction-log.md`. | **PASSED** |

---

## 4. Privacy-First Engineering

OpenWay is built on an unwavering privacy principle:

> **OpenWay analyzes the physical environment, not people's identities.**

- **Zero Face Recognition**: No facial detection, landmarking, or embeddings.
- **Zero Identity Recognition**: No personal tracking or identity association.
- **Zero Disability Inference**: Never infers or logs medical conditions or disability status.
- **Zero Cross-Camera Tracking**: Each entrance is monitored within its isolated spatial scope.
- **Ephemeral Media Storage**: Raw camera images are processed strictly in server memory buffers and dropped immediately after inference.

---

## 5. Engineering Metrics (Phase 6 Checkpoint)

- **197 Automated Tests across 25 Suites**: 100% green test suite covering temporal semantics, DynamoDB single-table schema, optimistic concurrency, deployed demo contract, SSRF defenses, multi-camera bindings, semantic prompt injection, Bedrock Converse API parsing, finite state machine transitions, event correlation, and event reconciliation.
- **Strict TypeScript**: 100% typechecked with strict null checks (`npm run typecheck` exits with 0).
- **ESLint & Web Vitals**: Zero lint errors or warnings (`npm run lint` exits with 0).
- **Production Build**: Next.js App Router optimized static and dynamic bundle compilation (`npm run build` exits with 0).
- **Zero Secret Leakage**: Verified via automated secret scanner; 0 tokens, AWS keys, or pre-signed URLs exposed to client bundles.
