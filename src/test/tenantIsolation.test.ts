import { describe, it, expect, beforeEach } from "vitest";
import { resetGlobalStorage, getStorageProvider } from "@/persistence";
import { bootstrapStorage, DEMO_IDS } from "@/persistence/bootstrap";
import { NextRequest } from "next/server";

// Import Next.js route handlers
import { GET as getAssurance } from "@/app/api/entrances/[id]/assurance/route";
import { GET as getTimeline } from "@/app/api/entrances/[id]/timeline/route";
import { POST as createRemediation } from "@/app/api/entrances/[id]/remediation/route";
import { POST as completeRemediation } from "@/app/api/remediation/[id]/complete/route";
import { POST as acknowledgeRemediation } from "@/app/api/remediation/[id]/acknowledge/route";
import { POST as verifyRemediation } from "@/app/api/remediation/[id]/verify/route";
import { POST as resetDemo } from "@/app/api/demo/reset/route";
import { POST as scenarioDemo } from "@/app/api/simulator/scenario/route";
import { POST as analyzeVision } from "@/app/api/vision/analyze/route";

describe("Tenant Isolation & IDOR Protection", () => {
  beforeEach(async () => {
    resetGlobalStorage();
    await bootstrapStorage();

    // Create a mock second tenant in storage to test cross-tenant protection
    const storage = getStorageProvider();
    await storage.venues.save({
      id: "venue_private_bank",
      name: "Private Bank Vault",
      timezone: "America/New_York",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await storage.entrances.save({
      id: "entrance_vault_01",
      venueId: "venue_private_bank",
      name: "High Security Vault Entrance",
      description: "Vault entrance ramp",
      enabled: true,
      cameraBinding: {
        deviceId: "cam_vault_secret",
        componentId: "component_video_01",
        deviceName: "Vault Security Cam",
      },
      requirements: {
        pathwayClear: true,
        obstructionFree: true,
        doorReady: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await storage.remediations.save({
      id: "task_private_tenant_999",
      entranceId: "entrance_vault_01",
      triggerAssessmentId: "init",
      status: "OPEN",
      reason: "Confidential vault door inspection",
      createdAt: new Date().toISOString(),
    });
  });

  describe("Read IDOR Defenses", () => {
    it("rejects GET /api/entrances/[id]/assurance for unauthorized tenant with 403 Forbidden", async () => {
      const req = new Request("http://localhost:3000/api/entrances/entrance_vault_01/assurance");
      const res = await getAssurance(req, { params: { id: "entrance_vault_01" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });

    it("allows GET /api/entrances/[id]/assurance for demo tenant", async () => {
      const req = new Request(`http://localhost:3000/api/entrances/${DEMO_IDS.ENTRANCE_ID}/assurance`);
      const res = await getAssurance(req, { params: { id: DEMO_IDS.ENTRANCE_ID } });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entrance.id).toBe(DEMO_IDS.ENTRANCE_ID);
    });

    it("rejects GET /api/entrances/[id]/timeline for unauthorized tenant with 403 Forbidden", async () => {
      const req = new Request("http://localhost:3000/api/entrances/entrance_vault_01/timeline");
      const res = await getTimeline(req, { params: { id: "entrance_vault_01" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });
  });

  describe("Mutation IDOR Defenses", () => {
    it("rejects POST /api/entrances/[id]/remediation for unauthorized tenant with 403 Forbidden", async () => {
      const req = new Request("http://localhost:3000/api/entrances/entrance_vault_01/remediation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Unauthorized attempt to create task" }),
      });
      const res = await createRemediation(req, { params: { id: "entrance_vault_01" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });

    it("rejects POST /api/remediation/[id]/complete for task belonging to another tenant with 403", async () => {
      const req = new Request("http://localhost:3000/api/remediation/task_private_tenant_999/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy: "Malicious Actor" }),
      });
      const res = await completeRemediation(req, { params: { id: "task_private_tenant_999" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });

    it("rejects POST /api/remediation/[id]/acknowledge for task belonging to another tenant with 403", async () => {
      const req = new Request("http://localhost:3000/api/remediation/task_private_tenant_999/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const res = await acknowledgeRemediation(req, { params: { id: "task_private_tenant_999" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });

    it("rejects POST /api/remediation/[id]/verify for task belonging to another tenant with 403", async () => {
      const req = new Request("http://localhost:3000/api/remediation/task_private_tenant_999/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const res = await verifyRemediation(req, { params: { id: "task_private_tenant_999" } });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Access denied");
    });
  });

  describe("Demo Isolation Bounds", () => {
    it("rejects POST /api/demo/reset when attempting to target a non-demo entrance with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entranceId: "entrance_vault_01" }),
      });
      const res = await resetDemo(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("isolated demo entrance");
    });

    it("rejects POST /api/simulator/scenario when targeting another tenant entrance with 403", async () => {
      const req = new Request("http://localhost:3000/api/simulator/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: "RUN_PREEMPTIVE_OBSTRUCTION",
          entranceId: "entrance_vault_01",
        }),
      });
      const res = await scenarioDemo(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("restricted to the demo tenant");
    });

    it("rejects POST /api/vision/analyze when targeting another tenant entrance with 403", async () => {
      const req = new Request("http://localhost:3000/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entranceId: "entrance_vault_01",
          analyzerType: "simulator",
        }),
      });
      const res = await analyzeVision(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("public demo sandbox");
    });
  });
});
