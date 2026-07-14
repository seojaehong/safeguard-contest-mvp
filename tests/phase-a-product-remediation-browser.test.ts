import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";

import { buildWorkpackGenerationFingerprint } from "@/lib/current-workpack";
import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { applyPhaseADocumentAuthorityMarker } from "@/lib/phase-a-review";
import type { AskResponse, PhaseAReview } from "@/lib/types";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness,
} from "./helpers/isolated-next-browser-harness";

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONFIRMATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTH_TOKEN = "phase-a-product-reviewer-session";
const SUPABASE_URL = "https://phase-a-product-fixture.supabase.co";
const AUTH_STORAGE_KEY = "sb-phase-a-product-fixture-auth-token";
const EVIDENCE_DIRECTORY = process.env.PHASE_A_BROWSER_EVIDENCE_DIR?.trim()
  ? path.resolve(process.env.PHASE_A_BROWSER_EVIDENCE_DIR)
  : null;
const BROWSER_HARNESS_MODE = process.env.PHASE_A_BROWSER_HARNESS_MODE === "prod" ? "prod" : "dev";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;

function readyPendingReview(): PhaseAReview {
  const planBinding = structuredClone(
    buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
  );
  return {
    verdict: "검토 필요",
    verified: false,
    evidenceChainState: "resolved",
    groundingStatus: "resolved",
    outputStatus: "grounded_draft",
    verifiedRecords: planBinding.expectedRecordCount,
    planBinding,
    materializationCoverage: {
      status: "complete",
      chainId: planBinding.chainId,
      planDigest: planBinding.planDigest,
      expectedRecordCount: planBinding.expectedRecordCount,
      materializedRecordCount: planBinding.expectedRecordCount,
      expectedStableKeys: [...planBinding.expectedStableKeys],
      materializedStableKeys: [...planBinding.expectedStableKeys],
      unresolvedStableKeys: [],
    },
    humanConfirmation: { required: true, status: "pending" },
    actionableReason: "인증된 검토자의 최종 확인이 필요합니다.",
  };
}

function confirmedReview(token = AUTH_TOKEN): PhaseAReview {
  const pending = readyPendingReview();
  const planBinding = pending.planBinding;
  if (!planBinding) throw new Error("expected Phase A plan binding");
  return {
    ...pending,
    verdict: "통과",
    verified: true,
    humanConfirmation: {
      required: true,
      status: "confirmed",
      confirmationId: CONFIRMATION_ID,
      confirmedAt: "2026-07-13T20:00:00.000Z",
      issuedBy: "safeclaw_server",
      workpackId: WORKPACK_ID,
      reviewer: {
        principalType: "authenticated_workspace_user",
        userId: "phase-a-reviewer",
        sessionFingerprint: `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`,
      },
      chainId: planBinding.chainId,
      planDigest: planBinding.planDigest,
    },
    actionableReason: "Phase A 근거와 문서 반영 실적을 인증된 검토자가 확인했습니다.",
  };
}

function withGenerationEvidence(response: AskResponse, signatureCharacter: "a" | "b"): AskResponse {
  const dbHarnessPacket = response.dbHarness?.packet;
  if (!dbHarnessPacket) throw new Error("expected sample DB harness packet");
  return {
    ...response,
    generationEvidence: {
      version: "safeclaw-generation-evidence/v1",
      algorithm: "HMAC-SHA256",
      snapshot: {
        question: response.question,
        scenario: response.scenario,
        dbHarnessPacket,
        generationTrace: response.generationTrace,
        responseContentDigest: `sha256:${signatureCharacter.repeat(64)}`,
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
      signature: signatureCharacter.repeat(64),
    },
    generationEvidenceError: undefined,
  };
}

function withDbHarness(response: AskResponse): AskResponse {
  const packet = buildDbHarnessPacket({
    question: response.question,
    references: [
      {
        id: "phase-a-direct-control",
        source_id: "kosha-phase-a-browser",
        item_type: "technical-guideline",
        category: "차량계 하역운반기계",
        subcategory: "접촉 방지",
        title: "차량계 하역운반기계 접촉 방지 지침",
        summary: "작업구역 분리와 유도자 배치를 확인합니다.",
        keywords: ["지게차", "접촉", "유도자"],
        risk_tags: ["struck-by"],
        primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        controls: ["작업구역 분리", "유도자 배치"],
        evidence_role: "direct",
        retrieval_source: "ranked",
      },
      {
        id: "phase-a-sif-priority",
        source_id: "sif-phase-a-browser",
        item_type: "sif-case",
        category: "SIF",
        subcategory: "끼임",
        title: "차량과 작업자 접촉 SIF 사례",
        summary: "차량 동선과 작업자 동선이 겹친 중대사고 사례입니다.",
        keywords: ["지게차", "끼임", "동선"],
        risk_tags: ["struck-by"],
        primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
        controls: ["보행 동선 분리"],
        evidence_role: "supporting",
        retrieval_source: "ranked",
      },
    ],
  });
  return {
    ...response,
    dbHarness: {
      packet,
      promptContext: buildHarnessPromptContext(packet),
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: packet.improvementMemory.length,
        workpackMemory: packet.workpackMemory.length,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status,
      },
    },
  };
}

