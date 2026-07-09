import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

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
    <SafeClawModuleShell
      eyebrow="지식 DB 상세"
      title="공식자료 기반 안전지식."
      description="SIF/KOSHA/작업 이력에서 검토한 지식 항목을 문서 반영 전 확인합니다."
      status="partial"
      mappedTo="지식 DB · 근거 확인 · 문서 반영 후보"
      activeHref="/knowledge"
      actions={<Link href="/knowledge">목록으로</Link>}
    >
      <article className="safeclaw-module-panel knowledge-detail-card">
        {renderMarkdown(markdown)}
      </article>
    </SafeClawModuleShell>
  );
}
