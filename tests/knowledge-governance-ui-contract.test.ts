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
  const inboxSource = fs.readFileSync(
    path.join(process.cwd(), "app/knowledge/KnowledgeReviewInbox.tsx"),
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

  it("connects human review while keeping publication and legal authority blocked", () => {
    expect(pageSource).toContain("승인, 현장 전용 유지 또는 반려할 수 있습니다.");
    expect(pageSource).toContain("모든 결정은 미게시 상태로 남고 온톨로지에는 자동 반영되지 않습니다.");
    expect(inboxSource).toContain('action: ReviewAction');
    expect(inboxSource).toContain("검토 결과를 저장했습니다. 게시되지는 않았습니다.");
    expect(inboxSource).not.toContain("publish_ontology");
    expect(inboxSource).not.toContain("legalConfirmed: true");
  });

  it("localizes schema field names at the presentation boundary", () => {
    expect(pageSource).toContain('roleLabel: "문서 역할"');
    expect(pageSource).toContain('shortSummary: "짧은 요약"');
    expect(pageSource).toContain('documentReflectionLabel: "문서 반영 위치"');
    expect(pageSource).toContain("const schemaDisplayMarkdown");
    expect(pageSource).toContain("<pre>{schemaDisplayMarkdown}</pre>");
    expect(pageSource).not.toContain("<pre>{schemaMarkdown}</pre>");
    expect(pageSource).not.toContain("<h2 id=\"schema-heading\">LLM 재생성 스키마</h2>");
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