function buildPendingFixture(): AskResponse {
  const sample = withDbHarness(buildSampleWorkpack());
  return withGenerationEvidence({
    ...sample,
    phaseAReview: readyPendingReview(),
    status: { ...sample.status, summary: "Phase A 사람 확인 대기" },
  }, "a");
}

function buildConfirmedFixture(): AskResponse {
  const sample = withDbHarness(buildSampleWorkpack());
  const review = confirmedReview();
  const deliverables = { ...sample.deliverables };
  for (const key of Object.keys(deliverables) as Array<keyof typeof deliverables>) {
    const value = deliverables[key];
    if (typeof value === "string") {
      deliverables[key] = applyPhaseADocumentAuthorityMarker(value, review) as never;
    }
  }
  return withGenerationEvidence({
    ...sample,
    phaseAReview: review,
    deliverables,
    status: { ...sample.status, summary: "Phase A 근거 및 사람 확인 완료" },
  }, "a");
}

function buildServerConfirmedWorkpack(pending: AskResponse): AskResponse {
  const review = confirmedReview();
  const deliverables = { ...pending.deliverables };
  const documentCoverage = pending.dbHarness?.summary.documentCoverage ?? [];
  for (const key of Object.keys(deliverables) as Array<keyof typeof deliverables>) {
    const value = deliverables[key];
    if (typeof value === "string") {
      deliverables[key] = applyPhaseADocumentAuthorityMarker(value, review) as never;
    }
  }
  return withGenerationEvidence({
    ...pending,
    phaseAReview: review,
    deliverables,
    qualityContract: {
      overall: "ready",
      summary: "공유 전 핵심 항목이 준비됐습니다.",
      generatedAt: "2026-07-14T00:00:00.000Z",
      items: [],
      fallback: { hasFallback: false, modes: {} },
      ontology: { status: "ready", matchCount: 1, verdict: "통과", detail: "안전조치 검수 통과" },
      evidence: { status: "ready", mappedCount: 3, requiredCount: 3, detail: "증빙 매핑 완료" },
      structured: { status: "ready", readyCount: 4, requiredCount: 4, detail: "구조화 완료" },
      persistence: { status: "ready", requiresLogin: true, detail: "저장 준비" },
      dbHarness: {
        status: "ready",
        directEvidenceCount: 1,
        sifCaseCount: 1,
        supportingEvidenceCount: 1,
        missingEvidence: [],
        documentCoverage,
        detail: "DB 하네스 준비",
      },
    },
    ontologyQa: {
      reviewTask: "차량계 하역운반기계 작업",
      result: {
        reviewable: true,
        task: "차량계 하역운반기계 작업",
        covered: { hazards: ["접촉"], controls: ["작업구역 분리"], articles: [] },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "검수 통과",
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "안전조치 검수 통과",
    },
    status: { ...pending.status, summary: "SERVER_CONFIRMED_WORKPACK" },
  }, "b");
}

async function seedAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript(({ expectedOrigin, storageKey, token }) => {
    if (window.location.origin !== expectedOrigin) return;
    window.localStorage.setItem(storageKey, JSON.stringify({
      access_token: token,
      refresh_token: "phase-a-product-refresh-token",
      expires_at: 4_102_444_800,
      expires_in: 3_600,
      token_type: "bearer",
      user: {
        id: "phase-a-reviewer",
        aud: "authenticated",
        role: "authenticated",
        email: "reviewer@example.com",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-14T00:00:00.000Z",
      },
    }));
  }, { expectedOrigin: baseUrl, storageKey: AUTH_STORAGE_KEY, token: AUTH_TOKEN });
}

