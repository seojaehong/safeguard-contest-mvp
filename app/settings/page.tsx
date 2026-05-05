import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

const settings = [
  ["조직·현장", "회사와 현장 정보를 작업공간 기본값으로 관리"],
  ["발송 채널", "메일·문자 연결 상태와 발송 기본값 관리"],
  ["API 연결", "운영 점검 화면에서 공공 API와 전파 채널 상태 확인"],
  ["권한", "관리자 로그인 기준으로 접근 범위 관리"]
] as const;

export default function SettingsPage() {
  return (
    <SafeClawModuleShell
      eyebrow="설정"
      title="설정."
      description="조직, 현장, API, 발송 채널 설정을 한곳에서 확인합니다. 운영에 필요한 연결 상태와 이동 경로를 먼저 제공합니다."
      status="planned"
      mappedTo="조직 · 현장 · 발송 채널"
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
