type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  const payload = context ? { message, ...context } : { message };
  console[level](`[server] ${level}`, payload);
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
