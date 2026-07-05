export const MCP_ENDPOINT_URL = "https://www.safeclaw.kr/api/mcp/mcp";

export function buildOpenClawInstallCommand(token: string): string {
  return [
    "openclaw --profile safeclaw mcp add safeclaw",
    `--url ${MCP_ENDPOINT_URL}`,
    "--transport streamable-http",
    `--header "Authorization=Bearer ${token}"`,
  ].join(" ");
}

export function buildOpenClawProbeCommand(): string {
  return "openclaw --profile safeclaw mcp probe safeclaw";
}

