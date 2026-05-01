import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

type WikiEntry = {
  title: string;
  href: string;
  excerpt: string;
};

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

  return (
    <main className="v2-shell knowledge-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeGuard 홈">
          <span className="brand-mark">S</span>
          <span><strong>SafeGuard</strong><small>LLM 위키</small></span>
        </Link>
        <nav>
          <Link href="/demo">시연</Link>
          <Link href="/why">차별성</Link>
          <Link href="/preview">핵심 3종</Link>
          <Link href="/roadmap">로드맵</Link>
        </nav>
      </header>

      <section className="v2-hero card">
        <span className="eyebrow">Safety Knowledge Layer</span>
        <h1>문서팩 생성에 쓰는 기초 지식 DB와 LLM 재생성 경로를 확인합니다.</h1>
        <p>이 화면은 크롤링 원본 전체가 아니라, 공식자료 기반 seed 지식층과 `/api/knowledge/*` 런타임이 어떻게 연결되는지 보여주는 운영 확인 페이지입니다.</p>
      </section>

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
    </main>
  );
}
