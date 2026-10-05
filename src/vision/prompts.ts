import { AccessibilityRequirements } from "@/domain/types";

/**
 * System prompt strictly constraining Bedrock's role to environmental evidence analysis.
 *
 * ARCHITECTURAL AND PRIVACY INVARIANTS:
 * - Prohibits facial recognition, identity inference, and demographic profiling.
 * - Prohibits disability inference or medical diagnosis.
 * - Prohibits legal/regulatory compliance certification (e.g. ADA code).
 * - Prohibits state-machine transitions (e.g. VERIFIED_RESTORED).
 */
export function buildSystemPrompt(): string {
  return [
    "You are an environmental evidence analyzer for OpenWay, a real-time accessibility assurance system.",
    "Analyze ONLY camera-observable physical conditions relevant to the entrance shown in the image.",
    "",
    "CRITICAL PRIVACY AND SAFETY INVARIANTS:",
    "1. Do NOT identify people. Ignore faces, clothing, and personal appearance.",
    "2. Do NOT infer disability, medical conditions, or personal characteristics.",
    "3. Do NOT infer age, gender, race, identity, or any protected traits.",
    "4. Do NOT determine legal accessibility compliance, municipal building-code certification, or ADA legality.",
    "5. Do NOT determine or suggest OpenWay application states (such as VERIFIED_RESTORED or INTERRUPTED).",
    "6. When evidence is occluded, dark, blurry, or insufficient, return UNKNOWN. Never guess.",
    "",
    "Your response must be concise, factual, and strictly follow the JSON output schema.",
  ].join("\n");
}

/**
 * Builds user prompt dynamically based on the entrance's configured AccessibilityRequirements.
 */
export function buildUserPrompt(
  requirements: AccessibilityRequirements,
  entranceName = "Configured Entrance"
): string {
  const reqLines: string[] = [];

  if (requirements.pathwayClear) {
    reqLines.push("- pathwayClear: The wheelchair ramp and access route must be visibly free of blockages.");
  }
  if (requirements.obstructionFree) {
    reqLines.push("- obstructionFree: The doorway and threshold must have NO packages, debris, or obstacles present.");
  }
  if (requirements.doorReady) {
    reqLines.push("- doorReady: The doorway and automatic push-plate/handle must appear visually accessible.");
  }

  // Include any custom venue requirements
  for (const [key, val] of Object.entries(requirements)) {
    if (!["pathwayClear", "obstructionFree", "doorReady"].includes(key) && val) {
      reqLines.push(`- ${key}: Configured venue requirement must be observed clear.`);
    }
  }

  return [
    `Analyze the provided Ring camera evidence for: "${entranceName}".`,
    "",
    "Configured Camera-Observable Requirements to verify:",
    ...reqLines,
    "",
    "Determine strictly whether each observable condition is TRUE, FALSE, or UNKNOWN.",
    "- If a physical obstruction (box, bicycle, cart, snow pile) is visible in the access envelope, set obstructionPresent to 'TRUE'.",
    "- If the access pathway is clear and visible, set pathwayClear to 'TRUE' and obstructionPresent to 'FALSE'.",
    "- If the image is too dark, blurry, occluded, or does not show the entrance, set evidenceQuality to 'INSUFFICIENT' and conditions to 'UNKNOWN'.",
    "",
    "Return the observation strictly in the requested structured JSON format.",
  ].join("\n");
}
