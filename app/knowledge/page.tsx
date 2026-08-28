import fs from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import {
  KNOWLEDGE_AUTHORITY_LANES,
  KNOWLEDGE_PROMOTION_STAGES
} from "@/lib/knowledge-governance";
import type {
  KnowledgeAuthorityId,
  KnowledgePromotionStageId
} from "@/lib/knowledge-governance";
import {
  normalizeApprovedSafetyReferenceProvenanceUrl
} from "@/lib/safety-reference-catalog";
import { createPublicPageAdmissionRequest, readPublicAdmissionMessage } from "@/lib/public-page-admission";
import {
  runPublicSafetyReferenceStatsRead,
  unavailableSafetyReferenceStats,
} from "@/lib/public-status-operation";
import { KnowledgeSectionNavigator } from "./KnowledgeSectionNavigator";
import { KnowledgeReviewInbox } from "./KnowledgeReviewInbox";
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

const KNOWLEDGE_SCHEMA_PRESENTATION_LABELS = {
  roleLabel: "문서 역할",
  shortSummary: "짧은 요약",
  documentReflectionLabel: "문서 반영 위치"
} as const;

const KNOWLEDGE_STAGE_PRESENTATION = {
  knowledge_event: {
    label: "원본 이벤트",
    detail: "수집 시점, 출처, 원문 링크와 현장 범위를 보존한 원본 기록",
    ownerLabel: "SafeClaw 수집"
  },
  candidate: {
    label: "지식 후보",
    detail: "AI가 출처 정보를 유지해 만든 사람 검토용 제안",
    ownerLabel: "AI 문서화 도구"
  },
  human_review: {
    label: "사람 검토",
    detail: "출처, 권위, 적용 범위와 충돌 여부를 확인하는 검토 단계 · 현재 연결 전",
    ownerLabel: "검토 책임자"
  },
  published_ontology: {
    label: "게시된 안전지식",
    detail: "별도 승인과 감사 요건을 통과한 읽기 전용 안전지식 · 현재 새 게시 연결 전",
    ownerLabel: "SafeClaw 공식 지식 저장소"
  }
} satisfies Record<KnowledgePromotionStageId, {
  label: string;
  detail: string;
  ownerLabel: string;
}>;

const NEXT_STAGE_LABELS = {
  knowledge_event: "원본 이벤트",
  candidate: "지식 후보",
  human_review: "사람 검토",
  published_ontology: "게시된 안전지식"
} satisfies Record<KnowledgePromotionStageId, string>;

const KNOWLEDGE_AUTHORITY_PRESENTATION = {
  sif: {
    label: "SIF 재해·통제 근거",
    provenanceRule: "중대재해 패턴과 통제 근거로 추적하며 법령 출처로 대체하지 않음"
  },
  kosha: {
    label: "KOSHA 기술지침",
    provenanceRule: "기술적 실행 방법과 통제대책 근거로 사용하며 법적 강제성과 분리"
  },
  law: {
    label: "현행 법령",
    provenanceRule: "공식 조문, 시행일과 개정 상태를 확인한 경우에만 법적 의무 근거로 사용"
  },
  organization_history: {
    label: "조직 이력",
    provenanceRule: "해당 조직의 작업팩과 개선 이력으로 제한하고 공개 참조와 섞지 않음"
  },
  site_history: {
    label: "현장 이력",
    provenanceRule: "해당 현장의 관찰과 조치 이력으로 제한하고 조직 밖 승격을 허용하지 않음"
  },
  hermes_llm: {
    label: "AI 문서화 도구",
    provenanceRule: "근거를 재작성한 후보만 만들며 DB 수정과 온톨로지 게시를 수행하지 않음"
  }
} satisfies Record<KnowledgeAuthorityId, {
  label: string;
  provenanceRule: string;
}>;

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

