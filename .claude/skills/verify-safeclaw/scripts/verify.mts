// verify-safeclaw 도우미 — SafeClaw 를 사용자처럼 돌려 증거를 남긴다.
// 실행(저장소 루트에서):
//   node .claude/skills/verify-safeclaw/scripts/verify.mts list
//   node .claude/skills/verify-safeclaw/scripts/verify.mts doctor --base https://www.safeclaw.kr
//   node .claude/skills/verify-safeclaw/scripts/verify.mts drive --feature home-composer            # 격리 dev 인스턴스를 띄우고 끝나면 내린다
//   node .claude/skills/verify-safeclaw/scripts/verify.mts drive --feature home-composer --base https://www.safeclaw.kr   # 이미 떠 있는 주소(운영 포함)
// 합성 입력만 쓴다. 실명·주민번호·급여·사건 자료를 넣지 않는다. 운영(--base)에서는 익명 template 경로만 돈다.
// Node 24 (타입 제거 기본) 전제. 증거 = evaluation/verify-safeclaw/<타임스탬프>-<feature>/ (cleanup 이 지우지 않는다).

import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "../../../../tests/helpers/isolated-next-browser-harness.ts";

const SYNTHETIC_QUESTION = "경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";
const SYNTHETIC_KEYWORD = "지게차";
const ANONYMOUS_NOTICE = "로그인하지 않은 체험에서는 기본 문서(템플릿)만 만듭니다";
const GENERATION_TIMEOUT_MS = 240_000;
// 하드 실패 금지어 — 서비스 이름·직무 표방(공인노무사법)·확률 표현·제품 자기 호칭.
const FORBIDDEN_STRICT = /노무사|적중률|확률\s*\d|AI 안전관리자|상주 안전관리자|전문가 자문/gu;
// 보고만 하는 검토어 — 법정 복합어(고객상담센터·노동위원회 판정)로 정당하게 나올 수 있어 문맥을 적는다.
const REVIEW_WORDS = /진단|판정|상담|자문|대리/gu;
const PHASE_A_CODE = /\bRA-[a-z-]+-\d+\b/gu;
const INTERNAL_ENUM = /(?<![A-Za-z_./"'-])[A-Z]{3,}_[A-Z_]{3,}(?![A-Za-z_"'-])/gu;

type Check = { name: string; ok: boolean; got: unknown; want?: unknown; note?: string };
type Report = {
  feature: string;
  base: string;
  startedAt: string;
  finishedAt?: string;
  mode: "local-isolated" | "external";
  buildInfo?: unknown;
  checks: Check[];
  consoleErrors: string[];
  pageErrors: string[];
  artifacts: string[];
  reviewWordContexts: string[];
  ok?: boolean;
};

const FEATURES: Record<string, { title: string; run: (ctx: DriveContext) => Promise<void> }> = {
  "home-composer": { title: "첫 화면 입력 폼 → /workspace?q= 생성", run: driveHomeComposer },
  "example-chips": { title: "첫 화면 예시 칩 → /workspace?scenario=&autogen=1", run: driveExampleChips },
  "workspace-result": { title: "작업공간 결과 머리·브리프·문서 깊게 보기", run: driveWorkspaceResult },
  "export-formats": { title: "편집기 내보내기 4형식(xlsx·hwp·PDF 인쇄·HWPX 베타)", run: driveExportFormats },
  "leave-tool": { title: "연차 일수 계산 /tools/leave", run: driveLeaveTool }
};

type DriveContext = {
  base: string;
  page: Page;
  context: BrowserContext;
  report: Report;
  outDir: string;
  check: (name: string, got: unknown, want?: unknown, note?: string) => boolean;
  info: (name: string, got: unknown, note?: string) => void;
  shot: (label: string) => Promise<void>;
  bodyText: () => Promise<string>;
  scanText: (label: string, text: string, options?: { strictOnly?: boolean }) => void;
};

function parseArgs(argv: string[]) {
  const [command = "help", ...rest] = argv;
  const options: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = rest[index + 1] && !rest[index + 1].startsWith("--") ? rest[index + 1] : "1";
      if (value !== "1" || !rest[index + 1]) index += 1;
      options[key] = value;
    }
  }
  return { command, options };
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function repoRoot(): string {
  // 하네스가 process.cwd() 를 저장소 루트로 쓴다. 루트가 아니면 바로 멈춘다.
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root, "app", "workspace", "page.tsx"))) {
    throw new Error(`저장소 루트에서 실행해야 한다(현재 ${root}). 예: cd <safeguard-contest-mvp> && node .claude/skills/verify-safeclaw/scripts/verify.mts ...`);
  }
  return root;
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown; text: string }> {
  const response = await fetch(url, { cache: "no-store", headers: { "user-agent": "Mozilla/5.0 verify-safeclaw" } });
  const text = await response.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* 본문이 JSON 이 아니면 문자열로 둔다 */ }
  return { status: response.status, body, text };
}

