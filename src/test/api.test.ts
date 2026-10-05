import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getStatus } from "@/app/api/ring/status/route";
import { GET as getDevices } from "@/app/api/ring/devices/route";
import { GET as getEvents } from "@/app/api/ring/events/route";
import { GET as getSnapshot } from "@/app/api/ring/snapshot/route";
import { POST as handleSimulate } from "@/app/api/ring/simulate/route";
import { POST as handleWebhook } from "@/app/api/ring/webhook/route";
import { RingWebhookHandler } from "@/ring/webhook";

describe("OpenWay Next.js API Routes", () => {
  beforeEach(() => {
    RingWebhookHandler.resetCache();
  });

  it("GET /api/ring/status returns simulator status by default", async () => {
    const req = new NextRequest("http://localhost:3000/api/ring/status?mode=simulator");
    const res = await getStatus(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status.state).toBe("SIMULATED");
    expect(body.status.mode).toBe("simulator");
  });

  it("GET /api/ring/devices returns discovered devices list", async () => {
    const req = new NextRequest("http://localhost:3000/api/ring/devices?mode=simulator");
    const res = await getDevices(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.devices)).toBe(true);
    expect(body.count).toBeGreaterThan(0);
    expect(body.devices[0].name).toBeDefined();
    expect(body.devices[0].capabilities).toBeDefined();
  });

  it("GET /api/ring/events returns recent observations", async () => {
    const req = new NextRequest("http://localhost:3000/api/ring/events?mode=simulator&limit=5");
    const res = await getEvents(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("GET /api/ring/snapshot retrieves visual image evidence", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/ring/snapshot?deviceId=sim_device_front_ramp&mode=simulator"
    );
    const res = await getSnapshot(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.imageEvidence).toBeDefined();
    expect(body.imageEvidence.deviceId).toBe("sim_device_front_ramp");
    expect(body.imageEvidence.isSimulated).toBe(true);
  });

  it("POST /api/ring/simulate controls simulator connection and triggers events", async () => {
    // 1. Trigger motion event
    const motionReq = new NextRequest("http://localhost:3000/api/ring/simulate", {
      method: "POST",
      body: JSON.stringify({
        action: "MOTION_EVENT",
        summary: "API Test motion observed",
      }),
    });
    const motionRes = await handleSimulate(motionReq);
    const motionBody = await motionRes.json();
    expect(motionRes.status).toBe(200);
    expect(motionBody.success).toBe(true);
    expect(motionBody.event.eventType).toBe("motion");

    // 2. Disconnect simulator
    const discReq = new NextRequest("http://localhost:3000/api/ring/simulate", {
      method: "POST",
      body: JSON.stringify({ action: "DISCONNECTED" }),
    });
    const discRes = await handleSimulate(discReq);
    expect(discRes.status).toBe(200);

    // Verify status reflects DISCONNECTED
    const statusReq = new NextRequest("http://localhost:3000/api/ring/status?mode=simulator");
    const statusRes = await getStatus(statusReq);
    const statusBody = await statusRes.json();
    expect(statusBody.status.state).toBe("ERROR");

    // Reconnect simulator
    const connReq = new NextRequest("http://localhost:3000/api/ring/simulate", {
      method: "POST",
      body: JSON.stringify({ action: "CONNECTED" }),
    });
    await handleSimulate(connReq);
  });

  it("POST /api/ring/webhook accepts valid official Ring v1.1 webhook requests", async () => {
    const officialPayload = {
      meta: {
        version: "1.1",
        time: new Date().toISOString(),
        request_id: "api_route_webhook_test_01",
      },
      data: {
        id: "cam_ent_btn_01",
        type: "button_press",
        attributes: {
          source: "cam_entrance",
        },
      },
    };

    const req = new NextRequest("http://localhost:3000/api/ring/webhook", {
      method: "POST",
      body: JSON.stringify(officialPayload),
    });

    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.status).toBe("accepted");
    expect(body.eventId).toBe("api_route_webhook_test_01");
  });
});
