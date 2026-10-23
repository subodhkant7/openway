# OpenWay Architecture

OpenWay is built on a modular, decoupled architecture that separates hardware observation ingestion from accessibility assurance domain rules, evidence evaluation, deterministic state transitions, and cloud persistence.

---

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Browser ["Operator Interface (WCAG 2.2 AA)"]
        UI["Operator Dashboard (React / Tailwind)"]
        Card["Entrance Assurance Card"]
        Timeline["Evidence & Assurance Timeline"]
        Controls["Simulator Workbench (7 Scenarios)"]
        GatekeeperModal["Nine-Point Gatekeeper Modal"]
        
        UI --> Card
        UI --> Timeline
        UI --> Controls
        UI --> GatekeeperModal
        UI -->|Next.js Fetch / Server Actions| API
    end

    subgraph Server ["OpenWay Domain & Application Server (Next.js / Node.js)"]
        API["API Layer (/api/entrances, /api/assessments, /api/remediation, /api/ring/*)"]
        
        subgraph DomainLayer ["Deterministic Domain Engine (Pure TypeScript)"]
            FSM["Assurance State Machine (FSM)"]
            Gatekeeper["Restoration Gatekeeper (9 Invariant Checks)"]
            Verifier["Post-Remediation Verifier (capturedAt >= completedAt)"]
            Aggregator["Observation Aggregator (Tri-State)"]
            Freshness["Freshness Evaluator (Authoritative Capture Time)"]
        end

        subgraph CloudPersistence ["Operational AWS Infrastructure"]
            Dynamo["Amazon DynamoDB (OpenWayTable)"]
            Amplify["AWS Amplify Hosting (SSR Execution Role)"]
            Secrets["AWS Secrets Manager (Cached SecretProvider)"]
        end

        API --> DomainLayer
        DomainLayer --> Dynamo
        
        Webhook["Ring Webhook Engine (HMAC & Deduplication)"]
        ProviderFactory["Ring Provider Factory"]
        API --> ProviderFactory
        Webhook --> DomainLayer
    end

    subgraph RingLayer ["Ring Integration Layer (src/ring)"]
        ProviderFactory --> IProvider["RingProvider Interface"]
        IProvider --> Playground["RingPlaygroundProvider (Dev Mode)"]
        IProvider --> PartnerAPI["RingApiProvider (Production OAuth)"]
        IProvider --> Simulator["RingSimulatorProvider (Deterministic Offline)"]
        
        Playground --> Client["RingClient (Server-Side HTTP Client)"]
        PartnerAPI --> Client
    end

    subgraph VisionLayer ["Multimodal Vision Layer (src/vision)"]
        VisionInterface["VisionAnalyzer Interface"]
        VisionInterface --> BedrockAnalyzer["BedrockVisionAnalyzer (Converse API)"]
        VisionInterface --> SimVision["SimulatorVisionAnalyzer (Deterministic Fallback)"]
    end

    subgraph Upstream ["Upstream External Services"]
        Client -->|Bearer Auth / Server-to-Server| AVA["api.amazonvision.com"]
        AVA -.->|X-Signature Webhooks v1.1| Webhook
        AVA --> Hardware["Ring Doorbells & Cameras"]
        BedrockAnalyzer -->|Converse API (amazon.nova-lite-v1:0)| BedrockService["Amazon Bedrock Runtime"]
    end