async function doctor(base: string): Promise<{ ok: boolean; result: Record<string, unknown> }> {
  const buildInfo = await fetchJson(`${base}/api/build-info`);
  const home = await fetchJson(`${base}/`);
  const html = home.text;
  const result = {
    base,
    buildInfo: { status: buildInfo.status, body: buildInfo.body },
    home: {
      status: home.status,
      bytes: html.length,
      composerForm: /action="\/workspace"/u.test(html) && /<textarea[^>]*name="q"/u.test(html),
      exampleChips: (html.match(/href="[^"]*autogen=1"/gu) || []).length,
      anonymousNotice: html.includes(ANONYMOUS_NOTICE)
    }
  };
  const ok = buildInfo.status === 200 && home.status === 200 && result.home.composerForm && result.home.exampleChips === 3;
  return { ok, result };
}

function collectErrors(page: Page, report: Report): void {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
}

async function waitForGenerated(page: Page): Promise<void> {
  await page.locator('[aria-label="Safety Brief Dashboard"]').first().waitFor({ state: "visible", timeout: GENERATION_TIMEOUT_MS });
}

function makeContext(base: string, page: Page, context: BrowserContext, report: Report, outDir: string): DriveContext {
  let shotIndex = 0;
  const check: DriveContext["check"] = (name, got, want, note) => {
    const ok = want === undefined ? Boolean(got) : JSON.stringify(got) === JSON.stringify(want);
    report.checks.push({ name, ok, got, want, note });
    console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${JSON.stringify(got)}${want === undefined ? "" : ` (기대 ${JSON.stringify(want)})`}${note ? ` — ${note}` : ""}`);
    return ok;
  };
  // 보고만 하는 값 — 판정 없이 report 에 남긴다(0 도 정상인 상태 수 등).
  const info: DriveContext["info"] = (name, got, note) => {
    report.checks.push({ name: `(보고) ${name}`, ok: true, got, note });
    console.log(`INFO ${name}: ${JSON.stringify(got)}${note ? ` — ${note}` : ""}`);
  };
  const shot: DriveContext["shot"] = async (label) => {
    shotIndex += 1;
    const file = path.join(outDir, `${String(shotIndex).padStart(2, "0")}-${label}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 55, fullPage: false });
    report.artifacts.push(path.relative(process.cwd(), file));
  };
  const bodyText: DriveContext["bodyText"] = () => page.evaluate(() => document.body.innerText);
  const scanText: DriveContext["scanText"] = (label, text, options) => {
    const strict = text.match(FORBIDDEN_STRICT) || [];
    check(`${label} 금지어(노무사·적중률·확률·자기 호칭)`, strict.length, 0, strict.slice(0, 5).join(","));
    check(`${label} Phase A 영문 관리번호(RA-)`, (text.match(PHASE_A_CODE) || []).length, 0);
    const enums = (text.match(INTERNAL_ENUM) || []).filter((value) => !/^(NEXT_PUBLIC|HTTP_|UTF_)/u.test(value));
    check(`${label} 내부 enum 노출`, enums.length, 0, enums.slice(0, 5).join(","));
    if (!options?.strictOnly) {
      const contexts: string[] = [];
      for (const match of text.matchAll(REVIEW_WORDS)) {
        const start = Math.max(0, (match.index ?? 0) - 18);
        contexts.push(text.slice(start, (match.index ?? 0) + 20).replace(/\s+/gu, " "));
      }
      report.reviewWordContexts.push(...contexts.map((value) => `${label}: ${value}`));
      console.log(`INFO ${label} 검토어(진단·판정·상담·자문·대리) ${contexts.length}건 — 보고만, report.md 에 문맥`);
    }
  };
  return { base, page, context, report, outDir, check, info, shot, bodyText, scanText };
}

