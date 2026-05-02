import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export default function ProductHomePage() {
  return (
    <SafeClawModuleShell
      eyebrow="Home Dashboard"
      title="오늘 작업 현황."
      description="다현장 카드, 미완료 교육, 전파 실패, API 경보를 모아 보여줄 운영 홈입니다. 현재는 안정 작업공간으로 연결합니다."
      status="planned"
      mappedTo="신규 대시보드 필요"
      actions={<Link href="/workspace">오늘 작업 생성</Link>}
    >
      <section className="safeclaw-module-grid three">
        <article><span>오늘 작업</span><strong>작업공간에서 생성</strong><p>문서팩 생성 엔진은 `/workspace`에서 안정적으로 운영합니다.</p></article>
        <article><span>교육 확인</span><strong>작업자 패널 연결</strong><p>작업자·교육 화면을 홈 요약으로 끌어올릴 예정입니다.</p></article>
        <article><span>전파 결과</span><strong>메일·문자 우선</strong><p>전파 실패와 재시도 필요 항목을 홈 알림으로 표시합니다.</p></article>
      </section>
    </SafeClawModuleShell>
  );
}
