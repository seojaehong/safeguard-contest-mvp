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
  const navigatorSource = fs.readFileSync(
    path.join(process.cwd(), "app/knowledge/KnowledgeSectionNavigator.tsx"),
    "utf8"
  );
  const browserRunnerSource = fs.readFileSync(
    path.join(process.cwd(), "scripts/knowledge_review_authority_ui_runner.mjs"),
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

  it("keeps multi-candidate review selected-only with bounded candidate text", () => {
    expect(inboxSource).toContain('data-review-workbench="selected-only"');
    expect(inboxSource).toContain("data-knowledge-review-state");
    expect(inboxSource).toContain('data-selected-review-candidate="true"');
    expect(inboxSource).toContain('data-selected-candidate-body="true"');
    expect(inboxSource).toContain("matchedHazardCount");
    expect(cssSource).toMatch(/\.reviewWorkbench\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px, 280px\) minmax\(0, 1fr\);/u);
    expect(cssSource).toMatch(/\.candidateText\s*\{[\s\S]*?overflow:\s*auto;/u);
  });

  it("keeps the review subject ahead of readiness and visible beside evidence", () => {
    const candidateBodyIndex = inboxSource.indexOf('data-selected-candidate-body="true"');
    const readinessIndex = inboxSource.indexOf("data-review-content-readiness");
    expect(candidateBodyIndex).toBeGreaterThan(0);
    expect(candidateBodyIndex).toBeLessThan(readinessIndex);
    expect(inboxSource).toContain('data-review-evidence-subject-context="true"');
    expect(inboxSource).toContain("검토 대상");
    expect(inboxSource).toContain("candidatePresentation.subject");
    expect(cssSource).toMatch(/\.evidenceSubjectContext strong\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/u);
  });

  it("exposes linked roving candidate tabs and keyboard-operable mobile review panes", () => {
    expect(inboxSource).toContain('role="tablist"');
    expect(inboxSource).toContain('aria-orientation={compactViewport ? "horizontal" : "vertical"}');
    expect(inboxSource).toContain('role="tab"');
    expect(inboxSource).toContain('aria-controls={`knowledge-review-candidate-panel-${index}`}');
    expect(inboxSource).toContain('data-review-candidate-position={`${index + 1}/${items.length}`}');
    expect(inboxSource).toContain('{` · 후보 ${index + 1}/${items.length}`}');
    expect(inboxSource).toContain('tabIndex={selected ? 0 : -1}');
    expect(inboxSource).toContain('role="tabpanel"');
    expect(inboxSource).toContain('ArrowDown: (index + 1) % items.length');
    expect(inboxSource).toContain('End: lastIndex');
    expect(inboxSource).toContain('onKeyDown={handleReviewPaneKeyDown}');
    expect(cssSource).toMatch(/\.reviewCandidateButton:focus-visible[\s\S]*?outline:\s*3px solid/u);
  });

  it("announces pending review decisions and exposes a busy action boundary", () => {
    expect(inboxSource).toContain('setMessage("검토 결과를 저장하는 중입니다.")');
    expect(inboxSource).toContain('setMessage("검토 후보를 준비하는 중입니다.")');
    expect(inboxSource).toContain("const pending = pendingRunId !== null");
    expect(inboxSource).toContain("aria-busy={pending}");
    expect(inboxSource).toContain('data-review-pending={pending ? "true" : "false"}');
    expect(inboxSource).toContain('className={styles.reviewInboxMessage} role="status"');
  });

  it("distinguishes an operator configuration lock from temporary candidate load", () => {
    expect(inboxSource).toContain('code === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"');
    expect(inboxSource).toContain('code === "PUBLIC_ASK_CONCURRENCY_LIMIT"');
    expect(inboxSource).toContain("분산 보호 설정이 완료될 때까지 잠겨");
    expect(inboxSource).toContain("AI 후보 준비 작업이 진행 중입니다.");
    expect(inboxSource).toContain('if (status === 401) return "로그인 상태를 다시 확인해 주세요.";');
    expect(inboxSource).toContain('if (status === 503) return "검토 저장소 또는 AI 보호 설정을 확인해 주세요.";');
    expect(inboxSource).toContain("knowledge review candidate preparation rejected");
    expect(inboxSource).toContain("기존 후보 검토와 미게시 경계는 그대로 유지됩니다.");
  });

  it("makes horizontally contained authority evidence keyboard reachable", () => {
    expect(inboxSource).toContain('className={styles.reviewAuthorityCounts} tabIndex={0} aria-label="근거 구성 수량, 가로로 스크롤 가능" onKeyDown={handleHorizontalScrollKey}');
    expect(inboxSource).toContain('className={styles.reviewBoundary} role="region" tabIndex={0} aria-label="후보 적용 경계, 가로로 스크롤 가능" onKeyDown={handleHorizontalScrollKey}');
    expect(inboxSource).toContain('if (event.key === "End") left = element.scrollWidth;');
    expect(cssSource).toMatch(/\.reviewAuthorityCounts:focus-visible,[\s\S]*?\.reviewBoundary:focus-visible[\s\S]*?outline:\s*3px solid/u);
  });

  it("preserves the authoritative local report when assembling live evidence", () => {
    expect(browserRunnerSource).toContain(
      'const localReportPath = path.join(afterLocalDir, "report.json")'
    );
    expect(browserRunnerSource).toContain(
      'const summaryReportPath = path.join(summaryDir, "report.json")'
    );
    expect(browserRunnerSource).toContain(
      'await fs.writeFile(summaryReportPath, `${JSON.stringify(summary, null, 2)}\\n`, "utf8")'
    );
    expect(browserRunnerSource).not.toContain(
      'fs.copyFile(localReportPath, path.join(afterLocalDir, "report.json"))'
    );
  });

  it("fails the live review runner closed when evidence digests or readiness labels collapse", () => {
    expect(browserRunnerSource).toContain("metrics.evidenceDigestWidth >= 160");
    expect(browserRunnerSource).toContain("metrics.evidenceDigestHeight <= 36");
    expect(browserRunnerSource).toContain("mobileEvidence.digestWidth >= 160");
    expect(browserRunnerSource).toContain("metrics.readinessSectionMinWidth >= (viewport.width > 720 ? 120 : 96)");
    expect(browserRunnerSource).toContain("metrics.readinessLabelMaxHeight <= 36");
    expect(browserRunnerSource).toContain("knowledge-review-evidence-readability-${theme}-${viewport.name}");
  });

  it("fails the browser contract closed when the candidate subject loses evidence context", () => {
    expect(browserRunnerSource).toContain("metrics.selectedBodyBeforeReadiness");
    expect(browserRunnerSource).toContain('metrics.selectedBodyText.startsWith("1) 위험요인 요약:")');
    expect(browserRunnerSource).toContain("metrics.selectedBodyTopVisible");
    expect(browserRunnerSource).toContain("metrics.candidatePositionsComplete");
    expect(browserRunnerSource).toContain("candidatePositionLabels: results.every");
    expect(browserRunnerSource).toContain("metrics.evidenceSubjectContextCount === 1");
    expect(browserRunnerSource).toContain("mobileEvidence.subjectContextCount === 1");
    expect(browserRunnerSource).toContain("mobileEvidence.subjectVisible");
    expect(browserRunnerSource).toContain("knowledge-review-candidate-subject-${theme}-${viewport.name}");
  });

  it("keeps hazard-to-evidence trace evidence scoped and fail closed", () => {
    expect(browserRunnerSource).toContain('process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "trace-blocks"');
    expect(browserRunnerSource).toContain('schemaVersion: "safeclaw-hermes-review-trace-block-summary/v1"');
    expect(browserRunnerSource).toContain('verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS"');
    expect(browserRunnerSource).toContain("approvalFailsClosedWhenIncomplete: true");
    expect(browserRunnerSource).toContain("allHazardsClosed: false");
    expect(browserRunnerSource).toContain("allDocumentsClosed: false");
    expect(browserRunnerSource).toContain("machineEvidenceReplacesHumanReview: false");
    expect(browserRunnerSource).toContain('exactSavedShareVerdict: "MISSING_EVIDENCE"');
    expect(browserRunnerSource).toContain('traceMatrixMode ? "trace-matrix" : "trace-block"');
  });

  it("keeps the canonical hazard trace matrix complete and internally bounded", () => {
    expect(browserRunnerSource).toContain('process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "trace-matrix"');
    expect(browserRunnerSource).toContain('schemaVersion: "safeclaw-hermes-review-trace-matrix-summary/v1"');
    expect(browserRunnerSource).toContain('verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX"');
    expect(browserRunnerSource).toContain("canonicalControlLinkCount");
    expect(browserRunnerSource).toContain("canonicalDocumentLinkCount");
    expect(browserRunnerSource).toContain("allCanonicalMappingsClosed: true");
    expect(browserRunnerSource).toContain('traceScrollOwner: traceMatrixMode ? "candidate-pane" : null');
    expect(browserRunnerSource).toContain("candidatePaneInternalScroll");
    expect(browserRunnerSource).toContain("candidatePane.scrollTop += panelRect.top - paneRect.top - 8");
    expect(browserRunnerSource).toContain("traceScreenshotContextVisible === true");
    expect(browserRunnerSource).toContain('metrics.traceListOverflowY === "visible"');
    expect(browserRunnerSource).toContain("metrics.candidatePaneScrollHeight > metrics.candidatePaneClientHeight");
    expect(inboxSource).toContain("className={styles.reviewTraceLinks}");
    expect(cssSource).toMatch(/\.reviewTraceability ol\s*\{[\s\S]*?overflow:\s*visible;/u);
    expect(browserRunnerSource).toContain("machineEvidenceReplacesHumanReview: false");
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
    expect(pageSource).toContain('data-knowledge-progressive-disclosure="promotion"');
    expect(pageSource).toContain('data-knowledge-progressive-disclosure="authority"');
    expect(pageSource).toContain('name="knowledge-governance-support"');
    expect(pageSource).toContain('data-knowledge-progressive-disclosure="hazards"');
    expect(pageSource).toContain('data-knowledge-progressive-disclosure="forms"');
    expect(pageSource).toContain('name="knowledge-wiki-directory"');
    expect(cssSource).toContain("@media (max-width: 720px)");
    expect(cssSource).not.toMatch(/gradient\s*\(/i);
  });

  it("keeps the mobile task selector on one locally scrolling rail", () => {
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.tabList\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*hidden;/u);
    expect(cssSource).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.sectionTab\s*\{[\s\S]*?flex:\s*0 0 104px;[\s\S]*?scroll-snap-align:\s*start;/u);
    expect(navigatorSource).toContain('selectedTab.scrollIntoView({ block: "nearest", inline: "nearest" });');
  });

  it("gives repeated knowledge disclosures and links full touch targets", () => {
    expect(cssSource).toMatch(/\.referenceDisclosure > summary[\s\S]*?min-height:\s*44px;/u);
    expect(cssSource).toMatch(/\.detailContent a[\s\S]*?min-height:\s*44px;/u);
  });
});
