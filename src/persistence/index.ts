import { StorageProvider } from "./repositories";
import { InMemoryStorageProvider } from "./memoryStore";
import { DynamoStorageProvider } from "./dynamo/DynamoStorageProvider";

export * from "./repositories";
export * from "./memoryStore";
export * from "./dynamo";

// Global singleton instance for application runtime
let globalStorage: StorageProvider | null = null;

export function getStorageProvider(preferredType?: "memory" | "dynamo"): StorageProvider {
  if (globalStorage && !preferredType) {
    return globalStorage;
  }

  const storageType =
    preferredType ||
    (process.env.OPENWAY_STORAGE === "dynamo" ? "dynamo" : "memory");

  if (storageType === "dynamo") {
    globalStorage = new DynamoStorageProvider();
  } else {
    if (!globalStorage || !(globalStorage instanceof InMemoryStorageProvider)) {
      globalStorage = new InMemoryStorageProvider();
    }
  }

  return globalStorage;
}

export function resetGlobalStorage(): void {
  if (globalStorage instanceof InMemoryStorageProvider) {
    globalStorage.reset();
  } else {
    globalStorage = new InMemoryStorageProvider();
  }
}
