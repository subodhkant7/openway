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

function instantiateProvider(mode: string): RingProvider {
  switch (mode.toLowerCase()) {
    case "playground":
      safeLog("info", "Initializing Ring Developer Playground Provider");
      return new RingPlaygroundProvider();

    case "api":
      safeLog("info", "Initializing Ring Partner API Provider");
      return new RingApiProvider();

    case "simulator":
    default:
      safeLog("info", "Initializing Ring Deterministic Simulator Provider");
      return RingSimulatorProvider.getInstance();
  }
}

/**
 * Returns the configured RingProvider based on environment configuration.
 * Prevents client query parameters from escaping simulator mode to live credentials.
 */
export function getRingProvider(modeOverride?: string): RingProvider {
  const envMode = (process.env.OPENWAY_PROVIDER || "simulator").toLowerCase();

  // If no override, return the cached environment provider
  if (!modeOverride) {
    if (!cachedProvider || currentMode !== envMode) {
      currentMode = envMode;
      cachedProvider = instantiateProvider(envMode);
    }
    return cachedProvider;
  }

  // Security Invariant: Public demo cannot be forced into live provider mode via client override
  if (envMode === "simulator" && (modeOverride === "playground" || modeOverride === "api")) {
    safeLog("warn", "Security violation: Attempted simulator escape to live Ring provider rejected.");
    return RingSimulatorProvider.getInstance();
  }

  // Return a fresh provider instance for the requested mode without mutating global cachedProvider
  return instantiateProvider(modeOverride);
}
