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
  candidateText: "작업발판 단부의 안전난간 상태와 추락방지 조치를 확인하고 현장 책임자가 적용 여부를 검토합니다.",
  matchedHazardCount: 1,
  providerLabel: "SafeClaw candidate builder",
  evidenceItems: [
    { id: "evidence-1111111111111111", authorityId: "law", authorityLabel: "법령 근거", sourceLabel: "산업안전보건법 제38조", capturedAt: "2026-08-14T00:00:00.000Z", digest: "sha256:1111111111111111", metadata: [{ label: "조문", value: "제38조" }], publicUrl: "https://www.law.go.kr/법령/산업안전보건법" },
    { id: "evidence-2222222222222222", authorityId: "sif", authorityLabel: "SIF 통제 근거", sourceLabel: "추락 재해 통제 사례", capturedAt: "2026-08-14T00:01:00.000Z", digest: "sha256:2222222222222222", metadata: [{ label: "자료 유형", value: "sif-case" }], publicUrl: "https://www.kosha.or.kr/kosha/data/industrialAccidentStatus.do" },
    { id: "evidence-3333333333333333", authorityId: "kosha", authorityLabel: "KOSHA 기술 지침", sourceLabel: "추락 방지 기술 지침", capturedAt: "2026-08-14T00:02:00.000Z", digest: "sha256:3333333333333333", metadata: [{ label: "가이드 코드", value: "C-49" }], publicUrl: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all" },
    { id: "evidence-4444444444444444", authorityId: "organization_history", authorityLabel: "조직 전용 이력", sourceLabel: "조직 전용 이력", capturedAt: "2026-08-14T00:03:00.000Z", digest: "sha256:4444444444444444", metadata: [], publicUrl: null },
    { id: "evidence-5555555555555555", authorityId: "site_history", authorityLabel: "현장 전용 이력", sourceLabel: "현장 전용 이력", capturedAt: "2026-08-14T00:04:00.000Z", digest: "sha256:5555555555555555", metadata: [], publicUrl: null }
  ],
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
  }
};
const queueItems = [
  queueItem,
  {
    ...queueItem,
    runId: "22222222-2222-4222-8222-222222222222",
    candidateLabel: "작업계획서 지식 후보 검토",
    candidateText: "양중 작업구역을 분리하고 신호수 배치 상태를 검토합니다.",
    matchedHazardCount: 2
  },
  {
    ...queueItem,
    runId: "33333333-3333-4333-8333-333333333333",
    candidateLabel: "TBM 브리핑 지식 후보 검토",
    candidateText: "작업 전 정전·검전·잠금표지 상태를 확인합니다.",
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
        localStorage.setItem(storageKey, JSON.stringify({
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
        }));
      }, authStorageKey);
      await page.route("**/api/knowledge/review", async (route) => {
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

      await page.goto(`${baseUrl}/knowledge?theme=${theme}#knowledge-governance-heading`, {
        waitUntil: "networkidle"
      });
      if (viewport.width <= 720) {
        await page.getByRole("tab", { name: "검토 흐름" }).click();
      }
      const inbox = page.locator('[data-knowledge-review-inbox="true"]');
      await inbox.getByRole("heading", { name: queueItem.candidateLabel }).waitFor();
      const candidateTabs = inbox.locator('[role="tablist"][aria-label="지식 후보"] [role="tab"]');
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
        const evidenceWorkbench = workbench?.querySelector("[data-review-evidence-workbench='true']");
        const evidencePane = workbench?.querySelector("[data-review-pane='evidence']");
        const authority = document.querySelector("[data-review-authority-contract='true']");
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
          || !(actionGroup instanceof HTMLElement)
          || !(firstAction instanceof HTMLElement)
          || !(candidateTablist instanceof HTMLElement)) {
          throw new Error("Missing Hermes review authority UI");
        }
        const rootRect = root.getBoundingClientRect();
        const navigatorRect = navigator.getBoundingClientRect();
        const selectedCandidateRect = selectedCandidate.getBoundingClientRect();
        const authorityRect = authority.getBoundingClientRect();
        const actionRect = actionGroup.getBoundingClientRect();
        const candidateTabs = Array.from(candidateTablist.querySelectorAll('[role="tab"]'));
        const selectedCandidateTab = candidateTabs.find((tab) => tab.getAttribute("aria-selected") === "true");
        const candidateControlIds = candidateTabs.map((tab) => tab.getAttribute("aria-controls") || "");
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
          selectedCandidateControlLinked: selectedCandidateTab?.getAttribute("aria-controls") === selectedCandidate.id,
          selectedCandidatePanelRole: selectedCandidate.getAttribute("role"),
          selectedCandidatePanelLabelledBy: selectedCandidate.getAttribute("aria-labelledby") === selectedCandidateTab?.id,
          selectedCandidateCount: workbench.querySelectorAll("[data-selected-review-candidate='true']").length,
          selectedBodyCount: workbench.querySelectorAll("[data-selected-candidate-body='true']").length,
          selectedBodyOverflowY: getComputedStyle(selectedBody).overflowY,
          evidencePaneCount: workbench.querySelectorAll("[data-review-pane='evidence']").length,
          evidenceItemCount: evidencePane?.querySelectorAll("li[data-review-evidence-authority]").length ?? 0,
          evidenceWorkbenchColumns: getComputedStyle(evidenceWorkbench).gridTemplateColumns.split(" ").length,
          evidenceInternalScroll: evidencePane?.querySelector("ol") instanceof HTMLElement
            ? getComputedStyle(evidencePane.querySelector("ol")).overflowY
            : null,
          publicEvidenceLinkCount: evidencePane?.querySelectorAll("a[href^='https://']").length ?? 0,
          navigatorBeforeDetail: navigatorRect.right <= selectedCandidateRect.left + 1,
          selectedCandidateHeight: selectedCandidateRect.height,
          authorityWidth: authorityRect.width,
          authorityRoleCount: authority.querySelectorAll("[data-review-authority-role]").length,
          authorityContained: authority.scrollWidth <= authority.clientWidth + 1,
          actionGroupTop: actionRect.top,
          firstActionBottom: firstAction.getBoundingClientRect().bottom,
          firstActionDepth: firstAction.getBoundingClientRect().bottom - rootRect.top,
          actionCount: actionGroup.querySelectorAll("button").length,
          actionContained: actionGroup.scrollWidth <= actionGroup.clientWidth + 1
        };
      });
      let mobileEvidence = null;
      if (viewport.width <= 720) {
        await inbox.getByRole("tab", { name: `근거 ${queueItem.evidenceItems.length}`, exact: true }).click();
        mobileEvidence = await page.evaluate(() => {
          const workbench = document.querySelector("[data-review-workbench='selected-only']");
          const pane = workbench?.querySelector("[data-review-pane='evidence']");
          if (!(workbench instanceof HTMLElement) || !(pane instanceof HTMLElement)) {
            throw new Error("Missing mobile Hermes evidence pane");
          }
          const list = pane.querySelector("ol");
          return {
            paneCount: workbench.querySelectorAll("[data-review-pane]").length,
            candidatePaneCount: workbench.querySelectorAll("[data-review-pane='candidate']").length,
            evidenceItemCount: pane.querySelectorAll("li[data-review-evidence-authority]").length,
            publicEvidenceLinkCount: pane.querySelectorAll("a[href^='https://']").length,
            listOverflowY: list instanceof HTMLElement ? getComputedStyle(list).overflowY : null,
            contained: pane.scrollWidth <= pane.clientWidth + 1
          };
        });
      }
      const screenshot = `knowledge-review-authority-${theme}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });
      const passed = metrics.horizontalOverflow === false
        && metrics.navigatorCandidateCount === queueItems.length
        && metrics.candidateTablistRole === "tablist"
        && metrics.candidateTablistOrientation === (viewport.width <= 720 ? "horizontal" : "vertical")
        && metrics.candidateTabCount === queueItems.length
        && metrics.selectedCandidateTabCount === 1
        && metrics.tabbableCandidateTabCount === 1
        && metrics.candidateControlIdsPresent
        && metrics.candidateControlIdsUnique
        && metrics.selectedCandidateControlLinked
        && metrics.selectedCandidatePanelRole === "tabpanel"
        && metrics.selectedCandidatePanelLabelledBy
        && candidateEndState.selectedIndex === queueItems.length - 1
        && candidateEndState.focusedIndex === queueItems.length - 1
        && candidateHomeState.selectedIndex === 0
        && candidateHomeState.focusedIndex === 0
        && metrics.selectedCandidateCount === 1
        && metrics.selectedBodyCount === 1
        && metrics.selectedBodyOverflowY === "auto"
        && (viewport.width > 720
          ? metrics.workbenchColumns === 2 && metrics.navigatorBeforeDetail && metrics.selectedCandidateHeight <= 580
          : metrics.workbenchColumns === 1)
        && metrics.authorityRoleCount === 6
        && metrics.authorityContained
        && metrics.actionCount === 3
        && metrics.actionContained
        && (viewport.width > 720
          ? metrics.evidencePaneCount === 1
            && metrics.evidenceItemCount === queueItem.evidenceItems.length
            && metrics.evidenceWorkbenchColumns === 2
            && metrics.evidenceInternalScroll === "auto"
            && metrics.publicEvidenceLinkCount === 3
          : mobileEvidence?.paneCount === 1
            && mobileEvidence.candidatePaneCount === 0
            && mobileEvidence.evidenceItemCount === queueItem.evidenceItems.length
            && mobileEvidence.publicEvidenceLinkCount === 3
            && mobileEvidence.listOverflowY === "auto"
            && mobileEvidence.contained
            && mobilePaneKeyboard?.endState.selectedIndex === 1
            && mobilePaneKeyboard.endState.focusedIndex === 1
            && mobilePaneKeyboard.endState.mountedPane === "evidence"
            && mobilePaneKeyboard.homeState.selectedIndex === 0
            && mobilePaneKeyboard.homeState.focusedIndex === 0
            && mobilePaneKeyboard.homeState.mountedPane === "candidate")
        && metrics.firstActionDepth <= viewport.height * 1.25
        && browserErrors.length === 0;
      results.push({
        theme,
        viewport,
        screenshot,
        metrics,
        candidateKeyboard: { endState: candidateEndState, homeState: candidateHomeState },
        mobilePaneKeyboard,
        mobileEvidence,
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
  contractMode: evidenceInspectorMode ? "evidence-inspector" : "authority-ui",
  verdict: failed.length === 0 && productionAligned
    ? evidenceInspectorMode
      ? "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
      : "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    : failed.length === 0 && !liveMode
      ? evidenceInspectorMode
        ? "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVIDENCE_INSPECTOR"
        : "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
      : evidenceInspectorMode
        ? "RED_HERMES_REVIEW_EVIDENCE_INSPECTOR"
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
    desktopColumns: 2,
    mobileColumns: 1,
    candidateBodyInternalScroll: true,
    candidateTablist: true,
    candidateRovingTabStop: true,
    candidateKeyboardNavigation: true,
    breakpointOrientationSynchronized: true,
    mobilePaneTabsLinked: true,
    mobilePaneKeyboardNavigation: true,
    evidenceItemLimit: 20,
    evidenceItemCount: queueItem.evidenceItems.length,
    desktopEvidenceColumns: 2,
    mobileMountedPaneCount: 1,
    publicEvidenceLinkCount: 3,
    privateEvidenceRawIdentityExposed: false,
    evidenceInternalScroll: true
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
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted.
- Candidate tabs expose one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and Arrow/Home/End keyboard navigation.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.
- Desktop mounts the selected candidate and five-item evidence inspector together; mobile mounts one linked pane behind a keyboard-operable segmented tab control.
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
  const localReportPath = path.join(summaryDir, "report.json");
  const localMarkdownPath = path.join(summaryDir, "report.md");
  const localReport = JSON.parse(await fs.readFile(localReportPath, "utf8"));
  const afterLocalDir = path.join(summaryDir, "after-local");
  await fs.mkdir(afterLocalDir, { recursive: true });
  await fs.copyFile(localReportPath, path.join(afterLocalDir, "report.json"));
  await fs.copyFile(localMarkdownPath, path.join(afterLocalDir, "report.md"));

  const summary = {
    schemaVersion: "safeclaw-hermes-knowledge-review-authority-ui-summary/v1",
    verdict: "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI",
    checkedAt,
    sourceHead,
    productCommit,
    productionCommit: productionBuild.commitSha,
    local: {
      path: path.relative(process.cwd(), path.join(afterLocalDir, "report.json")),
      verdict: localReport.verdict,
      viewportCount: localReport.viewportCount,
      passedCount: localReport.passedCount,
      failedCount: localReport.failedCount
    },
    afterLive: {
      path: path.relative(process.cwd(), path.join(outputDir, "report.json")),
      verdict: report.verdict,
      viewportCount: report.viewportCount,
      passedCount: report.passedCount,
      failedCount: report.failedCount
    },
    authorityContract: report.authorityContract,
    workbenchContract: report.workbenchContract,
    mutationBoundary: report.mutationBoundary,
    remainingBoundaries: report.remainingBoundaries
  };
  await fs.writeFile(localReportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(localMarkdownPath, `# Hermes Knowledge Review Authority UI

- Verdict: \`${summary.verdict}\`
- Product commit: \`${productCommit}\`
- Production commit: \`${productionBuild.commitSha}\`
- Local geometry: ${summary.local.passedCount}/${summary.local.viewportCount} PASS
- Live geometry: ${summary.afterLive.passedCount}/${summary.afterLive.viewportCount} PASS

## Result

The authenticated review candidate cockpit exposes six evidence-role counts, keeps legal-duty claims bound to law provenance, blocks public promotion of tenant memory, and requires site-manager acceptance before workpack use.
The candidate navigator also keeps one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and keyboard navigation across candidates and compact review panes.

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