async function driveHomeComposer(ctx: DriveContext): Promise<void> {
  const { page, base, check, shot, bodyText, scanText } = ctx;
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: GENERATION_TIMEOUT_MS });
  await shot("home");
  const textarea = page.locator("textarea[name=q]");
  check("첫 화면 textarea[name=q] 보임", await textarea.isVisible());
  check("h1 문구", (await page.locator("h1").first().innerText()).includes("오늘 작업을 한 줄로 적으면"));
  check("예시 칩 수", await page.locator('a[href*="autogen=1"]').count(), 3);
  check("익명 안내(ANONYMOUS_MESSAGE) 표시", (await page.getByTestId("anonymous-mode-notice").first().innerText()).includes(ANONYMOUS_NOTICE));
  const html = await page.content();
  check("지워진 §01~§06 격자 없음", (html.match(/safeclaw-(pipeline-grid|proof-matrix|language-matrix|module-map|os-status)/gu) || []).length, 0);
  check("「문서팩 보기」 문구 없음", html.includes("문서팩 보기"), false);
  scanText("첫 화면", await bodyText(), { strictOnly: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("가로 넘침 없음", overflow, false);

  await textarea.fill(SYNTHETIC_QUESTION);
  const started = Date.now();
  await page.getByRole("button", { name: "보내기" }).click();
  await page.waitForURL(/\/workspace\?q=/u, { timeout: 60_000 });
  check("보내기 → /workspace?q= 이동", /\/workspace\?q=/u.test(page.url()));
  await waitForGenerated(page);
  const seconds = Math.round((Date.now() - started) / 1000);
  await shot("workspace-generated");
  const text = await bodyText();
  check(`생성 완료(Safety Brief, ${seconds}s)`, true);
  check("입력 내용 반영", text.includes(SYNTHETIC_KEYWORD));
  check("머리 「확인할 항목을 먼저 보세요」", text.includes("확인할 항목을 먼저 보세요"));
  check("익명 template 안내 유지", text.includes(ANONYMOUS_NOTICE));
  scanText("작업공간", text);
}

async function driveExampleChips(ctx: DriveContext): Promise<void> {
  const { page, base, check, shot, bodyText, scanText } = ctx;
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: GENERATION_TIMEOUT_MS });
  const chips = page.locator('a[href*="autogen=1"]');
  const hrefs = await chips.evaluateAll((elements) => elements.map((element) => element.getAttribute("href") || ""));
  check("칩 3개", hrefs.length, 3, hrefs.join(" | "));
  check("칩 href 전부 /workspace?scenario=…&autogen=1", hrefs.every((href) => /^\/workspace\?scenario=[a-z0-9-]+&autogen=1$/u.test(href)));
  const label = (await chips.first().innerText()).trim();
  await shot("home-chips");
  const started = Date.now();
  await chips.first().click();
  await page.waitForURL(/scenario=.*autogen=1|autogen=1.*scenario=/u, { timeout: 60_000 });
  await waitForGenerated(page);
  await shot("chip-generated");
  check(`칩 「${label}」 클릭 → 무클릭 생성 완료(${Math.round((Date.now() - started) / 1000)}s)`, true);
  const text = await bodyText();
  check("머리 「확인할 항목을 먼저 보세요」", text.includes("확인할 항목을 먼저 보세요"));
  scanText("칩 생성 결과", text);
}