async function prepareWorkspace(
  page: Page,
  fixture: AskResponse,
  options: { theme?: "day" | "night"; authenticated?: boolean } = {},
): Promise<void> {
  page.setDefaultTimeout(15_000);
  await page.addInitScript(() => {
    window.localStorage.setItem("safeclaw.aiMode", "template");
  });
  if (options.authenticated) await seedAuthenticatedSession(page);
  await page.route("**/api/weather?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, weather: null }),
    });
  });
  await page.route("**/api/agent/context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sites: [{ id: "site-a", name: "성수 현장" }] }),
    });
  });
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });
  const navigation = await page.goto(`${baseUrl}/workspace?theme=${options.theme ?? "day"}`, { waitUntil: "networkidle" });
  try {
    await page.locator("#field-command-input").fill(fixture.question);
  } catch (error) {
    const pageText = await page.locator("body").innerText().catch(() => "");
    throw new Error(
      `workspace input unavailable (${navigation?.status() ?? "no response"})\n${pageText.slice(0, 4_000)}\n${harness?.readServerOutput() ?? ""}`,
      { cause: error },
    );
  }
  await page.getByRole("button", { name: /안전 문서 생성/ }).click();
  try {
    await page.locator(".document-preview-pane").waitFor({ state: "visible", timeout: 8_000 });
  } catch (error) {
    const pageText = await page.locator("body").innerText();
    throw new Error(
      `workspace fixture did not reach document review\n${pageText.slice(0, 4_000)}\n${harness?.readServerOutput() ?? ""}`,
      { cause: error },
    );
  }
}

async function openEditor(page: Page): Promise<void> {
  await page.locator(".doc-card-actions button", { hasText: "편집" }).first().click();
  await page.locator(".document-textarea").waitFor({ state: "visible" });
}

async function downloadText(page: Page, buttonName: string): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error(`download path missing for ${buttonName}`);
  return fs.readFileSync(downloadPath, "utf8");
}

async function installSaveRoutes(page: Page): Promise<{
  workerPostCount: () => number;
  workpackPostCount: () => number;
  educationPostCount: () => number;
}> {
  let workerPostCount = 0;
  let workpackPostCount = 0;
  let educationPostCount = 0;
  await page.route("**/api/workers", async (route) => {
    workerPostCount += 1;
    const requestBody = route.request().postDataJSON() as unknown;
    const workers = typeof requestBody === "object" && requestBody !== null && "workers" in requestBody
      ? Reflect.get(requestBody, "workers")
      : [];
    const workerMap: Record<string, string> = {};
    if (Array.isArray(workers)) {
      workers.forEach((worker, index) => {
        if (typeof worker !== "object" || worker === null) return;
        const id = Reflect.get(worker, "id");
        if (typeof id !== "string") return;
        workerMap[id] = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      });
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "작업자 저장 완료", workerMap }),
    });
  });
  await page.route("**/api/workpacks", async (route) => {
    workpackPostCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "문서팩 저장 완료", workpackId: WORKPACK_ID }),
    });
  });
  await page.route("**/api/education-records", async (route) => {
    educationPostCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "교육 이력 저장 완료", savedCount: 1 }),
    });
  });
  return {
    workerPostCount: () => workerPostCount,
    workpackPostCount: () => workpackPostCount,
    educationPostCount: () => educationPostCount,
  };
}

