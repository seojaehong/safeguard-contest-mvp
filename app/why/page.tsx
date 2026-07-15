import type { Metadata } from "next";
import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import styles from "./why.module.css";

export const metadata: Metadata = {
  title: "왜 SafeClaw인가 | SafeClaw",
  description: "기존 안전 문서 작성 방식과 비교해 SafeClaw가 현장 안전 문서 업무를 어떻게 줄여주는지 설명합니다."
};

const comparisonRows = [
  ["한 줄 입력에서 문서팩 생성", "지원", "부분 지원", "직접 작성", "프롬프트 의존"],
  ["법령·기상·교육 근거 연결", "문서 문장에 연결", "제한적", "별도 검색", "별도 확인 필요"],
  ["외국인 전송본", "주요 언어 제공", "제한적", "직접 번역", "프롬프트 의존"],
  ["TBM 실행 흐름", "질문·확인·전파", "기록 중심", "수기", "별도 정리 필요"],
  ["증빙과 이력 확장성", "로드맵 포함", "제품별 상이", "파일 관리", "별도 구축"]
];

const comparisonColumns = ["기준", "SafeClaw", "안전관리 SaaS", "한글·엑셀 양식", "일반 AI"];

const apiCards = [
  ["기상청", "현재·예보·특보 신호를 작업중지 기준과 TBM 문구에 반영합니다."],
  ["Law.go", "법령, 판례, 해석례를 문서 반영 근거로 연결합니다."],
  ["Work24", "작업과 대상에 맞는 후속 교육 후보를 제안합니다."],
  ["KOSHA", "공식자료, 교육, 재해사례를 위험성평가와 교육기록에 연결합니다."]
];

export default function WhyPage() {
  return (
    <SafeClawModuleShell
      eyebrow="차별성"
      title="왜 SafeClaw인가."
      description="검색기나 템플릿이 아니라, 근거를 위험성평가표, TBM, 교육기록, 전파 메시지의 문장으로 연결하는 작업공간입니다."
      status="live"
      mappedTo="근거 연결 · 실행 문서 · 현장 전파"
      activeHref="/why"
      actions={<Link href="/workspace">작업공간 열기</Link>}
    >
      <section className="safeclaw-module-grid four api-pulse-showcase">
        {apiCards.map(([title, body]) => (
          <article key={title} className="api-proof-card">
            <i aria-hidden="true" />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className={`safeclaw-module-panel ${styles.comparisonPanel}`}>
        <div className="compact-head">
          <span className="eyebrow">비교</span>
          <h2>대안별 차이</h2>
        </div>
        <div className={styles.tableFrame}>
          <table className={styles.comparisonTable} data-why-comparison>
            <caption className={styles.srOnly}>SafeClaw와 기존 안전 문서 작성 대안의 기능 비교</caption>
            <thead>
              <tr>
                {comparisonColumns.map((column) => <th key={column} scope="col">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([criterion, ...values]) => (
                <tr key={criterion}>
                  <th scope="row">{criterion}</th>
                  {values.map((value, index) => (
                    <td key={`${criterion}-${comparisonColumns[index + 1]}`} data-label={comparisonColumns[index + 1]}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="safeclaw-module-panel v2-link-band">
        <h2>차별성을 실제 작업 흐름에서 확인하려면</h2>
        <Link className="button" href="/workspace">작업공간 열기</Link>
      </section>
    </SafeClawModuleShell>
  );
}
