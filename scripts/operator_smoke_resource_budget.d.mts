import type {
  SpawnSyncOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from "node:child_process";

export const DEFAULT_SMOKE_HTTP_TIMEOUT_MS: number;
export const DEFAULT_SMOKE_RESPONSE_MAX_BYTES: number;
export const DEFAULT_SMOKE_PROCESS_TIMEOUT_MS: number;
export const DEFAULT_SMOKE_PROCESS_MAX_BUFFER_BYTES: number;

export class OperatorSmokeBudgetError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export function readBoundedPositiveInteger(
  value: unknown,
  fallback: number,
  bounds?: { min?: number; max?: number },
): number;

export function fetchBufferWithBudget(
  url: string | URL | Request,
  init?: RequestInit,
  options?: {
    timeoutMs?: number;
    maxBytes?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<{ response: Response; buffer: Buffer }>;

export function spawnSyncWithBudget(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
  budget?: { timeoutMs?: number; maxBufferBytes?: number },
): SpawnSyncReturns<string>;

export function spawnSyncWithBudget(
  command: string,
  args: readonly string[],
  options?: SpawnSyncOptions,
  budget?: { timeoutMs?: number; maxBufferBytes?: number },
): SpawnSyncReturns<Buffer>;
