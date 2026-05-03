import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export default function ProductHomePage() {
  return (
    <SafeClawModuleShell
      eyebrow="대시보드"
      title="오늘 작업 현황."
      description="오늘 생성할 문서팩, 교육 확인, 전파 결과, API 연결 상태를 현장 단위로 모아 보는 운영 홈입니다."
      status="planned"
      mappedTo="오늘 작업 · 교육 확인 · 전파 결과"
      activeHref="/home"
      actions={<Link href="/workspace">오늘 작업 생성</Link>}
    >
      <section className="safeclaw-module-grid three">
        <article><span>오늘 작업</span><strong>작업공간에서 생성</strong><p>문서팩 생성 엔진은 작업공간에서 안정적으로 운영합니다.</p></article>
        <article><span>교육 확인</span><strong>작업자 패널 연결</strong><p>작업자·교육 화면을 홈 요약으로 끌어올릴 예정입니다.</p></article>
        <article><span>전파 결과</span><strong>메일·문자 우선</strong><p>전파 실패와 재시도 필요 항목을 홈 알림으로 표시합니다.</p></article>
      </section>
    </SafeClawModuleShell>
  );
}