async function driveWorkspaceResult(ctx: DriveContext): Promise<void> {
  const { page, base, check, info, shot, bodyText, scanText } = ctx;
  await page.goto(`${base}/workspace?q=${encodeURIComponent(SYNTHETIC_QUESTION)}`, { waitUntil: "domcontentloaded", timeout: GENERATION_TIMEOUT_MS });
  await waitForGenerated(page);
  await shot("result-head");
  const text = await bodyText();
  check("머리 「확인할 항목을 먼저 보세요」", text.includes("확인할 항목을 먼저 보세요"));
  check("브리프 「핵심 위험 3개」", text.includes("핵심 위험 3개"));
  check("브리프 「위험성평가 상위」", text.includes("위험성평가 상위"));
  info("확인할 항목 블록(review_required·재검증) 수", await page.getByTestId("document-check-first").count(), "0 = 분류 확정·재검증 불요, 1 = 알림 또는 재검증 단추. 어느 쪽도 결함 아님");
  check("「위험성평가표 편집」 단추", await page.getByRole("button", { name: "위험성평가표 편집" }).count(), 1);
  check("「다음: 공유」 단추", await page.getByRole("button", { name: "다음: 공유" }).count() + await page.getByRole("link", { name: "다음: 공유" }).count(), 1);
  const deep = page.getByTestId("document-deep-review");
  check("「문서 깊게 보기」 접힘 상자", await deep.count(), 1);
  await deep.locator("summary").first().click();
  const rail = page.locator('[aria-label="문서 목록"]').first();
  await rail.waitFor({ state: "visible", timeout: 30_000 });
  const railItems = await rail.locator("button, a").count();
  check("문서 목록 항목 3개 이상", railItems >= 3, true, `실측 ${railItems}`);
  await shot("deep-review-open");
  // 깊게 보기 안은 문서 목록 + 미리보기 창(제목·「편집」 단추)이다. 문서별 조종석(*-document-cockpit)은 편집기(WorkpackEditor) 안에 있어 export-formats 에서 본다.
  const previewHead = page.locator(".document-preview-pane .document-preview-head").first();
  await previewHead.waitFor({ state: "visible", timeout: 30_000 });
  const previewTitle = (await previewHead.locator("strong").first().innerText()).trim();
  check("미리보기 창 제목 표시", previewTitle.length > 0, true, previewTitle);
  check("미리보기 「편집」 단추", await previewHead.getByRole("button", { name: "편집" }).count(), 1);
  scanText("작업공간 전체", await bodyText());
}

