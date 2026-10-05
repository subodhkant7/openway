# OpenWay Phase 1 — Interactive Demo Script

This script walks through a complete, deterministic 3-minute demonstration of OpenWay's Phase 1 capabilities, covering both live Ring Developer Playground integration and the offline local simulator.

---

## Prerequisites

- Development server running: `npm run dev`
- Browser open to: [http://localhost:3000](http://localhost:3000)

---

## Step-by-Step Demonstration Flow

### 1. Launch OpenWay & View Initial State
1. Open [http://localhost:3000](http://localhost:3000).
2. Point out the clean **Operator Interface**:
   - Header: **OPENWAY — Accessibility Assurance (Powered by Ring)**.
   - Privacy-By-Design notice with **Zero Facial Tracking** guarantee.
   - **Ring Connection Card**: Highlights active provider mode and gateway endpoint.
   - **Selected Entrance**: Shows `[not configured yet]` in initial state.
   - **Ring Devices**: Lists discovered hardware with user-assigned names and capability badges.
   - **Latest Ring Observation**: Displays real-time normalized telemetry stream.

---

### 2. Demonstrate Local Simulator Fallback
1. By default, OpenWay launches in `simulator` mode.
2. Note the amber **`SIMULATED`** badge on the connection card and telemetry events.
3. Show the discovered entrance cameras:
   - *Main Accessible Ramp Entrance* (Online, Doorbell)
   - *Automatic Side Access Door* (Online, Stick Up Cam)
   - *Drop-off Zone & Accessible Curb Cut* (Offline, Floodlight Cam)
4. Click **"Bind Main Accessible Ramp Entrance"** under Selected Entrance.
   - Entrance state transitions to: `ACCESS ASSURED & VERIFIED`.

---

### 3. Trigger Physical Obstruction & Verification Cycle
1. In the **Selected Entrance** card, click **"Simulate Ramp Obstruction (Interruption)"** (or use the Simulator Workbench: "Trigger Delivery (Obstruction)").
2. Observe the entrance state immediately change to:
   - **`ACCESS INTERRUPTED — REMEDIATION NEEDED`** (flashing high-visibility alert).
   - Telemetry feed logs: `Temporary obstruction detected in front of Main Accessible Ramp Entrance`.
3. Highlight OpenWay's core product principle:
   > *"An alert is not a resolution. A resolution is not verified until new evidence proves the physical state changed."*
4. Click **"Verify Restored with Fresh Ring Evidence"**:
   - Status transitions to `PENDING FRESH PHYSICAL EVIDENCE`.
   - OpenWay queries the Ring camera for a fresh observation snapshot.
   - After fresh evidence is captured and confirmed, status updates to **`ACCESS ASSURED & VERIFIED`**.

---

### 4. Fetch Fresh Camera Snapshot
1. On *Main Accessible Ramp Entrance* in the **Ring Devices** list, click **"Fresh Snapshot"**.
2. An inline preview displays the verified camera perspective showing the clear accessible ramp doorway and perspective lines with live UTC timestamp.

---

### 5. Connect to Live Ring Developer Playground
1. In the **Ring Connection Card**, toggle the mode button to **"Playground"**.
2. If `RING_ACCESS_TOKEN` is configured in `.env.local`:
   - Connection card transitions to **`CONNECTED (REAL RING)`** in emerald green.
   - Active device count updates directly from `https://api.amazonvision.com/v1/devices`.
   - Device capabilities (`Live Video`, `Snapshots`, `Media Clips`, `Motion Events`) reflect actual account permissions.
3. If no token is configured:
   - Connection card cleanly displays **`NOT CONFIGURED`** with instructions to supply a playground token without crashing the application.

---

### 6. Edge Case & Fault-Tolerance Demonstration
1. In the **Simulator Workbench**, click **"Set Device Offline"**.
   - The device immediately reflects **Offline** state.
2. Click **"Simulate Disconnection"**.
   - Ring Connection switches to **`ERROR`**, demonstrating graceful failure degradation without unhandled exceptions.
