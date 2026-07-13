import fs from "node:fs/promises";
import path from "node:path";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import styles from "./KnowledgePage.module.css";

type WikiEntry = {
  title: string;
  href: string;
  excerpt: string;
};

type KoshaReferenceEntry = {
  href: string;
  sourceKind: string;
  title: string;
  summary: string;
  fileMeta: string;
  reflectedLocation: string;
};

const KNOWLEDGE_SUMMARY_MAX_LENGTH = 150;

const koshaReferenceEntries: KoshaReferenceEntry[] = [
  {
    href: "/kosha-references/risk-assessment-implementation-manual-2022.pdf",
    sourceKind: "KOSHA · 매뉴얼",
    title: "위험성평가 이행·점검 매뉴얼 (2022)",
    summary: "위험성평가 절차·체크리스트·이행관리 매뉴얼.",
    fileMeta: "1.95MB · PDF",
    reflectedLocation: "위험성평가표 / 안전보건교육 / 사전준비"
  },
  {
    href: "/kosha-references/risk-assessment-guidebook-2022.pdf",
    sourceKind: "KOSHA · 지침해설서",
    title: "2022 위험성평가 지침해설서",
    summary: "위험성평가 법적 근거·실시 절차·등급 판정 해설.",
    fileMeta: "4.32MB · PDF",
    reflectedLocation: "위험성평가표 본문 작성 시 핵심 참조"
  },
  {
    href: "/kosha-references/risk-assessment-easy-guide.pdf",
    sourceKind: "KOSHA · 안내서",
    title: "쉽고 간편한 위험성평가 방법 안내서",
    summary: "4M·체크리스트·핵심요인 기법 등 실시 방법 안내.",
    fileMeta: "4.15MB · PDF",
    reflectedLocation: "신규 사업장 / 소규모 현장 위험성평가"
  },
  {
    href: "/kosha-references/work-accident-prevention-rate-leaflet.pdf",
    sourceKind: "KOSHA · 리플릿",
    title: "산재예방요율제 제도 안내",
    summary: "위험성평가 인정 사업장 산재보험료 할인 제도.",
    fileMeta: "1.34MB · PDF",
    reflectedLocation: "사업주 인센티브 안내"
  },
  {
    href: "/kosha-references/tbm-pre-work-safety-meeting-guide-2023.pdf",
    sourceKind: "KOSHA · TBM 메인 가이드",
    title: "작업 전 안전점검회의(TBM) 가이드 (2023)",
    summary: "TBM 도입·실시·기록·교육시간 인정 통합 가이드.",
    fileMeta: "4.2MB · PDF",
    reflectedLocation: "TBM 일지 / TBM 회의록 / 안전보건교육 작성 시 핵심 참조"
  },
  {
    href: "/kosha-references/safety-health-diagnosis-guideline-full.pdf",
    sourceKind: "KOSHA · 가이드라인",
    title: "안전보건진단 업무 가이드라인 (전문)",
    summary: "안전보건진단 업무 표준 절차 가이드라인.",
    fileMeta: "1.57MB · PDF",
    reflectedLocation: "위험성평가표 / 비상대응 / 사전점검"
  },
  {
    href: "/kosha-references/safety-health-diagnosis-sample-report.pdf",
    sourceKind: "KOSHA · 샘플",
    title: "안전보건진단 샘플 보고서 (공개용)",
    summary: "실제 진단 보고서 형식 샘플.",
    fileMeta: "510KB · PDF",
    reflectedLocation: "진단 보고서 / 점검결과 요약"
  }
];

export const dynamic = "force-dynamic";

async function readText(filePath: string) {
  return await fs.readFile(filePath, "utf8").catch(() => "");
}

