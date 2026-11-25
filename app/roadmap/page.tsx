import type { Metadata } from "next";
import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const metadata: Metadata = {
  title: "로드맵 | SafeClaw",
  description: "SafeClaw가 안전 문서팩 서비스에서 산업안전 SaaS로 성장하는 단계별 로드맵입니다."
};

const roadmap = [
  ["1단계", "업무 화면", "작업공간, 문서팩, 근거, 전파, 이력 화면을 실제 업무 메뉴로 정리합니다."],
  ["2단계", "재방문", "현장과 날짜별 작업 기록으로 같은 현장을 다음 날 다시 열 수 있게 합니다."],
  ["3단계", "공통 항목", "여러 문서에 들어가는 공통 항목을 한 곳에서 한 번 고치면 문서에 반영합니다."],
  ["4단계", "증빙", "증빙 보관함과 변경 기록으로 기록과 확인 흐름을 남깁니다."],
  ["5단계", "팀 운영", "결재선, 다현장 대시보드, 월간 리포트로 확장합니다."]
];

export default function RoadmapPage() {
  return (
    <SafeClawModuleShell
      eyebrow="실행 로드맵"
      title="제품 로드맵."
      description="업무 화면으로 실제 작업 흐름을 먼저 고정하고, 다음 단계에서 재방문과 이력을 완성합니다."
      status="partial"
      mappedTo="업무 화면 · 재방문 · 공통 항목 · 증빙"
      activeHref="/roadmap"
      actions={<Link href="/workspace">작업공간 열기</Link>}
    >
      <section className="safeclaw-module-grid two roadmap-list">
        {roadmap.map(([label, title, body]) => (
          <article key={label} className="roadmap-item">
            <span>{label}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="safeclaw-module-panel v2-link-band">
        <h2>첫 화면에서 바로 열어야 할 곳은 작업공간입니다.</h2>
        <Link className="button" href="/workspace">작업공간 열기</Link>
      </section>
    </SafeClawModuleShell>
  );
}
