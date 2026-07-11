import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

const allowedSections = new Set(["hazards", "forms"]);

function renderInlineMarkdown(value: string): ReactNode {
  const link = value.match(/^(.*?)\[([^\]]+)\]\((https?:\/\/[^)]+)\)(.*)$/);
  if (!link) return value;
  return <>{link[1]}<a href={link[3]} target="_blank" rel="noreferrer">{link[2]}</a>{link[4]}</>;
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const rendered: ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("# ")) {
      rendered.push(<h1 key={index}>{renderInlineMarkdown(line.replace(/^#\s+/, ""))}</h1>);
      continue;
    }
    if (line.startsWith("## ")) {
      rendered.push(<h2 key={index}>{renderInlineMarkdown(line.replace(/^##\s+/, ""))}</h2>);
      continue;
    }
    if (line.startsWith("- ")) {
      const items: ReactNode[] = [];
      const listStart = index;
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(<li key={index}>{renderInlineMarkdown(lines[index].replace(/^-\s+/, ""))}</li>);
        index += 1;
      }
      index -= 1;
      rendered.push(<ul key={`list-${listStart}`}>{items}</ul>);
      continue;
    }
    if (line.trim()) rendered.push(<p key={index}>{renderInlineMarkdown(line)}</p>);
  }
  return rendered;
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
