import { RingProvider } from "./RingProvider";
import { RingPlaygroundProvider } from "./RingPlaygroundProvider";
import { RingApiProvider } from "./RingApiProvider";
import { RingSimulatorProvider } from "./RingSimulatorProvider";
import { safeLog } from "./errors";

export * from "./types";
export * from "./errors";
export * from "./validation";
export * from "./RingProvider";
export * from "./RingClient";
export * from "./RingPlaygroundProvider";
export * from "./RingApiProvider";
export * from "./RingSimulatorProvider";
export * from "./webhook";
export * from "./accountLinking";

let cachedProvider: RingProvider | null = null;
let currentMode: string | null = null;

/**
 * Returns the configured RingProvider based on environment configuration or override.
 * Decouples OpenWay application logic from the underlying Ring provider.
 */
export function getRingProvider(modeOverride?: string): RingProvider {
  const mode = (modeOverride || process.env.OPENWAY_PROVIDER || "simulator").toLowerCase();

  // If mode changed or not instantiated, create appropriate provider
  if (!cachedProvider || currentMode !== mode) {
    currentMode = mode;

    switch (mode) {
      case "playground":
        safeLog("info", "Initializing Ring Developer Playground Provider");
        cachedProvider = new RingPlaygroundProvider();
        break;

      case "api":
        safeLog("info", "Initializing Ring Partner API Provider");
        cachedProvider = new RingApiProvider();
        break;

      case "simulator":
      default:
        safeLog("info", "Initializing Ring Deterministic Simulator Provider");
        cachedProvider = RingSimulatorProvider.getInstance();
        break;
    }
  }

  return cachedProvider;
}
