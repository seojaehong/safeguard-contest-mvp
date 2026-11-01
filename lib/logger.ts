type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

function isPlainRecord(value: unknown): value is LogContext {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Error);
}

function normalizeContext(context: unknown): LogContext | undefined {
  if (context === undefined) return undefined;
  if (isPlainRecord(context)) return context;
  return { error: context };
}

function serializeContext(context: LogContext | undefined): string {
  if (!context || Object.keys(context).length === 0) return "";
  const plain: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    plain[key] = value instanceof Error ? value.message : value;
  }
  try {
    return ` ${JSON.stringify(plain)}`;
  } catch {
    return " [context serialization failed]";
  }
}

/**
 * 실패 기록용 문맥: 오류 종류만 남기고 메시지 본문은 남기지 않는다
 * (상류·렌더러 오류 문구에 사용자 입력이나 주소가 섞일 수 있다).
 */
export function safeFailureContext(error: unknown): { errorType: string } {
  return { errorType: error instanceof Error ? error.name : typeof error };
}

/**
 * Structured console logger with scope prefix and level gating.
 * Default level: LOG_LEVEL env, else "debug" in dev / "info" in production.
 */
export function createLogger(scope: string, options?: { level?: LogLevel }): Logger {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const level: LogLevel =
    options?.level ??
    (envLevel && envLevel in LEVEL_ORDER ? envLevel : process.env.NODE_ENV === "production" ? "info" : "debug");
  const threshold = LEVEL_ORDER[level];

  function emit(kind: LogLevel, sink: (line: string) => void, message: string, context?: unknown) {
    if (LEVEL_ORDER[kind] < threshold) return;
    sink(`[${scope}] ${message}${serializeContext(normalizeContext(context))}`);
  }

  return {
    debug: (message, context) => emit("debug", (l) => console.log(l), message, context),
    info: (message, context) => emit("info", (l) => console.log(l), message, context),
    warn: (message, context) => emit("warn", (l) => console.warn(l), message, context),
    error: (message, context) => emit("error", (l) => console.error(l), message, context),
  };
}
