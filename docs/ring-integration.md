# Amazon Ring Integration Guide

This document details the technical integration between OpenWay and the official **Amazon Ring Partner API** (Amazon Vision API / AVA).

---

## Upstream API Overview

- **Base URL**: `https://api.amazonvision.com`
- **Protocol**: HTTPS / REST / JSON (JSON:API compatible)
- **Transport Security**: TLS 1.3
- **Authentication**: OAuth 2.0 Bearer Tokens
- **Webhook Delivery**: HTTPS POST with `X-Signature` HMAC-SHA256

---

## Supported Endpoints & Mappings

### 1. Device Discovery
- **Endpoint**: `GET /v1/devices`
- **Header**: `Authorization: Bearer <RING_ACCESS_TOKEN>`
- **Response**: List of authorized Ring hardware devices (doorbells, cameras).
- **OpenWay Normalizer**:
  - Extracts user-assigned device name (`name` or `description`).
  - Identifies device form factor (`kind`: doorbell, stickup_cam, floodlight_cam).
  - Resolves hardware components (`components`: camera, motion_detector, speaker, chime).

### 2. Device Status
- **Endpoint**: `GET /v1/devices/{id}/status`
- **Response**: Operational connectivity state (`state: "online"` / `online: true`, battery telemetry).
- **OpenWay Normalizer**: Maps upstream status to normalized `"online" | "offline" | "unknown"`.

### 3. Device Capabilities
- **Endpoint**: `GET /v1/devices/{id}/capabilities`
- **Response**: Hardware features enabled for the camera.
- **OpenWay Normalizer**:
  ```typescript
  {
    supports_live_video: boolean;
    supports_snapshots: boolean;
    supports_media_clips: boolean;
    supports_motion_events: boolean;
  }
  ```

### 4. Image Snapshot Evidence
- **Endpoint**: `GET /v1/devices/{id}/snapshot`
- **Response**: URL or binary buffer of the latest visual camera observation.
- **OpenWay Usage**: Used as physical evidence to verify whether an accessibility interruption (e.g. ramp obstruction) has actually been cleared before restoring access status.

### 5. Webhook Ingestion
- **Target**: `POST /api/ring/webhook`
- **Headers**:
  - `X-Signature`: Hex-encoded HMAC-SHA256 signature calculated over the raw request body using `RING_WEBHOOK_SECRET`.
  - `Content-Type`: `application/json`
- **Payload Shape**:
  ```json
  {
    "event_id": "evt_abc123",
    "event_type": "motion",
    "device_id": "cam_entrance_01",
    "timestamp": "2026-10-05T12:00:00Z",
    "components": ["motion_sensor"]
  }
  ```

---

## Integration Modes

### Mode A: Ring Developer Playground (Phase 1)
- **Use Case**: Fast prototyping, local development, and hackathon evaluation.
- **Workflow**:
  1. Generate short-lived token in the Ring Developer Portal.
  2. Configure `RING_ACCESS_TOKEN` in `.env.local`.
  3. `RingPlaygroundProvider` handles queries server-to-server.
- **Expiry**: ~30-60 minutes.

### Mode B: Production Ring Partner API (Phase 2)
- **Use Case**: Production venues, commercial deployments.
- **Workflow**:
  1. Full OAuth 2.0 authorization code grant.
  2. Exchange authorization code for access and refresh tokens.
  3. Background token refresh daemon.

### Mode C: Deterministic Local Simulator (Included)
- **Use Case**: CI/CD pipelines, offline hacking, deterministic demonstrations.
- **Workflow**: `RingSimulatorProvider` mirrors the exact `RingProvider` interface with in-memory state.
