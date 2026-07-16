declare module "@/scripts/issue-mcp-token.mjs" {
  type QueryResult<Row> = Promise<{ data: Row; error: null }>;

  export interface IssueMcpTokenClient {
    from(table: "sites"): {
      select(columns: string): {
        eq(column: string, value: string): QueryResult<Array<{
          id: string;
          name: string;
          organization_id: string;
        }>>;
      };
    };
    from(table: "mcp_tokens"): {
      insert(values: Record<string, unknown>): {
        select(columns: string): {
          single(): QueryResult<{ id: string }>;
        };
      };
    };
  }

  interface IssueMcpTokenInput {
    argv: string[];
    env: Record<string, string | undefined>;
    createClient: (
      url: string,
      key: string,
      options: { auth: { persistSession: boolean; autoRefreshToken: boolean } },
    ) => IssueMcpTokenClient;
    createToken?: () => string;
  }

  interface IssuedMcpToken {
    id: string;
    label: string;
    siteName: string;
    token: string;
  }

  export function issueMcpToken(input: IssueMcpTokenInput): Promise<IssuedMcpToken>;
}
