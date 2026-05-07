import fs from "node:fs/promises";
import path from "node:path";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";

type WikiEntry = {
  title: string;
  href: string;
  excerpt: string;
};

export const dynamic = "force-dynamic";

async function readText(filePath: string) {
  return await fs.readFile(filePath, "utf8").catch(() => "");
}

function titleFromMarkdown(markdown: string, fallback: string) {
  const firstHeading = markdown.split(/\r?\n/).find((line) => line.startsWith("# "));
  return firstHeading?.replace(/^#\s+/, "").trim() || fallback;
}

function normalizeKnowledgeSnippet(value: string, maxLength = 180) {
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

  return `${compact.slice(0, maxLength).trim()}...`;
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
      <section className="knowledge-status-grid">
        <article className="card">
          <span className="eyebrow">Built-in Wiki</span>
          <strong>{hazardEntries.length}개 위험요인 · {formEntries.length}개 서식</strong>
          <p className="muted">기본 위험요인과 서식 기준을 내장 위키로 관리하고, 현장 문서 보완 때 짧은 근거 요약만 보여줍니다.</p>
        </article>
        <article className="card">
          <span className="eyebrow">Runtime Knowledge</span>
          <strong>근거 매칭 · 원본 누적 · AI 보완</strong>
          <p className="muted">현장 API 호출 결과는 원본 이벤트로 검증되고, 로그인 시 Supabase 지식 테이블에 누적됩니다.</p>
        </article>
        <article className="card">
          <span className="eyebrow">Knowledge Catalog</span>
          <strong>{stats.items.toLocaleString("ko-KR")}개 항목 · {stats.sources}개 출처</strong>
          <p className="muted">{stats.message}</p>
        </article>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">KOSHA Technical Support</span>
          <strong>문서 반영용 근거 샘플</strong>
        </div>
        <p className="muted small">
          아래 항목은 원문 목록이 아니라 보완 생성에 쓰는 역할, 짧은 요약, 문서 반영 위치만 보여줍니다.
          전체 원문은 필요할 때만 세부 링크에서 확인합니다.
        </p>
        <div className="knowledge-status-grid compact">
          <article><span>전체</span><strong>{stats.technicalTotal.toLocaleString("ko-KR")}건</strong></article>
          <article><span>규정</span><strong>{stats.technicalSupportRegulations.toLocaleString("ko-KR")}건</strong></article>
          <article><span>지침</span><strong>{stats.technicalGuidelines.toLocaleString("ko-KR")}건</strong></article>
          <article><span>적재 실행</span><strong>{stats.ingestionRuns.toLocaleString("ko-KR")}회</strong></article>
        </div>
        <div className="knowledge-entry-list">
          {stats.samples.map((item) => (
            <a key={item.id} href={`/knowledge?reference=${encodeURIComponent(item.title)}`}>
              <small>{item.evidence_role_label || "근거 항목"}</small>
              <strong>{item.title}</strong>
              <span>{normalizeKnowledgeSnippet(item.short_summary || item.summary, 170)}</span>
              <span>{item.document_reflection_label || item.primary_documents.join(" · ")}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">KOSHA Reference Library</span>
          <strong>참고 자료실 (PDF)</strong>
        </div>
        <p className="muted small">
          KOSHA 공식 발간 매뉴얼·가이드라인 PDF. 출처: 안전보건공단 (공공누리 1유형, 출처표시 자유사용/재배포 가능).
          위험성평가·안전보건진단 작성 시 본문 옆에 펼쳐 참고하세요.
        </p>
        <div className="knowledge-entry-list">
          <a href="/kosha-references/risk-assessment-implementation-manual-2022.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 매뉴얼</small>
            <strong>위험성평가 이행·점검 매뉴얼 (2022)</strong>
            <span>위험성평가 절차·체크리스트·이행관리 매뉴얼. 1.95MB · PDF</span>
            <span>반영 위치: 위험성평가표 / 안전보건교육 / 사전준비</span>
          </a>
          <a href="/kosha-references/risk-assessment-guidebook-2022.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 지침해설서</small>
            <strong>2022 위험성평가 지침해설서</strong>
            <span>위험성평가 법적 근거·실시 절차·등급 판정 해설. 4.32MB · PDF</span>
            <span>반영 위치: 위험성평가표 본문 작성 시 핵심 참조</span>
          </a>
          <a href="/kosha-references/risk-assessment-easy-guide.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 안내서</small>
            <strong>쉽고 간편한 위험성평가 방법 안내서</strong>
            <span>4M·체크리스트·핵심요인 기법 등 실시 방법 안내. 4.15MB · PDF</span>
            <span>반영 위치: 신규 사업장 / 소규모 현장 위험성평가</span>
          </a>
          <a href="/kosha-references/work-accident-prevention-rate-leaflet.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 리플릿</small>
            <strong>산재예방요율제 제도 안내</strong>
            <span>위험성평가 인정 사업장 산재보험료 할인 제도. 1.34MB · PDF</span>
            <span>반영 위치: 사업주 인센티브 안내</span>
          </a>
          <a href="/kosha-references/tbm-pre-work-safety-meeting-guide-2023.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · TBM 메인 가이드</small>
            <strong>작업 전 안전점검회의(TBM) 가이드 (2023)</strong>
            <span>TBM 도입·실시·기록·교육시간 인정 통합 가이드. 4.2MB · PDF</span>
            <span>반영 위치: TBM 일지 / TBM 회의록 / 안전보건교육 작성 시 핵심 참조</span>
          </a>
          <a href="/kosha-references/safety-health-diagnosis-guideline-full.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 가이드라인</small>
            <strong>안전보건진단 업무 가이드라인 (전문)</strong>
            <span>안전보건진단 업무 표준 절차 가이드라인. 1.57MB · PDF</span>
            <span>반영 위치: 위험성평가표 / 비상대응 / 사전점검</span>
          </a>
          <a href="/kosha-references/safety-health-diagnosis-sample-report.pdf" target="_blank" rel="noopener noreferrer">
            <small>KOSHA · 샘플</small>
            <strong>안전보건진단 샘플 보고서 (공개용)</strong>
            <span>실제 진단 보고서 형식 샘플. 510KB · PDF</span>
            <span>반영 위치: 진단 보고서 / 점검결과 요약</span>
          </a>
        </div>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">Index</span>
          <strong>위키 인덱스</strong>
        </div>
        <p className="muted small">위험요인/서식 위키의 전체 목차입니다. 화면 기본 흐름에서는 근거 카드와 반영 위치를 먼저 확인합니다.</p>
        <details>
          <summary>위키 목차 원문 펼치기</summary>
          <pre>{indexMarkdown}</pre>
        </details>
      </section>

      <section className="knowledge-entry-grid">
        <article className="card">
          <div className="compact-head">
            <span className="eyebrow">Hazards</span>
            <strong>위험요인 위키</strong>
          </div>
          <div className="knowledge-entry-list">
            {hazardEntries.map((entry) => (
              <a key={entry.href} href={entry.href}>
                <strong>{entry.title}</strong>
                <span>{entry.excerpt}</span>
              </a>
            ))}
          </div>
        </article>
        <article className="card">
          <div className="compact-head">
            <span className="eyebrow">Forms</span>
            <strong>서식 위키</strong>
          </div>
          <div className="knowledge-entry-list">
            {formEntries.map((entry) => (
              <a key={entry.href} href={entry.href}>
                <strong>{entry.title}</strong>
                <span>{entry.excerpt}</span>
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">Schema</span>
          <strong>LLM 재생성 스키마</strong>
        </div>
        <p className="muted small">
          재생성 스키마는 개발/운영 확인용입니다. 현장 문서에는 roleLabel, shortSummary, documentReflectionLabel만 반영합니다.
        </p>
        <details>
          <summary>스키마 원문 펼치기</summary>
          <pre>{schemaMarkdown}</pre>
        </details>
      </section>
    </SafeClawModuleShell>
  );
}
