import Link from "next/link";
import type { Route } from "next";
import { BriefingSettingsCard } from "@/components/BriefingSettingsCard";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import styles from "./settings.module.css";

// 세 번째 값 = 바로 갈 수 있는 화면. 화면이 있는 항목만 제목을 링크로 둔다.
const settings: ReadonlyArray<readonly [string, string, Route | null]> = [
  ["조직·현장", "회사와 현장 정보를 작업공간 기본값으로 관리", null],
  ["발송 채널", "메일·문자는 미리보기만 제공합니다. 실발송은 아직 연결되지 않았습니다", null],
  ["내 AI 연결", "OpenClaw, Codex, Claude에 SafeClaw 도구 연결", "/settings/ai-connect" as Route],
  ["API 연결", "운영 점검 화면에서 공공 API와 전파 채널 상태 확인", "/ops/api" as Route],
  ["권한", "관리자 로그인 기준으로 접근 범위 관리", null]
];

export default function SettingsPage() {
  return (
    <SafeClawModuleShell
      eyebrow="설정"
      title="설정."
      description="조직, 현장, API, 발송 채널 설정을 한곳에서 확인합니다. 운영에 필요한 연결 상태와 이동 경로를 먼저 제공합니다."
      status="planned"
      mappedTo="조직 · 현장 · 발송 채널"
      activeHref="/settings"
      actions={<Link href={"/settings/ai-connect" as Route}>내 AI 연결</Link>}
    >
      <section className="safeclaw-module-grid two">
        {settings.map(([title, body, href]) => (
          <article key={title}>
            <h2 className="safeclaw-section-title">{title}</h2>
            <p className="safeclaw-setting-description">{body}</p>
            {href ? <Link className={styles.cardLink} href={href}>{title} 화면 열기</Link> : null}
          </article>
        ))}
        <BriefingSettingsCard />
      </section>
    </SafeClawModuleShell>
  );
}
