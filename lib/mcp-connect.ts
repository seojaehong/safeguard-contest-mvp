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

export function buildOpenClawOauthLoginCommand(): string {
  return "openclaw --profile safeclaw models auth login --provider openai --device-code --set-default --force";
}

export function buildOpenClawModelStatusCommand(): string {
  return "openclaw --profile safeclaw models status";
}

export function buildOpenClawHarnessAgentCommand(): string {
  return [
    "openclaw --profile safeclaw agent --agent main --local",
    `-m "성수동 외벽 도장 작업을 run_safeclaw_harness_agent 도구로 먼저 검토하고, 그 패킷 안의 근거와 개선 이력만 설명해줘."`
  ].join(" ");
}

