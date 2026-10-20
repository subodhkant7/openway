import { RingProvider } from "./RingProvider";
import { RingClient } from "./RingClient";
import { RingPlaygroundProvider } from "./RingPlaygroundProvider";
import { RingProviderStatus } from "./types";
import { RingAccountLinkingService } from "./accountLinking";
import { RingProviderError } from "./errors";
import { DEMO_IDS } from "@/persistence/bootstrap";

export interface RingApiProviderOptions {
  client?: RingClient;
  partnerUserId?: string;
  venueId?: string;
  linkingService?: RingAccountLinkingService;
}

/**
 * RingApiProvider
 * Production Partner API implementation (OAuth 2.0 / full Amazon Vision API).
 * Scopes authenticated operations to user/venue credentials with automated token refresh.
 */
export class RingApiProvider extends RingPlaygroundProvider implements RingProvider {
  private linkingService: RingAccountLinkingService;
  private targetId: string;

  constructor(options?: RingApiProviderOptions | RingClient) {
    const isClient = options instanceof RingClient;
    const opts = isClient ? { client: options } : (options as RingApiProviderOptions | undefined);

    const linkingService = opts?.linkingService || new RingAccountLinkingService();
    const targetId = opts?.partnerUserId || opts?.venueId || DEMO_IDS.VENUE_ID;

    // Build client with user-scoped dynamic access token provider if client not explicitly supplied
    let client = opts?.client;
    if (!client) {
      client = new RingClient({
        accessTokenProvider: async () => {
          const res = await linkingService.getValidAccessToken(targetId);
          if (res.status === "VALID" || res.status === "REFRESHED") {
            return res.accessToken!;
          }
          if (res.status === "ACCOUNT_RELINK_REQUIRED") {
            throw new RingProviderError({
              code: "ACCOUNT_RELINK_REQUIRED",
              message: "Ring account authorization expired or revoked. Re-linking required.",
              statusCode: 401,
            });
          }
          // If no linked account exists for this user, do not silently fall back to another user's token
          throw new RingProviderError({
            code: "RING_NOT_LINKED",
            message: `No Ring account is linked for tenant/user ${targetId}. Complete One-Way Account Linking.`,
            statusCode: 404,
          });
        },
      });
    }

    super(client);
    this.linkingService = linkingService;
    this.targetId = targetId;
  }

  public override async getProviderStatus(): Promise<RingProviderStatus> {
    const linkStatus = await this.linkingService.getAccountStatus(this.targetId);
    const baseUrl = this.client.getBaseUrl();
    const now = new Date().toISOString();

    if (linkStatus === "LINKED") {
      try {
        const devices = await this.listDevices();
        return {
          mode: "api",
          state: "CONNECTED",
          isConfigured: true,
          baseUrl,
          lastCheck: now,
          details: `Connected to official Ring Partner API (${baseUrl}) with user-scoped credentials.`,
          activeDeviceCount: devices.filter((d) => d.online).length,
        };
      } catch (err: unknown) {
        const ringErr =
          err instanceof RingProviderError
            ? err
            : new RingProviderError({
                code: "RING_API_ERROR",
                message: (err as Error).message,
              });

        return {
          mode: "api",
          state: ringErr.code === "ACCOUNT_RELINK_REQUIRED" ? "ERROR" : "ERROR",
          isConfigured: true,
          baseUrl,
          lastCheck: now,
          error: ringErr.message,
          details: `Ring API communication error: ${ringErr.message}`,
          activeDeviceCount: 0,
        };
      }
    }

    if (linkStatus === "ACCOUNT_RELINK_REQUIRED") {
      return {
        mode: "api",
        state: "ERROR",
        isConfigured: false,
        baseUrl,
        lastCheck: now,
        error: "Ring authorization expired or revoked.",
        details: "Ring account authorization expired or revoked. Re-linking required at /ring/link.",
        activeDeviceCount: 0,
      };
    }

    // ONBOARDING_REQUIRED: Check if static short-lived token was provided directly to client
    if (this.client.hasToken() && process.env.RING_ACCESS_TOKEN) {
      const superStatus = await super.getProviderStatus();
      return {
        ...superStatus,
        mode: "api",
        details: "Operating in static token mode (unlinked partner account). One-way account linking recommended.",
      };
    }

    return {
      mode: "api",
      state: "NOT_CONFIGURED",
      isConfigured: false,
      baseUrl,
      lastCheck: now,
      details: "Ring account is not linked. Complete One-Way Account Linking at /ring/link.",
      activeDeviceCount: 0,
    };
  }
}
