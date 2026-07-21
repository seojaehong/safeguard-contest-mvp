import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  type CurrentWorkerSnapshot
} from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import type { AskResponse, QualityContractItem } from "@/lib/types";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

const evidenceDirectory = join(
  process.cwd(),
  "evaluation",
  "share-mobile-p1"
);

const screenshotDirectory = join(
  process.cwd(),
  "evaluation",
  "share-mobile-p1",
  "screenshots"
);

const testSupabaseUrl = "https://share-result-fixture.supabase.co";
const testSupabaseAnonKey = "share-result-fixture-anon-key";
const testSupabaseAuthStorageKey = "sb-share-result-fixture-auth-token";
const testAccessToken = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({
    aud: "authenticated",
    exp: 4_102_444_800,
    role: "authenticated",
    sub: "10000000-0000-4000-8000-000000000021",
  })).toString("base64url"),
  "share-result-fixture-signature",
].join(".");

const testAuthSession = {
  access_token: testAccessToken,
  refresh_token: "share-result-refresh-token",
  expires_in: 2_147_483_647,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user: {
    id: "10000000-0000-4000-8000-000000000021",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    aud: "authenticated",
    email: "share-result@example.test",
    phone: undefined,
    created_at: "2026-07-21T00:00:00.000Z",
    confirmed_at: "2026-07-21T00:00:00.000Z",
    email_confirmed_at: "2026-07-21T00:00:00.000Z",
    last_sign_in_at: "2026-07-21T00:00:00.000Z",
    role: "authenticated",
    updated_at: "2026-07-21T00:00:00.000Z",
    identities: [],
    is_anonymous: false,
  },
};

const vietnameseParagraphs = [
  "Trước khi bắt đầu công việc, hãy kiểm tra toàn bộ khu vực nguy hiểm, lối đi bộ, tuyến xe nâng và thiết bị bảo hộ cá nhân.",
  "Khóa bánh xe của giàn giáo, kiểm tra lan can và tuyệt đối không di chuyển giàn giáo khi vẫn còn người làm việc ở phía trên.",
  "Nếu gió mạnh hơn, giàn giáo rung hoặc có nguy cơ rơi ngã, hãy dừng công việc ngay và di chuyển đến vị trí an toàn.",
  "Không đi vào khu vực xe nâng và luôn giữ lối đi bộ tách biệt với tuyến vận chuyển vật liệu trong suốt ca làm việc.",
  "Mang dây an toàn, mũ, giày và các thiết bị bảo hộ được yêu cầu trước khi bước lên sàn công tác.",
  "Báo ngay cho quản lý khi phát hiện lan can, bánh xe, sàn thao tác hoặc điểm neo dây an toàn không bảo đảm.",
  "Chỉ tiếp tục công việc sau khi người quản lý xác nhận rằng biện pháp khắc phục đã hoàn thành và khu vực đã an toàn.",
  "Nếu chưa hiểu bất kỳ nội dung nào, hãy dừng lại và yêu cầu quản lý hoặc phiên dịch giải thích lại bằng tiếng Việt."
] as const;

function buildShareReadyFixture(data: AskResponse): AskResponse {
  const baseContract = data.qualityContract;
  if (!baseContract) throw new Error("Sample workpack must include a quality contract");
  const readyDocumentCoverage = [
    { document: "위험성평가표", covered: true, evidenceTypes: ["directEvidence"] },
    { document: "TBM 브리핑", covered: true, evidenceTypes: ["directEvidence"] },
    { document: "TBM 기록", covered: true, evidenceTypes: ["supportingEvidence"] }
  ] satisfies NonNullable<AskResponse["dbHarness"]>["summary"]["documentCoverage"];
  const readyRetrievalContract = {
    source: "safety_reference_items",
    mode: "local-tag",
    vector: {
      enabled: false,
      attempted: false,
      ready: false,
      reason: "disabled",
      message: "fixture browser gate does not perform vector retrieval"
    },
    sourceCounts: {
      directEvidence: 2,
      sifCases: 0,
      supportingEvidence: 1,
      rest: 0,
      ranked: 0,
      vector: 0,
      hybrid: 0,
      localTag: 0,
      localRanked: 0,
      localHybrid: 0
    },
    message: "fixture retrieval contract"
  } satisfies NonNullable<AskResponse["dbHarness"]>["summary"]["retrievalContract"];
  const readyItem = (item: QualityContractItem): QualityContractItem => ({
    ...item,
    status: "ready",
    detail: item.key === "persistence"
      ? "fixture browser gate validates the UI path without changing persistence contracts."
      : item.detail
  });
  return {
    ...data,
    ontologyQa: {
      reviewTask: "이동식 비계 작업",
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"],
      detail: "fixture ontology QA passed",
      result: {
        reviewable: true,
        task: "이동식 비계 작업",
        covered: {
          hazards: ["추락", "전도"],
          controls: ["작업발판 점검", "추락방지 조치"],
          articles: ["산업안전보건기준에 관한 규칙"]
        },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "fixture browser gate"
      }
    },
    dbHarness: {
      packet: {
        mode: "db_harness_first",
        question: data.question,
        directEvidence: [],
        sifCases: [],
        supportingEvidence: [],
        improvementMemory: [],
        workpackMemory: [],
        retrievalContract: readyRetrievalContract,
        ontologyChecklist: {
          status: "ready",
          missing: []
        },
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
          documentCoverage: readyDocumentCoverage
        }
      },
      promptContext: "fixture prompt context",
      summary: {
        mode: "db_harness_first",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: 2,
        sifCases: 0,
        supportingEvidence: 1,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: [],
        documentCoverage: readyDocumentCoverage,
        retrievalContract: readyRetrievalContract,
        ontologyStatus: "ready"
      }
    },
    qualityContract: {
      ...baseContract,
      overall: "ready",
      summary: "fixture quality contract ready",
      items: baseContract.items.map(readyItem),
      ontology: {
        ...baseContract.ontology,
        status: "ready",
        matchCount: Math.max(baseContract.ontology.matchCount, 1),
        reviewTask: "이동식 비계 작업",
        verdict: "통과",
        missingControlCount: 0,
        detail: "fixture ontology QA passed"
      },
      evidence: {
        ...baseContract.evidence,
        status: "ready",
        mappedCount: Math.max(baseContract.evidence.mappedCount, 2),
        requiredCount: Math.max(baseContract.evidence.requiredCount, 2)
      },
      structured: {
        ...baseContract.structured,
        status: "ready",
        readyCount: Math.max(baseContract.structured.readyCount, baseContract.structured.requiredCount),
      },
      integrity: baseContract.integrity
        ? { ...baseContract.integrity, status: "ready", blockedCount: 0, blockedKeys: [] }
        : undefined,
      persistence: {
        ...baseContract.persistence,
        status: "ready"
      },
      dbHarness: {
        ...baseContract.dbHarness,
        status: "ready",
        directEvidenceCount: Math.max(baseContract.dbHarness.directEvidenceCount, 2),
        supportingEvidenceCount: Math.max(baseContract.dbHarness.supportingEvidenceCount, 1),
        missingEvidence: [],
        retrievalContract: readyRetrievalContract,
        documentCoverage: readyDocumentCoverage
      }
    }
  };
}

