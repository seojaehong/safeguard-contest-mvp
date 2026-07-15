import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("knowledge governance UI contract", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/knowledge/page.tsx"),
    "utf8"
  );
  const cssSource = fs.readFileSync(
    path.join(process.cwd(), "app/knowledge/KnowledgePage.module.css"),
    "utf8"
  );

  it("renders the four promotion stages from the shared governance model", () => {
    expect(pageSource).toContain("KNOWLEDGE_PROMOTION_STAGES");
    expect(pageSource).toContain('data-knowledge-governance-flow="true"');
    expect(pageSource).toContain("KNOWLEDGE_PROMOTION_STAGES.map");
    expect(pageSource).toContain('data-knowledge-stage={stage.id}');
  });

  it("keeps machine stage identifiers while presenting Korean governance labels", () => {
    expect(pageSource).toContain("KNOWLEDGE_STAGE_PRESENTATION");
    expect(pageSource).toContain("KNOWLEDGE_AUTHORITY_PRESENTATION");
    expect(pageSource).toContain("NEXT_STAGE_LABELS");
    expect(pageSource).toContain('published_ontology: "게시된 안전지식"');
    expect(pageSource).toMatch(/hermes_llm:\s*\{[\s\S]*?label:\s*"AI 문서화 도구"/u);
    expect(pageSource).toContain('human_review: "사람 검토"');
    expect(pageSource).toContain('data-knowledge-stage={stage.id}');
    expect(pageSource).toContain('data-knowledge-authority={lane.id}');
    expect(pageSource).not.toContain("<h3>{stage.label}</h3>");
    expect(pageSource).not.toContain('{stage.nextStage || "최종 읽기 범위"}');
    expect(pageSource).not.toContain("<strong>{lane.label}</strong>");
  });

  it("renders six distinct authority lanes without a publish control", () => {
    expect(pageSource).toContain("KNOWLEDGE_AUTHORITY_LANES");
    expect(pageSource).toContain('data-knowledge-authority-map="true"');
    expect(pageSource).toContain("KNOWLEDGE_AUTHORITY_LANES.map");

    const governanceSection = pageSource.slice(
      pageSource.indexOf('data-knowledge-governance-flow="true"'),
      pageSource.indexOf('aria-labelledby="technical-support-heading"')
    );
    expect(governanceSection).not.toContain("<button");
    expect(governanceSection).not.toContain("publish(");
  });

  it("keeps the governance surface bounded and single-column on mobile", () => {
    expect(cssSource).toContain(".promotionFlow");
    expect(cssSource).toContain(".authorityTable");
    expect(cssSource).toContain("@media (max-width: 720px)");
    expect(cssSource).not.toMatch(/gradient\s*\(/i);
  });

  it("gives repeated knowledge disclosures and links full touch targets", () => {
    expect(cssSource).toMatch(/\.rowDetails summary[\s\S]*?min-height:\s*44px;/u);
    expect(cssSource).toMatch(/\.detailContent a[\s\S]*?min-height:\s*44px;/u);
  });
});
