# OpenWay — Hackathon Engineering Evaluation

**Project**: OpenWay  
**Tracks**:
- **Primary Track**: Ring
- **Mini-Challenge**: AWS Builder  
**Phase**: Phase 8 — Final Demo, Submission Hardening, Judge Experience & Amazon Hackathon Package  
**Repository**: [https://github.com/subodhkant7/openway.git](https://github.com/subodhkant7/openway.git)  
**Presentation Website**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)  
**Live Public Demo**: [https://main.d2qhyx9vstga35.amplifyapp.com/console](https://main.d2qhyx9vstga35.amplifyapp.com/console)  

---

## 1. Problem Statement & Track Alignment

### The Real-World Accessibility Gap
Over 1.3 billion people globally live with significant disabilities, including tens of millions who use wheelchairs, walkers, canes, and strollers. While many commercial buildings have physically compliant ramps and automatic doors, **temporary interruptions are pervasive**:
- Delivery carriers drop parcels directly across wheelchair ramps.
- Construction items or trash bins obstruct accessible door paths.
- Heavy automatic entrance doors get wedged open or malfunction silently.

### Why Ring & AWS Are the Ideal Combination
Businesses already deploy Ring cameras and doorbells at front doors, service ramps, and delivery entrances. OpenWay transforms these existing cameras into **proactive, event-driven accessibility assurance guardians** by coupling Ring event telemetry with **Amazon Bedrock multimodal vision intelligence** and **Amazon DynamoDB durable cloud persistence**, deployed globally on **AWS Amplify Hosting**.

### Stage 2 Judging Criteria Alignment

| Stage 2 Criterion | Weight | OpenWay Phase 8 Implementation |
| :--- | :---: | :--- |
| **Tech Implementation** | 25% | Single-table DynamoDB cloud persistence with conditional writes, optimistic locking, pure 10-check restoration gatekeeper, server-side Bedrock Converse API multimodal analysis, and 235 automated tests across 30 test suites. |
| **Design** | 25% | WCAG 2.2 AA accessible operator interface, high-contrast dark theme, semantic landmarks, visual assurance cards, and an append-only chronological evidence timeline. |
| **Potential Impact** | 25% | Solves the daily barrier of blocked ramps and inaccessible doorways for millions of people with mobility disabilities, enabling businesses to maintain physical accessibility and avoid visitor frustration. |
| **Quality of Idea** | 25% | Novel non-security application of Ring: moving from basic passive motion alerts to an active assurance system where "reported fixed" never equals "verified fixed" without fresh physical proof. |

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
│  - Conditional Idempotency    │ │   - Ephemeral in-memory image │
│  - Optimistic Concurrency     │ │   - Subordinate interpreter   │
│  - Atomic TransactWriteItems  │ │   - Strict tri-state output   │
└───────────────────────────────┘ └───────────────────────────────┘
```

1. **AWS Amplify Hosting (Application Hosting)**:
   - Hosts full-stack Next.js 14 App Router application with SSR and edge asset delivery.
   - Handles server-to-server webhook ingestion (`POST /api/ring/webhook`) and operator assurance dashboard.
   - Manages least-privilege IAM service roles for server-side DynamoDB and Bedrock operations with zero client credential leakage.
2. **Amazon DynamoDB (Durable State, Idempotency & Concurrency)**:
   - Serves as the operational single-table database (`OpenWayTable`) with partition key `PK`, sort key `SK`, and global secondary index `GSI1`.
   - Stores venues, entrance configurations, remediation tasks, assessment history, and append-only audit timelines.
   - Enforces atomic idempotency locks (`attribute_not_exists(PK)`) to guarantee duplicate webhooks or replay attempts never generate redundant workflows.
   - Enforces optimistic concurrency (`version = :expectedVersion`) on state updates to prevent race conditions during rapid recheck requests.
3. **Amazon Bedrock (Multimodal Evidence Interpretation)**:
   - Evaluates camera snapshots using `amazon.nova-lite-v1:0` via the AWS SDK for JavaScript v3 Bedrock Runtime Converse API.
   - Acts strictly as an evidence interpreter: analyzes raw image bytes in volatile server memory buffers and outputs validated JSON with tri-state fields (`TRUE | FALSE | UNKNOWN`).
   - Bedrock output is strictly gated by OpenWay's deterministic `RestorationGatekeeper`; the AI never declares domain state directly.

---

## 3. Hackathon Product Feedback

In accordance with official Amazon hackathon submission guidelines, here is our factual evaluation of the developer tools, APIs, and SDKs utilized in OpenWay:

### 1. Amazon Ring Partner API & Developer Playground
- **Developer Tools/APIs/SDKs Used**: Official Ring Partner API (`https://api.amazonvision.com/v1/devices`), Developer Playground token authorization, Webhook v1.1 event subscription (`X-Signature` HMAC-SHA256), media image download (`POST /v1/devices/{id}/media/image/download`), and paginated event history (`GET /v1/devices/{id}/events`).
- **What Worked**:
  - The JSON:API specification provides a standardized resource model across diverse camera hardware.
  - HMAC-SHA256 signed webhooks allow reliable real-time event delivery without polling.
  - The Developer Playground provides quick generation of test tokens for early sandbox validation.
- **What Needs Work**:
  - Compound document parsing requires client-side graph stitching across `included` resources before device capabilities and status can be resolved.
  - Media image download returns HTTP 303 redirects to pre-signed S3 URLs, but documentation does not clearly detail redirect handling, authorization header stripping, or capture metadata headers (`x-ring-captured-at`).
  - Webhook signature headers vary between Playground mock dispatchers (`sha256=<hex>`) and production specification (raw hex).
- **Onboarding Experience**: Straightforward for authentication and device listing; required extra reverse-engineering for media download redirects and compound relationship parsing.
- **Would You Use It Again**: Yes. The official API surface is robust, stable, and uniquely suited for camera-driven assurance applications.

### 2. Amazon Bedrock
- **Developer Tools/APIs/SDKs Used**: `@aws-sdk/client-bedrock-runtime` Converse API with multimodal models (`amazon.nova-lite-v1:0`).
- **What Worked**:
  - Converse API provides a clean, unified multimodal payload structure for base64 image bytes.
  - Rapid inference latency and high fidelity in identifying physical pathway obstructions, parcels, and doorway orientation.
  - Predictable structured JSON formatting when constrained with schema enforcement instructions.
- **What Needs Work**:
  - Native JSON Schema enforcement (grammar-based decoding) across all Bedrock foundation models would eliminate occasional markdown code fence wrapping (`json ...`).
  - Clearer documentation for payload size limits when streaming raw camera buffers.
- **Onboarding Experience**: Exceptional. The Converse API is one of the best designed LLM/VLM interfaces available, drastically simplifying multimodal prompt engineering.
- **Would You Use It Again**: Absolutely. It is our preferred engine for production vision intelligence.

### 3. Amazon DynamoDB
- **Developer Tools/APIs/SDKs Used**: `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` with single-table design (`OpenWayTable`).
- **What Worked**:
  - Conditional expressions (`attribute_not_exists(PK)`, `version = :v`) deliver rock-solid distributed locking and optimistic concurrency.
  - Single-digit millisecond latency across transactional writes and queries.
  - Seamless TTL support for ephemeral deduplication records.
- **What Needs Work**:
  - Local testing requires spinning up DynamoDB Local or writing in-memory mock adapters for unit testing environments.
- **Onboarding Experience**: Smooth and predictable. Single-table patterns map cleanly to complex assurance lifecycles.
- **Would You Use It Again**: Yes, without hesitation. It is the premier choice for mission-critical event-driven state storage.

### 4. AWS Amplify Hosting
- **Developer Tools/APIs/SDKs Used**: AWS Amplify Gen 2 hosting platform, Next.js 14 App Router SSR support, IAM service role execution.
- **What Worked**:
  - Seamless Git integration: pushing to `origin/main` automatically builds and deploys both frontend and backend API route handlers.
  - Built-in HTTPS endpoints with custom domain support and environment variable injection.
  - Native IAM execution role allows server actions and route handlers to access DynamoDB and Bedrock without hardcoded AWS access keys.
- **What Needs Work**:
  - Build logs can occasionally be delayed during high-concurrency preview runs.
- **Onboarding Experience**: Fast and frictionless. Took under 10 minutes from git repository to live public deployment.
- **Would You Use It Again**: Yes. For full-stack Next.js applications on AWS, Amplify Hosting is outstanding.

---

## 4. Prioritized Feature Requests

These genuine feature requests would directly benefit accessibility assurance and event-driven automation systems built on Ring and AWS:

### 1. [CRITICAL] Authoritative Capture Timestamp in Media Headers & Playground Coverage
- **Request**: Standardize an authoritative `x-ring-captured-at` ISO-8601 header on all HTTP 200 and 303 responses from `/v1/devices/{id}/media/image/download`, and support an optional request parameter `min_captured_at=<ISO-8601>`.
- **Why It Matters to OpenWay**: OpenWay's fundamental invariant is that an entrance cannot be verified without evidence captured *after* remediation. When Ring returns a buffered frame captured 3 minutes prior, OpenWay must reject it as stale. An explicit timestamp header and timestamp filter would eliminate redundant polling and guarantee fresh post-remediation evidence.

### 2. [IMPORTANT] Clearer Media Capture & Redirect Semantics in Partner Documentation
- **Request**: Explicitly document the HTTP 303 redirect flow to S3 pre-signed URLs, including guidelines on stripping Authorization headers on redirect to prevent S3 400 errors, and document typical pre-signed URL expiration windows.
- **Why It Matters to OpenWay**: Standard HTTP clients that forward Bearer tokens on 303 redirects receive S3 authentication errors. Clarifying this in the official Ring documentation saves developers hours of debugging.

### 3. [IMPORTANT] Explicit Accessibility-Oriented Simulator Scenarios in Developer Playground
- **Request**: Add structured accessibility test fixtures into the Developer Playground (e.g. simulated ramp obstruction events, clear doorway frames, camera occlusion events).
- **Why It Matters to OpenWay**: Currently developers must hand-craft synthetic frames or connect physical hardware to test non-security event flows. Official accessibility scenario presets would encourage more developers to build inclusive smart venue solutions.

### 4. [NICE TO HAVE] Multi-Sensor Component Correlation in Webhook Envelopes
- **Request**: Include the specific camera sensor ID or component identifier (e.g. `ground_package_camera` vs `entry_wide_camera`) in webhook payload attributes for multi-lens Ring hardware.
- **Why It Matters to OpenWay**: Allows venues with dual-camera doorbells to bind accessibility verification strictly to the ground-facing ramp sensor without disambiguation queries.

---

## 5. Evaluation of Optional Open Source Mini-Challenge

In evaluating the optional **Open Source mini-challenge**, we reviewed the official hackathon rules:
- The challenge requires a **new additional open-source project or contribution to an existing public repository during the hackathon window**, alongside the primary submission.
- The rules explicitly clarify that the primary submission itself does not automatically qualify as satisfying this separate requirement.

**Decision**: We evaluated extracting OpenWay's deterministic `RestorationGatekeeper` into a standalone npm package (`@openway/evidence-gatekeeper`). However, to avoid fragmenting development focus or compromising the quality, documentation, and rock-solid stability of our primary **Ring track** submission and **AWS Builder** challenge, we made the conscious engineering decision to **concentrate 100% of our effort on perfecting the core OpenWay application**. The entire OpenWay codebase is fully open source under the MIT License, but we do not claim the separate Open Source mini-challenge.

---

## 6. Compliance with Hackathon Constraints & Conformance Matrix

| # | Hackathon Constraint / Capability | Implementation in OpenWay | Status |
| :-: | :--- | :--- | :-: |
| **1** | **Ring genuinely used in code** | Server-side `RingClient`, `RingPlaygroundProvider`, `RingApiProvider`, and `RingWebhookHandler` interfacing with official Amazon Ring Partner API endpoints. | **PASSED** |
| **2** | **Real runtime integration path** | Server-to-server HTTP client issues live requests to `https://api.amazonvision.com` with OAuth Bearer tokens, correlation IDs, and HMAC-SHA256 signature verification. | **PASSED** |
| **3** | **Demo shows simulator or actual device** | Complete deterministic local simulator (`RingSimulatorProvider`) and Developer Playground provider supporting live Ring devices. | **PASSED** |
| **4** | **No fake README-only integration** | 235 automated tests verifying live endpoint calls, token validation, rate limit handling, HMAC signature verification, state machine transitions, and gatekeeper invariants. | **PASSED** |
| **5** | **Server-side only API calls & credentials** | Ring and AWS credentials exist strictly in server-side Next.js route handlers; zero browser leakage verified via bundle audits. | **PASSED** |
| **6** | **Locally testable** | Deterministic mock provider runs seamlessly with `npm run dev` and `npm run test` without requiring live Ring credentials. | **PASSED** |
| **7** | **Clear setup & run instructions** | Documented step-by-step in `README.md`, `JUDGE.md`, `DEMO.md`, and `docs/deployment.md`. | **PASSED** |
| **8** | **Preserve existing MIT license** | Original MIT License by Subodh Kant preserved verbatim in [LICENSE](LICENSE). | **PASSED** |
| **9** | **Playground first, real account later** | Structured provider interface supports Playground token mode now and OAuth 2.0 Partner API scaffolding seamlessly. | **PASSED** |
| **10** | **No overreaching legal claims** | OpenWay explicitly limits scope to camera-observable physical conditions (ramps, doorways, pathways) configured by the venue. | **PASSED** |
| **11** | **Developer Tooling Friction Log** | 5 authentic entries strictly adhering to the 7-field schema in `docs/friction-log.md`. | **PASSED** |

---

## 7. Privacy-First Engineering

OpenWay is built on an unwavering privacy principle:

> **OpenWay analyzes the physical environment, not people's identities.**

- **Zero Face Recognition**: No facial detection, landmarking, or embeddings.
- **Zero Identity Recognition**: No personal tracking or identity association.
- **Zero Disability Inference**: Never infers or logs medical conditions or disability status.
- **Zero Cross-Camera Tracking**: Each entrance is monitored within its isolated spatial scope.
- **Ephemeral Media Storage**: Raw camera images are processed strictly in server memory buffers and dropped immediately after inference.

---

## 8. Final Engineering & Quality Metrics

- **235 Automated Tests across 30 Suites**: 100% green test suite covering temporal semantics, DynamoDB single-table schema, optimistic concurrency, deployed demo contract, SSRF defenses, multi-camera bindings, semantic prompt injection, Bedrock Converse API parsing, finite state machine transitions, event correlation, and event reconciliation.
- **Strict TypeScript**: 100% typechecked with strict null checks (`npm run typecheck` exits with 0).
- **ESLint & Web Vitals**: Zero lint errors or warnings (`npm run lint` exits with 0).
- **Production Build**: Next.js App Router optimized static and dynamic bundle compilation (`npm run build` exits with 0).
- **Zero Secret Leakage**: Verified via automated secret scanner; 0 tokens, AWS keys, or pre-signed URLs exposed to client bundles.
