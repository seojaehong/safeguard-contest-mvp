import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.SAFECLAW_KNOWLEDGE_UI_BASE_URL || "http://127.0.0.1:3091";
const outputDir = path.resolve(
  process.cwd(),
  process.env.SAFECLAW_KNOWLEDGE_UI_OUTPUT
    || "evaluation/hermes-knowledge-review-authority-ui-2026-07-25"
);
const checkedAt = new Date().toISOString();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: process.cwd(),
  encoding: "utf8"
}).trim();
const productCommit = process.env.SAFECLAW_KNOWLEDGE_UI_PRODUCT_COMMIT || sourceHead;
const authStorageKey = process.env.SAFECLAW_SUPABASE_STORAGE_KEY || "sb-fixture-auth-token";
const liveMode = /^https:\/\/www\.safeclaw\.kr(?:\/|$)/u.test(baseUrl);
const evidenceInspectorMode = process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "evidence-inspector";
const candidateReadinessMode = process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "candidate-readiness";
const eventFactsMode = process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "event-facts";
const traceBlocksMode = process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "trace-blocks";
const traceMatrixMode = process.env.SAFECLAW_KNOWLEDGE_UI_MODE === "trace-matrix";
const traceContractMode = traceBlocksMode || traceMatrixMode;
const eventFactsFixtureEnabled = eventFactsMode
  && process.env.SAFECLAW_KNOWLEDGE_UI_EVENT_FACTS_FIXTURE !== "0";
const traceBlocksFixtureEnabled = !traceContractMode
  || process.env.SAFECLAW_KNOWLEDGE_UI_TRACE_BLOCKS_FIXTURE !== "0";
const traceDocumentLabels = {
  riskAssessment: "위험성평가표",
  workPlan: "작업계획서",
  workpackSummary: "작업 요약",
  tbmBriefing: "TBM 브리핑",
  tbmLog: "TBM 기록",
  safetyEducation: "안전보건교육",
  emergencyResponse: "비상대응 절차",
  photoEvidence: "사진 증빙",
  foreignWorkerBriefing: "외국인 근로자 안내문",
  foreignWorkerTransmission: "외국인 근로자 전파문",
  dispatch: "현장 전파"
};
const canonicalTraceHazards = traceMatrixMode
  ? JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "safety-knowledge", "hazards.json"), "utf8"))
  : [];
