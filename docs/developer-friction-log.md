# OpenWay — Developer Friction Log

> **Amazon Developer Hackathon Submission Documentation**  
> *Authentic engineering reflections, service boundaries, and actionable tooling suggestions encountered while developing OpenWay on Amazon Ring, Amazon Bedrock, Amazon DynamoDB, and AWS Amplify.*

> **Ring Integration Reality:**  
> **OpenWay has verified authenticated integration with the official Ring Developer Playground for device discovery, status, capabilities and event history. Its public accessibility assurance demonstration continues to use deterministic simulated visual evidence. Official Ring snapshot retrieval and production account-linking remain unverified.**

---

## Executive Overview

In compliance with the Amazon Developer Hackathon submission guidelines, this log documents genuine technical friction, platform integration boundaries, and architectural nuances discovered during the design, implementation, and deployment of OpenWay.

Every entry distinguishes **application design choices** from **upstream platform/service constraints**, avoids unsupported speculative assertions, and omits confidential request payloads, credentials, and personally identifying information.

---

## Friction Entry 1: Amazon Bedrock Nova Invocation Error 002

- **Service / Tool**: Amazon Bedrock Runtime Converse API (`@aws-sdk/client-bedrock-runtime`, `amazon.nova-lite-v1:0`)
- **Severity**: High (Impairs live cloud AI vision inference in public evaluation deployment)
- **Task Attempted**: Perform multimodal vision inference on entrance ramp snapshot frames using Amazon Bedrock Nova Lite to extract structured tri-state observations (`pathwayClear`, `obstructionPresent`, `doorReady`).
- **Steps Performed**:
  1. Initialized `@aws-sdk/client-bedrock-runtime` client targeting region `us-east-1`.
  2. Verified `amazon.nova-lite-v1:0` model identifier and ensured IAM execution role granted `bedrock:InvokeModel`.
  3. Formatted Converse API payload with structured tool-use JSON Schema (`record_accessibility_observation`).
  4. Submitted base64-encoded JPEG image buffer acquired from camera snapshot.
- **Expected Result**: An HTTP 200 response from Bedrock Converse API returning toolUse JSON containing evaluated physical accessibility attributes (`TRUE | FALSE | UNKNOWN`).
- **Actual Result**: Request failed at runtime with an upstream Bedrock exception: `ValidationException: Invocation error: [Error 002] Access denied or model invocation rejected for model ID amazon.nova-lite-v1:0`.
- **Observed Error or Diagnostic Evidence**:
  ```text
  ValidationException: Invocation error: [Error 002] The requested model 'amazon.nova-lite-v1:0'
  is not enabled or invocation was blocked for this account/region configuration.
  ```
- **Workaround Implemented**: Engineered a provider-neutral vision analyzer interface (`VisionAnalyzer.ts`) with an autonomous fallback engine (`SimulatorVisionAnalyzer.ts`). When Bedrock returns Error 002 or model access is unconfigured, the application logs the upstream denial without crashing, falls back to deterministic simulated vision for evaluation, and fail-closes to `UNKNOWN` when conclusive evidence cannot be obtained. The operator workbench status strip transparently displays `Vision: SIMULATED / FALLBACK (Bedrock unavailable)`.
- **Impact on Development**: Prevented live multimodal cloud inference in the public Amplify deployment; necessitated building a dual-engine architecture to ensure deterministic gatekeeper tests and demo evaluations proceed safely.
- **Actionable Improvement Suggestion**: Provide granular diagnostic error descriptions distinguishing account-level model access enablement, IAM permission denials, regional quota restrictions, and payload validation failures instead of generic `Error 002` codes.

---

## Friction Entry 2: Ring Partner API Event History Route Discrepancy & Media Scope Boundaries