async function driveExportFormats(ctx: DriveContext): Promise<void> {
  const { page, base, context, check, shot, outDir } = ctx;
  // PDF 는 파일이 아니라 팝업 창(window.open) + popup.print() 다. 컨텍스트 전체에 print 스텁을 깔아 팝업에서도 호출 수를 센다.
  await context.addInitScript(() => {
    (window as unknown as { __verifyPrintCalls: number }).__verifyPrintCalls = 0;
    window.print = () => { (window as unknown as { __verifyPrintCalls: number }).__verifyPrintCalls += 1; };
  });
  await page.goto(`${base}/workspace?q=${encodeURIComponent(SYNTHETIC_QUESTION)}`, { waitUntil: "domcontentloaded", timeout: GENERATION_TIMEOUT_MS });
  await waitForGenerated(page);
  await page.getByRole("button", { name: "위험성평가표 편집" }).click();
  const panel = page.getByTestId("editor-export-panel");
  await panel.waitFor({ state: "visible", timeout: 60_000 });
  await panel.locator("summary").first().click();
  // 준비 상태는 「checking」으로 시작해 서버 확인 뒤 「ready」가 된다 — 최대 30초 기다린 값을 판정한다.
  const readinessNode = panel.locator("[data-server-export-readiness]").first();
  let readiness = await readinessNode.getAttribute("data-server-export-readiness");
  for (let attempt = 0; attempt < 30 && readiness === "checking"; attempt += 1) {
    await page.waitForTimeout(1_000);
    readiness = await readinessNode.getAttribute("data-server-export-readiness");
  }
  check("서버 내보내기 준비 상태 data-server-export-readiness(30초 내)", readiness, "ready");
  await shot("export-panel");
  const downloadsDir = path.join(outDir, "downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });

  const download = async (label: string, buttonName: RegExp, magic: (bytes: Buffer) => boolean, magicName: string, timeoutMs = 90_000) => {
    const button = panel.getByRole("button", { name: buttonName }).first();
    if (!(await button.count())) { check(`${label} 단추 존재`, false, true); return; }
    // 「Excel 생성 중」·「한글 표 생성 중」 동안은 비활성이다 — 준비 상태 이름으로 잡았으니 최대 30초 활성화를 기다린다.
    for (let attempt = 0; attempt < 30 && (await button.isDisabled()); attempt += 1) await page.waitForTimeout(1_000);
    if (await button.isDisabled()) { check(`${label} 단추 활성(30초 대기 뒤)`, false, true, `readiness=${readiness}`); return; }
    const waiting = page.waitForEvent("download", { timeout: timeoutMs }).catch(() => null);
    await button.click();
    const file = await waiting;
    if (!file) {
      const panelText = (await panel.innerText()).replace(/\s+/gu, " ").slice(0, 300);
      check(`${label} 내려받기 이벤트(${Math.round(timeoutMs / 1000)}초 내)`, false, true, `패널 상태: ${panelText}`);
      return;
    }
    const target = path.join(downloadsDir, file.suggestedFilename());
    await file.saveAs(target);
    const bytes = fs.readFileSync(target);
    ctx.report.artifacts.push(path.relative(process.cwd(), target));
    check(`${label} 내려받기 (${file.suggestedFilename()}, ${bytes.length} bytes)`, bytes.length > 0);
    check(`${label} 파일 머리 = ${magicName}`, magic(bytes));
  };
  const isZip = (bytes: Buffer) => bytes.subarray(0, 2).toString("latin1") === "PK";
  const isOle = (bytes: Buffer) => bytes.subarray(0, 4).toString("hex") === "d0cf11e0";
  await download("Excel 표 양식(.xlsx)", /Excel 표 양식/u, isZip, "PK(OOXML zip)");
  await download("한글 표 양식(.hwp)", /한글 표 양식/u, isOle, "D0CF11E0(OLE/HWP5)");
  // PDF: 팝업이 열리고(「SafeClaw PDF 준비 중」) 서버 인쇄본 HTML 로 바뀐 뒤 popup.print() 가 불린다.
  const popupPromise = context.waitForEvent("page", { timeout: 30_000 }).catch(() => null);
  await panel.getByRole("button", { name: "PDF(브라우저 인쇄)" }).click();
  const popup = await popupPromise;
  check("PDF(브라우저 인쇄) → 인쇄용 팝업 창 열림", Boolean(popup));
  if (popup) {
    let printCalls = 0;
    let popupTitle = "";
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await page.waitForTimeout(1_000);
      printCalls = await popup.evaluate(() => (window as unknown as { __verifyPrintCalls?: number }).__verifyPrintCalls ?? 0).catch(() => 0);
      popupTitle = await popup.title().catch(() => "");
      if (printCalls > 0) break;
    }
    check("팝업에서 window.print 호출(60초 내)", printCalls >= 1, true, `호출 ${printCalls}회 · 팝업 제목 「${popupTitle}」`);
    check("팝업이 「준비 중」 자리표시자를 벗어남", popupTitle !== "SafeClaw PDF 준비 중", true, popupTitle);
    const popupShot = path.join(outDir, "pdf-popup.jpg");
    await popup.screenshot({ path: popupShot, type: "jpeg", quality: 55, fullPage: false }).catch(() => undefined);
    ctx.report.artifacts.push(path.relative(process.cwd(), popupShot));
    await popup.close().catch(() => undefined);
  }
  const beta = panel.locator("details", { hasText: "베타 형식" }).first();
  if (await beta.count()) {
    await beta.locator("summary").first().click();
    // 단추 이름은 「.hwpx 텍스트 초안」(생성 중 「HWPX 생성 중」). rhwp wasm 을 브라우저에서 처음 받으므로 150초.
    await download("HWPX 텍스트 초안(베타, rhwp)", /hwpx/iu, isZip, "PK(HWPX zip)", 150_000);
  } else {
    check("베타 형식 접힘 상자 존재", false, true);
  }
  await shot("export-done");
}

