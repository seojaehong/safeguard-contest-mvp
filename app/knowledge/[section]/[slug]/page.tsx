import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

const allowedSections = new Set(["hazards", "forms"]);

function renderMarkdown(markdown: string) {
  return markdown.split(/\r?\n/).map((line, index) => {
    if (line.startsWith("# ")) {
      return <h1 key={index}>{line.replace(/^#\s+/, "")}</h1>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index}>{line.replace(/^##\s+/, "")}</h2>;
    }
    if (line.startsWith("- ")) {
      return <li key={index}>{line.replace(/^-\s+/, "")}</li>;
    }
    if (!line.trim()) {
      return <br key={index} />;
    }
    return <p key={index}>{line}</p>;
  });
}

export default async function KnowledgeDetailPage({
  params
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  if (!allowedSections.has(section) || /[\\/]/.test(slug)) notFound();

  const filePath = path.join(process.cwd(), "knowledge", "wiki", section, `${slug}.md`);
  const markdown = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!markdown) notFound();

  return (
    <main className="v2-shell knowledge-shell">
      <header className="v2-nav">
        <Link href="/knowledge" className="brand-lockup" aria-label="LLM 위키로 돌아가기">
          <span className="brand-mark">S</span>
          <span><strong>SafeClaw</strong><small>LLM 위키 상세</small></span>
        </Link>
        <nav>
          <Link href="/">작업공간</Link>
          <Link href="/knowledge">위키</Link>
          <Link href="/why">차별성</Link>
        </nav>
      </header>

      <article className="card knowledge-detail-card">
        {renderMarkdown(markdown)}
      </article>
    </main>
  );
}