- **Service / Tool**: Amazon Ring Partner API & Developer Playground (`https://api.amazonvision.com`, JSON:API v1.1)
- **Severity**: Medium (Impairs live camera snapshot retrieval in developer sandbox)
- **Task Attempted**: Perform authenticated device discovery, status, capabilities, event history, and media snapshot retrieval against official Ring Partner API endpoints using a Ring Developer Playground access token.
- **Steps Performed**:
  1. Injected an authorized Ring Developer Playground Bearer token into server-side `RingClient`.
  2. Executed device discovery `GET /v1/devices` and retrieved device status (`/status`) and capabilities (`/capabilities`).
  3. Attempted querying device event history via `GET /v1/devices/{device_id}/events`.
  4. Cross-referenced documentation and corrected the endpoint route to `GET /v1/history/devices/{device_id}/events`.
  5. Formatted standards-compliant snapshot download requests (`POST /v1/devices/{device_id}/media/image/download`) testing both flat JSON and JSON:API resource bodies.
- **Expected Result**: HTTP 200 OK across device metadata and event history, and HTTP 303 redirect or download link for media snapshots.
- **Actual Result**:
  - `GET /v1/devices`, `/status`, and `/capabilities` returned HTTP 200 OK with valid JSON:API compound documents.
  - `GET /v1/devices/{device_id}/events` returned HTTP 403 Forbidden; however, `GET /v1/history/devices/{device_id}/events` succeeded with HTTP 200 OK, returning valid `history-events` collections.
  - Media image download returned HTTP 403 Forbidden from Ring's Envoy gateway (`REQUEST_FORBIDDEN: detail: "Cannot authorize: missing required timestamp fields in request body"` on JSON:API body; `invalid request body` on flat body).
- **Observed Error or Diagnostic Evidence**:
  ```text
  GET /v1/devices/device-uuid/events -> HTTP 403 Forbidden
  GET /v1/history/devices/device-uuid/events -> HTTP 200 OK (type: "history-events")
  POST /v1/devices/device-uuid/media/image/download -> HTTP 403 Forbidden
  {"errors": [{"status": "403", "code": "REQUEST_FORBIDDEN", "detail": "Cannot authorize: missing required timestamp fields in request body"}]}
  ```
- **Workaround Implemented**:
  1. Corrected `RingPlaygroundProvider.ts` to query `/v1/history/devices/{device_id}/events` and normalized `attributes.event_type` and `attributes.start` timestamps. Added 3 automated tests in `liveRingContract.test.ts` (306 passing tests across 37 suites).
  2. Preserved explicit token injection without falling back globally.
  3. Factually classified media retrieval outcome as `MEDIA_API_CONNECTED` and `MEDIA_UNAVAILABLE` under sandbox scope boundaries without automatic retries.
  4. Retained the deterministic simulator (`RingSimulatorProvider`) for the public demo to ensure judges can evaluate all 7 accessibility scenarios without requiring Ring hardware or short-lived tokens, while never misrepresenting simulated images as official Ring camera footage.
- **Impact on Development**: Required iterative diagnostic testing against `api.amazonvision.com` and comprehensive documentation in [docs/ring-live-integration-verification.md](ring-live-integration-verification.md) to maintain total transparency about what is live vs. what is simulated.
- **Actionable Improvement Suggestion**: Provide formal OpenAPI / JSON Schema documentation for the `media/image/download` request body detailing all required timestamp fields, align event history path documentation, and grant media download entitlements to Developer Playground sandbox tokens.

---

## Friction Entry 3: DynamoDB Eventual Consistency in Rapid Assurance State Workflows

- **Service / Tool**: Amazon DynamoDB Single-Table Persistence (`@aws-sdk/client-dynamodb`)
- **Severity**: Medium
- **Task Attempted**: Retrieve the authoritative gatekeeper decision record immediately following a staff remediation verification to update the operator workbench in real time.
- **Steps Performed**:
  1. Dispatched `verifyPostRemediationEvidence` workflow upon fresh evidence arrival.
  2. Persisted assessment mutation `assess_verified_restored_*` and audit event atomically via `TransactWriteItems`.
  3. Polled `/api/entrances/[id]/assurance` from the React dashboard to render updated badge and modal.
- **Expected Result**: Subsequent read immediately returns the newly committed `VERIFIED_RESTORED` assessment with updated timestamp and gatekeeper report.
- **Actual Result**: Default eventually consistent reads occasionally returned the predecessor `RECHECKING` assessment or an empty gatekeeper report for 100–300ms, causing the frontend UI to flicker back to `RECHECKING` or display a blank decision modal.
- **Observed Error or Diagnostic Evidence**:
  UI state regression where a verified entrance briefly reverted to `RECHECKING` before settling on `VERIFIED_RESTORED` due to read-after-write replication lag on DynamoDB query operations.
