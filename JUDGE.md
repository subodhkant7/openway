# OpenWay Judge Guide

> **Primary Track**: Ring  
> **Mini-Challenge**: AWS Builder  
> **Presentation Website**: [https://main.d2qhyx9vstga35.amplifyapp.com/presentation](https://main.d2qhyx9vstga35.amplifyapp.com/presentation)  
> **Live Demo**: [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com)  
> **Health Check**: [https://main.d2qhyx9vstga35.amplifyapp.com/api/health](https://main.d2qhyx9vstga35.amplifyapp.com/api/health)

---

## 60-Second Evaluation Walkthrough

1. **Open the live demo**: Open [https://main.d2qhyx9vstga35.amplifyapp.com](https://main.d2qhyx9vstga35.amplifyapp.com). No login, no setup, no keys required.
2. **Confirm baseline**: Confirm entrance status is **`ACCESS AVAILABLE`** (Green).
3. **Click `1. PREEMPTIVE OBSTRUCTION`**: Observe Ring motion event ingestion &rarr; Bedrock vision detection &rarr; status transitions to **`ACCESS INTERRUPTED`** &rarr; Remediation task dispatched.
4. **Click `2. STAFF REMEDIATION`** (or click "Report Fixed"): Observe state transition to **`RECHECKING`**. Notice OpenWay **refuses to turn green** simply because staff claimed it was fixed.
5. **Click `3. CANONICAL VERIFICATION`**: Observe fresh post-remediation evidence evaluated by Amazon Bedrock &rarr; all gatekeeper rules satisfied &rarr; status transitions to **`ACCESS RESTORED — VERIFIED`**.
6. **Click `4. FAILURE DEMO 1: UNAVAILABLE`**: Simulates missing/unobtainable Ring evidence &rarr; status safely transitions to **`UNKNOWN`** (No False Green).
7. **Click `5. FAILURE DEMO 2: STALE PRE-REMEDIATION`**: Simulates replaying old pre-remediation footage &rarr; Gatekeeper rejects stale evidence &rarr; transitions to **`UNKNOWN`**.
8. **Click `Reset Demo Narrative`**: Restores the demo tenant cleanly to baseline `ACCESS AVAILABLE`.

---

## Why It Matters

> **Detected is not resolved. Resolved is not verified until fresh evidence proves the physical condition changed.**

Traditional camera alert systems push notifications and trust staff checkboxes. OpenWay operates a deterministic assurance state machine:
* **AI cannot declare restoration**: Amazon Bedrock produces subordinate structured observations (`pathwayClear`, `obstructionPresent`, `doorReady`).
* **Staff cannot declare restoration**: Staff completion only initiates the recheck loop.
* **Old evidence cannot prove new restoration**: Evidence captured even 1ms before remediation completion is rejected.
* **Failure fails closed**: Inconclusive or missing evidence strictly resolves to `UNKNOWN`.

---

## Provenance Transparency

* **`SIMULATED RING`**: Used in the public demo sandbox to provide a deterministic, zero-friction evaluator experience without requiring judge Ring hardware pairing.
* **`AMAZON BEDROCK`**: Real foundation model inference (`amazon.nova-lite-v1:0` via Converse API) interpreting image evidence.
* **`SPEC VERIFIED`**: Real Ring Partner API v1.1 integration architecture (`RingClient`, JSON:API `/v1/devices`, 303 media downloads, HMAC webhooks) verified against official specifications.
