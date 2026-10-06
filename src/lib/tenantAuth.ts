import { DEMO_IDS } from "@/persistence/bootstrap";

export interface TenantAuthResult {
  allowed: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Tenant Isolation & Authorization Guard
 *
 * In the public demo and hackathon environment:
 * - Public API callers and evaluators are strictly restricted to the demo tenant:
 *   Venue: DEMO_IDS.VENUE_ID ("venue_maple_cafe")
 *   Entrance: DEMO_IDS.ENTRANCE_ID ("entrance_side_accessible")
 * - Requests targeting any other tenant ID or entrance ID are rejected with 403 Forbidden.
 * - This prevents IDOR attacks, cross-tenant data leakage, and unauthorized mutations.
 */
export function validateTenantAccess(params: {
  entranceId?: string | null;
  venueId?: string | null;
  taskId?: string | null;
  authHeader?: string | null;
}): TenantAuthResult {
  // If an entranceId is supplied, it must match the demo entrance
  if (params.entranceId && params.entranceId !== DEMO_IDS.ENTRANCE_ID) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Access denied: Request targets an unauthorized tenant or entrance outside demo sandbox.",
    };
  }

  // If a venueId is supplied, it must match the demo venue
  if (params.venueId && params.venueId !== DEMO_IDS.VENUE_ID) {
    return {
      allowed: false,
      statusCode: 403,
      error: "Access denied: Request targets an unauthorized venue outside demo sandbox.",
    };
  }

  return { allowed: true };
}
