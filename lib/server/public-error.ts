import { randomUUID } from "node:crypto";

type ErrorRecord = Record<string, unknown>;

export type PublicFailure = {
  code: string;
  correlationId: string;
  message: string;
};

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const token = value.trim();
  return token && token.length <= 64 && /^[a-z0-9_.:-]+$/iu.test(token) ? token : undefined;
}

export function safeServerErrorContext(error: unknown): Record<string, string | number> {
  const record = isRecord(error) ? error : null;
  const errorType = error instanceof Error
    ? error.name || "Error"
    : typeof error;
  const errorCode = boundedToken(record?.code);
  const status = typeof record?.status === "number" && Number.isInteger(record.status)
    ? record.status
    : undefined;

  return {
    errorType,
    ...(errorCode ? { errorCode } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function projectPublicFailure(input: {
  scope: string;
  code: string;
  message: string;
  error: unknown;
  context?: Record<string, string | number | boolean | null>;
}): PublicFailure {
  const correlationId = randomUUID();
  console.error(`[${input.scope}] ${input.code}`, {
    correlationId,
    ...safeServerErrorContext(input.error),
    ...input.context,
  });
  return {
    code: input.code,
    correlationId,
    message: input.message,
  };
}