function titleFromMarkdown(markdown: string, fallback: string) {
  const firstHeading = markdown.split(/\r?\n/).find((line) => line.startsWith("# "));
  return firstHeading?.replace(/^#\s+/, "").trim() || fallback;
}

function normalizeKnowledgeSnippet(value: string, maxLength = KNOWLEDGE_SUMMARY_MAX_LENGTH) {
  const compact = value
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (compact.length <= maxLength) return compact;

  const slice = compact.slice(0, maxLength + 1);
  const boundaries = ["니다.", "한다.", "된다.", "있다.", "한다", "다.", "요.", ". ", "; "]
    .map((marker) => slice.lastIndexOf(marker))
    .filter((index) => index >= 60);
  const boundary = boundaries.length ? Math.max(...boundaries) : -1;
  if (boundary > 0) {
    const markerLength = slice[boundary + 1] === "." ? 2 : 1;
    return slice.slice(0, boundary + markerLength).trim();
  }

  return `${compact.slice(0, maxLength - 3).trim()}...`;
}

function excerptFromMarkdown(markdown: string) {
  const excerpt = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#") && !line.startsWith("- ["))
    .slice(0, 2)
    .join(" ");
  return normalizeKnowledgeSnippet(excerpt);
}

async function readWikiEntries(relativeDir: string) {
  const root = process.cwd();
  const dir = path.join(root, "knowledge", "wiki", relativeDir);
  const files = await fs.readdir(dir).catch(() => []);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  return await Promise.all(markdownFiles.map(async (file): Promise<WikiEntry> => {
    const markdown = await readText(path.join(dir, file));
    const slug = file.replace(/\.md$/, "");
    return {
      title: titleFromMarkdown(markdown, slug),
      href: `/knowledge/${relativeDir}/${slug}`,
      excerpt: excerptFromMarkdown(markdown)
    };
  }));
}

export default async function KnowledgePage() {
  const root = process.cwd();
  const indexMarkdown = await readText(path.join(root, "knowledge", "wiki", "index.md"));
  const schemaMarkdown = await readText(path.join(root, "knowledge", "SCHEMA.md"));
  const hazardEntries = await readWikiEntries("hazards");
  const formEntries = await readWikiEntries("forms");
  const stats = await getSafetyReferenceStats();

  return (
    <SafeClawModuleShell
      eyebrow="지식 DB"
      title="지식 DB."
      description="법령 전문, KOSHA 자료, 재해사례, 서식 기준을 문서 보완과 근거 탐색에 쓰는 지식층으로 관리합니다."
      status="live"
      mappedTo={`${stats.items.toLocaleString("ko-KR")}개 근거 항목 · KOSHA ${stats.technicalTotal.toLocaleString("ko-KR")}건`}
      activeHref="/knowledge"
    >
      <div className={styles.page} data-knowledge-surface>
        <section className={`knowledge-status-grid ${styles.overview}`} aria-label="지식 DB 상태">
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>내장 위키</span>
            <h2>{hazardEntries.length}개 위험요인 · {formEntries.length}개 서식</h2>
            <p>기본 위험요인과 서식 기준을 내장 위키로 관리하고, 현장 문서 보완 때 짧은 근거 요약만 보여줍니다.</p>
          </article>
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>운영 지식</span>
            <h2>근거 매칭 · 원본 누적 · AI 보완</h2>
            <p>현장 API 호출 결과는 원본 이벤트로 검증되고, 로그인 시 Supabase 지식 테이블에 누적됩니다.</p>
          </article>
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>지식 목록</span>
            <h2>{stats.items.toLocaleString("ko-KR")}개 항목 · {stats.sources.toLocaleString("ko-KR")}개 출처</h2>
            <p>{stats.message}</p>
          </article>
        </section>

        <section className={styles.section} aria-labelledby="technical-support-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>KOSHA 기술 지원</span>
              <h2 id="technical-support-heading">문서 반영용 KOSHA 기술 지원 자료</h2>
            </div>
            <p>
              아래 항목은 원문 목록이 아니라 보완 생성에 쓰는 역할, 짧은 요약, 문서 반영 위치만 보여줍니다.
              전체 원문은 필요할 때만 세부 링크에서 확인합니다.
            </p>
          </header>

          <dl className={styles.metricStrip} aria-label="KOSHA 기술 지원 적재 현황">
            <div><dt>전체</dt><dd>{stats.technicalTotal.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>규정</dt><dd>{stats.technicalSupportRegulations.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>지침</dt><dd>{stats.technicalGuidelines.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>적재 실행</dt><dd>{stats.ingestionRuns.toLocaleString("ko-KR")}회</dd></div>
          </dl>

          <p className={styles.provenance} data-knowledge-provenance="true">
            <strong>데이터 연결 상태</strong>
            <span>{stats.message}</span>
          </p>

          {/* data-knowledge-list="technical-support" */}
          <ul className={styles.referenceList} data-knowledge-list="technical-support">
            {stats.samples.map((item) => {
              const reflection = item.document_reflection_label || item.primary_documents.join(" · ");
              const sourceKind = item.source_kind_label || item.evidence_role_label || "근거 항목";
              const summary = normalizeKnowledgeSnippet(item.short_summary || item.summary, KNOWLEDGE_SUMMARY_MAX_LENGTH);

              return (
                <li key={item.id} className={styles.referenceRow} data-knowledge-row>
                  <div className={styles.rowIdentity}>
                    <span className={styles.sourceKind}>{sourceKind}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <p className={styles.rowSummary} data-knowledge-summary="true">{summary}</p>
                  <dl className={styles.reflection}>
                    <div>
                      <dt>반영 문서</dt>
                      <dd>{reflection}</dd>
                    </div>
                  </dl>
                  <details className={styles.rowDetails}>
                    <summary>근거 정보</summary>
                    <div className={styles.detailContent}>
                      {item.evidence_role_label ? <span>{item.evidence_role_label}</span> : null}
                      <a href={`/knowledge?reference=${encodeURIComponent(item.title)}`}>이 근거로 조회</a>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer">원문 열기</a>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {/* data-knowledge-list-end="technical-support" */}
        </section>

        <section className={styles.section} aria-labelledby="reference-library-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>KOSHA 참고 자료실</span>
              <h2 id="reference-library-heading">참고 자료실 (PDF)</h2>
            </div>
            <p>위험성평가·안전보건진단 작성 시 본문 옆에 펼쳐 참고하세요.</p>
          </header>

          <p className={styles.provenance} data-knowledge-provenance="true">
            <strong>자료 출처</strong>
            <span>KOSHA 공식 발간 매뉴얼·가이드라인 PDF. 출처: 안전보건공단 (공공누리 1유형, 출처표시 자유사용/재배포 가능).</span>
          </p>

          {/* data-knowledge-list="reference-library" */}
          <ul className={styles.referenceList} data-knowledge-list="reference-library">
            {koshaReferenceEntries.map((entry) => (
              <li key={entry.href} className={styles.referenceRow} data-knowledge-row>
                <div className={styles.rowIdentity}>
                  <span className={styles.sourceKind}>{entry.sourceKind}</span>
                  <h3>{entry.title}</h3>
                </div>
                <p className={styles.rowSummary} data-knowledge-summary="true">
                  {normalizeKnowledgeSnippet(entry.summary)}
                </p>
                <dl className={styles.reflection}>
                  <div>
                    <dt>반영 문서</dt>
                    <dd>{entry.reflectedLocation}</dd>
                  </div>
                </dl>
                <details className={styles.rowDetails}>
                  <summary>PDF 정보</summary>
                  <div className={styles.detailContent}>
                    <span>{entry.fileMeta}</span>
                    <a href={entry.href} target="_blank" rel="noopener noreferrer">PDF 원문 열기</a>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {/* data-knowledge-list-end="reference-library" */}
        </section>

        <section className={styles.section} aria-labelledby="wiki-index-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>색인</span>
              <h2 id="wiki-index-heading">위키 인덱스</h2>
            </div>
            <p>위험요인/서식 위키의 전체 목차입니다. 화면 기본 흐름에서는 근거 행과 반영 위치를 먼저 확인합니다.</p>
          </header>
          <details className={styles.rawDetails}>
            <summary>위키 목차 원문 펼치기</summary>
            <pre>{indexMarkdown}</pre>
          </details>
        </section>

        <section className={styles.wikiGrid} aria-label="내장 위키">
          <article className={styles.wikiColumn}>
            <header className={styles.compactHeader}>
              <span className={styles.kicker}>위험요인</span>
              <h2>위험요인 위키</h2>
            </header>
            <ul className={styles.wikiList}>
              {hazardEntries.map((entry) => (
                <li key={entry.href}>
                  <a href={entry.href}>
                    <strong>{entry.title}</strong>
                    <span>{entry.excerpt}</span>
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className={styles.wikiColumn}>
            <header className={styles.compactHeader}>
              <span className={styles.kicker}>서식</span>
              <h2>서식 위키</h2>
            </header>
            <ul className={styles.wikiList}>
              {formEntries.map((entry) => (
                <li key={entry.href}>
                  <a href={entry.href}>
                    <strong>{entry.title}</strong>
                    <span>{entry.excerpt}</span>
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.section} aria-labelledby="schema-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>스키마</span>
              <h2 id="schema-heading">LLM 재생성 스키마</h2>
            </div>
            <p>재생성 스키마는 개발/운영 확인용입니다. 현장 문서에는 roleLabel, shortSummary, documentReflectionLabel만 반영합니다.</p>
          </header>
          <details className={styles.rawDetails}>
            <summary>스키마 원문 펼치기</summary>
            <pre>{schemaMarkdown}</pre>
          </details>
        </section>
      </div>
    </SafeClawModuleShell>
  );
}