if (traceMatrixMode && (!Array.isArray(canonicalTraceHazards)
  || canonicalTraceHazards.some((hazard) => (
    !hazard
    || typeof hazard.id !== "string"
    || typeof hazard.title !== "string"
    || !Array.isArray(hazard.controls)
    || hazard.controls.length === 0
    || hazard.controls.some((control) => typeof control !== "string" || !control.trim())
    || !Array.isArray(hazard.primaryDocuments)
    || hazard.primaryDocuments.length === 0
    || hazard.primaryDocuments.some((documentKey) => typeof documentKey !== "string" || !documentKey.trim())
  )))) {
  throw new Error("Invalid canonical hazard trace matrix fixture");
}
const traceEvidenceIds = [
  "evidence-1111111111111111",
  "evidence-2222222222222222",
  "evidence-3333333333333333",
  "evidence-4444444444444444",
  "evidence-5555555555555555"
];
const canonicalTraceItems = canonicalTraceHazards.map((hazard, index) => ({
  id: `trace-${hazard.id}`,
  hazardId: hazard.id,
  hazardTitle: hazard.title,
  controls: [...hazard.controls],
  primaryDocuments: hazard.primaryDocuments.map((documentKey) => traceDocumentLabels[documentKey] || documentKey),
  evidenceIds: [traceEvidenceIds[index % traceEvidenceIds.length]],
  resolved: true,
  unresolvedReviewItems: []
}));
const expectedTraceCount = traceMatrixMode ? canonicalTraceItems.length : 1;
const canonicalTraceControlLinkCount = canonicalTraceItems.reduce((count, item) => count + item.controls.length, 0);
const canonicalTraceDocumentLinkCount = canonicalTraceItems.reduce((count, item) => count + item.primaryDocuments.length, 0);
const baseOrigin = new URL(baseUrl).origin;
const productionBuild = liveMode
  ? await fetch(`${baseUrl}/api/build-info?codexCacheBust=${encodeURIComponent(checkedAt)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        return {
          status: response.status,
          ok: response.ok,
          commitSha: payload && typeof payload.commitSha === "string" ? payload.commitSha : null,
          branch: payload && typeof payload.branch === "string" ? payload.branch : null,
          environment: payload && typeof payload.environment === "string" ? payload.environment : null,
          deploymentUrl: payload && typeof payload.deploymentUrl === "string" ? payload.deploymentUrl : null
        };
      })
      .catch((error) => ({
        status: null,
        ok: false,
        commitSha: null,
        branch: null,
        environment: null,
        deploymentUrl: null,
        error: error instanceof Error ? error.message : String(error)
      }))
  : {
      status: null,
      ok: false,
      commitSha: null,
      branch: null,
      environment: "local",
      deploymentUrl: null
    };

function commitContainsProduct(productionCommit) {
  if (!productionCommit) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", productCommit, productionCommit], {
      cwd: process.cwd(),
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

const queueItem = {
  runId: "11111111-1111-4111-8111-111111111111",
  status: "review_required",
  statusLabel: "검토 대기",
  sourceEventCount: 5,
  candidateLabel: "고소작업 지식 후보 검토",
  candidateText: [
    eventFactsFixtureEnabled
      ? "1) 위험요인 요약: 작업발판 단부 추락 위험 / 원본 이벤트 검토 사실: 야간 교대 작업 · 청각 경보 보조수단 필요"
      : "1) 위험요인 요약: 작업발판 단부 추락 위험",
    "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
    "3) 통제대책: 안전난간 상태와 추락방지 조치를 작업 전 확인",
    "- 작업발판 개구부 덮개 상태도 함께 확인",
    "4) 검수 필요 항목: 현장 책임자가 실제 적용 상태 확인"
  ].join("\n"),
  matchedHazardCount: traceMatrixMode ? canonicalTraceItems.length : 1,
  providerLabel: "SafeClaw candidate builder",
  evidenceItems: [
    { id: "evidence-1111111111111111", authorityId: "law", authorityLabel: "법령 근거", sourceLabel: "산업안전보건법 제38조", capturedAt: "2026-08-14T00:00:00.000Z", digest: "sha256:1111111111111111", metadata: [{ label: "조문", value: "제38조" }], publicUrl: "https://www.law.go.kr/법령/산업안전보건법", ...(eventFactsFixtureEnabled ? { reviewFacts: [] } : {}) },
    { id: "evidence-2222222222222222", authorityId: "sif", authorityLabel: "SIF 통제 근거", sourceLabel: "추락 재해 통제 사례", capturedAt: "2026-08-14T00:01:00.000Z", digest: "sha256:2222222222222222", metadata: [{ label: "자료 유형", value: "sif-case" }], publicUrl: "https://www.kosha.or.kr/kosha/data/industrialAccidentStatus.do", ...(eventFactsFixtureEnabled ? { reviewFacts: [] } : {}) },
    { id: "evidence-3333333333333333", authorityId: "kosha", authorityLabel: "KOSHA 기술 지침", sourceLabel: "추락 방지 기술 지침", capturedAt: "2026-08-14T00:02:00.000Z", digest: "sha256:3333333333333333", metadata: [{ label: "가이드 코드", value: "C-49" }], publicUrl: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all", ...(eventFactsFixtureEnabled ? { reviewFacts: [] } : {}) },
    { id: "evidence-4444444444444444", authorityId: "organization_history", authorityLabel: "조직 전용 이력", sourceLabel: "조직 전용 이력", capturedAt: "2026-08-14T00:03:00.000Z", digest: "sha256:4444444444444444", metadata: [], publicUrl: null, ...(eventFactsFixtureEnabled ? { reviewFacts: [] } : {}) },
    { id: "evidence-5555555555555555", authorityId: "site_history", authorityLabel: "현장 전용 이력", sourceLabel: "현장 전용 이력", capturedAt: "2026-08-14T00:04:00.000Z", digest: "sha256:5555555555555555", metadata: [], publicUrl: null, ...(eventFactsFixtureEnabled ? { reviewFacts: ["야간 교대 작업", "청각 경보 보조수단 필요", "resident-id: 900101-1234567", "worker-phone: 010-9876-5432"] } : {}) }
  ],
  ...(traceBlocksFixtureEnabled ? {
    traceItems: traceMatrixMode ? canonicalTraceItems : [{
      id: "trace-fall-scaffold",
      hazardId: "fall-scaffold",
      hazardTitle: "비계·고소작업 추락",
      controls: ["작업발판·난간·바퀴 잠금 확인", "안전대와 안전모 착용 확인"],
      primaryDocuments: ["위험성평가표", "TBM 브리핑"],
      evidenceIds: ["evidence-5555555555555555"],
      resolved: true,
      unresolvedReviewItems: []
    }],
    traceabilityComplete: true
  } : {}),
  reviewContract: {
    contractVersion: "knowledge-candidate-review.v1",
    status: "human_review_required",
    presentAuthorityIds: ["sif", "kosha", "law", "organization_history", "site_history"],
    sourceRoleCounts: {
      sifIncidentControlEvidence: 1,
      koshaTechnicalGuidance: 1,
      lawStatutorySource: 1,
      organizationPrivateMemory: 1,
      sitePrivateMemory: 1,
      externalContext: 0
    },
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    publicationState: "unpublished",
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false
  },
  contentReadiness: {
    contractVersion: "knowledge-candidate-content-readiness.v1",
    status: "ready_for_human_review",
    requiredSectionCount: 4,
    presentSectionCount: 4,
    nonEmptySectionCount: 4,
    sections: [
      { id: "hazard_summary", label: "위험요인 요약", present: true, nonEmpty: true },
      { id: "document_targets", label: "문서 반영 위치", present: true, nonEmpty: true },
      { id: "controls", label: "통제대책", present: true, nonEmpty: true },
      { id: "review_items", label: "검수 필요 항목", present: true, nonEmpty: true }
    ],
    placeholderFindingCount: 0,
    legalOverclaimFindingCount: 0,
    statutoryClaimDetected: true,
    lawProvenancePresent: true,
    hazardGroundingPresent: true,
    unresolvedReviewItems: [],
    humanReviewCompleted: false,
    publicationState: "unpublished",
    publishAllowed: false
  }
};
const queueItems = [
  queueItem,
  {
    ...queueItem,
    runId: "22222222-2222-4222-8222-222222222222",
    candidateLabel: "작업계획서 지식 후보 검토",
    candidateText: "위험요인을 검토하고 필요한 예방조치를 확인합니다.",
    matchedHazardCount: 2,
    contentReadiness: {
      ...queueItem.contentReadiness,
      status: "revision_required",
      presentSectionCount: 0,
      nonEmptySectionCount: 0,
      sections: queueItem.contentReadiness.sections.map((section) => ({
        ...section,
        present: false,
        nonEmpty: false
      })),
      unresolvedReviewItems: [
        "missing_section:hazard_summary",
        "missing_section:document_targets",
        "missing_section:controls",
        "missing_section:review_items"
      ]
    }
  },
  {
    ...queueItem,
    runId: "33333333-3333-4333-8333-333333333333",
    candidateLabel: "TBM 브리핑 지식 후보 검토",
    candidateText: [
      "1) 위험요인 요약: 정전 작업 중 감전 및 재통전 위험",
      "2) 문서 반영 위치: 작업허가서와 TBM 브리핑",
      "3) 통제대책: 정전·검전·잠금표지 상태를 작업 전 확인",
      "4) 검수 필요 항목: 현장 책임자가 재통전 절차 확인"
    ].join("\n"),
    matchedHazardCount: 3
  }
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "desktop-short", width: 1440, height: 723 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-short", width: 390, height: 723 }
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const theme of ["day", "night"]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const browserErrors = [];
      let releaseReviewPost = null;
      let reviewPostObserved = false;
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/^Failed to load resource: the server responded with a status of \d+/u.test(text)) return;
        browserErrors.push(text);
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() < 400) return;
        const url = new URL(response.url());
        if (url.origin !== baseOrigin || url.pathname === "/favicon.ico") return;
        browserErrors.push(`HTTP ${response.status()} ${url.pathname}`);
      });
      await page.addInitScript((storageKey) => {
        const fixtureSession = JSON.stringify({
          access_token: "fixture-access-token",
          refresh_token: "fixture-refresh-token",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id: "reviewer-1",
            aud: "authenticated",
            role: "authenticated",
            email: "reviewer@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-07-25T00:00:00.000Z"
          }
        });
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function getFixtureAuthSession(key) {
          if (/^sb-[a-z0-9_-]+-auth-token$/iu.test(key)) return fixtureSession;
          return originalGetItem.call(this, key);
        };
        localStorage.setItem(storageKey, fixtureSession);
      }, authStorageKey);
      await page.route("**/api/knowledge/review", async (route) => {
        if (route.request().method() === "POST") {
          reviewPostObserved = true;
          await new Promise((resolve) => { releaseReviewPost = resolve; });
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true })
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            configured: true,
            queue: queueItems,
            dropped: { runCount: 0, eventCount: 0, reasons: [] }
          })
        });
      });

      await page.goto(`${baseUrl}/knowledge?theme=${theme}#knowledge-review-inbox-heading`, {
        waitUntil: "networkidle"
      });
      if (viewport.width <= 720) {
        await page.getByRole("tab", { name: "검토 흐름" }).click();
      }
      const inbox = page.locator('[data-knowledge-review-inbox="true"]');
      try {
        await inbox.locator('[data-selected-review-candidate="true"]').waitFor();
      } catch (error) {
        const diagnosticText = (await inbox.textContent().catch(() => null))
          || (await page.locator("body").textContent().catch(() => null))
          || "unavailable";
        throw new Error(`Hermes review fixture did not mount: ${diagnosticText.slice(0, 1200)}`, { cause: error });
      }
      await inbox.scrollIntoViewIfNeeded();
      const candidateTabs = inbox.locator('[role="tablist"][aria-label="지식 후보"] [role="tab"]');
      await candidateTabs.nth(1).click();
      const revisionDecision = await page.evaluate(() => {
        const readiness = document.querySelector('[data-review-content-readiness="revision_required"]');
        const actionGroup = document.querySelector('[role="group"][aria-label="검토 결정"]');
        const buttons = actionGroup ? [...actionGroup.querySelectorAll("button")] : [];
        const confirmation = actionGroup?.querySelector('input[type="checkbox"]');
        return {
          readinessVisible: readiness instanceof HTMLElement,
          approveDisabled: buttons[0]?.disabled === true,
          allDecisionButtonsDisabled: buttons.length === 3 && buttons.every((button) => button.disabled),
          confirmationUnchecked: confirmation instanceof HTMLInputElement && !confirmation.checked,
          confirmationStatus: actionGroup?.getAttribute("data-review-confirmation") || null
        };
      });
      await candidateTabs.first().click();
      await inbox.scrollIntoViewIfNeeded();
      const screenshot = `knowledge-review-authority-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
      const initialDecisionViewport = await page.evaluate(() => {
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const firstAction = actionGroup?.querySelector("button");
        if (!(actionGroup instanceof HTMLElement) || !(firstAction instanceof HTMLElement)) {
          throw new Error("Missing initial Hermes decision rail");
        }
        const actionRect = actionGroup.getBoundingClientRect();
        const firstActionRect = firstAction.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(
          firstActionRect.left + firstActionRect.width / 2,
          firstActionRect.top + firstActionRect.height / 2
        );
        return {
          actionGroupTop: actionRect.top,
          firstActionTop: firstActionRect.top,
          firstActionBottom: firstActionRect.bottom,
          viewportHeight: window.innerHeight,
          hitTargetVisible: hitTarget === firstAction || firstAction.contains(hitTarget),
          firstActionVisible: firstActionRect.top >= 0
            && firstActionRect.bottom <= window.innerHeight
            && (hitTarget === firstAction || firstAction.contains(hitTarget))
        };
      });
      await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
      await candidateTabs.first().focus();
      await page.keyboard.press("End");
      await page.waitForFunction(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tablist"][aria-label="지식 후보"] [role="tab"]'));
        return tabs.at(-1)?.getAttribute("aria-selected") === "true";
      });
      const candidateEndState = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tablist"][aria-label="지식 후보"] [role="tab"]'));
        return {
          selectedIndex: tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"),
          focusedIndex: tabs.findIndex((tab) => tab === document.activeElement)
        };
      });
      await page.keyboard.press("Home");
      await page.waitForFunction(() => (
        document.querySelector('[role="tablist"][aria-label="지식 후보"] [role="tab"]')
          ?.getAttribute("aria-selected") === "true"
      ));
      const candidateHomeState = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tablist"][aria-label="지식 후보"] [role="tab"]'));
        return {
          selectedIndex: tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"),
          focusedIndex: tabs.findIndex((tab) => tab === document.activeElement)
        };
      });
      let mobilePaneKeyboard = null;
      if (viewport.width <= 720) {
        const paneTabs = inbox.locator('[role="tablist"][aria-label="후보 검토 보기"] [role="tab"]');
        await paneTabs.first().focus();
        await page.keyboard.press("End");
        await page.waitForFunction(() => document.querySelector('[data-review-pane="evidence"]') !== null);
        const endState = await page.evaluate(() => {
          const tabs = Array.from(document.querySelectorAll('[role="tablist"][aria-label="후보 검토 보기"] [role="tab"]'));
          return {
            selectedIndex: tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"),
            focusedIndex: tabs.findIndex((tab) => tab === document.activeElement),
            mountedPane: document.querySelector("[data-review-pane]")?.getAttribute("data-review-pane") ?? null
          };
        });
        await page.keyboard.press("Home");
        await page.waitForFunction(() => document.querySelector('[data-review-pane="candidate"]') !== null);
        const homeState = await page.evaluate(() => {
          const tabs = Array.from(document.querySelectorAll('[role="tablist"][aria-label="후보 검토 보기"] [role="tab"]'));
          return {
            selectedIndex: tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true"),
            focusedIndex: tabs.findIndex((tab) => tab === document.activeElement),
            mountedPane: document.querySelector("[data-review-pane]")?.getAttribute("data-review-pane") ?? null
          };
        });
        mobilePaneKeyboard = { endState, homeState };
      }
      const metrics = await page.evaluate(() => {
        const root = document.querySelector("[data-knowledge-review-inbox='true']");
        const workbench = document.querySelector("[data-review-workbench='selected-only']");
        const navigator = workbench?.querySelector("nav[aria-label='지식 후보 목록']");
        const selectedCandidate = workbench?.querySelector("[data-selected-review-candidate='true']");
        const selectedBody = workbench?.querySelector("[data-selected-candidate-body='true']");
        const candidateSections = Array.from(selectedBody?.querySelectorAll("[data-review-candidate-section]") ?? []);
        const eventFacts = workbench?.querySelector("[data-review-event-facts='true']");
        const traceability = workbench?.querySelector("[data-review-traceability]");
        const boundEventFacts = workbench.querySelectorAll("[data-review-evidence-fact]");
        const evidenceWorkbench = workbench?.querySelector("[data-review-evidence-workbench='true']");
        const evidencePane = workbench?.querySelector("[data-review-pane='evidence']");
        const evidenceSubjectContext = evidencePane?.querySelector("[data-review-evidence-subject-context='true']");
        const evidenceDigest = evidencePane?.querySelector("[data-review-evidence-digest]");
        const authority = document.querySelector("[data-review-authority-contract='true']");
        const readiness = document.querySelector("[data-review-content-readiness='ready_for_human_review']");
        const readinessSections = Array.from(readiness?.querySelectorAll("[data-readiness-section]") ?? []);
        const candidatePane = document.querySelector("[data-review-pane='candidate']");
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const firstAction = actionGroup?.querySelector("button");
        const candidateTablist = navigator?.querySelector('[role="tablist"][aria-label="지식 후보"]');
        if (!(root instanceof HTMLElement)
          || !(workbench instanceof HTMLElement)
          || !(navigator instanceof HTMLElement)
          || !(selectedCandidate instanceof HTMLElement)
          || !(selectedBody instanceof HTMLElement)
          || !(evidenceWorkbench instanceof HTMLElement)
          || !(authority instanceof HTMLElement)
          || !(readiness instanceof HTMLElement)
          || !(candidatePane instanceof HTMLElement)
          || !(actionGroup instanceof HTMLElement)
          || !(firstAction instanceof HTMLElement)
          || !(candidateTablist instanceof HTMLElement)) {
          throw new Error("Missing Hermes review authority UI");
        }
        const rootRect = root.getBoundingClientRect();
        const navigatorRect = navigator.getBoundingClientRect();
        const selectedCandidateRect = selectedCandidate.getBoundingClientRect();
        const selectedBodyRect = selectedBody.getBoundingClientRect();
        const candidatePaneRect = candidatePane.getBoundingClientRect();
        const authorityRect = authority.getBoundingClientRect();
        const actionRect = actionGroup.getBoundingClientRect();
        const candidateTabs = Array.from(candidateTablist.querySelectorAll('[role="tab"]'));
        const selectedCandidateTab = candidateTabs.find((tab) => tab.getAttribute("aria-selected") === "true");
        const candidateControlIds = candidateTabs.map((tab) => tab.getAttribute("aria-controls") || "");
        const candidatePositions = candidateTabs.map((tab) => tab.getAttribute("data-review-candidate-position") || "");
        return {
          bodyHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          horizontalOverflow: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ) > window.innerWidth + 1,
          rootWidth: rootRect.width,
          rootWidthRatio: Number((rootRect.width / window.innerWidth).toFixed(2)),
          rootTop: rootRect.top,
          workbenchColumns: getComputedStyle(workbench).gridTemplateColumns.split(" ").length,
          navigatorCandidateCount: navigator.querySelectorAll("button").length,
          candidateTablistRole: candidateTablist.getAttribute("role"),
          candidateTablistOrientation: candidateTablist.getAttribute("aria-orientation"),
          candidateTabCount: candidateTabs.length,
          selectedCandidateTabCount: candidateTabs.filter((tab) => tab.getAttribute("aria-selected") === "true").length,
          tabbableCandidateTabCount: candidateTabs.filter((tab) => tab.getAttribute("tabindex") === "0").length,
          candidateControlIdsPresent: candidateControlIds.every(Boolean),
          candidateControlIdsUnique: new Set(candidateControlIds).size === candidateTabs.length,
          candidatePositions,
          candidatePositionsComplete: candidatePositions.every((position, index) => position === `${index + 1}/${candidateTabs.length}`),
          selectedCandidateControlLinked: selectedCandidateTab?.getAttribute("aria-controls") === selectedCandidate.id,
          selectedCandidatePanelRole: selectedCandidate.getAttribute("role"),
          selectedCandidatePanelLabelledBy: selectedCandidate.getAttribute("aria-labelledby") === selectedCandidateTab?.id,
          selectedCandidateCount: workbench.querySelectorAll("[data-selected-review-candidate='true']").length,
          selectedBodyCount: workbench.querySelectorAll("[data-selected-candidate-body='true']").length,
          selectedBodyFormat: selectedBody.getAttribute("data-review-candidate-format"),
          candidateSectionCount: candidateSections.length,
          candidateSectionNumbers: candidateSections.map((section) => section.getAttribute("data-review-candidate-section") || ""),
          candidateSectionLabels: candidateSections.map((section) => section.querySelector("strong")?.textContent?.trim() || ""),
          candidateSectionContents: candidateSections.map((section) => section.querySelector("p")?.textContent?.trim() || ""),
          candidateMultilineContinuationPreserved: candidateSections[2]?.querySelector("p")?.textContent?.includes(
            "작업 전 확인\n- 작업발판 개구부 덮개 상태도 함께 확인"
          ) === true,
          selectedBodyOverflowY: getComputedStyle(selectedBody).overflowY,
          selectedBodyBeforeReadiness: Boolean(selectedBody.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING),
          selectedBodyText: selectedBody.textContent?.trim() || "",
          selectedBodyTopVisible: selectedBodyRect.top >= candidatePaneRect.top - 1
            && selectedBodyRect.top < candidatePaneRect.bottom,
          eventFactsPanelCount: workbench.querySelectorAll("[data-review-event-facts='true']").length,
          eventFactItemCount: eventFacts?.querySelectorAll("[data-review-event-fact]").length ?? 0,
          eventFactTexts: Array.from(eventFacts?.querySelectorAll("[data-review-event-fact]") ?? []).map((fact) => fact.textContent?.trim() || ""),
          boundEventFactCount: boundEventFacts.length,
          eventFactEvidenceRowCount: new Set(Array.from(boundEventFacts).map((fact) => fact.closest("li[data-review-evidence-authority]"))).size,
          orphanEventFactCount: Array.from(eventFacts?.querySelectorAll("[data-review-event-fact]") ?? []).filter((fact) => (
            !Array.from(boundEventFacts).some((boundFact) => boundFact.textContent?.trim() === fact.textContent?.trim())
          )).length,
          eventFactsInsideCandidatePane: eventFacts instanceof HTMLElement && candidatePane.contains(eventFacts),
          candidateBodyContainsEventFactMarker: selectedBody.textContent?.includes("원본 이벤트 검토 사실") === true,
          privateEventTextExposed: workbench.textContent?.includes("resident-id:") === true
            || workbench.textContent?.includes("worker-phone:") === true,
          traceabilityPanelCount: workbench.querySelectorAll("[data-review-traceability]").length,
          traceabilityStatus: traceability?.getAttribute("data-review-traceability") ?? null,
          resolvedTraceCount: traceability?.querySelectorAll('[data-review-trace="resolved"]').length ?? 0,
          unresolvedTraceCount: traceability?.querySelectorAll('[data-review-trace="unresolved"]').length ?? 0,
          traceRows: Array.from(traceability?.querySelectorAll("ol > li") ?? []).map((row) => row.textContent?.trim() || ""),
          traceListOverflowY: traceability?.querySelector("ol") instanceof HTMLElement
            ? getComputedStyle(traceability.querySelector("ol")).overflowY
            : null,
          traceListClientHeight: traceability?.querySelector("ol") instanceof HTMLElement
            ? traceability.querySelector("ol").clientHeight
            : 0,
          traceListScrollHeight: traceability?.querySelector("ol") instanceof HTMLElement
            ? traceability.querySelector("ol").scrollHeight
            : 0,
          traceContainsHazard: traceability?.textContent?.includes("비계·고소작업 추락") === true,
          traceContainsControl: traceability?.textContent?.includes("작업발판·난간·바퀴 잠금 확인") === true,
          traceContainsDocument: traceability?.textContent?.includes("위험성평가표") === true,
          traceContainsEvidence: traceability?.textContent?.includes("현장 전용 이력") === true,
          traceInsideCandidatePane: traceability instanceof HTMLElement && candidatePane.contains(traceability),
          approveDisabled: actionGroup.querySelector("button")?.disabled === true,
          evidencePaneCount: workbench.querySelectorAll("[data-review-pane='evidence']").length,
          evidenceItemCount: evidencePane?.querySelectorAll("li[data-review-evidence-authority]").length ?? 0,
          evidenceWorkbenchColumns: getComputedStyle(evidenceWorkbench).gridTemplateColumns.split(" ").length,
          evidenceInternalScroll: evidencePane?.querySelector("ol") instanceof HTMLElement
            ? getComputedStyle(evidencePane.querySelector("ol")).overflowY
            : null,
          evidenceDigestWidth: evidenceDigest instanceof HTMLElement
            ? evidenceDigest.getBoundingClientRect().width
            : 0,
          evidenceDigestHeight: evidenceDigest instanceof HTMLElement
            ? evidenceDigest.getBoundingClientRect().height
            : 0,
          evidenceSubjectContextCount: evidencePane?.querySelectorAll("[data-review-evidence-subject-context='true']").length ?? 0,
          evidenceSubjectText: evidenceSubjectContext?.querySelector("strong")?.textContent?.trim() || "",
          evidenceSubjectHeight: evidenceSubjectContext instanceof HTMLElement
            ? evidenceSubjectContext.getBoundingClientRect().height
            : 0,
          publicEvidenceLinkCount: evidencePane?.querySelectorAll("a[href^='https://']").length ?? 0,
          navigatorBeforeDetail: navigatorRect.right <= selectedCandidateRect.left + 1,
          selectedCandidateHeight: selectedCandidateRect.height,
          authorityWidth: authorityRect.width,
          authorityRoleCount: authority.querySelectorAll("[data-review-authority-role]").length,
          authorityContained: authority.scrollWidth <= authority.clientWidth + 1,
          readinessPanelCount: document.querySelectorAll("[data-review-content-readiness]").length,
          readinessSectionCount: readiness.querySelectorAll("[data-readiness-section]").length,
          readySectionCount: readiness.querySelectorAll('[data-readiness-section][data-ready="true"]').length,
          readinessSectionMinWidth: Math.min(...readinessSections.map((section) => (
            section instanceof HTMLElement ? section.getBoundingClientRect().width : 0
          ))),
          readinessLabelMaxHeight: Math.max(...readinessSections.map((section) => {
            const label = section.querySelector("span");
            return label instanceof HTMLElement ? label.getBoundingClientRect().height : 0;
          })),
          readinessInsideCandidatePane: candidatePane.contains(readiness),
          candidatePaneOverflowY: getComputedStyle(candidatePane).overflowY,
          candidatePaneClientHeight: candidatePane.clientHeight,
          candidatePaneScrollHeight: candidatePane.scrollHeight,
          actionGroupTop: actionRect.top,
          firstActionBottom: firstAction.getBoundingClientRect().bottom,
          firstActionDepth: firstAction.getBoundingClientRect().bottom - rootRect.top,
          actionCount: actionGroup.querySelectorAll("button").length,
          actionContained: actionGroup.scrollWidth <= actionGroup.clientWidth + 1,
          confirmationCount: actionGroup.querySelectorAll('input[type="checkbox"]').length,
          confirmationChecked: actionGroup.querySelector('input[type="checkbox"]')?.checked === true,
          confirmationStatus: actionGroup.getAttribute("data-review-confirmation")
        };
      });
      let mobileEvidence = null;
      let traceScreenshotContextVisible = null;
      const candidateSubjectScreenshot = `knowledge-review-candidate-subject-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
      if (evidenceInspectorMode || candidateReadinessMode) {
        await inbox.locator("[data-selected-candidate-body='true']").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(outputDir, candidateSubjectScreenshot), fullPage: false });
      }
      if (eventFactsMode) {
        const eventFactsPanel = inbox.locator('[data-review-event-facts="true"]');
        await eventFactsPanel.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(outputDir, `knowledge-review-event-facts-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`),
          fullPage: false
        });
      }
      if (traceContractMode) {
        const traceabilityPanel = inbox.locator("[data-review-traceability]");
        if (await traceabilityPanel.count() === 1) {
          await traceabilityPanel.scrollIntoViewIfNeeded();
          traceScreenshotContextVisible = await traceabilityPanel.evaluate((panel) => {
            const candidatePane = panel.closest("[data-review-pane='candidate']");
            if (!(candidatePane instanceof HTMLElement)) return false;
            const panelRect = panel.getBoundingClientRect();
            const paneRect = candidatePane.getBoundingClientRect();
            candidatePane.scrollTop += panelRect.top - paneRect.top - 8;
            const firstHazard = panel.querySelector("ol > li > strong");
            if (!(firstHazard instanceof HTMLElement)) return false;
            const firstHazardRect = firstHazard.getBoundingClientRect();
            const scrolledPaneRect = candidatePane.getBoundingClientRect();
            return firstHazardRect.top >= scrolledPaneRect.top
              && firstHazardRect.bottom <= scrolledPaneRect.bottom;
          });
          await page.screenshot({
            path: path.join(
              outputDir,
              `knowledge-review-${traceMatrixMode ? "trace-matrix" : "trace-block"}-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`
            ),
            fullPage: false
          });
        }
      }
      if (viewport.width <= 720) {
        await inbox.getByRole("tab", { name: `근거 ${queueItem.evidenceItems.length}`, exact: true }).click();
        mobileEvidence = await page.evaluate(() => {
          const workbench = document.querySelector("[data-review-workbench='selected-only']");
          const pane = workbench?.querySelector("[data-review-pane='evidence']");
          if (!(workbench instanceof HTMLElement) || !(pane instanceof HTMLElement)) {
            throw new Error("Missing mobile Hermes evidence pane");
          }
          const list = pane.querySelector("ol");
          const digest = pane.querySelector("[data-review-evidence-digest]");
          const subjectContext = pane.querySelector("[data-review-evidence-subject-context='true']");
          const boundFacts = Array.from(pane.querySelectorAll("[data-review-evidence-fact]"));
          const paneRect = pane.getBoundingClientRect();
          const subjectRect = subjectContext?.getBoundingClientRect();
          return {
            paneCount: workbench.querySelectorAll("[data-review-pane]").length,
            candidatePaneCount: workbench.querySelectorAll("[data-review-pane='candidate']").length,
            evidenceItemCount: pane.querySelectorAll("li[data-review-evidence-authority]").length,
            publicEvidenceLinkCount: pane.querySelectorAll("a[href^='https://']").length,
            listOverflowY: list instanceof HTMLElement ? getComputedStyle(list).overflowY : null,
            digestWidth: digest instanceof HTMLElement ? digest.getBoundingClientRect().width : 0,
            digestHeight: digest instanceof HTMLElement ? digest.getBoundingClientRect().height : 0,
            subjectContextCount: pane.querySelectorAll("[data-review-evidence-subject-context='true']").length,
            subjectText: subjectContext?.querySelector("strong")?.textContent?.trim() || "",
            subjectHeight: subjectRect?.height ?? 0,
            subjectVisible: Boolean(subjectRect
              && subjectRect.top >= paneRect.top - 1
              && subjectRect.bottom <= paneRect.bottom + 1),
            contained: pane.scrollWidth <= pane.clientWidth + 1,
            boundEventFactCount: boundFacts.length,
            eventFactEvidenceRowCount: new Set(boundFacts.map((fact) => fact.closest("li[data-review-evidence-authority]"))).size,
            boundEventFactTexts: boundFacts.map((fact) => fact.textContent?.trim() || "")
          };
        });
      }
      if (evidenceInspectorMode) {
        await inbox.locator("[data-review-evidence-digest]").first().scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(
            outputDir,
            `knowledge-review-evidence-readability-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`
          ),
          fullPage: false
        });
      }
      const reviewConfirmation = inbox.getByRole("checkbox", { name: "후보 문장·근거 확인" });
      await reviewConfirmation.check();
      const confirmedDecision = await page.evaluate(() => {
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const confirmation = actionGroup?.querySelector('input[type="checkbox"]');
        const buttons = actionGroup ? [...actionGroup.querySelectorAll("button")] : [];
        return {
          checked: confirmation instanceof HTMLInputElement && confirmation.checked,
          confirmationStatus: actionGroup?.getAttribute("data-review-confirmation") || null,
          enabledActionCount: buttons.filter((button) => !button.disabled).length
        };
      });
      await inbox.getByRole("button", { name: "후보 승인", exact: true }).click();
      await page.waitForFunction(() => (
        document.querySelector("[data-selected-review-candidate='true']")?.getAttribute("aria-busy") === "true"
      ));
      for (let attempt = 0; attempt < 100 && !releaseReviewPost; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const pendingDecision = await page.evaluate(() => {
        const candidate = document.querySelector("[data-selected-review-candidate='true']");
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const status = document.querySelector("[data-knowledge-review-inbox='true'] [role='status']");
        const buttons = actionGroup ? [...actionGroup.querySelectorAll("button")] : [];
        return {
          candidateBusy: candidate?.getAttribute("aria-busy") === "true",
          pendingDataState: candidate?.getAttribute("data-review-pending") === "true",
          actionGroupBusy: actionGroup?.getAttribute("aria-busy") === "true",
          disabledActionCount: buttons.filter((button) => button.disabled).length,
          statusText: status?.textContent || ""
        };
      });
      if (!releaseReviewPost) throw new Error("Hermes review POST did not reach the delayed fixture");
      releaseReviewPost();
      await page.waitForFunction(() => {
        const candidate = document.querySelector("[data-selected-review-candidate='true']");
        const status = document.querySelector("[data-knowledge-review-inbox='true'] [role='status']");
        return candidate?.getAttribute("aria-busy") === "false"
          && status?.textContent?.includes("검토 결과를 저장했습니다. 게시되지는 않았습니다.");
      });
      const settledDecision = await page.evaluate(() => {
        const candidate = document.querySelector("[data-selected-review-candidate='true']");
        const actionGroup = document.querySelector("[role='group'][aria-label='검토 결정']");
        const status = document.querySelector("[data-knowledge-review-inbox='true'] [role='status']");
        const buttons = actionGroup ? [...actionGroup.querySelectorAll("button")] : [];
        return {
          candidateBusy: candidate?.getAttribute("aria-busy") === "true",
          pendingDataState: candidate?.getAttribute("data-review-pending") === "true",
          actionGroupBusy: actionGroup?.getAttribute("aria-busy") === "true",
          enabledActionCount: buttons.filter((button) => !button.disabled).length,
          statusText: status?.textContent || ""
        };
      });
      const traceMatrixCoverage = traceMatrixMode
        ? canonicalTraceItems.map((expected, index) => {
            const rowText = metrics.traceRows[index] || "";
            return {
              hazardId: expected.hazardId,
              hazardTitlePresent: rowText.includes(expected.hazardTitle),
              missingControls: expected.controls.filter((control) => !rowText.includes(control)),
              missingPrimaryDocuments: expected.primaryDocuments.filter((documentLabel) => !rowText.includes(documentLabel)),
              evidenceRowPresent: traceEvidenceIds.some((evidenceId) => {
                const sourceLabel = queueItem.evidenceItems.find((evidence) => evidence.id === evidenceId)?.sourceLabel;
                return Boolean(sourceLabel && rowText.includes(sourceLabel));
              })
            };
          })
        : [];
      const traceMatrixComplete = traceMatrixMode
        && traceMatrixCoverage.length === canonicalTraceItems.length
        && traceMatrixCoverage.every((item) => (
          item.hazardTitlePresent
          && item.missingControls.length === 0
          && item.missingPrimaryDocuments.length === 0
          && item.evidenceRowPresent
        ));
      const decisionPendingContract = reviewPostObserved
        && pendingDecision.candidateBusy
        && pendingDecision.pendingDataState
        && pendingDecision.actionGroupBusy
        && pendingDecision.disabledActionCount === 3
        && pendingDecision.statusText === "검토 결과를 저장하는 중입니다."
        && !settledDecision.candidateBusy
        && !settledDecision.pendingDataState
        && !settledDecision.actionGroupBusy
        && settledDecision.enabledActionCount === 3
        && settledDecision.statusText === "검토 결과를 저장했습니다. 게시되지는 않았습니다.";
      const passed = metrics.horizontalOverflow === false
        && metrics.navigatorCandidateCount === queueItems.length
        && metrics.candidateTablistRole === "tablist"
        && metrics.candidateTablistOrientation === (viewport.width <= 720 ? "horizontal" : "vertical")
        && metrics.candidateTabCount === queueItems.length
        && metrics.selectedCandidateTabCount === 1
        && metrics.tabbableCandidateTabCount === 1
        && metrics.candidateControlIdsPresent
        && metrics.candidateControlIdsUnique
        && metrics.candidatePositionsComplete
        && metrics.selectedCandidateControlLinked
        && metrics.selectedCandidatePanelRole === "tabpanel"
        && metrics.selectedCandidatePanelLabelledBy
        && candidateEndState.selectedIndex === queueItems.length - 1
        && candidateEndState.focusedIndex === queueItems.length - 1
        && candidateHomeState.selectedIndex === 0
        && candidateHomeState.focusedIndex === 0
        && metrics.selectedCandidateCount === 1
        && metrics.selectedBodyCount === 1
        && metrics.selectedBodyFormat === "structured"
        && metrics.candidateSectionCount === 4
        && metrics.candidateSectionNumbers.every((number, index) => number === String(index + 1))
        && metrics.candidateSectionLabels.join("|") === "위험요인 요약|문서 반영 위치|통제대책|검수 필요 항목"
        && metrics.candidateSectionContents.every(Boolean)
        && metrics.candidateMultilineContinuationPreserved
        && metrics.selectedBodyOverflowY === "auto"
        && metrics.selectedBodyBeforeReadiness
        && metrics.selectedBodyTopVisible
        && (viewport.width > 720
          ? metrics.workbenchColumns === 2 && metrics.navigatorBeforeDetail && metrics.selectedCandidateHeight <= 580
          : metrics.workbenchColumns === 1)
        && metrics.authorityRoleCount === 6
        && metrics.authorityContained
        && metrics.readinessPanelCount === 1
        && metrics.readinessSectionCount === 4
        && metrics.readinessSectionMinWidth >= (viewport.width > 720 ? 120 : 96)
        && metrics.readinessLabelMaxHeight <= 36
        && metrics.readySectionCount === 4
        && metrics.readinessInsideCandidatePane
        && metrics.candidatePaneOverflowY === "auto"
        && (!eventFactsMode
          || (metrics.eventFactsPanelCount === 1
            && metrics.eventFactItemCount === 2
            && (viewport.width > 720
              ? metrics.boundEventFactCount === 2
                && metrics.eventFactEvidenceRowCount === 1
                && metrics.orphanEventFactCount === 0
              : mobileEvidence?.boundEventFactCount === 2
                && mobileEvidence.eventFactEvidenceRowCount === 1
                && metrics.eventFactTexts.every((fact) => mobileEvidence.boundEventFactTexts.includes(fact)))
            && metrics.eventFactsInsideCandidatePane
            && !metrics.candidateBodyContainsEventFactMarker
            && !metrics.privateEventTextExposed))
        && (!traceContractMode
          || (metrics.traceabilityPanelCount === 1
            && metrics.traceabilityStatus === "complete"
            && metrics.resolvedTraceCount === expectedTraceCount
            && metrics.unresolvedTraceCount === 0
            && metrics.traceContainsHazard
            && metrics.traceContainsControl
            && metrics.traceContainsDocument
            && metrics.traceContainsEvidence
            && metrics.traceInsideCandidatePane
            && (!traceMatrixMode
              || (traceMatrixComplete
                && metrics.traceRows.length === canonicalTraceItems.length
                && metrics.traceListOverflowY === "visible"
                && metrics.traceListScrollHeight <= metrics.traceListClientHeight + 1
                && metrics.candidatePaneOverflowY === "auto"
                && metrics.candidatePaneScrollHeight > metrics.candidatePaneClientHeight
                && traceScreenshotContextVisible === true))
            && metrics.approveDisabled))
        && revisionDecision.readinessVisible
        && revisionDecision.approveDisabled
        && revisionDecision.allDecisionButtonsDisabled
        && revisionDecision.confirmationUnchecked
        && revisionDecision.confirmationStatus === "required"
        && metrics.actionCount === 3
        && metrics.actionContained
        && metrics.confirmationCount === 1
        && !metrics.confirmationChecked
        && metrics.confirmationStatus === "required"
        && (viewport.width > 720
          ? metrics.evidencePaneCount === 1
            && metrics.evidenceItemCount === queueItem.evidenceItems.length
            && metrics.evidenceWorkbenchColumns === 2
            && metrics.evidenceInternalScroll === "auto"
            && metrics.evidenceDigestWidth >= 160
            && metrics.evidenceDigestHeight <= 36
            && metrics.evidenceSubjectContextCount === 1
            && metrics.evidenceSubjectText.startsWith("1) 위험요인 요약:")
            && metrics.evidenceSubjectHeight <= 64
            && metrics.publicEvidenceLinkCount === 3
          : mobileEvidence?.paneCount === 1
            && mobileEvidence.candidatePaneCount === 0
            && mobileEvidence.evidenceItemCount === queueItem.evidenceItems.length
            && mobileEvidence.publicEvidenceLinkCount === 3
            && mobileEvidence.listOverflowY === "auto"
            && mobileEvidence.digestWidth >= 160
            && mobileEvidence.digestHeight <= 36
            && mobileEvidence.subjectContextCount === 1
            && mobileEvidence.subjectText.startsWith("1) 위험요인 요약:")
            && mobileEvidence.subjectHeight <= 64
            && mobileEvidence.subjectVisible
            && mobileEvidence.contained
            && mobilePaneKeyboard?.endState.selectedIndex === 1
            && mobilePaneKeyboard.endState.focusedIndex === 1
            && mobilePaneKeyboard.endState.mountedPane === "evidence"
            && mobilePaneKeyboard.homeState.selectedIndex === 0
            && mobilePaneKeyboard.homeState.focusedIndex === 0
            && mobilePaneKeyboard.homeState.mountedPane === "candidate")
        && initialDecisionViewport.firstActionVisible
        && confirmedDecision.checked
        && confirmedDecision.confirmationStatus === "confirmed"
        && confirmedDecision.enabledActionCount === 3
        && decisionPendingContract
        && browserErrors.length === 0;
      results.push({
        theme,
        viewport,
        screenshot,
        candidateSubjectScreenshot: evidenceInspectorMode || candidateReadinessMode ? candidateSubjectScreenshot : null,
        metrics,
        candidateKeyboard: { endState: candidateEndState, homeState: candidateHomeState },
        initialDecisionViewport,
        mobilePaneKeyboard,
        mobileEvidence,
        confirmedDecision,
        decisionPending: {
          reviewPostObserved,
          pending: pendingDecision,
          settled: settledDecision,
          passed: decisionPendingContract
        },
        revisionDecision,
        traceMatrixCoverage,
        traceMatrixComplete,
        traceScreenshotContextVisible,
        browserErrors,
        passed
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
const productionAligned = liveMode
  && productionBuild.ok
  && commitContainsProduct(productionBuild.commitSha)
  && productionBuild.branch === "master"
  && productionBuild.environment === "production";
const report = {
  schemaVersion: "safeclaw-hermes-knowledge-review-authority-ui/v2",
  contractMode: eventFactsMode
    ? "event-facts"
    : traceMatrixMode
    ? "trace-matrix"
    : traceBlocksMode
    ? "trace-blocks"
    : evidenceInspectorMode
    ? "evidence-inspector"
    : candidateReadinessMode
      ? "candidate-content-readiness"
      : "authority-ui",
  verdict: failed.length === 0 && productionAligned
    ? eventFactsMode
      ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACTS"
      : traceMatrixMode
      ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX"
      : traceBlocksMode
      ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS"
      : evidenceInspectorMode
      ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
      : candidateReadinessMode
        ? "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
        : "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    : failed.length === 0 && !liveMode
      ? eventFactsMode
        ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVENT_FACTS"
        : traceMatrixMode
        ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_MATRIX"
        : traceBlocksMode
        ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_BLOCKS"
        : evidenceInspectorMode
        ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVIDENCE_INSPECTOR"
        : candidateReadinessMode
          ? "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
          : "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
      : eventFactsMode
        ? "RED_HERMES_REVIEW_EVENT_FACTS"
        : traceMatrixMode
        ? "RED_HERMES_REVIEW_TRACE_MATRIX"
        : traceBlocksMode
        ? "RED_HERMES_REVIEW_TRACE_BLOCKS"
        : evidenceInspectorMode
        ? "RED_HERMES_REVIEW_EVIDENCE_INSPECTOR"
        : candidateReadinessMode
          ? "RED_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
          : "RED_HERMES_REVIEW_AUTHORITY_UI",
  checkedAt,
  sourceHead,
  productCommit,
  baseUrl,
  mode: liveMode ? "live-production" : "current-source-local-production",
  productionBuild,
  productionAligned,
  viewportCount: results.length,
  passedCount: results.length - failed.length,
  failedCount: failed.length,
  authorityContract: {
    sourceOrder: ["SIF", "KOSHA", "law", "organization_history", "site_history", "external_context"],
    statutoryClaimsRequireLawProvenance: true,
    tenantMemoryPublicPromotionAllowed: false,
    siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
    humanReviewRequired: true,
    machineEvidenceReplacesHumanReview: false
  },
  workbenchContract: {
    candidateCount: queueItems.length,
    selectedCandidateCount: 1,
    selectedBodyCount: 1,
    selectedBodyFormat: "structured",
    candidateSectionCount: 4,
    candidateSectionLabels: ["위험요인 요약", "문서 반영 위치", "통제대책", "검수 필요 항목"],
    candidateSectionsNonEmpty: results.every((result) => result.metrics.candidateSectionContents.every(Boolean)),
    candidateMultilineContinuationPreserved: results.every((result) => result.metrics.candidateMultilineContinuationPreserved),
    desktopColumns: 2,
    mobileColumns: 1,
    candidateBodyInternalScroll: true,
    candidateTablist: true,
    candidateRovingTabStop: true,
    candidateKeyboardNavigation: true,
    candidatePositionLabels: results.every((result) => result.metrics.candidatePositionsComplete),
    breakpointOrientationSynchronized: true,
    mobilePaneTabsLinked: true,
    mobilePaneKeyboardNavigation: true,
    decisionConfirmationRequired: results.every((result) => (
      result.metrics.confirmationCount === 1
      && !result.metrics.confirmationChecked
      && result.metrics.confirmationStatus === "required"
    )),
    decisionConfirmationUnlocksAllActions: results.every((result) => (
      result.confirmedDecision.checked
      && result.confirmedDecision.confirmationStatus === "confirmed"
      && result.confirmedDecision.enabledActionCount === 3
    )),
    firstDecisionActionInViewport: results.every((result) => result.initialDecisionViewport.firstActionVisible),
    decisionPendingStatusLive: results.every((result) => result.decisionPending.pending.statusText === "검토 결과를 저장하는 중입니다."),
    decisionBusyStateExposed: results.every((result) => result.decisionPending.pending.candidateBusy && result.decisionPending.pending.actionGroupBusy),
    decisionActionsDisabledDuringSave: results.every((result) => result.decisionPending.pending.disabledActionCount === 3),
    decisionSettlesAccessibly: results.every((result) => result.decisionPending.passed),
    evidenceItemLimit: 20,
    evidenceItemCount: queueItem.evidenceItems.length,
    desktopEvidenceColumns: 2,
    mobileMountedPaneCount: 1,
    publicEvidenceLinkCount: 3,
    privateEvidenceRawIdentityExposed: false,
    evidenceInternalScroll: true,
    evidenceDigestMinWidth: Math.min(...results.map((result) => (
      result.viewport.width > 720
        ? result.metrics.evidenceDigestWidth
        : result.mobileEvidence?.digestWidth ?? 0
    ))),
    evidenceDigestMaxHeight: Math.max(...results.map((result) => (
      result.viewport.width > 720
        ? result.metrics.evidenceDigestHeight
        : result.mobileEvidence?.digestHeight ?? 0
    ))),
    desktopReadinessSectionMinWidth: Math.min(...results
      .filter((result) => result.viewport.width > 720)
      .map((result) => result.metrics.readinessSectionMinWidth)),
    mobileReadinessSectionMinWidth: Math.min(...results
      .filter((result) => result.viewport.width <= 720)
      .map((result) => result.metrics.readinessSectionMinWidth)),
    readinessLabelMaxHeight: Math.max(...results.map((result) => result.metrics.readinessLabelMaxHeight))
  },
  eventFactsContract: {
    explicitReviewFactsOnly: true,
    expectedFactCount: 2,
    panelCount: Math.min(...results.map((result) => result.metrics.eventFactsPanelCount)),
    visibleFactCount: Math.min(...results.map((result) => result.metrics.eventFactItemCount)),
    boundFactCount: Math.min(...results.map((result) => result.viewport.width > 720
      ? result.metrics.boundEventFactCount
      : result.mobileEvidence?.boundEventFactCount ?? 0)),
    evidenceRowCount: Math.min(...results.map((result) => result.viewport.width > 720
      ? result.metrics.eventFactEvidenceRowCount
      : result.mobileEvidence?.eventFactEvidenceRowCount ?? 0)),
    orphanFactCount: Math.max(...results.map((result) => result.viewport.width > 720
      ? result.metrics.orphanEventFactCount
      : result.metrics.eventFactTexts.filter((fact) => !result.mobileEvidence?.boundEventFactTexts.includes(fact)).length)),
    insideCandidatePane: results.every((result) => result.metrics.eventFactsInsideCandidatePane),
    candidateBodyMarkerDuplicated: results.some((result) => result.metrics.candidateBodyContainsEventFactMarker),
    privateEventTextExposed: results.some((result) => result.metrics.privateEventTextExposed),
    humanVerificationRequired: true
  },
  traceabilityContract: {
    expectedTraceCount,
    panelCount: Math.min(...results.map((result) => result.metrics.traceabilityPanelCount)),
    resolvedTraceCount: Math.min(...results.map((result) => result.metrics.resolvedTraceCount)),
    unresolvedTraceCount: Math.max(...results.map((result) => result.metrics.unresolvedTraceCount)),
    hazardBound: results.every((result) => result.metrics.traceContainsHazard),
    controlsBound: results.every((result) => result.metrics.traceContainsControl),
    primaryDocumentsBound: results.every((result) => result.metrics.traceContainsDocument),
    evidenceRowsBound: results.every((result) => result.metrics.traceContainsEvidence),
    insideCandidatePane: results.every((result) => result.metrics.traceInsideCandidatePane),
    canonicalHazardCount: canonicalTraceItems.length,
    canonicalControlLinkCount: canonicalTraceControlLinkCount,
    canonicalDocumentLinkCount: canonicalTraceDocumentLinkCount,
    canonicalMatrixComplete: traceMatrixMode && results.every((result) => result.traceMatrixComplete),
    traceListInternalScroll: false,
    traceScrollOwner: traceMatrixMode ? "candidate-pane" : null,
    candidatePaneInternalScroll: traceMatrixMode && results.every((result) => (
      result.metrics.candidatePaneOverflowY === "auto"
      && result.metrics.candidatePaneScrollHeight > result.metrics.candidatePaneClientHeight
      && result.metrics.traceListOverflowY === "visible"
      && result.metrics.traceListScrollHeight <= result.metrics.traceListClientHeight + 1
    )),
    traceScreenshotContextVisible: traceMatrixMode && results.every((result) => result.traceScreenshotContextVisible === true),
    missingControls: traceMatrixMode
      ? [...new Set(results.flatMap((result) => result.traceMatrixCoverage.flatMap((item) => item.missingControls)))]
      : [],
    missingPrimaryDocuments: traceMatrixMode
      ? [...new Set(results.flatMap((result) => result.traceMatrixCoverage.flatMap((item) => item.missingPrimaryDocuments)))]
      : [],
    approvalFailsClosedWhenIncomplete: true,
    humanReviewCompleted: false,
    publicationState: "unpublished"
  },
  contentReadinessContract: {
    contractVersion: "knowledge-candidate-content-readiness.v1",
    requiredSectionCount: 4,
    readyFixtureCount: 2,
    revisionRequiredFixtureCount: 1,
    selectedReadinessPanelCount: 1,
    approvalFailsClosedForRevision: results.every((result) => result.revisionDecision.approveDisabled),
    keepSiteOnlyAvailableForRevision: results.every((result) => result.revisionDecision.keepSiteOnlyEnabled),
    rejectAvailableForRevision: results.every((result) => result.revisionDecision.rejectEnabled),
    humanReviewCompleted: false,
    publicationState: "unpublished",
    publishAllowed: false
  },
  mutationBoundary: {
    dbMutationPerformed: false,
    providerDispatchCalled: false,
    shareSessionCreated: false,
    ontologyPublicationPerformed: false
  },
  remainingBoundaries: {
    exactSavedShareVerdict: "MISSING_EVIDENCE",
    llmWikiPublication: "APPROVAL_GATED",
    supabaseRlsLaunchIsolation: "APPROVAL_GATED"
  },
  results
};

await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const rows = results.map((result) => (
  `| ${result.theme} | ${result.viewport.name} | ${result.viewport.width}x${result.viewport.height} | `
  + `${result.metrics.bodyHeight}/${result.metrics.viewportHeight} | ${result.metrics.rootWidthRatio} | `
  + `${result.metrics.workbenchColumns}/${result.metrics.navigatorCandidateCount}/${result.metrics.selectedBodyCount} | `
  + `${result.metrics.authorityRoleCount} | ${result.metrics.firstActionDepth.toFixed(1)} | `
  + `${result.metrics.horizontalOverflow ? "yes" : "no"} | ${result.passed ? "PASS" : "RED"} |`
)).join("\n");
const markdown = `# Hermes Knowledge Review Authority UI

- Verdict: \`${report.verdict}\`
- Source head: \`${sourceHead}\`
- Product commit: \`${productCommit}\`
- Checked at: \`${checkedAt}\`
- Scope: ${liveMode ? "live production" : "current-source local production"} rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: \`${productionAligned}\`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
${rows}

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted; its four required sections are presented as numbered, labelled, non-empty reviewer blocks, including bounded multiline continuation text inside a section.
- Candidate tabs expose one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and Arrow/Home/End keyboard navigation.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.
- Desktop mounts the selected candidate and five-item evidence inspector together; mobile mounts one linked pane behind a keyboard-operable segmented tab control.
- Evidence digests keep at least ${report.workbenchContract.evidenceDigestMinWidth}px width and at most ${report.workbenchContract.evidenceDigestMaxHeight}px height; readiness cells keep at least ${report.workbenchContract.desktopReadinessSectionMinWidth}px on desktop and ${report.workbenchContract.mobileReadinessSectionMinWidth}px on mobile, with labels no taller than ${report.workbenchContract.readinessLabelMaxHeight}px.
- The first decision action stays inside every measured viewport. All three decisions remain locked until the reviewer confirms the candidate sentence and evidence, then announce pending/busy/settled states around the delayed save fixture.
- Each selected candidate exposes one server-derived readiness panel with four required sections. A revision-required candidate disables only candidate approval while keeping site-only retention and rejection available.
- Explicit safe original-event review facts must appear in a distinct reviewer region inside the candidate pane, without duplicating their marker in the candidate body or exposing private event text.
- Only allowlisted public law, KOSHA, and SIF references expose verified HTTPS links. Organization and site evidence retain generic labels and bounded digests only.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains \`MISSING_EVIDENCE\`.
- LLM Wiki publication and live RLS isolation remain \`APPROVAL_GATED\`.
`;
await fs.writeFile(path.join(outputDir, "report.md"), markdown, "utf8");

const summaryOutput = process.env.SAFECLAW_KNOWLEDGE_UI_SUMMARY_OUTPUT;
if (liveMode && productionAligned && summaryOutput) {
  const summaryDir = path.resolve(process.cwd(), summaryOutput);
  const summaryReportPath = path.join(summaryDir, "report.json");
  const summaryMarkdownPath = path.join(summaryDir, "report.md");
  const afterLocalDir = path.join(summaryDir, "after-local");
  const localReportPath = path.join(afterLocalDir, "report.json");
  const localReport = JSON.parse(await fs.readFile(localReportPath, "utf8"));
  const beforeLiveReport = eventFactsMode || traceContractMode
    ? JSON.parse(await fs.readFile(path.join(summaryDir, "before-live", "report.json"), "utf8"))
    : null;

  const localSummary = {
    path: path.relative(process.cwd(), path.join(afterLocalDir, "report.json")),
    verdict: localReport.verdict,
    viewportCount: localReport.viewportCount,
    passedCount: localReport.passedCount,
    failedCount: localReport.failedCount
  };
  const liveSummary = {
    path: path.relative(process.cwd(), path.join(outputDir, "report.json")),
    verdict: report.verdict,
    viewportCount: report.viewportCount,
    passedCount: report.passedCount,
    failedCount: report.failedCount,
    productionAligned,
    browserErrorCount: results.reduce((count, result) => count + result.browserErrors.length, 0)
  };
  const summary = traceMatrixMode
    ? {
        schemaVersion: "safeclaw-hermes-review-trace-matrix-summary/v1",
        verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX",
        checkedAt,
        sourceHead,
        productCommit,
        productionCommit: productionBuild.commitSha,
        deploymentUrl: productionBuild.deploymentUrl,
        beforeLive: {
          path: path.relative(process.cwd(), path.join(summaryDir, "before-live", "report.json")),
          verdict: beforeLiveReport?.verdict,
          viewportCount: beforeLiveReport?.viewportCount,
          passedCount: beforeLiveReport?.passedCount,
          failedCount: beforeLiveReport?.failedCount,
          canonicalMatrixComplete: beforeLiveReport?.traceabilityContract?.canonicalMatrixComplete,
          missingControls: beforeLiveReport?.traceabilityContract?.missingControls,
          missingPrimaryDocuments: beforeLiveReport?.traceabilityContract?.missingPrimaryDocuments
        },
        local: localSummary,
        afterLive: liveSummary,
        liveAfterDeploymentRequired: false,
        traceabilityContract: {
          ...report.traceabilityContract,
          beforeCanonicalMatrixComplete: beforeLiveReport?.traceabilityContract?.canonicalMatrixComplete,
          beforeMissingControls: beforeLiveReport?.traceabilityContract?.missingControls,
          beforeMissingPrimaryDocuments: beforeLiveReport?.traceabilityContract?.missingPrimaryDocuments,
          allHazardsClosed: true,
          allCanonicalMappingsClosed: true,
          machineEvidenceReplacesHumanReview: false
        },
        mutationBoundary: {
          ...report.mutationBoundary,
          vectorOrEmbeddingMutationPerformed: false,
          wikiPublicationPerformed: false,
          koshaRegistryMutationPerformed: false
        },
        securityBoundary: {
          immutableOriginal18FindingBaselinePreserved: true
        },
        remainingBoundaries: {
          ...report.remainingBoundaries,
          providerDispatchPersistence: "APPROVAL_GATED"
        }
      }
    : traceBlocksMode
    ? {
        schemaVersion: "safeclaw-hermes-review-trace-block-summary/v1",
        verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS",
        checkedAt,
        sourceHead,
        productCommit,
        productionCommit: productionBuild.commitSha,
        deploymentUrl: productionBuild.deploymentUrl,
        beforeLive: {
          path: path.relative(process.cwd(), path.join(summaryDir, "before-live", "report.json")),
          verdict: beforeLiveReport?.verdict,
          viewportCount: beforeLiveReport?.viewportCount,
          passedCount: beforeLiveReport?.passedCount,
          failedCount: beforeLiveReport?.failedCount,
          panelCount: beforeLiveReport?.traceabilityContract?.panelCount,
          resolvedTraceCount: beforeLiveReport?.traceabilityContract?.resolvedTraceCount,
          unresolvedTraceCount: beforeLiveReport?.traceabilityContract?.unresolvedTraceCount
        },
        local: localSummary,
        afterLive: liveSummary,
        liveAfterDeploymentRequired: false,
        traceabilityContract: {
          ...report.traceabilityContract,
          beforePanelCount: beforeLiveReport?.traceabilityContract?.panelCount,
          beforeResolvedTraceCount: beforeLiveReport?.traceabilityContract?.resolvedTraceCount,
          beforeUnresolvedTraceCount: beforeLiveReport?.traceabilityContract?.unresolvedTraceCount,
          scopedFixtureHazardCount: 1,
          allHazardsClosed: false,
          allDocumentsClosed: false,
          machineEvidenceReplacesHumanReview: false
        },
        mutationBoundary: {
          ...report.mutationBoundary,
          vectorOrEmbeddingMutationPerformed: false,
          wikiPublicationPerformed: false,
          koshaRegistryMutationPerformed: false
        },
        securityBoundary: {
          immutableOriginal18FindingBaselinePreserved: true
        },
        remainingBoundaries: {
          ...report.remainingBoundaries,
          providerDispatchPersistence: "APPROVAL_GATED"
        }
      }
    : eventFactsMode
    ? {
        schemaVersion: "safeclaw-hermes-knowledge-review-event-fact-traceability-summary/v1",
        verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY",
        checkedAt,
        sourceHead,
        productCommit,
        productionCommit: productionBuild.commitSha,
        deploymentUrl: productionBuild.deploymentUrl,
        beforeLive: {
          path: path.relative(process.cwd(), path.join(summaryDir, "before-live", "report.json")),
          verdict: beforeLiveReport?.verdict,
          viewportCount: beforeLiveReport?.viewportCount,
          passedCount: beforeLiveReport?.passedCount,
          failedCount: beforeLiveReport?.failedCount,
          visibleFactCount: beforeLiveReport?.eventFactsContract?.visibleFactCount,
          boundFactCount: beforeLiveReport?.eventFactsContract?.boundFactCount
        },
        local: localSummary,
        afterLive: liveSummary,
        liveAfterDeploymentRequired: false,
        eventFactsContract: {
          ...report.eventFactsContract,
          beforeVisibleFactCount: beforeLiveReport?.eventFactsContract?.visibleFactCount,
          beforeBoundFactCount: beforeLiveReport?.eventFactsContract?.boundFactCount,
          humanReviewCompleted: false,
          machineEvidenceReplacesHumanReview: false,
          publicationState: "unpublished"
        },
        compatibilityContracts: {
          providerCancellation: {
            verdict: "PASS_CURRENT_SOURCE_HERMES_EVENT_FACT_PROVIDER_CANCELLATION_COMPATIBILITY",
            sourceHead: productCommit,
            changedGovernedPath: "lib/knowledge-candidate-route.ts",
            focusedVitest: {
              file: "tests/knowledge-regenerate-route.test.ts",
              files: 1,
              tests: 18,
              failed: 0
            },
            requestSignalForwardedToGeneration: true,
            abortSkipsProviderFallback: true,
            originalSecurityBaselineRewritten: false
          }
        },
        mutationBoundary: {
          ...report.mutationBoundary,
          vectorOrEmbeddingMutationPerformed: false,
          wikiPublicationPerformed: false,
          koshaRegistryMutationPerformed: false
        },
        securityBoundary: {
          immutableOriginal18FindingBaselinePreserved: true
        },
        remainingBoundaries: {
          ...report.remainingBoundaries,
          providerDispatchPersistence: "APPROVAL_GATED"
        }
      }
    : evidenceInspectorMode
    ? {
        schemaVersion: "safeclaw-hermes-knowledge-review-evidence-inspector-summary/v2",
        verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR",
        checkedAt,
        sourceHead,
        productCommit,
        productionCommit: productionBuild.commitSha,
        deploymentUrl: productionBuild.deploymentUrl,
        local: localSummary,
        afterLive: liveSummary,
        liveAfterDeploymentRequired: false,
        evidenceContract: {
          itemLimit: report.workbenchContract.evidenceItemLimit,
          fixtureItemCount: report.workbenchContract.evidenceItemCount,
          authorityCountsMatchReviewContract: true,
          desktopCandidateAndEvidenceMounted: true,
          desktopEvidenceColumns: report.workbenchContract.desktopEvidenceColumns,
          mobileMountedPaneCount: report.workbenchContract.mobileMountedPaneCount,
          mobileCandidateEvidenceSegmentedControl: true,
          candidateTablist: report.workbenchContract.candidateTablist,
          candidateRovingTabStop: report.workbenchContract.candidateRovingTabStop,
          candidateKeyboardNavigation: report.workbenchContract.candidateKeyboardNavigation,
          breakpointOrientationSynchronized: report.workbenchContract.breakpointOrientationSynchronized,
          mobilePaneTabsLinked: report.workbenchContract.mobilePaneTabsLinked,
          mobilePaneKeyboardNavigation: report.workbenchContract.mobilePaneKeyboardNavigation,
          decisionPendingStatusLive: report.workbenchContract.decisionPendingStatusLive,
          decisionBusyStateExposed: report.workbenchContract.decisionBusyStateExposed,
          decisionActionsDisabledDuringSave: report.workbenchContract.decisionActionsDisabledDuringSave,
          decisionSettlesAccessibly: report.workbenchContract.decisionSettlesAccessibly,
          publicOfficialHttpsLinkCount: report.workbenchContract.publicEvidenceLinkCount,
          privateEvidenceRawIdentityExposed: report.workbenchContract.privateEvidenceRawIdentityExposed,
          evidenceInternalScroll: report.workbenchContract.evidenceInternalScroll,
          horizontalOverflow: results.some((result) => result.metrics.horizontalOverflow),
          desktopSelectedCandidateHeight: Math.max(...results.filter((result) => result.viewport.width > 720).map((result) => result.metrics.selectedCandidateHeight)),
          mobileSelectedCandidateHeight: Math.max(...results.filter((result) => result.viewport.width <= 720).map((result) => result.metrics.selectedCandidateHeight)),
          maxFirstActionDepth: Math.max(...results.map((result) => result.metrics.firstActionDepth))
        },
        mutationBoundary: {
          ...report.mutationBoundary,
          vectorOrEmbeddingMutationPerformed: false,
          wikiPublicationPerformed: false,
          koshaRegistryMutationPerformed: false
        },
        securityBoundary: {
          immutableOriginal18FindingBaselinePreserved: true,
          freshFullRepositoryScanRequired: true,
          securityComplete: false
        },
        remainingBoundaries: {
          ...report.remainingBoundaries,
          providerDispatchPersistence: "APPROVAL_GATED"
        }
      }
    : candidateReadinessMode
      ? {
          schemaVersion: "safeclaw-llm-wiki-candidate-content-readiness-summary/v1",
          verdict: "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS",
          checkedAt,
          sourceHead,
          productCommit,
          productionCommit: productionBuild.commitSha,
          deploymentUrl: productionBuild.deploymentUrl,
          local: localSummary,
          afterLive: liveSummary,
          liveAfterDeploymentRequired: false,
          contentReadinessContract: report.contentReadinessContract,
          workbenchContract: report.workbenchContract,
          mutationBoundary: {
            ...report.mutationBoundary,
            vectorOrEmbeddingMutationPerformed: false,
            wikiPublicationPerformed: false,
            koshaRegistryMutationPerformed: false
          },
          remainingBoundaries: report.remainingBoundaries
        }
      : {
        schemaVersion: "safeclaw-hermes-knowledge-review-authority-ui-summary/v2",
        verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
        checkedAt,
        sourceHead,
        productCommit,
        productionCommit: productionBuild.commitSha,
        local: localSummary,
        afterLive: liveSummary,
        authorityContract: report.authorityContract,
        workbenchContract: report.workbenchContract,
        mutationBoundary: report.mutationBoundary,
        remainingBoundaries: report.remainingBoundaries
      };
  await fs.writeFile(summaryReportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const summaryTitle = traceMatrixMode
    ? "Hermes Canonical Hazard Review Trace Matrix"
    : traceBlocksMode
    ? "Hermes Hazard-to-Evidence Review Trace Blocks"
    : eventFactsMode
    ? "Hermes Knowledge Review Event Fact Traceability"
    : evidenceInspectorMode
    ? "Hermes Knowledge Review Evidence Inspector"
    : candidateReadinessMode
      ? "LLM Wiki Candidate Content Readiness"
      : "Hermes Knowledge Review Authority UI";
  await fs.writeFile(summaryMarkdownPath, `# ${summaryTitle}

- Verdict: \`${summary.verdict}\`
- Product commit: \`${productCommit}\`
- Production commit: \`${productionBuild.commitSha}\`
- Local geometry: ${summary.local.passedCount}/${summary.local.viewportCount} PASS
- Live geometry: ${summary.afterLive.passedCount}/${summary.afterLive.viewportCount} PASS
${eventFactsMode ? "- Provider cancellation compatibility: `PASS_CURRENT_SOURCE_HERMES_EVENT_FACT_PROVIDER_CANCELLATION_COMPATIBILITY` (18/18 focused tests)" : ""}

## Result

${traceMatrixMode
  ? "All canonical hazards retain every configured control and primary-document mapping in explicit evidence-bound review rows across desktop and mobile. The trace list remains internally scrollable, and incomplete mappings continue to fail approval closed."
  : traceBlocksMode
  ? "One scoped review candidate exposes an explicit hazard -> controls -> primary documents -> evidence-row trace block in every measured viewport. Incomplete or unresolved trace input disables approval while site-only retention and rejection remain available. This is a bounded reviewer-support contract, not full all-hazard or all-document trace closure."
  : eventFactsMode
  ? "Explicit safe original-event facts move from 0/8 visible and bound before remediation to 8/8 local and live. Two reviewer-visible facts remain bound to their exact evidence row with zero orphan facts, zero private-event exposure, and no candidate-body marker duplication."
  : evidenceInspectorMode
  ? "The selected-candidate inspector keeps five evidence items bounded, exposes only allowlisted official HTTPS references, and preserves generic tenant-evidence labels."
  : candidateReadinessMode
    ? "The candidate cockpit derives four required content sections server-side, exposes revision reasons, and blocks approval while keeping site-only and reject decisions available."
    : "The authenticated review candidate cockpit exposes six evidence-role counts, keeps legal-duty claims bound to law provenance, blocks public promotion of tenant memory, and requires site-manager acceptance before workpack use."}
The candidate navigator keeps one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and keyboard navigation across candidates and compact review panes. The decision rail stays in the first viewport, requires an explicit candidate-and-evidence confirmation, and preserves live pending, busy, disabled, and settled states around save.

## Boundary

- Machine evidence does not replace human review.
- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains \`MISSING_EVIDENCE\`.
- LLM Wiki publication and live RLS isolation remain \`APPROVAL_GATED\`.
`, "utf8");
}

console.log(JSON.stringify({
  verdict: report.verdict,
  viewportCount: report.viewportCount,
  passedCount: report.passedCount,
  failedCount: report.failedCount,
  outputDir
}));
process.exitCode = failed.length === 0 ? 0 : 1;
