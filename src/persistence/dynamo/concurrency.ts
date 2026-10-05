/**
 * DynamoDB Optimistic Concurrency & Versioning Utilities
 */

export class OptimisticLockError extends Error {
  public readonly entityId: string;
  public readonly currentVersion?: number;
  public readonly expectedVersion?: number;

  constructor(message: string, entityId: string, currentVersion?: number, expectedVersion?: number) {
    super(message);
    this.name = "OptimisticLockError";
    this.entityId = entityId;
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Retries an asynchronous operation if it fails with an OptimisticLockError.
 */
export async function withOptimisticRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const maxDelayMs = options.maxDelayMs ?? 500;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await operation();
    } catch (err: unknown) {
      const isLockError =
        err instanceof OptimisticLockError ||
        (typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "ConditionalCheckFailedException");

      if (!isLockError || attempt >= maxAttempts) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 20);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
