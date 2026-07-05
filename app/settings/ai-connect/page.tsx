import Link from "next/link";
import { AiConnectPanel } from "@/components/AiConnectPanel";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "내 AI 연결 | SafeClaw",
  robots: { index: false, follow: false },
};

export default function AiConnectPage() {
  return (
    <SafeClawModuleShell
      eyebrow="내 AI 연결"
      title="AI 연결."
      description="OpenClaw, Codex, Claude 같은 외부 AI에 SafeClaw의 기상·법령·문서 검수 도구를 안전하게 연결합니다."
      status="partial"
      mappedTo="MCP 토큰 · OpenClaw/Codex · Claude Desktop"
      activeHref="/settings/ai-connect"
      actions={<Link href="/ops/api">API 상태 확인</Link>}
    >
      <AiConnectPanel />
    </SafeClawModuleShell>
  );
}

