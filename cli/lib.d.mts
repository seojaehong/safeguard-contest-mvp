// Minimal ambient type declarations for cli/lib.mjs so the root `tsc --noEmit`
// (which covers **/*.ts project-wide) can typecheck tests/cli.test.ts without
// pulling the CLI into a TS build pipeline. The CLI itself stays plain ESM
// JS (see cli/CLAUDE.md-equivalent note in docs/cli.md) — this file is test
// support only, not a compiled artifact.

export class CliError extends Error {
  code: string;
  exitCode: number;
  constructor(message: string, code?: string, exitCode?: number);
}

export const DEFAULT_BASE: string;
export const MCP_PATH: string;
export const COMMANDS: string[];
export const HELP_TEXT: string;
export const VERSION: string;

export function parseArgs(argv: string[]): {
  help?: boolean;
  version?: boolean;
  command: string | null;
  options?: Record<string, unknown>;
  positional?: string[];
};

export function validateDocpackArgs(input: {
  positional: string[];
  options: Record<string, unknown>;
}): { question: string; mode: string; json: boolean };

export function validateWeatherArgs(input: {
  positional: string[];
  options: Record<string, unknown>;
}): { region: string };

export function validateValidateArgs(input: {
  positional: string[];
  options: Record<string, unknown>;
}): { source: string };

export function validateCasesArgs(input: {
  positional: string[];
  options: Record<string, unknown>;
}): { keyword: string };

export function validateEvidenceArgs(input: {
  positional: string[];
  options: Record<string, unknown>;
}): { docType?: string };

export function resolveConfig(env: Record<string, string | undefined>): {
  token: string;
  base: string;
};

export function parseSseMessages(bodyText: string): Array<Record<string, unknown>>;

export function buildToolCallRequest(
  id: number,
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown>;

export function callTool(input: {
  base: string;
  token: string;
  tool: string;
  args: Record<string, unknown>;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<{ data: unknown; isError: boolean }>;

export function formatDocpack(data: any): string;
export function formatWeather(data: any): string;
export function formatValidate(data: any): string;
export function formatCases(data: any): string;
export function formatEvidence(data: any): string;
export function validateExitCode(data: { removedCitations?: string[]; [key: string]: unknown }): number;
