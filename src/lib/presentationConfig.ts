/**
 * OpenWay Presentation Site — Configuration & Verified Status
 *
 * Single source of truth for the public /presentation route.
 *
 * TRUTHFULNESS RULE:
 * `liveVisionInference.status` must only be set to "OPERATIONAL" after a real
 * image inference request has succeeded through the deployed application path
 * (POST /api/vision/analyze with analyzerType "bedrock" returning a non-error
 * observation). A configured model or a health endpoint reporting
 * "CONFIGURED" is NOT evidence of successful inference.
 *
 * To update after verification, change `status`, `checkedAt`, and `detail`
 * below. Every status surface on the presentation page reads from here.
 */

export const PRESENTATION_LINKS = {
  /** Verified production deployment of the interactive OpenWay console. */
  demo: "https://main.d2qhyx9vstga35.amplifyapp.com/console",
  presentation: "https://main.d2qhyx9vstga35.amplifyapp.com",
  repository: "https://github.com/subodhkant7/openway",
} as const;

export type VerificationStatus = "OPERATIONAL" | "UNAVAILABLE" | "UNCONFIRMED";

export interface ComponentStatus {
  label: string;
  status: VerificationStatus;
  /** ISO date (YYYY-MM-DD) of the last direct verification. */
  checkedAt: string;
  /** Short, factual description of how the status was established. */
  detail: string;
}

export const PLATFORM_STATUS = {
  simulatorWorkflow: {
    label: "Simulator-backed assurance workflow",
    status: "OPERATIONAL",
    checkedAt: "2026-10-12",
    detail:
      "Deployed console runs the full detect → remediate → recheck → verify workflow using simulated Ring events and simulated vision observations.",
  },
  persistence: {
    label: "Amazon DynamoDB workflow state",
    status: "OPERATIONAL",
    checkedAt: "2026-10-12",
    detail: "Production /api/health reports storage provider dynamo, status CONNECTED.",
  },
  liveVisionInference: {
    label: "Live Amazon Bedrock vision inference",
    status: "UNAVAILABLE",
    checkedAt: "2026-10-12",
    detail:
      "A real image request through the deployed /api/vision/analyze path (amazon.nova-lite-v1:0, us-east-1) returned “Error 002: Access to Bedrock models is not allowed for this account”. OpenWay failed closed to UNKNOWN.",
  },
  liveRing: {
    label: "Live Ring Partner API",
    status: "UNCONFIRMED",
    checkedAt: "2026-10-12",
    detail:
      "Integration code is implemented; the deployed environment runs the Ring simulator (health reports SIMULATOR_ACTIVE).",
  },
} as const satisfies Record<string, ComponentStatus>;

export const VISION_MODEL_ID = "amazon.nova-lite-v1:0";
