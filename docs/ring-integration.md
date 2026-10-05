# Amazon Ring Integration Guide

This document details the technical integration between OpenWay and the official **Amazon Ring Partner API** (Amazon Vision API / AVA).

---

## 1. Upstream API Specifications & Authorities

- **Base URL**: `https://api.amazonvision.com`
- **OAuth Host**: `https://oauth.ring.com`
- **Data Specification**: **JSON:API (v1.0 / v1.1)**
- **Transport Security**: TLS 1.3, Server-to-Server only (browser CORS calls are strictly blocked by Amazon Vision API)
- **Authentication**: `Authorization: Bearer <access_token>`
- **Webhook Delivery**: HTTPS POST with `X-Signature` HMAC-SHA256 signature header

---

## 2. Capability Conformance & Verification Matrix

| Capability | Implementation | Official Endpoint / Protocol | Verification Status | Remaining Risk / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Ring Device Discovery** | `RingPlaygroundProvider.listDevices()` | `GET /v1/devices?include=status,capabilities` (JSON:API) | **VERIFIED** | Handled via compound documents (`data`, `attributes`, `relationships`, `included`). |
| **Ring Device Status** | `RingPlaygroundProvider.getDeviceStatus()` | `GET /v1/devices/{id}/status` or compound document | **VERIFIED** | Normalizes online/offline state and battery telemetry. |
| **Ring Capabilities** | `RingPlaygroundProvider.getDeviceCapabilities()` | `GET /v1/devices/{id}/capabilities` or compound document | **VERIFIED** | Normalizes `supports_live_video`, `supports_snapshots`, `supports_media_clips`, `supports_motion_events`. |
| **Ring Image Evidence** | `RingClient.downloadImage()`, `RingPlaygroundProvider.getImageEvidence()` | `POST /v1/devices/{id}/media/image/download` with `{ components: ["camera"] }` | **DOCUMENTED / SPEC-VERIFIED** (Not live-verified on physical Ring account) | Correctly handles HTTP `303 See Other` redirects to pre-signed S3 URLs as well as binary dataUrl streams. |
| **Ring Webhook Ingestion** | `RingWebhookHandler.processWebhook()` | `POST /api/ring/webhook` (v1.1 schema) | **VERIFIED** | Validates `X-Signature` HMAC-SHA256 with constant-time comparison; deduplicates using `meta.request_id`. |
| **Ring Event Normalization** | `RingPlaygroundProvider.normalizeEvent()` | Official v1.1 event schema (`button_press`, `motion`) | **VERIFIED** | Explicitly separates `official_ring`, `simulated_local`, and `openway_domain` event categories. |
| **Ring Media Clips** | `RingProvider` capability detection | `POST /v1/devices/{id}/media/video/download` | **DOCUMENTED / DEFERRED** | Capability flag detected; video download deferred to Phase 2. |
| **OAuth Account Linking** | `RingApiProvider` & documentation | `https://oauth.ring.com/v2/authorize` & `/oauth/token` | **PENDING PHASE 2** | Short-lived Playground Access Token (~30–60 min) used for Phase 1. |
| **Local Simulator** | `RingSimulatorProvider` | Offline deterministic in-memory provider | **VERIFIED** | Honestly labeled with `SIMULATED - LOCAL TEST EVIDENCE`. |

---

## 3. Supported Endpoints & Request/Response Contracts

### A. Device Discovery (`GET /v1/devices`)
- **Query Parameters**: `?include=status,capabilities`
- **Headers**:
  ```http
  Authorization: Bearer <RING_ACCESS_TOKEN>
  Accept: application/vnd.api+json, application/json
  X-Correlation-Id: <UUID>
  ```
- **Response Structure**:
  ```json
  {
    "data": [
      {
        "id": "dev_01",
        "type": "device",
        "attributes": {
          "name": "Main Accessible Ramp Entrance",
          "kind": "doorbell"
        },
        "relationships": {
          "status": { "data": { "id": "stat_01", "type": "status" } },
          "capabilities": { "data": { "id": "caps_01", "type": "capabilities" } }
        }
      }
    ],
    "included": [
      {
        "id": "stat_01",
        "type": "status",
        "attributes": { "online": true, "state": "online", "battery_level": 94 }
      },
      {
        "id": "caps_01",
        "type": "capabilities",
        "attributes": {
          "supports_live_video": true,
          "supports_snapshots": true,
          "supports_media_clips": true,
          "supports_motion_events": true
        }
      }
    ]
  }
  ```

### B. Image Evidence Retrieval (`POST /v1/devices/{device_id}/media/image/download`)
- **Headers**:
  ```http
  Authorization: Bearer <RING_ACCESS_TOKEN>
  Content-Type: application/json
  Accept: image/jpeg, image/png, application/json
  X-Correlation-Id: <UUID>
  ```
- **Request Body**:
  ```json
  {
    "components": ["camera"]
  }
  ```
- **Response Flow**:
  - The API responds with HTTP `303 See Other`.
  - The `Location` header contains a time-limited pre-signed Amazon S3 URL.
  - OpenWay either returns this verified URL or downloads the stream server-side and produces a base64 Data URL (`data:image/jpeg;base64,...`) to enforce security boundaries without exposing external buckets or storing raw files permanently.

### C. Webhook Ingestion (`POST /api/ring/webhook`)
- **Headers**:
  ```http
  X-Signature: <hmac_sha256_hex>
  Content-Type: application/json
  ```
- **Official v1.1 Schema**:
  ```json
  {
    "meta": {
      "version": "1.1",
      "time": "2026-10-05T12:00:00.000Z",
      "request_id": "c83081fc-2f1b-4cb7-8b18-b18a318b8bab",
      "account_id": "ava1.ring.account.XXXYYY"
    },
    "data": {
      "id": "cam_front_entrance_motion_1771027372",
      "type": "motion",
      "attributes": {
        "source": "cam_front_entrance",
        "source_type": "devices",
        "timestamp": 1771027372393
      },
      "relationships": {
        "devices": {
          "links": {
            "self": "/v1/devices/cam_front_entrance"
          }
        }
      }
    }
  }
  ```

---

## 4. Media Security & Retention Boundaries

1. **Zero Public Directory Leakage**: No Ring image or video files are written to Next.js `public/` directories or exposed without server authorization.
2. **In-Memory Streaming**: Binary images downloaded from Ring are held temporarily in-memory and converted to ephemeral Data URLs or handled as signed time-limited redirects.
3. **No Long-Term Unencrypted Storage**: Media is discarded after verification is complete.
