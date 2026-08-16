declare module "@/scripts/final_99_gate_contract.mjs" {
  export const requiredDeliverables: readonly string[];
  export const coreDocumentChecks: readonly Array<{
    id: string;
    key: string;
    requiredTerms: readonly string[];
    routeTitle: string;
    title: string;
  }>;

  export function resolveExecutionMode(
    argv?: readonly string[],
    env?: Readonly<Record<string, string | undefined>>,
  ): "no-mutation" | "standard";

  export function shouldSkipAuthHistoryWrites(
    authToken: string | undefined,
    mode?: "no-mutation" | "standard",
  ): boolean;

  export function resolveDocsDir(
    env?: Readonly<Record<string, string | undefined>>,
    cwd?: string,
  ): string;

  export function resolveAskAiMode(
    mode?: "no-mutation" | "standard",
    env?: Readonly<Record<string, string | undefined>>,
  ): "template" | "enhanced" | "full" | undefined;
}