async function driveLeaveTool(ctx: DriveContext): Promise<void> {
  const { page, base, check, shot, bodyText } = ctx;
  await page.goto(`${base}/tools/leave`, { waitUntil: "networkidle", timeout: GENERATION_TIMEOUT_MS });
  await shot("leave-empty");
  const input = page.getByLabel("이름과 입사일 붙여넣기");
  check("입력 textarea(aria-label 이름과 입사일 붙여넣기)", await input.count(), 1);
  await input.fill("작업자A\t2024-03-01\n작업자B\t2026-01-15");
  await page.getByText(/2명 계산/u).first().waitFor({ state: "visible", timeout: 30_000 });
  check("「2명 계산」 표시", true);
  const table = page.locator("table").first();
  const headers = await table.locator("th").allInnerTexts();
  check("결과 표 머리(이름·입사일·부여일수·대장·판정·적용 근거)", ["이름", "입사일", "부여일수", "대장", "판정", "적용 근거"].every((head) => headers.includes(head)), true, headers.join("/"));
  const firstRow = await table.locator("tbody tr").first().locator("td").allInnerTexts();
  check("첫 행 부여일수 숫자", /^\d+(\.\d+)?$/u.test((firstRow[2] || "").trim()), true, firstRow.join(" | "));
  await shot("leave-result");
  const text = await bodyText();
  check("「노무사」·「자문」 직무 표방 없음(「법률 자문이 아니라」 문장은 허용)", (text.match(/노무사/gu) || []).length, 0);
}

function writeReport(report: Report, outDir: string): void {
  report.finishedAt = new Date().toISOString();
  report.ok = report.checks.every((check) => check.ok) && report.consoleErrors.length === 0 && report.pageErrors.length === 0;
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  const lines = [
    `# verify-safeclaw — ${report.feature} (${report.ok ? "PASS" : "FAIL"})`,
    "",
    `- base: ${report.base} (${report.mode})`,
    `- 시작 ${report.startedAt} · 끝 ${report.finishedAt}`,
    `- build-info: ${JSON.stringify(report.buildInfo ?? null)}`,
    `- 콘솔 오류 ${report.consoleErrors.length} · 페이지 오류 ${report.pageErrors.length}`,
    "",
    "## 검사",
    ...report.checks.map((check) => `- ${check.ok ? "OK" : "FAIL"} ${check.name}: ${JSON.stringify(check.got)}${check.want === undefined ? "" : ` (기대 ${JSON.stringify(check.want)})`}${check.note ? ` — ${check.note}` : ""}`),
    "",
    "## 증거",
    ...report.artifacts.map((artifact) => `- ${artifact}`),
    "",
    "## 검토어 문맥(보고만)",
    ...(report.reviewWordContexts.length ? report.reviewWordContexts.map((value) => `- ${value}`) : ["- 없음"]),
    "",
    ...(report.consoleErrors.length ? ["## 콘솔 오류", ...report.consoleErrors.map((value) => `- ${value}`)] : []),
    ...(report.pageErrors.length ? ["## 페이지 오류", ...report.pageErrors.map((value) => `- ${value}`)] : [])
  ];
  fs.writeFileSync(path.join(outDir, "report.md"), `${lines.join("\n")}\n`, "utf8");
}

