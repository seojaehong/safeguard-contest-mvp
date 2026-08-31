declare module "@/scripts/lib/credential-output.mjs" {
  interface WritableStreamLike {
    isTTY?: boolean;
    write(chunk: string): unknown;
  }

  export type CredentialOutput =
    | { mode: "reveal" }
    | { mode: "file"; outputPath: string };

  interface PrepareCredentialOutputInput {
    argv: string[];
    startIndex: number;
    commandUsage: string;
    stdout?: WritableStreamLike;
    platform?: NodeJS.Platform;
    inspectPath?: (path: string) => Promise<unknown>;
    inspectParent?: (path: string) => Promise<{ isDirectory(): boolean }>;
  }

  interface EmitCredentialInput {
    secret: string;
    output: CredentialOutput;
    stdout?: WritableStreamLike;
    stderr?: WritableStreamLike;
    writeSecretFile?: (
      path: string,
      contents: string,
      options: { encoding: "utf8"; flag: "wx"; mode: number },
    ) => Promise<void>;
    setMode?: (path: string, mode: number) => Promise<void>;
    inspectWrittenFile?: (path: string) => Promise<{ mode: number }>;
  }

  export function prepareCredentialOutput(input: PrepareCredentialOutputInput): Promise<CredentialOutput>;
  export function emitCredential(input: EmitCredentialInput): Promise<{
    mode: "reveal" | "file";
    outputPath: string | null;
  }>;
}

declare module "@/scripts/issue_supabase_auth_token.mjs" {
  interface SupabaseAuthTokenClient {
    auth: {
      signInWithPassword(credentials: { email: string; password: string }): Promise<{
        data: { session: { access_token: string } | null };
        error: { message: string } | null;
      }>;
    };
  }

  interface IssueSupabaseAuthTokenInput {
    env: Record<string, string | undefined>;
    createClient: (
      url: string,
      key: string,
      options: { auth: { persistSession: boolean; autoRefreshToken: boolean } },
    ) => SupabaseAuthTokenClient;
  }

  export function issueSupabaseAuthToken(input: IssueSupabaseAuthTokenInput): Promise<{
    accessToken: string;
    email: string;
  }>;
}