```

---

## Architectural Differentiation: Three Independent Layers

OpenWay rigorously decouples its operational stack into three distinct lanes:

### 1. Ingestion & Evidence Layer (`src/ring/`, `src/evidence/`)
- Supplies raw events, timestamps, device bindings, and image buffers.
- Contains **zero business rules or accessibility policy logic**.
- Validates SSRF redirect origins and extracts authoritative capture timestamps (`x-ring-captured-at`, `Last-Modified`).

### 2. Deterministic Domain & Policy Engine (`src/domain/`, `src/policy/`, `src/workflow/`)
- Pure TypeScript implementation with zero cloud SDK dependencies.
- Enforces the core invariant: **Detection ≠ Resolution ≠ Verification**.
- Evaluates the **9-Point Deterministic Restoration Gatekeeper** (`canDeclareRestored`).
- Governs the Assurance State Machine (`AVAILABLE`, `INTERRUPTED`, `ACTION_REQUIRED`, `RECHECKING`, `VERIFIED_RESTORED`, `UNKNOWN`).

### 3. Cloud Infrastructure & Persistence (`src/persistence/dynamo/`)
- **AWS Amplify Hosting**: Full-stack Next.js 14 App Router SSR with least-privilege IAM execution roles.
- **Amazon DynamoDB**: Single-table persistence (`OpenWayTable`) with conditional write locks (`attribute_not_exists(PK)`), optimistic locking, and atomic `TransactWriteItems`.
- **AWS Secrets Manager**: Server-side credential isolation via `SecretProvider.ts` with 1-hour in-memory caching.

---

## Module Breakdown

### 1. Domain Layer (`src/domain/`)
- `types.ts`: Core entities including `Venue`, `Entrance`, `CameraBinding`, `AccessibilityRequirements`, `RemediationTask`, `AccessAssessment`, and `AuditEvent`.
- `CameraBinding`: Explicit hardware binding (`deviceId`, `componentId`). Model heuristics never guess which camera observes an entrance.
- `AccessibilityRequirements`: Typed physical conditions (`pathwayClear`, `obstructionFree`, `doorReady`).

### 2. Evidence Layer (`src/evidence/`)
- `types.ts`: Provider-neutral `Evidence` schema with strict provenance tracking (`OFFICIAL_RING`, `SIMULATED_LOCAL`, `OPENWAY_DERIVED`), `temporalClassification` (`PRE_REMEDIATION`, `POST_REMEDIATION`, `TEMPORALLY_UNVERIFIED`, `STALE`, `INVALID`), and tri-state `AccessibilityObservation`.
- `temporalClassification.ts`: Explicit temporal classification distinguishing EVENT TIME, CAPTURE TIME, and RECEIPT TIME against task completion timestamp and max age limits.
- `freshness.ts`: Pure deterministic freshness evaluator based on capture timestamp, evaluation time, max age thresholds, and clock drift tolerance.
- `aggregation.ts`: Evaluates evidence freshness, camera binding, requirements satisfaction, and contradictory observations.
- `evidenceAcquisition.ts`: Acquires fresh visual evidence from Ring media download endpoints, preserves camera provenance, extracts authoritative capture timestamps, and classifies temporality.

### 3. Policy Layer (`src/policy/`)
- `postRemediationVerifier.ts`: Implements `verifyPostRemediationEvidence(...)` enforcing all mandatory verification conditions (existence, known capture time, `capturedAt >= completedAt`, entrance match, device match, component match, freshness, schema validity, requirement satisfaction, non-contradiction).
- `restorationGatekeeper.ts`: Pure deterministic function implementing `canDeclareRestored`. Evaluates the 9 restoration gatekeeper rules and rejects premature or unverified evidence.

### 4. Workflow & Orchestration Layer (`src/workflow/`)
- `accessAssuranceOrchestrator.ts`: Async processing boundary for Ring events. Coordinates event correlation, fresh evidence acquisition, multimodal vision inference, state transitions, and remediation dispatch with deduplication (`provider_eventId_deviceId`).
- `eventCorrelator.ts`: Deterministically maps Ring events to configured entrances via `deviceId` and `componentId`. Rejects unbound hardware (`UNBOUND_DEVICE`) with audit logging.
- `recheckService.ts`: Bounded post-remediation verification workflow. Explicitly requests fresh Ring evidence captured after staff completion (`capturedAt >= completedAt`), invokes `verifyPostRemediationEvidence`, and transitions to `VERIFIED_RESTORED`, `ACTION_REQUIRED`, or `UNKNOWN`.
- `eventReconciliation.ts`: Lightweight event history recovery abstraction. Recovers missed Ring events via paginated `links.next` navigation and replays them idempotently while preserving temporal verification invariants.
- `stateMachine.ts`: Deterministic Assurance State Machine (`AVAILABLE`, `INTERRUPTED`, `ACTION_REQUIRED`, `RECHECKING`, `VERIFIED_RESTORED`, `UNKNOWN`) with invalid transition rejection and structured logging.
- `simulatorWorkflow.ts`: Exercises the canonical demo flow and deliberate failure demos using the same application services as production code.

### 5. Persistence Layer (`src/persistence/`)
- `repositories.ts`: Clean repository contracts decoupling the domain from storage engines (`VenueRepository`, `EntranceRepository`, `EvidenceRepository`, `ObservationRepository`, `AssessmentRepository`, `RemediationTaskRepository`, `AuditEventRepository`).
- `dynamo/`: Production Amazon DynamoDB single-table persistence adapter:
  - `DynamoStorageProvider.ts`: Full implementation of `StorageProvider` with atomic `TransactWriteItems` bundling assessments, remediation tasks, and audit events.
  - `schema.ts`: Single-table partition (`PK`) and sort key (`SK`) conventions with Global Secondary Index (`GSI1PK`, `GSI1SK`).
  - `idempotency.ts`: Durable distributed idempotency records with conditional write locks (`attribute_not_exists(PK)`) protecting concurrent webhook arrivals across multiple server instances.
  - `concurrency.ts`: Optimistic concurrency error handling (`OptimisticLockError`) and exponential jitter retry helper (`withOptimisticRetry`).
- `memoryStore.ts`: In-memory transactional storage provider retained for lightning-fast deterministic unit testing.
- `bootstrap.ts`: Deterministic, idempotent seeding of the demo venue (`venue_maple_cafe`) and entrance (`entrance_side_accessible`).

### 6. Vision Layer (`src/vision/`)
- `VisionAnalyzer.ts`: Provider-neutral vision interface (`VisionAnalyzer`, `VisionAnalysisInput`, `DetailedVisionObservation`). Keeps Ring != Vision != Policy.
- `BedrockVisionAnalyzer.ts`: Implements multimodal analysis using AWS Bedrock Runtime Converse API (`amazon.nova-lite-v1:0`). Enforces platform-level tool calling JSON schemas (`record_accessibility_observation`) and Zod `.strict()` output validation.
- `SimulatorVisionAnalyzer.ts`: Deterministic simulated vision engine supporting CLEAR, BLOCKED, UNCERTAIN, and CONTRADICTORY scene evaluation.
- `VisionPipelineService.ts`: Pipeline coordinator implementing deduplication/cost-control idempotency keys, observation persistence, audit emission, and deterministic policy transition dispatch.
- **Unavailable Runtime Inference Disclosure**: In evaluation environments where Amazon Bedrock access is unconfigured or rejected with Error 002 (account-level model enablement restriction), OpenWay falls back to `SimulatorVisionAnalyzer.ts` and fails closed to `UNKNOWN` when conclusive evidence is absent.

### 7. Ring Integration Layer (`src/ring/`)
- `RingClient.ts`: Server-side HTTP client with SSRF redirect origin protection (`isValidRingMediaHost`), authoritative capture timestamp extraction (`x-ring-captured-at`, `Last-Modified`), and 416/503 handling.
- `RingPlaygroundProvider.ts`: Live Playground client with JSON:API compound document parsing and paginated event history following `links.next`.
- `RingSimulatorProvider.ts`: Deterministic offline simulator maintaining strict `SIMULATED_LOCAL` provenance separation.
- `accountLinking.ts`: Ring Partner OAuth account-linking scaffolding with AES-256-GCM token encryption at rest and automated refresh abstraction.

---

## Reliability & Fault Tolerance Matrix

| Failure Mode | Architectural Mitigation | Resulting State |
| :--- | :--- | :--- |
| **Evidence Stale** | Freshness evaluator rejects timestamps exceeding max age threshold. | `UNKNOWN` |
| **Contradictory Observations** | Aggregator flags conflicting fresh observations. | `UNKNOWN` |
| **Wrong Camera Evidence** | Gatekeeper and API reject evidence whose device/component does not match entrance binding. | `REJECTED` (State unaffected) |
| **Pre-Remediation Evidence Reuse** | `verifyPostRemediationEvidence` requires `capturedAt >= completedAt`. | `UNKNOWN` |
| **Missing Capture Timestamp** | Temporal classifier marks evidence `TEMPORALLY_UNVERIFIED`. | `UNKNOWN` |
| **Media 404 / 416 / Timeout** | Client catches upstream media absence and surfaces typed error. | `UNKNOWN` |
| **Arbitrary Redirect SSRF** | `isValidRingMediaHost` rejects non-Ring/non-AWS redirect targets. | Download Aborted / Rejected |
| **Concurrent Webhook Ingestion** | Durable DynamoDB conditional write locks (`attribute_not_exists(PK)`). | Duplicate Swallowed / Processed Once |
| **Concurrent State Mutation** | Optimistic locking on assessment versioning with exponential backoff retry. | Clean State Reconciliation |
| **Process / Container Restart** | State durably persisted in Amazon DynamoDB; survives browser and host reloads. | Persistent Operational Continuity |
| **Upstream 429 Rate Limit** | Bounded exponential backoff with jitter in `RingClient`. | Operational continuity |
| **Storage Transaction Failure**| TransactWriteItems rolls back all partial mutations atomically. | Consistent pre-transaction state |
| **Bedrock Error 002 Denied** | VisionPipeline falls back to simulated vision; fails closed on ambiguity. | `UNKNOWN` |
