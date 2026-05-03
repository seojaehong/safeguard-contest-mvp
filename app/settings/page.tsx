import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

const settings = [
  ["조직·현장", "회사와 현장 정보를 작업공간 기본값으로 관리"],
  ["전파 채널", "메일·문자 즉시 사용, 카카오·밴드 승인 후 연결"],
  ["API 연결", "운영 점검 화면에서 공공 API와 전파 채널 상태 확인"],
  ["권한", "관리자 로그인 이후 단계에서 확장"]
] as const;

export default function SettingsPage() {
  return (
    <SafeClawModuleShell
      eyebrow="설정"
      title="설정."
      description="조직, 현장, API, 전파 채널 설정을 한곳에서 확인합니다. 제출 기준에서는 필요한 연결 상태와 이동 경로를 먼저 제공합니다."
      status="planned"
      mappedTo="조직 · 현장 · 전파 채널"
      activeHref="/settings"
      actions={<Link href="/ops/api">API 상태 확인</Link>}
    >
      <section className="safeclaw-module-grid two">
        {settings.map(([title, body]) => (
          <article key={title}>
            <span>{title}</span>
            <strong>{body}</strong>
          </article>
        ))}
      </section>
    </SafeClawModuleShell>
  );
}
