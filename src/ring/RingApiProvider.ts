import { RingProvider } from "./RingProvider";
import { RingClient } from "./RingClient";
import { RingPlaygroundProvider } from "./RingPlaygroundProvider";
import { RingProviderStatus } from "./types";

/**
 * RingApiProvider
 * Production Partner API implementation (OAuth 2.0 / full Amazon Vision API).
 * Inherits core device normalization from RingPlaygroundProvider with production-grade API conventions.
 */
export class RingApiProvider extends RingPlaygroundProvider implements RingProvider {
  constructor(client?: RingClient) {
    super(client);
  }

  public override async getProviderStatus(): Promise<RingProviderStatus> {
    const status = await super.getProviderStatus();
    return {
      ...status,
      mode: "api",
      details: status.isConfigured
        ? `Connected to official Ring Partner API (${status.baseUrl})`
        : "Production Ring Partner API credentials (OAuth / Access Token) not configured.",
    };
  }
}
