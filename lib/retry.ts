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

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      console.warn(
        `${label} failed. Attempt ${attempt}/${retries + 1}.`,
        error,
      );

      if (attempt > retries) {
        break;
      }

      await wait(delayMs * attempt);
    }
  }

  throw lastError;
}