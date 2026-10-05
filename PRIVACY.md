# OpenWay Privacy Charter

> **"OpenWay analyzes the physical environment, not people's identities."**

Accessibility assurance requires observing configured physical conditions—such as wheelchair ramps, automatic entrance doors, elevators, and curb cuts. It **never** requires identifying, profiling, or tracking individuals.

---

## Architectural Prohibitions

OpenWay enforces strict architectural boundaries in code and policy. The following capabilities are **never** implemented:

1. **No Facial Recognition**: OpenWay never extracts, processes, or stores facial geometry, facial landmarks, or facial embeddings.
2. **No Identity Recognition**: Observations are evaluated solely for environmental obstruction states, never to determine who is present.
3. **No Disability Inference**: OpenWay never infers, categorizes, or records medical conditions, mobility impairments, or protected personal traits.
4. **No Visitor Profiling**: No behavioral profiling, demographic analysis, or customer tracking.
5. **No Cross-Camera Tracking**: OpenWay evaluates each entrance camera independently within its local spatial boundary; it does not correlate person movements across camera networks.
6. **No Marketing Exploitation**: Video telemetry and snapshots are strictly prohibited from being monetized, shared with advertisers, or used for behavioral ad targeting.

---

## Data Minimization & Retention

1. **Transient Processing**: Video telemetry and motion events are processed in-memory.
2. **Evidence Minimization**: When physical evidence is captured to verify that an entrance path has been restored, OpenWay stores only a single low-resolution snapshot showing the cleared pathway.
3. **Automated Expiration**: Physical evidence snapshots are subject to strict rolling retention policies (e.g. 7-day retention for operator dispute resolution, followed by automated cryptographic erasure).
4. **Credential Isolation**: All Ring tokens and credentials remain strictly server-side and are never transmitted to client browsers or third-party analytical trackers.
5. **Sanitized Audit Events**: Audit events record timestamps, correlation IDs, and state transitions; they never store customer names, secrets, signed URLs, or raw image payloads.

---

## Scope Boundary & Legal Notice

OpenWay verifies:
> **Explicitly configured, camera-observable entrance conditions.**

OpenWay does **not** certify:
> **General legal building-code certification or ADA compliance.**

---

## Summary for Venue Patrons & Staff

Patrons and venue visitors can be confident that OpenWay cameras serve one purpose: ensuring that people of all abilities have unobstructed, dignified access to the physical venue.
