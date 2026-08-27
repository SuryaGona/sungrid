import { logWarn } from "@/lib/logger";

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options?: {
    retries?: number;
    delayMs?: number;
    label?: string;
  },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const delayMs = options?.delayMs ?? 700;
  const label = options?.label ?? "operation";
  const maxAttempts = retries + 1;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const errorContext =
        error instanceof Error
          ? {
              errorName: error.name,
              errorMessage: error.message,
              errorStack: error.stack,
            }
          : {
              errorMessage: String(error),
            };

      logWarn(`${label} failed`, {
        operation: label,
        attempt,
        maxAttempts,
        willRetry: attempt <= retries,
        ...errorContext,
      });

      if (attempt > retries) {
        break;
      }

      await wait(delayMs * attempt);
    }
  }

  throw lastError;
}