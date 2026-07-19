import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PORT = Number(process.env.SAFECLAW_RECIPIENT_DEMO_PORT || 32177);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const sessionPayload = {
  ok: true,
  configured: true,
  session: {
    id: SESSION_ID,
    workpackId: WORKPACK_ID,
    shareScope: "invited",
    question: "부산 해운대 천장 누수 보수 · 고소작업 · 베트남 작업자 1명",
    status: "active",
    expiresAt: "2099-01-01T00:00:00.000Z",
    accessPolicy: {
      anonymousAllowed: false,
      manualLanguageSwitchAllowed: true,
      requireKnownWorkerSnapshot: true
    },
    documents: [
      {
        key: "riskAssessmentDraft",
        title: "위험성평가표",
        body: "추락 위험: 이동식 비계 고정과 안전대 착용을 확인합니다."
      },
      {
        key: "tbmBriefing",
        title: "TBM 브리핑",
        body: "강풍 시 작업을 중지하고 관리감독자에게 보고합니다."
      },
      {
        key: "tbmLogDraft",
        title: "TBM 기록",
        body: "작업자 전원이 위험요인과 작업중지 기준을 확인했습니다."
      }
    ],
    recipientMessage: {
      languageCode: "vi",
      title: "Tiếng Việt",
      body: [
        "Dừng công việc khi gió mạnh.",
        "Kiểm tra dây an toàn trước khi làm việc.",
        "Nếu không hiểu hướng dẫn, hãy hỏi lại quản lý hoặc phiên dịch."
      ].join("\n")
    },
    recipients: [{
      workerId: WORKER_ID,
      displayName: "Nguyen Van An",
      languageCode: "vi"
    }]
  },
  message: "공유 세션을 조회했습니다."
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      });
      request.on("error", () => resolve(false));
      request.setTimeout(2_000, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startServer() {
  const nextBin = [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next", "dist", "bin", "next")
  ].find((candidate) => fs.existsSync(candidate));
  if (!nextBin) {
    throw new Error("Unable to locate Next.js binary for recipient demo capture");
  }
  const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    windowsHide: true
  });
  let output = "";
  const append = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-20_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  return {
    output: () => output,
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (process.platform === "win32") {
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else {
        child.kill("SIGTERM");
      }
      await delay(1_500);
    }
  };
}

function routeMetrics() {
  const elements = [...document.querySelectorAll("body *")];
  const outside = elements.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > innerWidth + 1);
  }).length;
  const buttons = [...document.querySelectorAll("button, a, input, select, summary")].filter((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });
  return {
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    outside,
    minControlHeight: Math.min(...buttons.map((element) => Math.round(element.getBoundingClientRect().height))),
    hasVietnameseChrome: document.body.innerText.includes("Kiểm tra gói tài liệu"),
    hasVietnameseNotice: document.body.innerText.includes("Dừng công việc khi gió mạnh."),
    hasKoreanReviewTitle: document.body.innerText.includes("문서팩 검토"),
    hasConfirmButton: document.body.innerText.includes("Tôi đã xem"),
    hasSavedConfirmation: document.body.innerText.includes("Đã lưu xác nhận xem tài liệu.")
  };
}

const server = startServer();
const metrics = {
  checkedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  sessionId: SESSION_ID,
  workerId: WORKER_ID,
  apiCalls: [],
  screenshots: {},
  video: null,
  beforeConfirm: null,
  afterConfirm: null
};

try {
  await waitForHttp(`${BASE_URL}/share/not-a-session?lang=vi`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: 390, height: 844 } }
  });
  const page = await context.newPage();
  await page.route("**/api/share-sessions/**", async (route) => {
    const request = route.request();
    metrics.apiCalls.push({ method: request.method(), url: request.url() });
    if (request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          configured: true,
          confirmationId: "confirmation-demo-1",
          message: "작업자 열람 확인을 저장했습니다."
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionPayload)
    });
  });

  await page.goto(`${BASE_URL}/share/${SESSION_ID}?workerId=${WORKER_ID}&lang=vi`, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Kiểm tra gói tài liệu", { exact: true }).waitFor({ timeout: 30_000 });
  const beforePath = path.join(outDir, "01-recipient-portal-vietnamese-before-confirm.png");
  await page.screenshot({ path: beforePath, fullPage: true });
  metrics.screenshots.beforeConfirm = beforePath;
  metrics.beforeConfirm = await page.evaluate(routeMetrics);

  await page.getByRole("button", { name: "Tôi đã xem" }).click();
  await page.getByText("Đã lưu xác nhận xem tài liệu.", { exact: false }).waitFor({ timeout: 30_000 });
  const afterPath = path.join(outDir, "02-recipient-portal-vietnamese-after-confirm.png");
  await page.screenshot({ path: afterPath, fullPage: true });
  metrics.screenshots.afterConfirm = afterPath;
  metrics.afterConfirm = await page.evaluate(routeMetrics);

  const video = page.video();
  await context.close();
  if (video) {
    const videoPath = await video.path();
    const targetVideoPath = path.join(outDir, "recipient-portal-vietnamese-confirmation.webm");
    fs.copyFileSync(videoPath, targetVideoPath);
    if (videoPath !== targetVideoPath) {
      fs.rmSync(videoPath, { force: true });
    }
    metrics.video = targetVideoPath;
  }
  await browser.close();
} finally {
  await server.stop();
  metrics.serverOutputTail = server.output();
  fs.writeFileSync(path.join(outDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
}
