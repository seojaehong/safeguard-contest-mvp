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

function excerptFromMarkdown(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#") && !line.startsWith("- ["))
    .slice(0, 2)
    .join(" ")
    .slice(0, 180);
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
      mappedTo={`${stats.items.toLocaleString("ko-KR")}개 항목 · KOSHA ${stats.technicalTotal.toLocaleString("ko-KR")}건`}
      activeHref="/knowledge"
    >
      <section className="knowledge-status-grid">
        <article className="card">
          <span className="eyebrow">Seed Wiki</span>
          <strong>{hazardEntries.length}개 위험요인 · {formEntries.length}개 서식</strong>
          <p className="muted">파일 위치: <code>knowledge/wiki</code>, 데이터 위치: <code>data/safety-knowledge</code></p>
        </article>
        <article className="card">
          <span className="eyebrow">Runtime API</span>
          <strong>/api/knowledge/match · ingest · regenerate</strong>
          <p className="muted">현장 API 호출 결과는 원본 이벤트로 검증되고, 로그인 시 Supabase 지식 테이블에 누적됩니다.</p>
        </article>
        <article className="card">
          <span className="eyebrow">Supabase Catalog</span>
          <strong>{stats.items.toLocaleString("ko-KR")}개 항목 · {stats.sources}개 출처</strong>
          <p className="muted">{stats.message}</p>
        </article>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">KOSHA Technical Support</span>
          <strong>기술지원규정 폴더 연결 상태</strong>
        </div>
        <div className="knowledge-status-grid compact">
          <article><span>전체</span><strong>{stats.technicalTotal.toLocaleString("ko-KR")}건</strong></article>
          <article><span>규정</span><strong>{stats.technicalSupportRegulations.toLocaleString("ko-KR")}건</strong></article>
          <article><span>지침</span><strong>{stats.technicalGuidelines.toLocaleString("ko-KR")}건</strong></article>
          <article><span>적재 실행</span><strong>{stats.ingestionRuns.toLocaleString("ko-KR")}회</strong></article>
        </div>
        <div className="knowledge-entry-list">
          {stats.samples.map((item) => (
            <a key={item.id} href={`/knowledge?reference=${encodeURIComponent(item.title)}`}>
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="card knowledge-index-card">
        <div className="compact-head">
          <span className="eyebrow">Index</span>
          <strong>위키 인덱스</strong>
        </div>
        <pre>{indexMarkdown}</pre>
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
        <pre>{schemaMarkdown}</pre>
      </section>
    </SafeClawModuleShell>
  );
}
