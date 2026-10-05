import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getVenues } from "@/app/api/venues/route";
import { GET as getEntrances } from "@/app/api/entrances/route";
import { GET as getAssurance } from "@/app/api/entrances/[id]/assurance/route";
import { GET as getTimeline } from "@/app/api/entrances/[id]/timeline/route";
import { POST as createRemediation } from "@/app/api/entrances/[id]/remediation/route";
import { POST as acknowledgeTask } from "@/app/api/remediation/[id]/acknowledge/route";
import { POST as completeTask } from "@/app/api/remediation/[id]/complete/route";
import { POST as evaluateAssessment } from "@/app/api/assessments/route";
import { POST as runScenarioRoute } from "@/app/api/simulator/scenario/route";
import { resetGlobalStorage, getStorageProvider } from "@/persistence";

describe("OpenWay Domain API Endpoints", () => {
  beforeEach(() => {
    resetGlobalStorage();
  });

  it("GET /api/venues returns configured venues", async () => {
    const res = await getVenues();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.venues)).toBe(true);
    expect(body.venues.length).toBeGreaterThanOrEqual(1);
    expect(body.venues[0].name).toBe("Maple Street Cafe");
  });

  it("GET /api/entrances returns list of entrances with camera bindings", async () => {
    const req = new NextRequest("http://localhost:3000/api/entrances");
    const res = await getEntrances(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.entrances)).toBe(true);
    expect(body.entrances.length).toBeGreaterThanOrEqual(1);
    expect(body.entrances[0].cameraBinding.deviceId).toBe("cam_front_entrance");
  });

  it("GET /api/entrances/:id/assurance returns assurance state and requirements", async () => {
    const req = new NextRequest("http://localhost:3000/api/entrances/entrance_side_accessible/assurance");
    const res = await getAssurance(req, { params: { id: "entrance_side_accessible" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.state).toBe("AVAILABLE");
    expect(body.entrance.name).toBe("Side Accessible Entrance");
    expect(body.requirements.pathwayClear).toBe(true);
  });

  it("GET /api/entrances/:id/timeline returns chronological audit trail", async () => {
    const req = new NextRequest("http://localhost:3000/api/entrances/entrance_side_accessible/timeline");
    const res = await getTimeline(req, { params: { id: "entrance_side_accessible" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.timeline)).toBe(true);
    expect(body.timeline.length).toBeGreaterThanOrEqual(1);
  });

  it("Remediation Lifecycle: create -> acknowledge -> complete (strictly transitions to RECHECKING)", async () => {
    // 1. Create task
    const createReq = new NextRequest(
      "http://localhost:3000/api/entrances/entrance_side_accessible/remediation",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Trash can blocking entrance ramp" }),
      }
    );
    const createRes = await createRemediation(createReq, {
      params: { id: "entrance_side_accessible" },
    });
    const createBody = await createRes.json();

    expect(createRes.status).toBe(200);
    expect(createBody.remediationTask.status).toBe("OPEN");
    const taskId = createBody.remediationTask.id;

    // 2. Acknowledge task
    const ackReq = new NextRequest(`http://localhost:3000/api/remediation/${taskId}/acknowledge`, {
      method: "POST",
    });
    const ackRes = await acknowledgeTask(ackReq, { params: { id: taskId } });
    const ackBody = await ackRes.json();

    expect(ackRes.status).toBe(200);
    expect(ackBody.remediationTask.status).toBe("ACKNOWLEDGED");

    // 3. Complete task (MUST move to RECHECKING, NEVER VERIFIED_RESTORED directly!)
    const compReq = new NextRequest(`http://localhost:3000/api/remediation/${taskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ completedBy: "Staff Member Jordan" }),
    });
    const compRes = await completeTask(compReq, { params: { id: taskId } });
    const compBody = await compRes.json();

    expect(compRes.status).toBe(200);
    expect(compBody.remediationTask.status).toBe("COMPLETED");
    expect(compBody.assessment.state).toBe("RECHECKING");
    expect(compBody.verificationPending).toBe(true);
  });

  it("POST /api/assessments evaluates fresh evidence and rejects wrong camera", async () => {
    const now = new Date().toISOString();

    // 1. Evidence with wrong camera device
    const wrongCameraReq = new NextRequest("http://localhost:3000/api/assessments", {
      method: "POST",
      body: JSON.stringify({
        entranceId: "entrance_side_accessible",
        evidence: {
          deviceId: "cam_unbound_backdoor", // Wrong device
          componentId: "component_video_01",
          capturedAt: now,
          evidenceType: "IMAGE",
          provenance: "OFFICIAL_RING",
          isSimulated: false,
        },
        observations: [
          {
            pathwayClear: "TRUE",
            obstructionPresent: "FALSE",
            doorReady: "TRUE",
          },
        ],
      }),
    });

    const wrongRes = await evaluateAssessment(wrongCameraReq);
    expect(wrongRes.status).toBe(422);
    const wrongBody = await wrongRes.json();
    expect(wrongBody.reasonCode).toBe("WRONG_CAMERA_REJECTED");

    // 2. Evidence with matching camera device
    const matchingReq = new NextRequest("http://localhost:3000/api/assessments", {
      method: "POST",
      body: JSON.stringify({
        entranceId: "entrance_side_accessible",
        evidence: {
          deviceId: "cam_front_entrance", // Matching device
          componentId: "component_video_01",
          capturedAt: now,
          evidenceType: "IMAGE",
          provenance: "OFFICIAL_RING",
          isSimulated: false,
        },
        observations: [
          {
            pathwayClear: "TRUE",
            obstructionPresent: "FALSE",
            doorReady: "TRUE",
          },
        ],
      }),
    });

    const matchingRes = await evaluateAssessment(matchingReq);
    expect(matchingRes.status).toBe(200);
    const matchingBody = await matchingRes.json();
    expect(matchingBody.success).toBe(true);
  });

  it("POST /api/simulator/scenario executes deterministic scenarios", async () => {
    const req = new NextRequest("http://localhost:3000/api/simulator/scenario", {
      method: "POST",
      body: JSON.stringify({
        scenario: "SCENARIO_1_NORMAL",
        entranceId: "entrance_side_accessible",
      }),
    });

    const res = await runScenarioRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.resultingState).toBe("AVAILABLE");
  });
});