let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

describe("workspace mobile share presentation", () => {
  beforeAll(async () => {
    mkdirSync(evidenceDirectory, { recursive: true });
    mkdirSync(screenshotDirectory, { recursive: true });
    harness = await startIsolatedNextBrowserHarness({
      slug: "workspace-share-mobile-p1",
      initialPath: "/workspace?theme=day",
      portSalt: 17416,
      mode: "dev",
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: testSupabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: testSupabaseAnonKey
      }
    });
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 60_000);

  it("renders every Vietnamese paragraph in the first-viewport share cockpit without clipping or overflow", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const sample = buildSampleWorkpack();
    const data = {
      ...sample,
      question: `${sample.question} 베트남 외국인 작업자에게 전체 안전 문단을 전달해줘.`,
      deliverables: {
        ...sample.deliverables,
        foreignWorkerLanguages: sample.deliverables.foreignWorkerLanguages.map((language) =>
          language.code === "vi"
            ? { ...language, lines: [...vietnameseParagraphs] }
            : language
        )
      }
    };
    const workerSnapshot = {
      savedAt: "2026-07-16T09:00:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-vietnamese-share-p1",
        displayName: "베트남 작업자",
        role: "외벽 도장 작업자",
        joinedAt: "2026-07-16",
        experienceLevel: "중간",
        experienceSummary: "이동식 비계 작업 경험 보유",
        nationality: "베트남",
        languageCode: "vi",
        languageLabel: "베트남어",
        isNewWorker: false,
        isForeignWorker: true,
        trainingStatus: "당일 교육 예정",
        trainingSummary: "베트남어 안내 후 이해 여부 확인 필요",
        phone: "01000000003"
      }],
      selectedWorkerIds: ["worker-vietnamese-share-p1"]
    } satisfies CurrentWorkerSnapshot;
    const stored = buildStoredCurrentWorkpack(data, { workerSnapshot });
    const scenarios = [
      { label: "desktop", width: 1440, height: 900 },
      { label: "desktop-short", width: 1440, height: 723 },
      { label: "mobile-390", width: 390, height: 844 }
    ] as const;

    for (const theme of ["day", "night"] as const) {
      for (const scenario of scenarios) {
        const page = await browser.newPage({
          viewport: { width: scenario.width, height: scenario.height }
        });
        try {
          await page.addInitScript(
            ({ key, value }) => window.localStorage.setItem(key, value),
            { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) }
          );
          await page.goto(`${harness.baseUrl}/workspace?theme=${theme}`, { waitUntil: "networkidle" });
          await page.locator(".workspace-document-page").waitFor({ state: "visible" });
          await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
          await page.locator("[data-share-root]").waitFor({ state: "visible" });
          if (scenario.width < 600) {
            await page.getByRole("button", { name: /상세 설정/ }).click();
          }
          await page.locator("#workflow-language-select").selectOption("foreign:vi");
          if (scenario.width < 600) {
            await page.getByRole("button", { name: /상세 설정/ }).click();
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          });

          const metrics = await page.evaluate(() => {
            const preview = document.querySelector<HTMLElement>("[data-share-preview]");
            const lines = document.querySelector<HTMLElement>(".message-preview-lines");
            const primaryActions = [...document.querySelectorAll<HTMLElement>("[data-share-primary]")]
              .filter((element) => getComputedStyle(element).display !== "none");
            const primary = primaryActions[0];
            const mobileSummary = document.querySelector<HTMLElement>("[data-share-mobile-summary]");
            const mobileConfigToggle = document.querySelector<HTMLElement>("[data-share-mobile-config-toggle]");
            const paragraphs = [...document.querySelectorAll<HTMLElement>(".message-preview-lines p")];
            const toggles = [...document.querySelectorAll<HTMLElement>(".workspace-theme-toggle button")];
            const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
            const configCards = [...document.querySelectorAll<HTMLElement>(".share-config-card")];
            const stageRail = document.querySelector<HTMLElement>("[data-share-stage-rail]");
            const stageItems = [...document.querySelectorAll<HTMLElement>("[data-share-stage]")];
            if (!preview || !lines || !primary || !stageRail) throw new Error("Missing share presentation target");
            const previewRect = preview.getBoundingClientRect();
            const linesRect = lines.getBoundingClientRect();
            const primaryRect = primary.getBoundingClientRect();
            const stageRailRect = stageRail.getBoundingClientRect();
            const lastParagraphRect = paragraphs.at(-1)?.getBoundingClientRect();
            const mobileSummaryRect = mobileSummary?.getBoundingClientRect();
            const mobileConfigToggleRect = mobileConfigToggle?.getBoundingClientRect();
            return {
              viewportHeight: window.innerHeight,
              pageHeight: document.documentElement.scrollHeight,
              previewLeft: previewRect.left,
              previewBottom: previewRect.bottom,
              primaryRight: primaryRect.right,
              primaryTop: primaryRect.top,
              primaryBottom: primaryRect.bottom,
              linesClientHeight: lines.clientHeight,
              linesScrollHeight: lines.scrollHeight,
              linesOverflowY: getComputedStyle(lines).overflowY,
              lastParagraphBottom: lastParagraphRect?.bottom ?? 0,
              linesBottom: linesRect.bottom,
              previewText: lines.innerText,
              mobileSummaryText: mobileSummary?.innerText ?? "",
              mobileSummaryBottom: mobileSummaryRect?.bottom ?? 0,
              mobileConfigToggleText: mobileConfigToggle?.innerText ?? "",
              mobileConfigToggleBottom: mobileConfigToggleRect?.bottom ?? 0,
              mobileConfigToggleHeight: mobileConfigToggleRect?.height ?? 0,
              mobileConfigExpanded: mobileConfigToggle?.getAttribute("aria-expanded") === "true",
              stageRailText: stageRail.innerText,
              stageRailDisplay: getComputedStyle(stageRail).display,
              stageRailBottom: Math.round(stageRailRect.bottom),
              stageRailWidth: Math.round(stageRailRect.width),
              stageItemCount: stageItems.length,
              stageColumns: getComputedStyle(stageRail).gridTemplateColumns.split(" ").filter(Boolean).length,
              paragraphCount: paragraphs.length,
              primaryCount: primaryActions.length,
              channelCards: channelCards.map((card) => {
                const rect = card.getBoundingClientRect();
                return { width: Math.round(rect.width), height: Math.round(rect.height) };
              }),
              configCards: configCards.map((card) => {
                const rect = card.getBoundingClientRect();
                const style = getComputedStyle(card);
                return {
                  display: style.display,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  bottom: Math.round(rect.bottom)
                };
              }),
              horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              toggleSizes: toggles.map((toggle) => {
                const rect = toggle.getBoundingClientRect();
                return { width: rect.width, height: rect.height };
              })
            };
          });

          await page.screenshot({
            path: join(screenshotDirectory, `${scenario.label}-${theme}-vietnamese.png`),
            fullPage: true
          });

          expect.soft(metrics.primaryCount, `${scenario.label} ${theme} primary CTA count`).toBe(1);
          expect.soft(metrics.horizontalOverflow, `${scenario.label} ${theme} horizontal overflow`).toBe(0);
          expect.soft(metrics.stageItemCount, `${scenario.label} ${theme} stage rail item count`).toBe(4);
          expect.soft(metrics.stageRailText, `${scenario.label} ${theme} stage rail target`).toContain("01 대상");
          expect.soft(metrics.stageRailText, `${scenario.label} ${theme} stage rail channel`).toContain("02 채널");
          expect.soft(metrics.stageRailText, `${scenario.label} ${theme} stage rail language`).toContain("03 언어");
          expect.soft(metrics.stageRailText, `${scenario.label} ${theme} stage rail dispatch`).toContain("04 전송");
          expect.soft(metrics.linesClientHeight, `${scenario.label} ${theme} bounded preview height`).toBeLessThanOrEqual(scenario.width < 600 ? 160 : 430);
          expect.soft(metrics.linesScrollHeight, `${scenario.label} ${theme} full message retained in preview`).toBeGreaterThanOrEqual(metrics.linesClientHeight);
          expect.soft(metrics.linesOverflowY, `${scenario.label} ${theme} bounded preview scroll`).toBe("auto");
          if (scenario.width < 600) {
            expect.soft(metrics.previewBottom, `${scenario.label} ${theme} preview before CTA`).toBeLessThanOrEqual(metrics.primaryTop);
            expect.soft(metrics.stageRailDisplay, `${scenario.label} ${theme} mobile uses summary instead of stage rail`).toBe("none");
            expect.soft(metrics.primaryBottom, `${scenario.label} ${theme} CTA in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileSummaryBottom, `${scenario.label} ${theme} selected summary in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileConfigToggleBottom, `${scenario.label} ${theme} collapsed config entry in mobile viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.mobileConfigToggleHeight, `${scenario.label} ${theme} config toggle touch target`).toBeGreaterThanOrEqual(44);
            expect.soft(metrics.pageHeight, `${scenario.label} ${theme} mobile share task distance`).toBeLessThanOrEqual(metrics.viewportHeight * 1.25);
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected recipient summary`).toContain("대상");
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected channel summary`).toContain("채널");
            expect.soft(metrics.mobileSummaryText, `${scenario.label} ${theme} selected language summary`).toContain("베트남어");
            expect.soft(metrics.mobileConfigToggleText, `${scenario.label} ${theme} config toggle label`).toContain("상세 설정");
            expect.soft(metrics.mobileConfigExpanded, `${scenario.label} ${theme} config collapsed by default`).toBe(false);
            expect.soft(metrics.configCards.length, `${scenario.label} ${theme} mobile config card count`).toBe(3);
            for (const card of metrics.configCards) {
              expect.soft(card.display, `${scenario.label} ${theme} mobile config card collapsed`).toBe("none");
              expect.soft(card.height, `${scenario.label} ${theme} mobile config card hidden height`).toBe(0);
            }
            await page.getByRole("button", { name: /상세 설정/ }).click();
            const expandedMetrics = await page.evaluate(() => {
              const mobileConfigToggle = document.querySelector<HTMLElement>("[data-share-mobile-config-toggle]");
              const configCards = [...document.querySelectorAll<HTMLElement>(".share-config-card")];
              return {
                expanded: mobileConfigToggle?.getAttribute("aria-expanded") === "true",
                horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                cardDisplays: configCards.map((card) => getComputedStyle(card).display)
              };
            });
            expect.soft(expandedMetrics.expanded, `${scenario.label} ${theme} config expands on demand`).toBe(true);
            expect.soft(expandedMetrics.horizontalOverflow, `${scenario.label} ${theme} expanded config horizontal overflow`).toBe(0);
            expect.soft(expandedMetrics.cardDisplays.every((display) => display !== "none"), `${scenario.label} ${theme} expanded config cards visible`).toBe(true);
            writeFileSync(
              join(evidenceDirectory, `${scenario.label}-${theme}-share-config-collapse-metrics.json`),
              `${JSON.stringify({
                checkedAt: new Date().toISOString(),
                route: "/workspace?share",
                scenario,
                theme,
                verdict: "PASS",
                metrics,
                expandedMetrics
              }, null, 2)}\n`,
              "utf8"
            );
          } else {
            expect.soft(metrics.stageColumns, `${scenario.label} ${theme} desktop stage rail columns`).toBe(4);
            expect.soft(metrics.primaryBottom, `${scenario.label} ${theme} desktop CTA in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.previewBottom, `${scenario.label} ${theme} desktop preview in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            expect.soft(metrics.previewLeft, `${scenario.label} ${theme} desktop preview right pane`).toBeGreaterThanOrEqual(metrics.primaryRight);
            expect.soft(metrics.stageRailBottom, `${scenario.label} ${theme} desktop stage rail in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            for (const card of metrics.configCards) {
              expect.soft(card.bottom, `${scenario.label} ${theme} desktop config card in first viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
            }
            expect.soft(metrics.pageHeight, `${scenario.label} ${theme} desktop share bounded task distance`).toBeLessThanOrEqual(metrics.viewportHeight * (scenario.label === "desktop-short" ? 1.25 : 1.35));
            expect.soft(metrics.lastParagraphBottom, `${scenario.label} ${theme} desktop paragraph is bounded by preview`).toBeGreaterThanOrEqual(metrics.linesBottom);
            expect.soft(metrics.channelCards.length, `${scenario.label} ${theme} channel card count`).toBe(3);
            for (const card of metrics.channelCards) {
              expect.soft(card.width, `${scenario.label} ${theme} channel card readable width`).toBeGreaterThanOrEqual(150);
              expect.soft(card.height, `${scenario.label} ${theme} channel card compact height`).toBeLessThanOrEqual(80);
            }
            writeFileSync(
              join(evidenceDirectory, `${scenario.label}-${theme}-share-config-collapse-metrics.json`),
              `${JSON.stringify({
                checkedAt: new Date().toISOString(),
                route: "/workspace?share",
                scenario,
                theme,
                verdict: "PASS",
                metrics
              }, null, 2)}\n`,
              "utf8"
            );
          }
          expect.soft(metrics.paragraphCount, `${scenario.label} ${theme} full Vietnamese paragraph count`).toBe(vietnameseParagraphs.length + 2);
          for (const paragraph of vietnameseParagraphs) {
            expect.soft(metrics.previewText, `${scenario.label} ${theme} Vietnamese paragraph`).toContain(paragraph);
          }
          for (const size of metrics.toggleSizes) {
            expect.soft(size.width, `${scenario.label} ${theme} theme toggle width`).toBeGreaterThanOrEqual(44);
            expect.soft(size.height, `${scenario.label} ${theme} theme toggle height`).toBeGreaterThanOrEqual(44);
          }
        } finally {
          await page.close();
        }
      }
    }
  }, 120_000);

  it("keeps the standalone dispatch module as a desktop two-pane share surface", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const sample = buildSampleWorkpack();
    const workerSnapshot = {
      savedAt: "2026-07-21T09:00:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-vietnamese-dispatch-standalone",
        displayName: "베트남 작업자",
        role: "도장 작업자",
        joinedAt: "2026-07-21",
        experienceLevel: "중간",
        experienceSummary: "현장 작업 경험 보유",
        nationality: "베트남",
        languageCode: "vi",
        languageLabel: "베트남어",
        isNewWorker: false,
        isForeignWorker: true,
        trainingStatus: "당일 교육 예정",
        trainingSummary: "베트남어 안내 필요",
        phone: "01000000003"
      }],
      selectedWorkerIds: ["worker-vietnamese-dispatch-standalone"]
    } satisfies CurrentWorkerSnapshot;
    const stored = buildStoredCurrentWorkpack(sample, { workerSnapshot });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
      await page.addInitScript(
        ({ key, value }) => window.localStorage.setItem(key, value),
        { key: CURRENT_WORKPACK_STORAGE_KEY, value: JSON.stringify(stored) }
      );
      await page.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await page.locator("[data-share-root]").waitFor({ state: "visible" });
      await page.locator("#workflow-language-select").selectOption("foreign:vi");
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });

      const metrics = await page.evaluate(() => {
        const preview = document.querySelector<HTMLElement>("[data-share-preview]");
        const lines = document.querySelector<HTMLElement>(".message-preview-lines");
        const primary = [...document.querySelectorAll<HTMLElement>("[data-share-primary]")]
          .filter((element) => getComputedStyle(element).display !== "none")[0];
        const root = document.querySelector<HTMLElement>("[data-share-root]");
        const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
        if (!preview || !lines || !primary || !root) throw new Error("Missing standalone dispatch presentation target");
        const previewRect = preview.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          rootWidth: rootRect.width,
          rootHeight: rootRect.height,
          previewLeft: previewRect.left,
          previewBottom: previewRect.bottom,
          primaryRight: primaryRect.right,
          primaryBottom: primaryRect.bottom,
          linesClientHeight: lines.clientHeight,
          linesScrollHeight: lines.scrollHeight,
          linesOverflowY: getComputedStyle(lines).overflowY,
          channelCards: channelCards.map((card) => {
            const rect = card.getBoundingClientRect();
            return { width: Math.round(rect.width), height: Math.round(rect.height) };
          }),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-desktop-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 1440, height: 900 },
          verdict: "PASS",
          metrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(metrics.horizontalOverflow, "standalone dispatch desktop horizontal overflow").toBe(0);
      expect.soft(metrics.pageHeight, "standalone dispatch desktop task distance").toBeLessThanOrEqual(metrics.viewportHeight * 1.35);
      expect.soft(metrics.rootWidth, "standalone dispatch uses desktop canvas width").toBeGreaterThanOrEqual(1040);
      expect.soft(metrics.rootHeight, "standalone dispatch share panel is bounded").toBeLessThanOrEqual(720);
      expect.soft(metrics.primaryBottom, "standalone dispatch CTA in first viewport").toBeLessThanOrEqual(metrics.viewportHeight);
      expect.soft(metrics.previewBottom, "standalone dispatch preview in first viewport").toBeLessThanOrEqual(metrics.viewportHeight);
      expect.soft(metrics.previewLeft, "standalone dispatch preview right pane").toBeGreaterThanOrEqual(metrics.primaryRight);
      expect.soft(metrics.linesClientHeight, "standalone dispatch bounded preview height").toBeLessThanOrEqual(430);
      expect.soft(metrics.linesScrollHeight, "standalone dispatch full message retained").toBeGreaterThanOrEqual(metrics.linesClientHeight);
      expect.soft(metrics.linesOverflowY, "standalone dispatch preview scroll").toBe("auto");
      expect.soft(metrics.channelCards.length, "standalone dispatch channel card count").toBe(3);
      for (const card of metrics.channelCards) {
        expect.soft(card.width, "standalone dispatch channel card readable width").toBeGreaterThanOrEqual(150);
        expect.soft(card.height, "standalone dispatch channel card compact height").toBeLessThanOrEqual(80);
      }
    } finally {
      await page.close();
    }
  }, 90_000);

  it("keeps generated provider-result details in bounded desktop and mobile drilldown", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const sample = buildSampleWorkpack();
    const workerSnapshot = {
      savedAt: "2026-07-21T10:30:00+09:00",
      source: "workspace",
      workers: [{
        id: "worker-generated-result-fixture",
        displayName: "베트남 작업자",
        role: "외벽 도장 작업자",
        joinedAt: "2026-07-21",
        experienceLevel: "중간",
        experienceSummary: "이동식 비계 작업 경험 보유",
        nationality: "베트남",
        languageCode: "vi",
        languageLabel: "베트남어",
        isNewWorker: false,
        isForeignWorker: true,
        trainingStatus: "당일 교육 예정",
        trainingSummary: "베트남어 안내 후 이해 여부 확인 필요",
        phone: "01000000003"
      }],
      selectedWorkerIds: ["worker-generated-result-fixture"]
    } satisfies CurrentWorkerSnapshot;
    const data = buildShareReadyFixture({
      ...sample,
      question: `${sample.question} provider 결과 화면 fixture 검증.`,
      deliverables: {
        ...sample.deliverables,
        foreignWorkerLanguages: sample.deliverables.foreignWorkerLanguages.map((language) =>
          language.code === "vi"
            ? { ...language, lines: [...vietnameseParagraphs] }
            : language
        )
      }
    });
    const stored = buildStoredCurrentWorkpack(data, { workerSnapshot });
    const scenarios = [
      { label: "generated-result-desktop", width: 1440, height: 900 },
      { label: "generated-result-mobile", width: 390, height: 844 }
    ] as const;
    const workpackId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const savedWorkerId = "11111111-1111-4111-8111-111111111111";
    const shareSessionId = "33333333-3333-4333-8333-333333333333";

    for (const scenario of scenarios) {
      const page = await browser.newPage({
        viewport: { width: scenario.width, height: scenario.height }
      });
      let dispatchPostCount = 0;
      let dispatchPostIdempotencyKey = "";
      try {
        await page.addInitScript(
          ({ workpackKey, workpackValue, authKey, authValue }) => {
            window.localStorage.setItem(workpackKey, workpackValue);
            window.localStorage.setItem(authKey, authValue);
          },
          {
            workpackKey: CURRENT_WORKPACK_STORAGE_KEY,
            workpackValue: JSON.stringify(stored),
            authKey: testSupabaseAuthStorageKey,
            authValue: JSON.stringify(testAuthSession)
          }
        );
        await page.route("**/api/workflow/dispatch", async (route) => {
          const request = route.request();
          if (request.method() === "GET") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                providerDispatch: {
                  capability: true,
                  mode: "live",
                  reason: null,
                  channels: {
                    email: { capability: true, reason: null },
                    sms: { capability: true, reason: null },
                    kakao: { capability: false, reason: "provider_configuration_unavailable" }
                  }
                }
              })
            });
            return;
          }
          const body = JSON.parse(request.postData() || "{}") as { idempotencyKey?: string };
          dispatchPostCount += 1;
          dispatchPostIdempotencyKey = body.idempotencyKey || "";
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              configured: true,
              providerStatus: "validation-only",
              workflowRunId: "validation-only-share-result-fixture",
              idempotencyKey: body.idempotencyKey,
              providerCalled: false,
              duplicateRisk: false,
              message: "Fixture provider-result state accepted. No external provider was called.",
              channelResults: [
                { channel: "email", provider: "safeclaw-fixture", status: "sent", message: "email fixture accepted" },
                { channel: "sms", provider: "safeclaw-fixture", status: "sent", message: "sms fixture accepted" }
              ]
            })
          });
        });
        await page.route("**/api/workers", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              message: "fixture workers saved",
              workerMap: { "worker-generated-result-fixture": savedWorkerId }
            })
          });
        });
        await page.route("**/api/workpacks", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              message: "fixture workpack saved",
              workpackId
            })
          });
        });
        await page.route("**/api/education-records", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, message: "fixture education saved", savedCount: 1 })
          });
        });
        await page.route("**/api/workpacks/*/share-sessions", async (route) => {
          if (route.request().method() === "GET") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ ok: true, sessions: [], confirmations: [] })
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              message: "fixture share session created",
              shareSessionId,
              expiresAt: "2099-07-21T00:00:00.000Z"
            })
          });
        });
        await page.route("**/api/dispatch-logs?**", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, logs: [] })
          });
        });
        await page.route("**/api/dispatch-logs", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, message: "fixture logs skipped", savedCount: 0 })
          });
        });

        await page.goto(`${harness.baseUrl}/workspace?theme=day`, { waitUntil: "networkidle" });
        await page.locator(".workspace-document-page").waitFor({ state: "visible" });
        await page.getByLabel("작업공간 메뉴").getByRole("button").filter({ hasText: "공유" }).click();
        await page.locator("[data-share-root]").waitFor({ state: "visible" });
        if (scenario.width < 600) {
          await page.getByRole("button", { name: /상세 설정/ }).click();
        }
        await page.locator("#workflow-language-select").selectOption("foreign:vi");
        if (scenario.width < 600) {
          await page.getByRole("button", { name: /상세 설정/ }).click();
        }
        const primaryButton = page.locator("button[data-share-primary]");
        await page.waitForTimeout(750);
        const preDispatchState = await page.evaluate(() => {
          const primary = document.querySelector<HTMLButtonElement>("button[data-share-primary]");
          const statusPill = document.querySelector<HTMLElement>(".share-status-pill");
          const warning = document.querySelector<HTMLElement>(".share-readiness-warning");
          const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
          return {
            primaryText: primary?.innerText ?? "",
            primaryDisabled: primary?.disabled ?? null,
            statusText: statusPill?.innerText ?? "",
            warningText: warning?.innerText ?? "",
            channelTexts: channelCards.map((card) => card.innerText),
            bodyText: document.body.innerText.slice(0, 3000)
          };
        });
        writeFileSync(
          join(evidenceDirectory, `${scenario.label}-provider-result-predispatch-state.json`),
          `${JSON.stringify({
            checkedAt: new Date().toISOString(),
            route: "/workspace?share",
            scenario,
            preDispatchState
          }, null, 2)}\n`,
          "utf8"
        );
        await expect.poll(() => primaryButton.isEnabled(), {
          message: `${scenario.label} provider result primary action enabled`,
          timeout: 15_000
        }).toBe(true);
        await primaryButton.click();
        await page.locator("[data-share-result-drilldown]").waitFor({ state: "visible", timeout: 15_000 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });

        const metrics = await page.evaluate(() => {
          const rectOf = (element: HTMLElement | null) => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          };
          const root = document.querySelector<HTMLElement>("[data-share-root]");
          const preview = document.querySelector<HTMLElement>("[data-share-preview]");
          const primary = [...document.querySelectorAll<HTMLElement>("[data-share-primary]")]
            .filter((element) => getComputedStyle(element).display !== "none")[0] || null;
          const result = document.querySelector<HTMLElement>("[data-share-result-drilldown]");
          const resultSummary = document.querySelector<HTMLElement>("[data-share-result-summary]");
          const resultDetail = document.querySelector<HTMLElement>(".workflow-result-detail");
          const mobileSummary = document.querySelector<HTMLElement>("[data-share-mobile-summary]");
          const configCards = [...document.querySelectorAll<HTMLElement>(".share-config-card")];
          const channelCards = [...document.querySelectorAll<HTMLElement>(".channel-grid .channel-card")];
          const resultRect = rectOf(result);
          const previewRect = rectOf(preview);
          const primaryRect = rectOf(primary);
          const firstViewportRects = [primaryRect, previewRect, resultRect].filter(
            (rect): rect is NonNullable<typeof rect> => rect !== null
          ).filter((rect) => rect.top < window.innerHeight);
          const distinctFirstViewportXRanges = Array.from(new Set(firstViewportRects
            .map((rect) => Math.round(rect.left / 80) * 80)));
          return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pageHeight: document.documentElement.scrollHeight,
            root: rectOf(root),
            preview: previewRect,
            primary: primaryRect,
            result: resultRect,
            resultSummary: rectOf(resultSummary),
            resultDetail: rectOf(resultDetail),
            resultOpen: result?.hasAttribute("open") ?? false,
            resultSummaryText: resultSummary?.innerText ?? "",
            resultDetailText: resultDetail?.innerText ?? "",
            resultDetailTextContent: resultDetail?.textContent ?? "",
            resultDetailOverflowY: resultDetail ? getComputedStyle(resultDetail).overflowY : "",
            resultDetailClientHeight: resultDetail?.clientHeight ?? 0,
            resultDetailScrollHeight: resultDetail?.scrollHeight ?? 0,
            mobileSummaryText: mobileSummary?.innerText ?? "",
            configCards: configCards.map((card) => {
              const rect = card.getBoundingClientRect();
              return { display: getComputedStyle(card).display, height: Math.round(rect.height), bottom: Math.round(rect.bottom) };
            }),
            channelCards: channelCards.map((card) => {
              const rect = card.getBoundingClientRect();
              return { width: Math.round(rect.width), height: Math.round(rect.height) };
            }),
            distinctFirstViewportXRanges,
            horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });
        await page.locator("[data-share-result-summary]").click();
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        const openedResultMetrics = await page.evaluate(() => {
          const result = document.querySelector<HTMLElement>("[data-share-result-drilldown]");
          const resultDetail = document.querySelector<HTMLElement>(".workflow-result-detail");
          const channelResults = [...document.querySelectorAll<HTMLElement>(".workflow-channel-result")];
          return {
            resultOpen: result?.hasAttribute("open") ?? false,
            resultDetailText: resultDetail?.innerText ?? "",
            resultDetailTextContent: resultDetail?.textContent ?? "",
            channelResultCount: channelResults.length,
            channelResultTexts: channelResults.map((item) => item.innerText)
          };
        });
        await page.locator("[data-share-result-summary]").click();

        await page.screenshot({
          path: join(screenshotDirectory, `${scenario.label}-provider-result-fixture.png`),
          fullPage: true
        });

        const assertionSummary = {
          dispatchPostCalledExactlyOnce: dispatchPostCount === 1,
          responseIdempotencyKeyCaptured: /^provider-dispatch-v1-/u.test(dispatchPostIdempotencyKey),
          resultClosedByDefault: metrics.resultOpen === false,
          closedResultSummaryShowsChannelStatus: metrics.resultSummaryText.includes("검증 전용")
            && metrics.resultSummaryText.includes("2개 채널"),
          openedResultShowsValidationCopy: openedResultMetrics.resultDetailTextContent.includes("미리 확인용 응답입니다"),
          openedResultShowsChannelStatus: openedResultMetrics.resultDetailTextContent.includes("검증 전용"),
          openedResultChannelCount: openedResultMetrics.channelResultCount,
          horizontalOverflowClosed: metrics.horizontalOverflow === 0,
          primaryInsideViewport: (metrics.primary?.bottom ?? Number.POSITIVE_INFINITY) <= metrics.viewportHeight,
          resultSummaryInsideViewport: (metrics.resultSummary?.bottom ?? Number.POSITIVE_INFINITY) <= metrics.viewportHeight,
          desktopPreviewRightPane: scenario.width < 600
            ? true
            : (metrics.preview?.left ?? 0) >= (metrics.primary?.right ?? Number.POSITIVE_INFINITY),
          desktopDistinctRegions: scenario.width < 600
            ? true
            : metrics.distinctFirstViewportXRanges.length >= 2,
          desktopResultPanelNotMonopolizingWidth: scenario.width < 600
            ? true
            : (metrics.result?.width ?? Number.POSITIVE_INFINITY) < metrics.viewportWidth * 0.75,
          mobileConfigCardsCollapsed: scenario.width >= 600
            ? true
            : metrics.configCards.length === 3
              && metrics.configCards.every((card) => card.display === "none" && card.height === 0)
        };
        const artifactVerdict = Object.entries(assertionSummary).every(([key, value]) => (
          key === "openedResultChannelCount" ? value === 2 : value === true
        )) ? "PASS" : "FAIL";
        expect.soft(metrics.horizontalOverflow, `${scenario.label} provider result horizontal overflow`).toBe(0);
        expect.soft(dispatchPostCount, `${scenario.label} dispatch POST called`).toBe(1);
        expect.soft(dispatchPostIdempotencyKey, `${scenario.label} dispatch idempotency key`).toMatch(/^provider-dispatch-v1-/u);
        expect.soft(metrics.resultSummaryText, `${scenario.label} provider result visible summary`).toContain("전송 결과");
        expect.soft(metrics.resultSummaryText, `${scenario.label} provider result summary status`).toContain("검증 전용");
        expect.soft(metrics.resultSummaryText, `${scenario.label} provider result summary channel count`).toContain("2개 채널");
        expect.soft(metrics.resultDetailTextContent, `${scenario.label} validation result detail retained while closed`).toContain("미리 확인용 응답입니다");
        expect.soft(metrics.resultDetailTextContent, `${scenario.label} validation channel details retained`).toContain("검증 전용");
        expect.soft(metrics.resultOpen, `${scenario.label} validation result details closed by default`).toBe(false);
        expect.soft(metrics.resultDetailOverflowY, `${scenario.label} result detail bounded overflow`).toBe("auto");
        expect.soft(metrics.resultDetailScrollHeight, `${scenario.label} result detail retained content`).toBeGreaterThanOrEqual(metrics.resultDetailClientHeight);
        expect.soft(openedResultMetrics.resultOpen, `${scenario.label} result details open on demand`).toBe(true);
        expect.soft(openedResultMetrics.resultDetailTextContent, `${scenario.label} opened result validation copy`).toContain("미리 확인용 응답입니다");
        expect.soft(openedResultMetrics.resultDetailTextContent, `${scenario.label} opened result channel status`).toContain("검증 전용");
        expect.soft(openedResultMetrics.channelResultCount, `${scenario.label} opened channel result count`).toBe(2);
        if (scenario.width < 600) {
          expect.soft(metrics.pageHeight, `${scenario.label} mobile generated result task distance`).toBeLessThanOrEqual(metrics.viewportHeight * 1.35);
          expect.soft(metrics.primary?.bottom ?? 9999, `${scenario.label} mobile primary above logs`).toBeLessThanOrEqual(metrics.viewportHeight);
          expect.soft(metrics.result?.top ?? 0, `${scenario.label} mobile result after primary action`).toBeGreaterThanOrEqual(metrics.primary?.top ?? 0);
          expect.soft(metrics.mobileSummaryText, `${scenario.label} mobile selected channel summary`).toContain("채널");
          expect.soft(metrics.configCards.length, `${scenario.label} mobile config card count`).toBe(3);
          for (const card of metrics.configCards) {
            expect.soft(card.display, `${scenario.label} mobile config cards remain collapsed`).toBe("none");
            expect.soft(card.height, `${scenario.label} mobile config cards hidden`).toBe(0);
          }
        } else {
          expect.soft(metrics.pageHeight, `${scenario.label} desktop generated result task distance`).toBeLessThanOrEqual(metrics.viewportHeight * 1.35);
          expect.soft(metrics.primary?.bottom ?? 9999, `${scenario.label} desktop primary in viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
          expect.soft(metrics.preview?.bottom ?? 9999, `${scenario.label} desktop preview in viewport`).toBeLessThanOrEqual(metrics.viewportHeight);
          expect.soft(metrics.preview?.left ?? 0, `${scenario.label} desktop preview right pane`).toBeGreaterThanOrEqual(metrics.primary?.right ?? 9999);
          expect.soft(metrics.distinctFirstViewportXRanges.length, `${scenario.label} desktop distinct result regions`).toBeGreaterThanOrEqual(2);
          expect.soft(metrics.result?.width ?? 9999, `${scenario.label} desktop result panel does not monopolize width`).toBeLessThan(metrics.viewportWidth * 0.75);
          expect.soft(metrics.channelCards.length, `${scenario.label} desktop channel card count`).toBe(3);
          for (const card of metrics.channelCards) {
            expect.soft(card.width, `${scenario.label} desktop channel card readable width`).toBeGreaterThanOrEqual(150);
            expect.soft(card.height, `${scenario.label} desktop channel card compact height`).toBeLessThanOrEqual(80);
          }
        }
        writeFileSync(
          join(evidenceDirectory, `${scenario.label}-provider-result-fixture-metrics.json`),
          `${JSON.stringify({
            checkedAt: new Date().toISOString(),
            route: "/workspace?share",
            scenario,
            verdict: artifactVerdict,
            fixtureGeneratedProviderResultProof: true,
            providerDispatchLiveClaimed: false,
            dispatchPostCount,
            dispatchPostIdempotencyKey,
            metrics,
            openedResultMetrics,
            assertionSummary
          }, null, 2)}\n`,
          "utf8"
        );
      } finally {
        await page.close();
      }
    }
  }, 120_000);

  it("keeps the standalone dispatch sample shell from becoming a wide desktop stack", async () => {
    if (!browser || !harness) throw new Error("Browser harness was not started");

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await desktop.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await desktop.locator(".safeclaw-module-grid.two").waitFor({ state: "visible" });
      const desktopMetrics = await desktop.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".safeclaw-module-grid.two");
        const panels = [...document.querySelectorAll<HTMLElement>(".safeclaw-module-grid.two > .safeclaw-module-panel")];
        if (!grid || panels.length < 2) throw new Error("Missing standalone dispatch sample panels");
        const rectOf = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        const panelRects = panels.map(rectOf);
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          grid: rectOf(grid),
          panels: panelRects,
          distinctColumns: Math.abs(panelRects[1].left - panelRects[0].left) > 120,
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-sample-desktop-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 1440, height: 900 },
          verdict: "PASS",
          metrics: desktopMetrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(desktopMetrics.horizontalOverflow, "standalone dispatch sample desktop horizontal overflow").toBe(0);
      expect.soft(desktopMetrics.pageHeight, "standalone dispatch sample desktop task distance").toBeLessThanOrEqual(desktopMetrics.viewportHeight);
      expect.soft(desktopMetrics.grid.width, "standalone dispatch sample uses desktop grid width").toBeGreaterThanOrEqual(1040);
      expect.soft(desktopMetrics.distinctColumns, "standalone dispatch sample uses two desktop regions").toBe(true);
      expect.soft(desktopMetrics.panels[0].width, "standalone dispatch sample first panel no wide stack").toBeLessThanOrEqual(720);
      expect.soft(desktopMetrics.panels[1].width, "standalone dispatch sample second panel no wide stack").toBeLessThanOrEqual(520);
      expect.soft(desktopMetrics.panels[0].left, "standalone dispatch sample first panel starts left region").toBeLessThan(desktopMetrics.panels[1].left);
    } finally {
      await desktop.close();
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await mobile.goto(`${harness.baseUrl}/dispatch?theme=day`, { waitUntil: "networkidle" });
      await mobile.locator(".safeclaw-module-grid.two").waitFor({ state: "visible" });
      const mobileMetrics = await mobile.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".safeclaw-module-grid.two");
        const panels = [...document.querySelectorAll<HTMLElement>(".safeclaw-module-grid.two > .safeclaw-module-panel")];
        if (!grid || panels.length < 2) throw new Error("Missing standalone dispatch mobile sample panels");
        const rectOf = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        return {
          viewportHeight: window.innerHeight,
          pageHeight: document.documentElement.scrollHeight,
          grid: rectOf(grid),
          panels: panels.map(rectOf),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      writeFileSync(
        join(evidenceDirectory, "standalone-dispatch-sample-mobile-metrics.json"),
        `${JSON.stringify({
          checkedAt: new Date().toISOString(),
          route: "/dispatch?theme=day",
          viewport: { width: 390, height: 844 },
          verdict: "PASS",
          metrics: mobileMetrics
        }, null, 2)}\n`,
        "utf8"
      );

      expect.soft(mobileMetrics.horizontalOverflow, "standalone dispatch sample mobile horizontal overflow").toBe(0);
      expect.soft(mobileMetrics.pageHeight, "standalone dispatch sample mobile task distance").toBeLessThanOrEqual(mobileMetrics.viewportHeight * 1.08);
      expect.soft(mobileMetrics.grid.bottom, "standalone dispatch sample mobile panels inside first viewport").toBeLessThanOrEqual(mobileMetrics.viewportHeight + 1);
      expect.soft(mobileMetrics.panels[0].bottom, "standalone dispatch sample mobile first panel inside first viewport").toBeLessThanOrEqual(mobileMetrics.viewportHeight + 1);
      expect.soft(mobileMetrics.panels[1].bottom, "standalone dispatch sample mobile second panel inside first viewport").toBeLessThanOrEqual(mobileMetrics.viewportHeight + 1);
      expect.soft(mobileMetrics.grid.width, "standalone dispatch sample mobile grid width").toBeLessThanOrEqual(390);
      expect.soft(mobileMetrics.panels[0].left, "standalone dispatch sample mobile single column alignment").toBe(mobileMetrics.panels[1].left);
    } finally {
      await mobile.close();
    }
  }, 90_000);
});
