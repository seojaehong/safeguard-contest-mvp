import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import { buildSampleWorkpack } from "@/lib/sample-workpack";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import type { AskResponse } from "@/lib/types";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published")
);
const weldingControls = [
  "가연성물질 별도 보관·격리",
  "용접방화포·불티비산방지덮개 설치",
  "화재감시자 배치",
  "차광보안면·방열복 착용"
];

function buildReadyWeldingWorkpack(): AskResponse {
  const response = buildSampleWorkpack();
  const retrievalContract: NonNullable<AskResponse["dbHarness"]>["packet"]["retrievalContract"] = {
    source: "safety_reference_items",
    mode: "rest-ilike",
    vector: {
      enabled: false,
      attempted: false,
      ready: false,
      reason: "disabled",
      message: "vector search disabled for deterministic fixture"
    },
    sourceCounts: {
      directEvidence: 0,
      sifCases: 0,
      supportingEvidence: 1,
      rest: 1,
      ranked: 0,
      vector: 0,
      hybrid: 0,
      localTag: 0,
      localRanked: 0,
      localHybrid: 0
    },
    message: "published fixture reference"
  };
  const supportingEvidence: NonNullable<AskResponse["dbHarness"]>["packet"]["supportingEvidence"][number] = {
    id: "welding-reference",
    source_id: "published-ontology",
    item_type: "guidance",
    category: "용접",
    subcategory: null,
    title: "용접 작업 안전조치",
    summary: "편집 문서 재점검 기준",
    keywords: ["용접"],
    risk_tags: ["화재"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: weldingControls,
    evidence_role: "supporting",
    retrieval_source: "rest"
  };
  response.question = "용접 작업 전 안전조치 확인";
  response.mode = "live";
  response.ontologyQa = {
    reviewTask: "용접",
    result: {
      reviewable: true,
      task: "용접",
      covered: { hazards: [], controls: weldingControls, articles: [] },
      missing: { hazards: [], controls: [], articles: [] },
      coverageRate: 1,
      verdict: "통과",
      advisory: "생성 시점 검수"
    },
    sourceDocumentKeys: ["tbmBriefing"],
    detail: "생성 시점 안전조치 검수 통과"
  };
  response.status = {
    ...response.status,
    lawgo: "live",
    ai: "live",
    weather: "live",
    work24: "live",
    kosha: "live"
  };
  response.externalData.weather.mode = "live";
  response.externalData.training.mode = "live";
  response.externalData.koshaEducation.mode = "live";
  response.externalData.accidentCases.mode = "live";
  response.externalData.kosha.mode = "live";
  response.externalData.safetyKnowledge = {
    source: "safety-knowledge",
    mode: "live",
    detail: "검수 기준 연결",
    matches: [{
      id: "welding-ready",
      title: "용접 안전조치",
      primaryDocuments: ["TBM 브리핑"],
      controls: weldingControls,
      sourceTitles: ["published ontology"],
      legalMappingTitles: []
    }]
  };
  response.externalData.safetyReference = {
    source: "safety-reference-catalog",
    mode: "live",
    query: response.question,
    count: 1,
    totalItems: 1,
    message: "published reference ready",
    items: []
  };
  response.structured = {
    riskAssessmentRows: [{} as NonNullable<AskResponse["structured"]>["riskAssessmentRows"][number]],
    riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
  };
  response.deliverables.workPlanStructured = {} as NonNullable<AskResponse["deliverables"]["workPlanStructured"]>;
  response.deliverables.tbmBriefingStructured = {} as NonNullable<AskResponse["deliverables"]["tbmBriefingStructured"]>;
  response.deliverables.tbmLogStructured = {} as NonNullable<AskResponse["deliverables"]["tbmLogStructured"]>;
  response.dbHarness = {
    packet: {
      mode: "db_harness_first",
      question: response.question,
      directEvidence: [],
      sifCases: [],
      supportingEvidence: [supportingEvidence],
      improvementMemory: [],
      workpackMemory: [],
      retrievalContract,
      ontologyChecklist: { status: "ready", missing: [] },
      generationContract: {
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        requiredDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        missingEvidence: [],
        documentCoverage: ["위험성평가표", "TBM 브리핑", "TBM 기록"].map((document) => ({
          document,
          covered: true,
          evidenceTypes: ["directEvidence" as const]
        }))
      }
    },
    promptContext: "published welding basis",
    summary: {
      mode: "db_harness_first",
      llmRole: "naturalize_only",
      llmOutputScope: "rewrite_fixed_evidence_only",
      evidenceAuthority: "db_harness",
      providerRetryScope: "naturalization_retry_only",
      fallbackChainAllowed: false,
      genericProseSubstitutionAllowed: false,
      missingEvidencePolicy: "surface_review_required",
      directEvidence: 0,
      sifCases: 0,
      supportingEvidence: 1,
      improvementMemory: 0,
      workpackMemory: 0,
      missingEvidence: [],
      documentCoverage: ["위험성평가표", "TBM 브리핑", "TBM 기록"].map((document) => ({
        document,
        covered: true,
        evidenceTypes: ["directEvidence" as const]
      })),
      retrievalContract,
      ontologyStatus: "ready"
    }
  };
  return response;
}

describe("workspace edited workpack revalidation", () => {
  let browser: Browser | null = null;
  let harness: IsolatedNextBrowserHarness | null = null;

  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "workspace-edit-revalidation",
      initialPath: "/workspace?theme=day",
      portSalt: 5279,
      mode: process.env.WORKSPACE_REVALIDATION_BROWSER_MODE === "prod" ? "prod" : "dev"
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("keeps failed edits locked and unlocks share only after canonical content passes", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildReadyWeldingWorkpack();
    const preservedEdit = "사용자 편집 작업순서: 용접 전 가스 농도와 주변 작업을 확인한다.";
    const concurrentEdit = "재점검 중 추가 편집: 용접기 접지 상태를 다시 확인한다.";
    let askRequestCount = 0;
    let graphRequestCount = 0;
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));

    await page.route("**/api/weather?**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, weather: null })
    }));
    await page.route("**/api/ask", (route) => {
      askRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sample)
      });
    });
    await page.route("**/api/ontology/graph", async (route) => {
      graphRequestCount += 1;
      if (graphRequestCount === 1) await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, configured: true, scope: "published", graph: publishedGraph })
      });
    });

    await page.goto(`${harness.baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
    await page.locator(".advanced-settings > summary").click();
    await page.getByRole("radio", { name: /템플릿/ }).check();
    await page.locator("#field-command-input").fill(sample.question);
    await page.getByRole("button", { name: /안전 문서 생성/ }).click();
    await page.waitForTimeout(1_000);
    if (await page.locator(".document-preview-pane").count() === 0) {
      throw new Error(`Generation did not reach the document page (ask=${askRequestCount}, errors=${pageErrors.join(" | ")}): ${await page.locator("body").innerText()}`);
    }
    await page.locator(".document-viewer-list button", { hasText: "TBM 브리핑" }).click();
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();

    const editor = page.getByRole("textbox", { name: "TBM/작업 전 안전점검회의 편집" });
    const failingEdit = `${weldingControls.filter((control) => control !== "화재감시자 배치").join("\n")}\n${preservedEdit}`;
    await editor.fill(failingEdit);
    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();
    await page.getByTestId("revalidate-edited-workpack").click();
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await editor.fill(`${failingEdit}\n${concurrentEdit}`);
    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();

    await expect.poll(() => page.getByTestId("revalidate-edited-workpack").isVisible()).toBe(true);
    await expect.poll(() => page.locator(".document-preview-pane pre").textContent()).toContain(concurrentEdit);
    await page.getByTestId("revalidate-edited-workpack").click();
    await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
    await expect.poll(() => page.locator(".share-readiness-warning").count()).toBe(1);

    await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "문서" }).click();
    await page.locator(".doc-card-actions button", { hasText: "편집" }).click();
    await editor.fill(`${failingEdit}\n${concurrentEdit}\n화재감시자 배치`);
    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();
    await page.getByTestId("revalidate-edited-workpack").click();

    await expect.poll(() => page.getByTestId("revalidate-edited-workpack").count()).toBe(0);
    await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
    await page.locator(".workspace-share-page").waitFor({ state: "visible" });
    expect(await page.locator(".share-readiness-warning").count()).toBe(0);
    expect(await page.evaluate(() => window.localStorage.getItem("safeclaw.currentWorkpack.v1"))).toContain(preservedEdit);
    expect(await page.evaluate(() => window.localStorage.getItem("safeclaw.currentWorkpack.v1"))).toContain(concurrentEdit);
    await page.close();
  }, 90_000);
});