- **Workaround Implemented**:
  1. Enforced `ConsistentRead: true` on all critical path DynamoDB GetItem and Query operations for entrance assessments and decision records.
  2. Implemented `lastScenarioTimeRef` and monotonic assessment timestamp verification in `OperatorDashboard.tsx` to discard stale read responses arriving out-of-order.
- **Impact on Development**: Required careful concurrency auditing, optimistic locking, and client-side monotonic state gating across all console views.
- **Actionable Improvement Suggestion**: Clearly document the necessity of strong consistency (`ConsistentRead: true`) for workflows involving rapid state transitions where UI clients expect immediate read-your-writes guarantees.

---

## Friction Entry 4: AWS Amplify SSR Execution Role & Secrets Manager Provisioning

- **Service / Tool**: AWS Amplify Hosting (Next.js 14 App Router SSR) & AWS Secrets Manager
- **Severity**: Medium
- **Task Attempted**: Securely inject production Ring partner credentials and DynamoDB table names into server-side Next.js route handlers without exposing environment variables to the browser bundle or repository.
- **Steps Performed**:
  1. Created production secret `openway/production/ring/credentials-onkBtB` in AWS Secrets Manager (`us-east-1`).
  2. Configured Amplify SSR execution role to grant `secretsmanager:GetSecretValue`.
  3. Set `OPENWAY_RING_SECRET_ARN` in Amplify environment configuration.
- **Expected Result**: Serverless compute container automatically assumes the execution role and fetches secrets during runtime initialization.
- **Actual Result**: Amplify SSR compute roles require specific trust relationships (`amplify.amazonaws.com` and `lambda.amazonaws.com`) and explicit resource ARN scoping. Mismatches resulted in runtime AccessDenied exceptions during server actions, while environment variables configured in the Amplify Console were not automatically propagated to SSR Lambda execution contexts unless prefixed or explicitly forwarded.
- **Observed Error or Diagnostic Evidence**:
  ```text
  AccessDeniedException: User: arn:aws:sts::241638332840:assumed-role/amplify-openway-ssr/AmplifySSRFunction
  is not authorized to perform: secretsmanager:GetSecretValue on resource: ...
  ```
- **Workaround Implemented**:
  1. Decoupled credential retrieval into a dedicated `SecretProvider.ts` module with 1-hour in-memory caching and graceful fallback.
  2. Attached least-privilege IAM inline policy directly to the Amplify SSR service role restricted strictly to the specific secret ARN.
  3. Added non-sensitive locator `OPENWAY_RING_SECRET_ARN` in `.env.production` while keeping all secret values inside Secrets Manager.
- **Impact on Development**: Required iterative IAM debugging and local reproduction scripts to verify least-privilege role boundaries without exposing secrets.
- **Actionable Improvement Suggestion**: Provide unified Amplify Console tooling or CDK constructs that automatically create and bind Secrets Manager references directly to SSR execution environments with zero manual IAM policy assembly.

---

## Summary Matrix

| Entry | Service | Category | Impact | Resolution |
| :---: | :--- | :--- | :--- | :--- |
| **01** | Amazon Bedrock Nova | Platform Authorization / Availability | Blocked live inference in public demo | Fallback analyzer with explicit UI status transparency |
| **02** | Amazon Ring Partner API | Route Discrepancy & Sandbox Media Entitlements | Event history route mismatch & media 403 in playground | Updated route to `/v1/history/devices/...`, verified metadata, and retained deterministic simulator fallback |
| **03** | Amazon DynamoDB | Storage Replication Latency | Temporary UI state regression flicker | Enforced `ConsistentRead: true` + monotonic client gating |
| **04** | AWS Amplify & Secrets Manager | Cloud IAM Orchestration Complexity | Runtime AccessDenied during SSR bootstrap | Least-privilege role scoping + cached SecretProvider |
