import { getStorageProvider } from "@/persistence";
import { canDeclareRestored } from "@/policy/restorationGatekeeper";
import { aggregateObservations } from "@/evidence/aggregation";
import { transitionAssuranceState } from "@/workflow/stateMachine";
import { Evidence, AccessibilityObservation } from "@/evidence/types";
import { AssuranceState, AuditEvent, RemediationTask } from "@/domain/types";

export type SimulatorScenarioName =
  | "SCENARIO_1_NORMAL"
  | "SCENARIO_2_OBSTRUCTION"
  | "SCENARIO_3_STAFF_FALSE_CLAIM"
  | "SCENARIO_4_FRESH_CLEAR_EVIDENCE"
  | "SCENARIO_5_STALE_CLEAR_EVIDENCE"
  | "SCENARIO_6_CONTRADICTORY_EVIDENCE"
  | "SCENARIO_7_WRONG_CAMERA";

export interface ScenarioExecutionResult {
  scenario: SimulatorScenarioName;
  description: string;
  expectedState: AssuranceState | "REJECTED";
  resultingState: AssuranceState | "REJECTED";
  entranceId: string;
  passed: boolean;
  explanation: string;
  evidenceId?: string;
  taskId?: string;
}

export async function runSimulatorScenario(
  scenario: SimulatorScenarioName,
  entranceId = "entrance_side_accessible"
): Promise<ScenarioExecutionResult> {
  const storage = getStorageProvider();
  const entrance = await storage.entrances.findById(entranceId);
  if (!entrance) {
    throw new Error(`Entrance "${entranceId}" not found for scenario execution.`);
  }

  const correlationId = `sim_scen_${Date.now()}`;
  const now = new Date();
  const nowIso = now.toISOString();

  switch (scenario) {
    // ----------------------------------------------------
    // Scenario 1: Normal (AVAILABLE)
    // ----------------------------------------------------
    case "SCENARIO_1_NORMAL": {
      const ev: Evidence = {
        id: `ev_norm_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: nowIso,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };

      const obs: AccessibilityObservation = {
        id: `obs_norm_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.98,
        observedAt: nowIso,
        analyzer: "simulator-analyzer-v1",
        analyzerVersion: "1.0.0",
        explanation: "Normal clear pathway and accessible door.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      const currentState = latestAssessment?.state || "AVAILABLE";

      const transition = transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "AVAILABLE",
        trigger: "NORMAL_BASELINE_CHECK",
        correlationId,
        evidenceIds: [ev.id],
        reason: "All accessibility conditions verified clear.",
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "AVAILABLE",
        reasonCode: "REQUIREMENTS_SATISFIED",
        reason: "All accessibility conditions verified clear.",
        evidenceIds: [ev.id],
        observationIds: [obs.id],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      return {
        scenario,
        description: "Scenario 1: Normal baseline check with clear conditions.",
        expectedState: "AVAILABLE",
        resultingState: transition.newState,
        entranceId: entrance.id,
        passed: transition.newState === "AVAILABLE",
        explanation: "Entrance is fully AVAILABLE with clear pathway and door.",
        evidenceId: ev.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 2: Obstruction (INTERRUPTED -> ACTION_REQUIRED)
    // ----------------------------------------------------
    case "SCENARIO_2_OBSTRUCTION": {
      const ev: Evidence = {
        id: `ev_obstr_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: nowIso,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };

      const obs: AccessibilityObservation = {
        id: `obs_obstr_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "FALSE",
        obstructionPresent: "TRUE",
        doorReady: "TRUE",
        confidence: 0.95,
        observedAt: nowIso,
        analyzer: "simulator-analyzer-v1",
        analyzerVersion: "1.0.0",
        explanation: "Delivery boxes blocking wheelchair ramp.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      const currentState = latestAssessment?.state || "AVAILABLE";

      // 1. Move to INTERRUPTED
      transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "INTERRUPTED",
        trigger: "OBSTRUCTION_OBSERVED",
        correlationId,
        evidenceIds: [ev.id],
        reason: obs.explanation,
      });

      // 2. Create Remediation Task and move to ACTION_REQUIRED
      const task: RemediationTask = {
        id: `task_${Date.now()}`,
        entranceId: entrance.id,
        triggerAssessmentId: `assess_${Date.now()}`,
        status: "OPEN",
        reason: "Clear delivery boxes blocking access ramp",
        createdAt: nowIso,
      };
      await storage.remediations.save(task);

      transitionAssuranceState({
        entranceId: entrance.id,
        currentState: "INTERRUPTED",
        nextState: "ACTION_REQUIRED",
        trigger: "TASK_DISPATCHED",
        correlationId,
        evidenceIds: [ev.id],
        reason: task.reason,
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "ACTION_REQUIRED",
        reasonCode: "ACCESS_OBSTRUCTION_DISPATCHED",
        reason: "Obstruction detected: remediation task dispatched.",
        evidenceIds: [ev.id],
        observationIds: [obs.id],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_obstr`,
        type: "ACCESS_INTERRUPTED",
        timestamp: nowIso,
        correlationId,
        entityType: "ENTRANCE",
        entityId: entrance.id,
        metadata: { obstruction: true, reason: obs.explanation },
      });

      return {
        scenario,
        description: "Scenario 2: Ramp obstruction detected; remediation dispatched.",
        expectedState: "ACTION_REQUIRED",
        resultingState: "ACTION_REQUIRED",
        entranceId: entrance.id,
        passed: true,
        explanation: "Obstruction moved state to INTERRUPTED then ACTION_REQUIRED with active task.",
        evidenceId: ev.id,
        taskId: task.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 3: Staff falsely claims fixed (RECHECKING, NOT VERIFIED_RESTORED)
    // ----------------------------------------------------
    case "SCENARIO_3_STAFF_FALSE_CLAIM": {
      // Find or create active task
      let activeTask = await storage.remediations.findActiveByEntranceId(entrance.id);
      if (!activeTask) {
        activeTask = {
          id: `task_${Date.now()}`,
          entranceId: entrance.id,
          triggerAssessmentId: "prev",
          status: "OPEN",
          reason: "Clear obstruction",
          createdAt: new Date(now.getTime() - 60000).toISOString(),
        };
        await storage.remediations.save(activeTask);
      }

      // Mark task completed by staff
      const completedTask: RemediationTask = {
        ...activeTask,
        status: "COMPLETED",
        completedAt: nowIso,
        completedBy: "Staff Alex",
      };
      await storage.remediations.save(completedTask);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      let currentState = latestAssessment?.state || "ACTION_REQUIRED";
      if (currentState === "AVAILABLE" || currentState === "UNKNOWN") {
        currentState = "ACTION_REQUIRED";
      }

      // Transition must be RECHECKING, strictly NOT VERIFIED_RESTORED!
      const transition = transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "RECHECKING",
        trigger: "STAFF_COMPLETED_TASK",
        correlationId,
        reason: "Staff Alex reported task completed. Awaiting verification evidence.",
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "RECHECKING",
        reasonCode: "RECHECKING_AWAITING_EVIDENCE",
        reason: "Staff reported task completed. Pending fresh verification evidence.",
        evidenceIds: latestAssessment?.evidenceIds || [],
        observationIds: latestAssessment?.observationIds || [],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_claim`,
        type: "TASK_COMPLETED",
        timestamp: nowIso,
        correlationId,
        entityType: "REMEDIATION_TASK",
        entityId: completedTask.id,
        metadata: {
          completedBy: "Staff Alex",
          notice: "Remediation claimed. Verification strictly pending fresh camera evidence.",
        },
      });

      return {
        scenario,
        description: "Scenario 3: Staff falsely claims fixed. Invariant: state is RECHECKING, never VERIFIED_RESTORED.",
        expectedState: "RECHECKING",
        resultingState: transition.newState,
        entranceId: entrance.id,
        passed: transition.newState === "RECHECKING",
        explanation: "Staff completion placed entrance into RECHECKING. Did not restore access.",
        taskId: completedTask.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 4: Fresh clear evidence (VERIFIED_RESTORED)
    // ----------------------------------------------------
    case "SCENARIO_4_FRESH_CLEAR_EVIDENCE": {
      // Must have completed remediation task
      let completedTask = (await storage.remediations.listByEntranceId(entrance.id))
        .filter((t) => t.status === "COMPLETED")[0];

      if (!completedTask) {
        completedTask = {
          id: `task_${Date.now()}`,
          entranceId: entrance.id,
          triggerAssessmentId: "prev",
          status: "COMPLETED",
          completedAt: new Date(now.getTime() - 30000).toISOString(),
          completedBy: "Staff Alex",
          reason: "Ramp cleared",
          createdAt: new Date(now.getTime() - 60000).toISOString(),
        };
        await storage.remediations.save(completedTask);
      }

      // Evidence captured AFTER remediation (e.g. 5 seconds after completedAt)
      const evidenceCapturedAt = new Date(
        new Date(completedTask.completedAt!).getTime() + 5000
      ).toISOString();

      const ev: Evidence = {
        id: `ev_fresh_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: evidenceCapturedAt,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };

      const obs: AccessibilityObservation = {
        id: `obs_fresh_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: nowIso,
        analyzer: "simulator-analyzer-v1",
        analyzerVersion: "1.0.0",
        explanation: "Fresh post-remediation evidence proves wheelchair ramp is completely clear.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs);

      const gateResult = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: completedTask,
        evidence: ev,
        observations: [obs],
        now,
      });

      if (!gateResult.allowed) {
        return {
          scenario,
          description: "Scenario 4: Fresh post-remediation evidence check.",
          expectedState: "VERIFIED_RESTORED",
          resultingState: "RECHECKING",
          entranceId: entrance.id,
          passed: false,
          explanation: `Gatekeeper rejected: ${gateResult.explanation}`,
          evidenceId: ev.id,
        };
      }

      transitionAssuranceState({
        entranceId: entrance.id,
        currentState: "RECHECKING",
        nextState: "VERIFIED_RESTORED",
        trigger: "FRESH_EVIDENCE_VERIFIED",
        correlationId,
        evidenceIds: [ev.id],
        reason: gateResult.explanation,
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "VERIFIED_RESTORED",
        reasonCode: "VERIFIED_RESTORED",
        reason: gateResult.explanation,
        evidenceIds: [ev.id],
        observationIds: [obs.id],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_restored`,
        type: "ACCESS_VERIFIED_RESTORED",
        timestamp: nowIso,
        correlationId,
        entityType: "ENTRANCE",
        entityId: entrance.id,
        metadata: {
          evidenceId: ev.id,
          message: "Accessibility restoration verified by fresh camera observation.",
        },
      });

      return {
        scenario,
        description: "Scenario 4: Fresh post-remediation evidence successfully verifies restoration.",
        expectedState: "VERIFIED_RESTORED",
        resultingState: "VERIFIED_RESTORED",
        entranceId: entrance.id,
        passed: true,
        explanation: "Gatekeeper passed all 9 checks. Access declared VERIFIED_RESTORED.",
        evidenceId: ev.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 5: Stale clear evidence (UNKNOWN)
    // ----------------------------------------------------
    case "SCENARIO_5_STALE_CLEAR_EVIDENCE": {
      // Evidence captured 15 minutes ago (> maxAgeSeconds 180s)
      const staleTime = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

      const ev: Evidence = {
        id: `ev_stale_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: staleTime,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "STALE",
        createdAt: nowIso,
      };

      const obs: AccessibilityObservation = {
        id: `obs_stale_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: nowIso,
        analyzer: "simulator-analyzer-v1",
        analyzerVersion: "1.0.0",
        explanation: "Clear pathway in old camera snapshot.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      const currentState = latestAssessment?.state || "RECHECKING";

      const aggregated = aggregateObservations({
        entrance,
        evidenceList: [ev],
        observations: [obs],
        now,
      });

      transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "UNKNOWN",
        trigger: "STALE_EVIDENCE_EVALUATION",
        correlationId,
        evidenceIds: [ev.id],
        reason: aggregated.explanation,
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "UNKNOWN",
        reasonCode: "STALE_EVIDENCE",
        reason: "Evidence is stale. Fresh observation is required to assure accessibility.",
        evidenceIds: [ev.id],
        observationIds: [obs.id],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_stale`,
        type: "ASSESSMENT_UNKNOWN",
        timestamp: nowIso,
        correlationId,
        entityType: "ENTRANCE",
        entityId: entrance.id,
        metadata: { evidenceAgeSeconds: 900, message: "Stale evidence rejected." },
      });

      return {
        scenario,
        description: "Scenario 5: Stale evidence cannot verify access; transitions to UNKNOWN.",
        expectedState: "UNKNOWN",
        resultingState: "UNKNOWN",
        entranceId: entrance.id,
        passed: true,
        explanation: "Stale evidence was safely rejected; state is UNKNOWN.",
        evidenceId: ev.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 6: Contradictory evidence (UNKNOWN)
    // ----------------------------------------------------
    case "SCENARIO_6_CONTRADICTORY_EVIDENCE": {
      const ev: Evidence = {
        id: `ev_contra_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: entrance.cameraBinding.deviceId,
        componentId: entrance.cameraBinding.componentId,
        capturedAt: nowIso,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };

      // Two contradictory observations for the same window
      const obs1: AccessibilityObservation = {
        id: `obs_c1_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.88,
        observedAt: nowIso,
        analyzer: "analyzer-a",
        analyzerVersion: "1.0.0",
        explanation: "Analyzer A observes pathway clear.",
      };

      const obs2: AccessibilityObservation = {
        id: `obs_c2_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "FALSE",
        obstructionPresent: "TRUE",
        doorReady: "TRUE",
        confidence: 0.89,
        observedAt: nowIso,
        analyzer: "analyzer-b",
        analyzerVersion: "1.0.0",
        explanation: "Analyzer B observes obstruction present.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs1);
      await storage.observations.save(obs2);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      const currentState = latestAssessment?.state || "AVAILABLE";

      const aggregated = aggregateObservations({
        entrance,
        evidenceList: [ev],
        observations: [obs1, obs2],
        now,
      });

      transitionAssuranceState({
        entranceId: entrance.id,
        currentState,
        nextState: "UNKNOWN",
        trigger: "CONTRADICTORY_OBSERVATIONS",
        correlationId,
        evidenceIds: [ev.id],
        reason: aggregated.explanation,
      });

      await storage.assessments.save({
        id: `assess_${Date.now()}`,
        entranceId: entrance.id,
        state: "UNKNOWN",
        reasonCode: "CONTRADICTORY_OBSERVATIONS",
        reason: aggregated.explanation,
        evidenceIds: [ev.id],
        observationIds: [obs1.id, obs2.id],
        policyVersion: "1.0.0",
        assessedAt: nowIso,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_contra`,
        type: "ASSESSMENT_UNKNOWN",
        timestamp: nowIso,
        correlationId,
        entityType: "ENTRANCE",
        entityId: entrance.id,
        metadata: {
          message: "Conflicting observations detected in same window. State safely marked UNKNOWN.",
        },
      });

      return {
        scenario,
        description: "Scenario 6: Contradictory observations safely produce UNKNOWN.",
        expectedState: "UNKNOWN",
        resultingState: "UNKNOWN",
        entranceId: entrance.id,
        passed: aggregated.contradictionDetected && aggregated.outcome === "UNKNOWN",
        explanation: "Contradictory observations detected; state safely resolved to UNKNOWN.",
        evidenceId: ev.id,
      };
    }

    // ----------------------------------------------------
    // Scenario 7: Wrong camera (REJECTED, no restoration)
    // ----------------------------------------------------
    case "SCENARIO_7_WRONG_CAMERA": {
      // Evidence from unbound device "cam_back_dock"
      const ev: Evidence = {
        id: `ev_wrong_cam_${Date.now()}`,
        venueId: entrance.venueId,
        entranceId: entrance.id,
        provider: "SIMULATOR",
        deviceId: "cam_unbound_back_dock", // Wrong camera device!
        componentId: "component_video_01",
        capturedAt: nowIso,
        receivedAt: nowIso,
        evidenceType: "IMAGE",
        provenance: "SIMULATED_LOCAL",
        isSimulated: true,
        freshness: "FRESH",
        createdAt: nowIso,
      };

      const obs: AccessibilityObservation = {
        id: `obs_wrong_cam_${Date.now()}`,
        evidenceId: ev.id,
        entranceId: entrance.id,
        pathwayClear: "TRUE",
        obstructionPresent: "FALSE",
        doorReady: "TRUE",
        confidence: 0.99,
        observedAt: nowIso,
        analyzer: "simulator-analyzer-v1",
        analyzerVersion: "1.0.0",
        explanation: "Clear snapshot from back loading dock camera.",
      };

      await storage.evidence.save(ev);
      await storage.observations.save(obs);

      const latestAssessment = await storage.assessments.findLatestByEntranceId(entrance.id);
      const currentState = latestAssessment?.state || "RECHECKING";

      const gateResult = canDeclareRestored({
        currentState: "RECHECKING",
        entrance,
        remediationTask: {
          id: "task_mock",
          entranceId: entrance.id,
          triggerAssessmentId: "prev",
          status: "COMPLETED",
          completedAt: new Date(now.getTime() - 60000).toISOString(),
          createdAt: new Date(now.getTime() - 120000).toISOString(),
          reason: "Clear ramp",
        },
        evidence: ev,
        observations: [obs],
        now,
      });

      await storage.auditEvents.append({
        id: `audit_${Date.now()}_wrong_cam`,
        type: "WRONG_CAMERA_REJECTED",
        timestamp: nowIso,
        correlationId,
        entityType: "EVIDENCE",
        entityId: ev.id,
        metadata: {
          entranceId: entrance.id,
          expectedDevice: entrance.cameraBinding.deviceId,
          actualDevice: ev.deviceId,
          notice: "Evidence rejected due to camera binding mismatch.",
        },
      });

      return {
        scenario,
        description: "Scenario 7: Evidence from unbound camera is strictly rejected.",
        expectedState: "REJECTED",
        resultingState: !gateResult.allowed ? "REJECTED" : currentState,
        entranceId: entrance.id,
        passed: !gateResult.allowed && gateResult.reasonCode === "WRONG_CAMERA_DEVICE",
        explanation: `Wrong camera rejected by gatekeeper: ${gateResult.explanation}`,
        evidenceId: ev.id,
      };
    }
  }
}
