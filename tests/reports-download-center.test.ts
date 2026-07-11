import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY
} from "@/lib/current-workpack";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import { toggleReportPhotoApproval } from "@/lib/reporting-downloads";

const improvement: OperationImprovement = {
  id: "improvement-1",
  createdAt: "2026-07-08T08:30:00.000Z",
  siteName: "서울 성수동",
  workSummary: "외벽 도장",
  hazardLabel: "추락 위험",
  improvementText: "난간을 보강",
  reflectedDocuments: ["위험성평가표"],
  beforePhotoName: "before.jpg",
  afterPhotoName: "after.jpg"
};

describe("reports download center behavior", () => {
  it("toggles approval for one exact improvement and photo pair", () => {
    const approved = toggleReportPhotoApproval([], [improvement], improvement.id);

    expect(approved).toEqual([{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }]);
    expect(toggleReportPhotoApproval(approved, [improvement], improvement.id)).toEqual([]);
  });

  it("fails closed when an improvement id is duplicated or loses its photo pair", () => {
    const approval = [{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }];
    const duplicate = { ...improvement, afterPhotoName: "other-after.jpg" };
    const missingAfter = { ...improvement, afterPhotoName: undefined };

    expect(toggleReportPhotoApproval(approval, [improvement, duplicate], improvement.id)).toEqual([]);
    expect(toggleReportPhotoApproval(approval, [missingAfter], improvement.id)).toEqual([]);
  });
});

const port = 35_000 + (process.pid % 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
const serverOutput: string[] = [];

function resolveNextBin(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    path.resolve(process.cwd(), "..", "..", "node_modules", "next", "dist", "bin", "next")
  ];
  const nextBin = candidates.find((candidate) => fs.existsSync(candidate));
  if (!nextBin) {
    throw new Error(`Unable to locate next dev binary. Checked: ${candidates.join(", ")}`);
  }
  return nextBin;
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput.slice(-20).join("")}`);
}

async function stopServer(): Promise<void> {
  if (!server || server.killed) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    server?.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    server?.kill();
  });
}

describe("reports download center remount behavior", () => {
  beforeAll(async () => {
    server = spawn(process.execPath, [resolveNextBin(), "dev", "--port", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
    });
    server.stdout.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    server.stderr.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString()));
    await waitForHttp(`${baseUrl}/reports`);
    browser = await chromium.launch({ headless: true });
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await stopServer();
  });

  it("resets exact-pair photo approval after a real page reload", async () => {
    if (!browser) throw new Error("Browser was not started");
    const now = new Date().toISOString();
    const workpack = buildStoredCurrentWorkpack(buildMockAskResponse(
      "성수동 외벽 도장 작업",
      mockSearchResults.slice(0, 2),
      "live",
      "report remount test"
    ));
    const storedImprovement: OperationImprovement = {
      ...improvement,
      createdAt: now,
      status: "candidate"
    };
    const context = await browser.newContext();
    await context.addInitScript(({ expectedOrigin, workpackJson, improvementsJson, workpackKey, improvementsKey }) => {
      if (window.location.origin !== expectedOrigin) return;
      window.localStorage.setItem(workpackKey, workpackJson);
      window.localStorage.setItem(improvementsKey, improvementsJson);
    }, {
      expectedOrigin: baseUrl,
      workpackJson: JSON.stringify(workpack),
      improvementsJson: JSON.stringify([storedImprovement]),
      workpackKey: CURRENT_WORKPACK_STORAGE_KEY,
      improvementsKey: OPERATION_IMPROVEMENTS_STORAGE_KEY
    });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
      const approval = page.getByLabel("Before/After 사진 포함 승인");
      await approval.waitFor({ state: "visible" });
      expect(await approval.isChecked()).toBe(false);

      await approval.check();
      expect(await approval.isChecked()).toBe(true);

      await page.reload({ waitUntil: "networkidle" });
      const remountedApproval = page.getByLabel("Before/After 사진 포함 승인");
      await remountedApproval.waitFor({ state: "visible" });
      expect(await remountedApproval.isChecked()).toBe(false);
    } finally {
      await context.close();
    }
  }, 90_000);
});