function localizeSchemaForPresentation(markdown: string) {
  return Object.entries(KNOWLEDGE_SCHEMA_PRESENTATION_LABELS).reduce(
    (localized, [machineLabel, displayLabel]) => localized.replaceAll(machineLabel, displayLabel),
    markdown.replaceAll("LLM", "AI")
  );
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
  const schemaPresentationSource = [
    "표시 항목",
    ...Object.keys(KNOWLEDGE_SCHEMA_PRESENTATION_LABELS).map((label) => `- ${label}`),
    "",
    schemaMarkdown
  ].join("\n");
  const schemaDisplayMarkdown = localizeSchemaForPresentation(schemaPresentationSource);
  const hazardEntries = await readWikiEntries("hazards");
  const formEntries = await readWikiEntries("forms");
  const incomingHeaders = await headers();
  const request = createPublicPageAdmissionRequest("/knowledge", incomingHeaders.entries());
  const statusRead = await runPublicSafetyReferenceStatsRead(request);
  const stats = statusRead.ok
    ? statusRead.data
    : unavailableSafetyReferenceStats(await readPublicAdmissionMessage(statusRead.response));

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
        <KnowledgeSectionNavigator>
        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-today"
          role="tabpanel"
          aria-labelledby="knowledge-tab-today"
          data-knowledge-panel="today"
        >
        <section
          className={`knowledge-status-grid ${styles.overview}`}
          id="knowledge-today"
          aria-label="오늘의 지식 DB 상태"
        >
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>내장 지식 베이스</span>
            <h2>{hazardEntries.length}개 위험요인 · {formEntries.length}개 서식</h2>
            <p>기본 위험요인과 서식 기준을 내장 위키로 관리하고, 현장 문서 보완 때 짧은 근거 요약만 보여줍니다.</p>
          </article>
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>운영 지식</span>
            <h2>원본 이벤트 · 검토 대기 · 미게시</h2>
            <p>AI가 만든 내용은 검토 전 후보로 분리되며, 사람의 결정 후에도 자동 게시되지 않습니다.</p>
          </article>
          <article className={styles.overviewItem}>
            <span className={styles.kicker}>지식 카탈로그</span>
            <h2>{stats.items.toLocaleString("ko-KR")}개 항목 · {stats.sources.toLocaleString("ko-KR")}개 출처</h2>
            <p>{stats.message}</p>
          </article>
        </section>

        <aside className={styles.searchAction} aria-label="핵심 지식 검색">
          <div>
            <span className={styles.kicker}>오늘 할 일</span>
            <strong>작업과 위험요인으로 필요한 근거를 먼저 찾으세요.</strong>
          </div>
          <a href="/search">근거 검색</a>
        </aside>
        </div>

        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-governance"
          role="tabpanel"
          aria-labelledby="knowledge-tab-governance"
          data-knowledge-panel="governance"
        >
        <section
          className={`${styles.section} ${styles.governanceSection}`}
          aria-labelledby="knowledge-governance-heading"
          data-knowledge-governance-flow="true"
        >
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>지식 승격 규칙</span>
              <h2 id="knowledge-governance-heading">지식 검토 흐름 · 사람 확인 필수</h2>
            </div>
            <p>
              후보의 출처와 적용 범위를 확인해 승인, 현장 전용 유지 또는 반려할 수 있습니다.
              모든 결정은 미게시 상태로 남고 온톨로지에는 자동 반영되지 않습니다.
            </p>
          </header>

          <KnowledgeReviewInbox />

          <div className={styles.governanceSupport}>
            <details
              className={styles.supportDisclosure}
              name="knowledge-governance-support"
              data-knowledge-progressive-disclosure="promotion"
            >
              <summary>
                <span className={styles.kicker}>승격 단계</span>
                <strong>원본부터 게시 전까지 4단계 확인</strong>
                <span>4단계</span>
              </summary>
              <ol className={styles.promotionFlow} aria-label="지식 승격 네 단계">
                {KNOWLEDGE_PROMOTION_STAGES.map((stage) => (
                  <li key={stage.id} className={styles.promotionStage} data-knowledge-stage={stage.id}>
                    <div className={styles.stageHeading}>
                      <span className={styles.stageSequence}>{stage.sequence}</span>
                      <span className={styles.stageState}>{stage.stateLabel}</span>
                    </div>
                    <h3>{KNOWLEDGE_STAGE_PRESENTATION[stage.id].label}</h3>
                    <p>{KNOWLEDGE_STAGE_PRESENTATION[stage.id].detail}</p>
                    <dl className={styles.stageMeta}>
                      <div>
                        <dt>소유</dt>
                        <dd>{KNOWLEDGE_STAGE_PRESENTATION[stage.id].ownerLabel}</dd>
                      </div>
                      <div>
                        <dt>다음 상태</dt>
                        <dd>{stage.nextStage ? NEXT_STAGE_LABELS[stage.nextStage] : "최종 읽기 범위"}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </details>

            <details
              className={styles.supportDisclosure}
              name="knowledge-governance-support"
              data-knowledge-progressive-disclosure="authority"
            >
              <summary>
                <span className={styles.kicker}>권위와 출처</span>
                <strong>근거별 권위와 적용 범위</strong>
                <span>{KNOWLEDGE_AUTHORITY_LANES.length}개 근거</span>
              </summary>
              <div className={styles.authorityMap} data-knowledge-authority-map="true">
                <ul className={styles.authorityTable} aria-label="지식 근거별 권위와 적용 범위">
                  {KNOWLEDGE_AUTHORITY_LANES.map((lane) => (
                    <li key={lane.id} className={styles.authorityRow} data-knowledge-authority={lane.id}>
                      <div className={styles.authorityIdentity}>
                        <strong>{KNOWLEDGE_AUTHORITY_PRESENTATION[lane.id].label}</strong>
                        <span>{KNOWLEDGE_AUTHORITY_PRESENTATION[lane.id].provenanceRule}</span>
                      </div>
                      <dl className={styles.authorityFacts}>
                        <div>
                          <dt>권위</dt>
                          <dd>{lane.authorityLabel}</dd>
                        </div>
                        <div>
                          <dt>범위</dt>
                          <dd>{lane.scopeLabel}</dd>
                        </div>
                        <div>
                          <dt>법적 역할</dt>
                          <dd>{lane.legalDutyLabel}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </section>
        </div>

        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-technical"
          role="tabpanel"
          aria-labelledby="knowledge-tab-technical"
          data-knowledge-panel="technical"
        >
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

          {/* data-knowledge-list="technical-support" */}
          <ul className={styles.referenceList} data-knowledge-list="technical-support">
            {stats.samples.map((item) => {
              const reflection = item.document_reflection_label || item.primary_documents.join(" · ");
              const sourceKind = item.source_kind_label || item.evidence_role_label || "근거 항목";
              const summary = normalizeKnowledgeSnippet(item.short_summary || item.summary, KNOWLEDGE_SUMMARY_MAX_LENGTH);
              const provenanceUrl = normalizeApprovedSafetyReferenceProvenanceUrl(item.source_url);

              return (
                <li key={item.id} className={styles.referenceRow} data-knowledge-row>
                  <details className={styles.referenceDisclosure} name="technical-support-reference" data-knowledge-progressive-disclosure="technical">
                    <summary>
                      <span className={styles.sourceKind}>{sourceKind}</span>
                      <strong>{item.title}</strong>
                    </summary>
                    <div className={styles.referenceDetailGrid}>
                      <p className={styles.rowSummary} data-knowledge-summary="true">{summary}</p>
                      <dl className={styles.reflection}>
                        <div>
                          <dt>반영 문서</dt>
                          <dd>{reflection}</dd>
                        </div>
                      </dl>
                      <div className={styles.detailContent}>
                        {item.evidence_role_label ? <span>{item.evidence_role_label}</span> : null}
                        <a href={`/knowledge?reference=${encodeURIComponent(item.title)}`}>이 근거로 조회</a>
                        {provenanceUrl ? (
                          <a href={provenanceUrl} target="_blank" rel="noopener noreferrer">원문 열기</a>
                        ) : null}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {/* data-knowledge-list-end="technical-support" */}
          <dl className={styles.metricStrip} aria-label="KOSHA 기술 지원 적재 현황" tabIndex={0}>
            <div><dt>전체</dt><dd>{stats.technicalTotal.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>규정</dt><dd>{stats.technicalSupportRegulations.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>지침</dt><dd>{stats.technicalGuidelines.toLocaleString("ko-KR")}건</dd></div>
            <div><dt>적재 실행</dt><dd>{stats.ingestionRuns.toLocaleString("ko-KR")}회</dd></div>
          </dl>
          <details className={styles.provenance} data-knowledge-provenance="true">
            <summary>데이터 연결 상태</summary>
            <p>{stats.message}</p>
          </details>
        </section>
        </div>

        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-references"
          role="tabpanel"
          aria-labelledby="knowledge-tab-references"
          data-knowledge-panel="references"
        >
        <section className={styles.section} aria-labelledby="reference-library-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>KOSHA 참고 자료실</span>
              <h2 id="reference-library-heading">참고 자료실 (PDF)</h2>
            </div>
            <p>위험성평가·안전보건진단 작성 시 본문 옆에 펼쳐 참고하세요.</p>
          </header>

          {/* data-knowledge-list="reference-library" */}
          <ul className={styles.referenceList} data-knowledge-list="reference-library">
            {koshaReferenceEntries.map((entry) => (
              <li key={entry.href} className={styles.referenceRow} data-knowledge-row>
                <details className={styles.referenceDisclosure} name="reference-library-entry" data-knowledge-progressive-disclosure="reference">
                  <summary>
                    <span className={styles.sourceKind}>{entry.sourceKind}</span>
                    <strong>{entry.title}</strong>
                  </summary>
                  <div className={styles.referenceDetailGrid}>
                    <p className={styles.rowSummary} data-knowledge-summary="true">
                      {normalizeKnowledgeSnippet(entry.summary)}
                    </p>
                    <dl className={styles.reflection}>
                      <div>
                        <dt>반영 문서</dt>
                        <dd>{entry.reflectedLocation}</dd>
                      </div>
                    </dl>
                    <div className={styles.detailContent}>
                      <span>{entry.fileMeta}</span>
                      <a href={entry.href} target="_blank" rel="noopener noreferrer">PDF 원문 열기</a>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {/* data-knowledge-list-end="reference-library" */}
          <details className={styles.provenance} data-knowledge-provenance="true">
            <summary>자료 출처</summary>
            <p>KOSHA 공식 발간 매뉴얼·가이드라인 PDF. 출처: 안전보건공단 (공공누리 1유형, 출처표시 자유사용/재배포 가능).</p>
          </details>
        </section>
        </div>

        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-wiki"
          role="tabpanel"
          aria-labelledby="knowledge-tab-wiki"
          data-knowledge-panel="wiki"
        >
        <section className={`${styles.section} ${styles.wikiSection}`} aria-labelledby="wiki-index-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>색인</span>
              <h2 id="wiki-index-heading">위키 인덱스</h2>
            </div>
            <p>위험요인/서식 위키의 전체 목차입니다. 화면 기본 흐름에서는 근거 행과 반영 위치를 먼저 확인합니다.</p>
          </header>
          <div className={styles.wikiGrid} aria-label="내장 위키">
          <details className={styles.wikiColumn} name="knowledge-wiki-directory" data-knowledge-progressive-disclosure="hazards">
            <summary className={styles.wikiDirectorySummary}>
              <span className={styles.kicker}>위험요인</span>
              <strong>위험요인 위키</strong>
              <span>{hazardEntries.length}개</span>
            </summary>
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
          </details>
          <details className={styles.wikiColumn} name="knowledge-wiki-directory" data-knowledge-progressive-disclosure="forms">
            <summary className={styles.wikiDirectorySummary}>
              <span className={styles.kicker}>서식</span>
              <strong>서식 위키</strong>
              <span>{formEntries.length}개</span>
            </summary>
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
          </details>
          </div>
          <details className={styles.rawDetails}>
            <summary>위키 목차 원문 펼치기</summary>
            <pre>{indexMarkdown}</pre>
          </details>
        </section>
        </div>

        <div
          className={styles.knowledgePanel}
          id="knowledge-panel-diagnostics"
          role="tabpanel"
          aria-labelledby="knowledge-tab-diagnostics"
          data-knowledge-panel="diagnostics"
        >
        <section className={styles.section} aria-labelledby="schema-heading">
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.kicker}>스키마</span>
              <h2 id="schema-heading">문서화 항목 안내</h2>
            </div>
            <p>AI 문서화에 쓰는 문서 역할, 짧은 요약, 문서 반영 위치를 확인합니다.</p>
          </header>
          <details className={styles.rawDetails}>
            <summary>운영 항목 원문 펼치기</summary>
            <pre>{schemaDisplayMarkdown}</pre>
          </details>
        </section>
        </div>
        </KnowledgeSectionNavigator>
      </div>
    </SafeClawModuleShell>
  );
}