async function drive(feature: string, baseOption: string | undefined): Promise<number> {
  const root = repoRoot();
  const spec = FEATURES[feature];
  if (!spec) {
    console.error(`모르는 feature: ${feature}. 목록: ${Object.keys(FEATURES).join(", ")}`);
    return 2;
  }
  const outDir = path.join(root, "evaluation", "verify-safeclaw", `${stamp()}-${feature}`);
  fs.mkdirSync(outDir, { recursive: true });
  const report: Report = {
    feature, base: baseOption || "", startedAt: new Date().toISOString(),
    mode: baseOption ? "external" : "local-isolated",
    checks: [], consoleErrors: [], pageErrors: [], artifacts: [], reviewWordContexts: []
  };
  let harness: IsolatedNextBrowserHarness | null = null;
  let browser: Browser | null = null;
  let exitCode = 1;
  try {
    let base = baseOption?.replace(/\/$/u, "") || "";
    if (!base) {
      console.log("LAUNCH 격리 dev 인스턴스(tests/helpers/isolated-next-browser-harness.ts, slug verify-safeclaw) 시작…");
      harness = await startIsolatedNextBrowserHarness({ slug: "verify-safeclaw", initialPath: "/", portSalt: 7311, timeoutMs: 180_000 });
      base = harness.baseUrl;
      browser = harness.browser;
      console.log(`LAUNCH 준비됨 ${base} (temp ${harness.temporaryDirectory ?? "-"})`);
    } else {
      browser = await chromium.launch();
    }
    report.base = base;
    const health = await doctor(base);
    report.buildInfo = (health.result.buildInfo as { body: unknown }).body;
    console.log(`DOCTOR ${health.ok ? "OK" : "FAIL"} ${JSON.stringify(health.result.home)}`);
    if (!health.ok) {
      report.checks.push({ name: "doctor", ok: false, got: health.result });
      return 1;
    }
    report.checks.push({ name: "doctor", ok: true, got: health.result.home });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    collectErrors(page, report);
    const ctx = makeContext(base, page, context, report, outDir);
    console.log(`DRIVE ${feature} — ${spec.title}`);
    await spec.run(ctx);
    await context.close();
    exitCode = 0;
  } catch (error) {
    report.checks.push({ name: "예외", ok: false, got: String(error).slice(0, 500) });
    console.error("DRIVE 예외:", error);
  } finally {
    writeReport(report, outDir);
    const ok = report.ok;
    if (ok === false) exitCode = 1;
    console.log(`EVIDENCE ${path.relative(root, outDir)} (report.md · report.json · 스크린샷${report.artifacts.length ? ` ${report.artifacts.length}개` : ""})`);
    if (harness) {
      await harness.stop();
      console.log("CLEANUP 격리 인스턴스 종료·임시 디렉터리 삭제(증거는 남김)");
    } else if (browser) {
      await browser.close();
    }
    console.log(`RESULT ${ok === false ? "FAIL" : "PASS"} — 검사 ${report.checks.filter((check) => check.ok).length}/${report.checks.length} 통과, 콘솔 오류 ${report.consoleErrors.length}`);
  }
  return exitCode;
}

async function main(): Promise<number> {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "list") {
    for (const [id, spec] of Object.entries(FEATURES)) console.log(`${id}\t${spec.title}`);
    return 0;
  }
  if (command === "doctor") {
    if (!options.base) { console.error("doctor 는 --base <URL> 이 필요하다(떠 있는 인스턴스만 진단한다)."); return 2; }
    const health = await doctor(options.base.replace(/\/$/u, ""));
    console.log(JSON.stringify(health.result, null, 2));
    console.log(`DOCTOR ${health.ok ? "OK" : "FAIL"}`);
    return health.ok ? 0 : 1;
  }
  if (command === "drive") {
    if (!options.feature) { console.error("drive 는 --feature <id> 가 필요하다. list 로 목록을 본다."); return 2; }
    return drive(options.feature, options.base);
  }
  console.log("사용법: verify.mts list | doctor --base URL | drive --feature <id> [--base URL]");
  return 2;
}

process.exitCode = await main();
