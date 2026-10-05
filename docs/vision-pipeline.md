# OpenWay Multimodal Evidence Vision Pipeline

This document details the multimodal evidence intelligence layer of OpenWay, powered by Amazon Bedrock and the Ring evidence pipeline.

---

## 1. Core Architectural Principle

OpenWay verifies:
> **Configured, camera-observable access conditions.**

OpenWay does **NOT** certify:
* ADA compliance;
* Legal accessibility;
* Ramp slope;
* Exact doorway width;
* Opening force;
* Mechanical door-force compliance;
* Hidden defects;
* General building safety;
* Whether a person has a disability.

### Subordinate AI Principle

```text
Ring Camera
  ↓
Evidence (In-Memory Bytes)
  ↓
Bedrock Vision Analysis (Converse API)
  ↓
Structured Observation (Strict Tri-State Schema)
  ↓
Deterministic Policy (Aggregation & Freshness Gatekeeper)
  ↓
OpenWay State Machine
```

**CRITICAL INVARIANT:**
Under **NO circumstances** does the system permit:
```text
Ring → LLM → VERIFIED_RESTORED
```

Amazon Bedrock acts purely as an environmental sensory interpreter. The deterministic `RestorationGatekeeper` and `AssuranceStateMachine` remain solely authoritative over accessibility state.

---

## 2. Amazon Bedrock Integration (AWS Builder Mini-Challenge)

OpenWay integrates Amazon Bedrock via the official `@aws-sdk/client-bedrock-runtime` using the modern Converse API (`ConverseCommand`).

### Configured Multimodal Model
* **Default Model Candidate:** `amazon.nova-lite-v1:0` (Amazon Nova Lite multimodal vision model)
* **Fallback Candidates:** `anthropic.claude-3-haiku-20240307-v1:0`, `anthropic.claude-3-5-sonnet-20240620-v1:0`
* **Configuration:** Entirely environment-driven via `BEDROCK_MODEL_ID` and `AWS_REGION`.

### Platform-Enforced Structured Output
Rather than relying on conversational prompting ("Please reply in JSON"), OpenWay uses Bedrock's native tool-calling structured output contract (`toolConfig` with `toolChoice` set to `record_accessibility_observation`).

The tool specification provides a rigid JSON Schema:
* Explicit tri-state enumerations: `"TRUE" | "FALSE" | "UNKNOWN"`
* Required fields: `pathwayClear`, `obstructionPresent`, `doorReady`, `confidence`, `evidenceQuality`, `observedFeatures`, `explanation`
* `additionalProperties: false` (strictly forbids any unrecognized fields)

### Post-Inference Zod Validation Gate
Every response returned by Bedrock is parsed and validated by Zod's `VisionAnalysisOutputSchema.strict()`:
* Any extra properties (e.g. if the model attempts to inject a `state` field) are rejected immediately.
* Any non-tri-state values (e.g. `"YES"` or boolean `true`) fail validation.
* Validation failures trigger a fail-closed `UNKNOWN` assessment.

---

## 3. Image Transport & Media Security

### Zero Public Media Leakage
* Ring snapshots and video frames are fetched directly into server memory as `Uint8Array` byte buffers.
* Images are **NEVER** written to a public static web directory (`public/`).
* Ring pre-signed S3 URLs are **NEVER** exposed to client browser dashboards.
* Raw image bytes are transmitted directly over HTTPS to Amazon Bedrock via the Converse API's `image.source.bytes` payload.
* Memory buffers are garbage collected after inference.

### Supported Image Formats
* `image/jpeg` (`format: "jpeg"`)
* `image/png` (`format: "png"`)
* Maximum payload limit: 5MB (enforced before AWS API dispatch).

---

## 4. Privacy Boundaries & Ethical Constraints

The vision analyzer strictly prohibits identity profiling:
1. **No Person Identification:** Ignores faces, clothing, and individual identity.
2. **No Demographic Inference:** Prompts and schemas forbid inferring age, gender, race, or protected characteristics.
3. **No Disability Classification:** Never attempts to infer whether an individual has a disability or uses assistive devices.
4. **No Person Tracking:** Does not track individuals across timestamps or locations.
5. **Observation Schema Constraints:** The observation data contract makes persisting identity or demographic traits structurally impossible.

---

## 5. Fail-Safe Error Handling & Resiliency

All Bedrock exceptions are caught and mapped into normalized `VisionAnalysisError` instances:

| Error Code | Upstream Cause | Retryable | System Behavior |
| :--- | :--- | :--- | :--- |
| `BEDROCK_AUTH_ERROR` | 403 / AccessDeniedException | No | Fails-closed; logs diagnostic; state evaluates to `UNKNOWN` |
| `BEDROCK_THROTTLED` | 429 / ThrottlingException | Yes (bounded) | Backoff retry via AWS SDK; if exhausted, resolves to `UNKNOWN` |
| `BEDROCK_TIMEOUT` | 504 / Request timeout | Yes (bounded) | Resolves to `UNKNOWN`, never assumes clear |
| `BEDROCK_UNAVAILABLE` | 503 / ResourceNotFound | Yes/No | Safe fallback to `UNKNOWN` |
| `INVALID_MODEL_OUTPUT` | Schema validation error | No | Reject malformed output; fails-closed to `UNKNOWN` |
| `IMAGE_TOO_LARGE` | Buffer > 5MB | No | Rejection with `INSUFFICIENT_EVIDENCE` |
| `IMAGE_INVALID` | 0-byte or corrupted image | No | Rejection with `INSUFFICIENT_EVIDENCE` |

---

## 6. Idempotency & Cost Control

OpenWay avoids continuous streaming inferences or duplicate Bedrock API costs:
* **Deterministic Processing Key:**
  ```text
  processingKey = `${evidence.provider}_${evidence.providerEventId || evidence.id}_${evidence.id}_${analyzerVersion}`
  ```
* Identical evidence items are cached in memory. Repeated calls for the same Ring event ID do not re-invoke Bedrock.
* Vision inferences are only triggered on event-driven state transitions, staff completion rechecks, or operator-requested reconciliations.

---

## 7. Provenance Tracking: Live Ring vs. Simulator

OpenWay maintains strict honesty in evidence provenance:

| Ring Source | Vision Engine | Displayed Provenance |
| :--- | :--- | :--- |
| Live Ring Partner API (`OFFICIAL_RING`) | Amazon Bedrock (`amazon.nova-lite-v1:0`) | `OFFICIAL RING` + `AMAZON BEDROCK` |
| Simulator / Playground (`SIMULATED_LOCAL`) | Amazon Bedrock (`amazon.nova-lite-v1:0`) | `SIMULATED LOCAL` + `AMAZON BEDROCK` |
| Simulator / Playground (`SIMULATED_LOCAL`) | Simulator Analyzer (`simulator`) | `SIMULATED LOCAL` + `SIMULATOR VISION` |

Simulated evidence is **never** presented as official Ring evidence in the operator timeline or UI.
