import { StorageProvider } from "./repositories";
import { InMemoryStorageProvider } from "./memoryStore";

export * from "./repositories";
export * from "./memoryStore";

// Global singleton instance for application runtime
let globalStorage: InMemoryStorageProvider | null = null;

export function getStorageProvider(): InMemoryStorageProvider {
  if (!globalStorage) {
    globalStorage = new InMemoryStorageProvider();
  }
  return globalStorage;
}

export function resetGlobalStorage(): void {
  if (globalStorage) {
    globalStorage.reset();
  } else {
    globalStorage = new InMemoryStorageProvider();
  }
}
