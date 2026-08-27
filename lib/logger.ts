import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function serializeLog(entry: Record<string, unknown>) {
  return JSON.stringify(entry, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function logInfo(message: string, context: LogContext = {}) {
  console.info(
    serializeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      ...context,
    }),
  );
}

export function logWarn(message: string, context: LogContext = {}) {
  console.warn(
    serializeLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      ...context,
    }),
  );
}

export function logError(
  message: string,
  error: unknown,
  context: LogContext = {},
) {
  const capturedError =
    error instanceof Error ? error : new Error(String(error));

  let sentryEventId: string | undefined;

  Sentry.withScope((scope) => {
    scope.setExtra("logMessage", message);

    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }

    sentryEventId = Sentry.captureException(capturedError);
  });

  console.error(
    serializeLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      sentryEventId,
      ...context,
      error: serializeError(error),
    }),
  );

  return sentryEventId;
}