function writeEvidenceJson(fileName: string, value: unknown): void {
  if (!EVIDENCE_DIRECTORY) return;
  fs.mkdirSync(EVIDENCE_DIRECTORY, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIRECTORY, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("Phase A product remediation browser contract", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "phase-a-product-remediation",
      initialPath: "/workspace?theme=day",
      portSalt: 7140,
      mode: BROWSER_HARNESS_MODE,
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "phase-a-product-anon-key",
      },
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 30_000);

  it("invalidates confirmed authority before every local export and after editor remount", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await prepareWorkspace(page, buildConfirmedFixture());
    await openEditor(page);
    await page.evaluate(() => {
      window.localStorage.setItem("safeclaw.pendingWorkpackSave.v1", "stale-pending-authority");
    });

    const editor = page.locator(".document-textarea");
    const authorityMarker = page.locator(".phase-a-authority-marker").first();
    expect(await authorityMarker.textContent()).toContain("법령 근거: 연결됨");
    const editedText = `[EDIT_REQUIRES_REVALIDATION]\n${await editor.inputValue()}`;
    await editor.fill(editedText);
    await expect.poll(async () => await authorityMarker.textContent()).toContain("법령 근거: 검토 필요");
    await expect.poll(async () => await editor.inputValue()).not.toContain("법령 근거: 연결됨");
    await expect.poll(async () => await editor.inputValue()).not.toContain("공식자료 확인 완료");
    expect(await page.evaluate(() => (
      window.localStorage.getItem("safeclaw.pendingWorkpackSave.v1")
    ))).toBeNull();
    const connectionStatus = page.locator(".result-ribbon article", { hasText: "연결 상태" });
    await expect.poll(async () => await connectionStatus.locator("strong").textContent()).toContain("편집 후 재검수 필요");
    const pendingEditedText = await editor.inputValue();
    expect(pendingEditedText).toContain("EDIT_REQUIRES_REVALIDATION");

    const exportPanel = page.getByTestId("editor-export-panel");
    await exportPanel.evaluate((element) => {
      if (!(element instanceof HTMLDetailsElement)) throw new Error("expected export details");
      element.open = true;
    });
    await exportPanel.locator("summary", { hasText: "베타 형식" }).click();

    const downloads = {
      txt: await downloadText(page, "TXT"),
      json: await downloadText(page, "JSON"),
      html: await downloadText(page, "HTML"),
      csv: await downloadText(page, "CSV"),
      xls: await downloadText(page, "XLS(legacy)"),
      tsv: await downloadText(page, "Sheets용 TSV 다운로드"),
    };
    for (const [format, content] of Object.entries(downloads)) {
      expect(content, `${format} stale legal authority`).not.toContain("법령 근거: 연결됨");
      expect(content, `${format} stale confirmed authority`).not.toContain("공식자료 확인 완료");
    }
    for (const format of ["txt", "json", "html", "xls"] as const) {
      expect(downloads[format]).toContain("법령 근거: 검토 필요");
    }

    await page.getByRole("button", { name: "문서 검토로 돌아가기" }).click();
    await page.locator(".document-preview-pane").waitFor({ state: "visible" });
    await openEditor(page);
    expect(await page.locator(".document-textarea").inputValue()).toBe(pendingEditedText);
    expect(await page.locator(".phase-a-authority-marker").first().textContent()).toContain("법령 근거: 검토 필요");

    if (EVIDENCE_DIRECTORY) {
      await page.getByTestId("editor-export-panel").evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) throw new Error("expected export details");
        element.open = true;
      });
      await page.screenshot({
        path: path.join(EVIDENCE_DIRECTORY, "phase-a-edit-pending-export-day-desktop.png"),
        fullPage: true,
      });
      writeEvidenceJson("phase-a-local-export-status.json", {
        editedSentinelPresent: Object.values(downloads).every((content) => content.includes("EDIT_REQUIRES_REVALIDATION")),
        staleConnectedAuthorityCount: Object.values(downloads).filter((content) => content.includes("법령 근거: 연결됨")).length,
        staleConfirmedAuthorityCount: Object.values(downloads).filter((content) => content.includes("공식자료 확인 완료")).length,
        formats: Object.keys(downloads),
      });
    }
    await page.close();
  }, 120_000);

  it("calls the production confirmation route, retries a bound 409, and applies only the server workpack", async () => {
    if (!browser) throw new Error("Browser was not started");
    const pending = buildPendingFixture();
    const serverConfirmed = buildServerConfirmedWorkpack(pending);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const saveRouteCounts = await installSaveRoutes(page);
    const confirmationBodies: Array<Record<string, unknown>> = [];
    const authorizationHeaders: string[] = [];
    const shareSessionBodies: Array<Record<string, unknown>> = [];
    let dispatchPostCount = 0;
    await page.route(`**/api/workpacks/${WORKPACK_ID}/share-sessions`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, configured: true, sessions: [], confirmations: [] }),
        });
        return;
      }
      shareSessionBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          shareSessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          expiresAt: "2099-01-01T00:00:00.000Z",
          message: "공유 세션 생성 완료",
        }),
      });
    });
    await page.route("**/api/dispatch-logs?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, configured: true, logs: [], message: "전송 이력 없음" }),
      });
    });
    await page.route("**/api/workflow/dispatch", async (route) => {
      dispatchPostCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          providerStatus: "fixture",
          providerCalled: false,
          channelResults: [{
            channel: "sms",
            provider: "safe-fixture",
            status: "sent",
            message: "fixture 전송 확인",
          }],
          message: "fixture 전송 확인",
        }),
      });
    });
    await page.route(`**/api/workpacks/${WORKPACK_ID}/phase-a-confirmation`, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      confirmationBodies.push(body);
      authorizationHeaders.push(route.request().headers().authorization || "");
      if (confirmationBodies.length === 1) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            code: "phase_a_confirmation_revision_conflict",
            confirmationId: CONFIRMATION_ID,
            message: "다른 요청이 먼저 확인을 저장했습니다. 반환된 확인 ID로 멱등 재시도하세요.",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          confirmationId: CONFIRMATION_ID,
          phaseAReview: serverConfirmed.phaseAReview,
          workpack: serverConfirmed,
          message: "Phase A 근거와 문서 반영 실적 확인을 저장했습니다.",
        }),
      });
    });

    await prepareWorkspace(page, pending, { authenticated: true });
    await openEditor(page);
    const confirmation = page.getByLabel("Phase A 근거 확인");
    await confirmation.waitFor({ state: "visible" });
    const confirmButton = confirmation.getByRole("button", { name: "Phase A 확인 저장" });
    expect(await confirmButton.isDisabled()).toBe(true);
    const saveButton = confirmation.getByRole("button", { name: "현재 작업팩 저장" });
    if (await saveButton.count() !== 1) {
      throw new Error(`phase a save action unavailable: ${await confirmation.innerText()}`);
    }
    await saveButton.click();
    await expect.poll(async () => await confirmButton.isEnabled()).toBe(true);

    await confirmButton.click();
    await expect.poll(async () => await confirmation.textContent()).toContain("다른 요청이 먼저 확인을 저장했습니다");
    const retryButton = confirmation.getByRole("button", { name: "서버 확인 다시 시도" });
    await retryButton.click();
    await expect.poll(async () => await confirmation.textContent()).toContain("확인 완료");

    expect(confirmationBodies).toHaveLength(2);
    expect(confirmationBodies[0]).toMatchObject({
      chainId: pending.phaseAReview?.planBinding?.chainId,
      planDigest: pending.phaseAReview?.planBinding?.planDigest,
    });
    expect(confirmationBodies[0]).not.toHaveProperty("confirmationId");
    expect(confirmationBodies[1]).toMatchObject({ confirmationId: CONFIRMATION_ID });
    expect(authorizationHeaders).toEqual([`Bearer ${AUTH_TOKEN}`, `Bearer ${AUTH_TOKEN}`]);
    expect(await page.locator(".phase-a-authority-marker").first().textContent()).toContain("법령 근거: 연결됨");
    const currentWorkpack = await page.evaluate(() => window.localStorage.getItem("safeclaw.currentWorkpack.v1"));
    expect(currentWorkpack).toContain("SERVER_CONFIRMED_WORKPACK");
    expect(currentWorkpack).toContain(CONFIRMATION_ID);

    await page.reload({ waitUntil: "domcontentloaded" });
    const restoredShareButton = page.getByLabel("작업공간 메뉴").getByRole("button", { name: /공유/ });
    await expect.poll(async () => await restoredShareButton.isEnabled()).toBe(true);
    await restoredShareButton.click();
    const sharePanel = page.locator("#dispatch");
    await sharePanel.waitFor({ state: "visible" });
    await sharePanel.getByRole("button", { name: /메일/ }).click();
    await sharePanel.getByRole("button", { name: "저장 후 전송하기" }).click();
    const dispatchDialog = page.getByRole("dialog", { name: "현장 전파 전 확인" });
    await dispatchDialog.getByRole("button", { name: "저장 후 전송" }).click();
    await expect.poll(() => dispatchPostCount).toBe(1);

    expect(saveRouteCounts.workpackPostCount()).toBe(1);
    expect(saveRouteCounts.workerPostCount()).toBe(2);
    expect(saveRouteCounts.educationPostCount()).toBe(1);
    expect(shareSessionBodies).toHaveLength(1);
    expect(shareSessionBodies[0]).toMatchObject({
      recipients: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    });
    await page.close();
  }, 120_000);

  it("retries only W1 downstream storage after education fails", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let workpackPostCount = 0;
    let educationPostCount = 0;
    let shareSessionPostCount = 0;
    let dispatchPostCount = 0;

    await page.route("**/api/workers", async (route) => {
      const requestBody = route.request().postDataJSON() as unknown;
      const workers = typeof requestBody === "object" && requestBody !== null && "workers" in requestBody
        ? Reflect.get(requestBody, "workers")
        : [];
      const workerMap: Record<string, string> = {};
      if (Array.isArray(workers)) {
        workers.forEach((worker, index) => {
          if (typeof worker !== "object" || worker === null) return;
          const id = Reflect.get(worker, "id");
          if (typeof id !== "string") return;
          workerMap[id] = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
        });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "작업자 저장 완료", workerMap }),
      });
    });
    await page.route("**/api/workpacks", async (route) => {
      workpackPostCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "문서팩 저장 완료", workpackId: WORKPACK_ID }),
      });
    });
    await page.route("**/api/education-records", async (route) => {
      educationPostCount += 1;
      await route.fulfill({
        status: educationPostCount === 1 ? 500 : 200,
        contentType: "application/json",
        body: JSON.stringify(educationPostCount === 1
          ? { ok: false, message: "교육 확인 이력 저장에 실패했습니다." }
          : { ok: true, message: "교육 이력 저장 완료", savedCount: 2 }),
      });
    });
    await page.route("**/api/workpacks/*/share-sessions", async (route) => {
      if (route.request().method() === "POST") shareSessionPostCount += 1;
      await route.abort();
    });
    await page.route("**/api/workflow/dispatch", async (route) => {
      dispatchPostCount += 1;
      await route.abort();
    });

    await prepareWorkspace(page, buildPendingFixture(), { authenticated: true });
    await openEditor(page);
    const confirmation = page.getByLabel("Phase A 근거 확인");
    await confirmation.getByRole("button", { name: "현재 작업팩 저장" }).click();
    await expect.poll(async () => await confirmation.textContent()).toContain("교육 확인 이력 저장에 실패했습니다");
    const pendingAfterFailure = await page.evaluate(() => (
      window.localStorage.getItem("safeclaw.pendingWorkpackSave.v1")
    ));
    expect(workpackPostCount).toBe(1);
    expect(educationPostCount).toBe(1);
    expect(shareSessionPostCount).toBe(0);
    expect(dispatchPostCount).toBe(0);

    await page.reload({ waitUntil: "networkidle" });
    await openEditor(page);
    const reloadedConfirmation = page.getByLabel("Phase A 근거 확인");
    await reloadedConfirmation.getByRole("button", { name: "현재 작업팩 저장" }).click();
    await expect.poll(async () => (
      await reloadedConfirmation.getByRole("button", { name: "Phase A 확인 저장" }).isEnabled()
    )).toBe(true);

    expect.soft(workpackPostCount).toBe(1);
    expect.soft(educationPostCount).toBe(2);
    expect.soft(pendingAfterFailure ?? "").toContain(WORKPACK_ID);
    expect.soft(pendingAfterFailure ?? "").toContain("worker-supervisor-1");
    expect.soft(shareSessionPostCount).toBe(0);
    expect.soft(dispatchPostCount).toBe(0);
    expect(await page.evaluate(() => (
      window.localStorage.getItem("safeclaw.pendingWorkpackSave.v1")
    ))).toBeNull();
    await page.close();
  }, 120_000);

  it.each([
    { caseName: "empty worker selection", emptySelection: true },
    { caseName: "missing server worker mapping", emptySelection: false },
  ])("blocks workpack insertion for $caseName", async ({ emptySelection }) => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let workerPostCount = 0;
    let workpackPostCount = 0;
    let educationPostCount = 0;
    let shareSessionPostCount = 0;
    let dispatchPostCount = 0;

    await page.route("**/api/workers", async (route) => {
      workerPostCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          message: "일부 작업자 저장 완료",
          workerMap: {
            "worker-supervisor-1": "00000000-0000-4000-8000-000000000001",
          },
        }),
      });
    });
    await page.route("**/api/workpacks", async (route) => {
      workpackPostCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "문서팩 저장 완료", workpackId: WORKPACK_ID }),
      });
    });
    await page.route("**/api/education-records", async (route) => {
      educationPostCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, message: "교육 이력 저장 완료", savedCount: 2 }),
      });
    });
    await page.route("**/api/workpacks/*/share-sessions", async (route) => {
      if (route.request().method() === "POST") shareSessionPostCount += 1;
      await route.abort();
    });
    await page.route("**/api/workflow/dispatch", async (route) => {
      dispatchPostCount += 1;
      await route.abort();
    });

    await prepareWorkspace(page, buildPendingFixture(), { authenticated: true });
    await openEditor(page);
    if (emptySelection) {
      await page.locator("details.editor-operations-disclosure").evaluate((element) => {
        if (!(element instanceof HTMLDetailsElement)) throw new Error("expected operations disclosure");
        element.open = true;
      });
      const workerCheckboxes = page.getByRole("checkbox", { name: /전파 대상 선택/ });
      const count = await workerCheckboxes.count();
      for (let index = 0; index < count; index += 1) {
        const checkbox = workerCheckboxes.nth(index);
        if (await checkbox.isChecked()) await checkbox.click();
      }
    }

    const confirmation = page.getByLabel("Phase A 근거 확인");
    await confirmation.getByRole("button", { name: "현재 작업팩 저장" }).click();
    await expect.poll(async () => await confirmation.textContent()).toContain(
      emptySelection ? "작업자를 한 명 이상 선택" : "서버 저장 ID를 찾지 못했습니다",
    );

    expect.soft(workerPostCount).toBe(emptySelection ? 0 : 1);
    expect.soft(workpackPostCount).toBe(0);
    expect.soft(educationPostCount).toBe(0);
    expect.soft(shareSessionPostCount).toBe(0);
    expect.soft(dispatchPostCount).toBe(0);
    expect(await page.evaluate(() => (
      window.localStorage.getItem("safeclaw.pendingWorkpackSave.v1")
    ))).toBeNull();
    await page.close();
  }, 120_000);

  it("fails closed with actionable copy when the confirmation session is missing or expires with 401", async () => {
    if (!browser) throw new Error("Browser was not started");
    const unauthenticated = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await prepareWorkspace(unauthenticated, buildPendingFixture());
    await openEditor(unauthenticated);
    const unauthenticatedPanel = unauthenticated.getByLabel("Phase A 근거 확인");
    expect(await unauthenticatedPanel.textContent()).toContain("관리자 로그인");
    expect(await unauthenticatedPanel.getByRole("button", { name: "Phase A 확인 저장" }).isDisabled()).toBe(true);
    await unauthenticated.close();

    const expired = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await installSaveRoutes(expired);
    await expired.route(`**/api/workpacks/${WORKPACK_ID}/phase-a-confirmation`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "phase_a_confirmation_auth_required",
          message: "인증된 검토자 세션이 필요합니다.",
        }),
      });
    });
    await prepareWorkspace(expired, buildPendingFixture(), { authenticated: true });
    await openEditor(expired);
    const expiredPanel = expired.getByLabel("Phase A 근거 확인");
    await expiredPanel.getByRole("button", { name: "현재 작업팩 저장" }).click();
    const expiredConfirmButton = expiredPanel.getByRole("button", { name: "Phase A 확인 저장" });
    await expect.poll(async () => await expiredConfirmButton.isEnabled()).toBe(true);
    await expiredConfirmButton.click();
    await expect.poll(async () => await expiredPanel.textContent()).toContain("로그인 세션이 만료되었습니다");
    expect(await expiredConfirmButton.isDisabled()).toBe(true);
    await expired.close();
  }, 120_000);

  it.each([
    { failureMode: "delayed" as const },
    { failureMode: "http-500" as const },
    { failureMode: "network-abort" as const },
  ])("handles $failureMode confirmation responses without local authority", async ({ failureMode }) => {
    if (!browser) throw new Error("Browser was not started");
    const pending = buildPendingFixture();
    const serverConfirmed = buildServerConfirmedWorkpack(pending);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
    await installSaveRoutes(page);

    let releaseDelayedResponse = (): void => {};
    const delayedResponseGate = new Promise<void>((resolve) => {
      releaseDelayedResponse = resolve;
    });
    await page.route(`**/api/workpacks/${WORKPACK_ID}/phase-a-confirmation`, async (route) => {
      if (failureMode === "network-abort") {
        await route.abort("failed");
        return;
      }
      if (failureMode === "http-500") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, message: "서버 내부 오류" }),
        });
        return;
      }
      await delayedResponseGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          confirmationId: CONFIRMATION_ID,
          phaseAReview: serverConfirmed.phaseAReview,
          workpack: serverConfirmed,
          message: "Phase A 확인 완료",
        }),
      });
    });

    await prepareWorkspace(page, pending, { authenticated: true });
    await openEditor(page);
    const confirmation = page.getByLabel("Phase A 근거 확인");
    await confirmation.getByRole("button", { name: "현재 작업팩 저장" }).click();
    const confirmButton = confirmation.getByRole("button", { name: "Phase A 확인 저장" });
    await expect.poll(async () => await confirmButton.isEnabled()).toBe(true);
    await confirmButton.click();

    let loadingDisabled = false;
    let retryEnabled = false;
    if (failureMode === "delayed") {
      const loadingButton = confirmation.getByRole("button", { name: "서버 확인 중" });
      await loadingButton.waitFor({ state: "visible" });
      loadingDisabled = await loadingButton.isDisabled();
      expect(loadingDisabled).toBe(true);
      expect(await confirmation.textContent()).toContain("서버 확인 중");
      expect(await page.evaluate((confirmationId) => (
        window.localStorage.getItem("safeclaw.currentWorkpack.v1")?.includes(confirmationId) ? 1 : 0
      ), CONFIRMATION_ID)).toBe(0);
      releaseDelayedResponse();
      await expect.poll(async () => await confirmation.textContent()).toContain("확인 완료");
    } else {
      await expect.poll(async () => await confirmation.textContent()).toContain("문제 발생");
      const retryButton = confirmation.getByRole("button", { name: "Phase A 확인 다시 시도" });
      retryEnabled = await retryButton.isEnabled();
      expect(retryEnabled).toBe(true);
      expect(await confirmation.textContent()).toContain(
        failureMode === "http-500" ? "잠시 후 다시 시도" : "연결을 확인한 뒤 다시 시도",
      );
      expect(await page.evaluate((confirmationId) => (
        window.localStorage.getItem("safeclaw.currentWorkpack.v1")?.includes(confirmationId) ? 1 : 0
      ), CONFIRMATION_ID)).toBe(0);
    }

    const applicationConsoleErrors = consoleErrors.filter((message) => (
      !/Failed to load resource|net::ERR_FAILED/i.test(message)
    ));
    expect(pageErrors).toEqual([]);
    expect(applicationConsoleErrors).toEqual([]);
    if (EVIDENCE_DIRECTORY) {
      writeEvidenceJson(`phase-a-confirmation-${failureMode}-metrics.json`, {
        harnessMode: harness?.mode ?? "dev",
        failureMode,
        loadingDisabled,
        retryEnabled,
        localConfirmationCount: 0,
        consoleErrors,
        applicationConsoleErrors,
        pageErrors,
      });
    }
    await page.close();
  }, 120_000);

  it.each([
    { theme: "day" as const, width: 1440, height: 900, label: "desktop" as const },
    { theme: "night" as const, width: 1440, height: 900, label: "desktop" as const },
    { theme: "day" as const, width: 390, height: 844, label: "mobile" as const },
    { theme: "night" as const, width: 390, height: 844, label: "mobile" as const },
  ])("keeps the $theme $label confirmation action accessible without overflow or overlap", async ({ theme, width, height, label }) => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width, height } });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
    await installSaveRoutes(page);
    const fixture = buildPendingFixture();
    await prepareWorkspace(page, fixture, { theme, authenticated: true });
    await openEditor(page);
    const confirmation = page.getByLabel("Phase A 근거 확인");
    await confirmation.getByRole("button", { name: "현재 작업팩 저장" }).click();
    const confirmButton = confirmation.getByRole("button", { name: "Phase A 확인 저장" });
    await expect.poll(async () => await confirmButton.isEnabled()).toBe(true);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>("[aria-label='Phase A 근거 확인']");
      const copy = panel?.querySelector<HTMLElement>(".phase-a-confirmation-copy");
      const eyebrow = copy?.querySelector<HTMLElement>(".eyebrow");
      const actions = panel?.querySelector<HTMLElement>(".phase-a-confirmation-actions");
      if (!panel || !copy || !eyebrow || !actions) throw new Error("confirmation geometry targets missing");
      const parseRgb = (value: string): [number, number, number] => {
        const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) throw new Error(`unsupported computed color: ${value}`);
        return [Number(match[1]), Number(match[2]), Number(match[3])];
      };
      const relativeLuminance = ([red, green, blue]: [number, number, number]): number => {
        const channels = [red, green, blue].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const contrastRatio = (foreground: string, background: string): number => {
        const foregroundLuminance = relativeLuminance(parseRgb(foreground));
        const backgroundLuminance = relativeLuminance(parseRgb(background));
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);
        return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
      };
      const collectShadowText = (root: ParentNode): string => {
        let text = root instanceof Node ? root.textContent ?? "" : "";
        for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
          if (element.shadowRoot) text += ` ${collectShadowText(element.shadowRoot)}`;
        }
        return text;
      };
      const copyRect = copy.getBoundingClientRect();
      const actionRect = actions.getBoundingClientRect();
      const overlaps = !(
        copyRect.bottom <= actionRect.top
        || actionRect.bottom <= copyRect.top
        || copyRect.right <= actionRect.left
        || actionRect.right <= copyRect.left
      );
      const controls = Array.from(panel.querySelectorAll<HTMLElement>("button"));
      const clipped = Array.from(panel.querySelectorAll<HTMLElement>("strong, p, button"))
        .filter((element) => element.scrollWidth > element.clientWidth + 1).length;
      const eyebrowColor = getComputedStyle(eyebrow).color;
      const panelBackgroundColor = getComputedStyle(panel).backgroundColor;
      const nextIssueBadgeCount = Array.from(document.querySelectorAll<HTMLElement>("nextjs-portal"))
        .filter((portal) => /\b1\s+Issues?\b/i.test(collectShadowText(portal.shadowRoot ?? portal)))
        .length;
      return {
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        panelWithinViewport: panel.getBoundingClientRect().right <= window.innerWidth + 1,
        copyActionOverlap: overlaps,
        controlHeights: controls.map((control) => Math.round(control.getBoundingClientRect().height)),
        clippedTextCount: clipped,
        primaryActionCount: panel.querySelectorAll("button.button:not(.secondary)").length,
        eyebrowColor,
        panelBackgroundColor,
        eyebrowContrast: contrastRatio(eyebrowColor, panelBackgroundColor),
        nextIssueBadgeCount,
      };
    });

    expect(metrics.horizontalOverflow).toBe(0);
    expect(metrics.panelWithinViewport).toBe(true);
    expect(metrics.copyActionOverlap).toBe(false);
    expect(metrics.controlHeights.every((height) => height >= 44)).toBe(true);
    expect(metrics.clippedTextCount).toBe(0);
    expect(metrics.primaryActionCount).toBe(1);
    expect(metrics.eyebrowColor).toBe(theme === "night" ? "rgb(139, 141, 252)" : "rgb(20, 23, 26)");
    expect(metrics.eyebrowContrast).toBeGreaterThanOrEqual(4.5);
    expect(metrics.nextIssueBadgeCount).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    if (EVIDENCE_DIRECTORY) {
      fs.mkdirSync(EVIDENCE_DIRECTORY, { recursive: true });
      await confirmation.screenshot({
        path: path.join(EVIDENCE_DIRECTORY, `phase-a-confirmation-${theme}-${label}.png`),
      });
      writeEvidenceJson(`phase-a-confirmation-${theme}-${label}-metrics.json`, {
        harnessMode: harness?.mode ?? "dev",
        theme,
        viewport: { width, height },
        generationFingerprint: buildWorkpackGenerationFingerprint(fixture),
        consoleErrors,
        pageErrors,
        ...metrics,
      });
    }
    await page.close();
  }, 120_000);
});
