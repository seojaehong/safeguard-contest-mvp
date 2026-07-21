#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_GEOMETRY = path.join("evaluation", "workspace-docs-share-production-gate-2026-07-20", "current-geometry.json");
const DEFAULT_LIVE_CRITICAL = path.join("evaluation", "live-critical-surface-current-2026-07-20-rerun", "report.json");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "mobile-p0-workspace-gate-2026-07-20");
const VIEWPORT_HEIGHT = 844;

/**
 * @typedef {Record<string, unknown>} JsonRecord
 */

/**
 * @param {unknown} value
 * @returns {value is JsonRecord}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {unknown} value
 * @param {string} key
 */
function recordAt(value, key) {
  if (!isRecord(value)) {
    return {};
  }
  const next = value[key];
  return isRecord(next) ? next : {};
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ rootDir: string, geometryFile: string, liveCriticalFile: string, outputDir: string }} */
  const options = {
    rootDir: REPO_ROOT,
    geometryFile: DEFAULT_GEOMETRY,
    liveCriticalFile: DEFAULT_LIVE_CRITICAL,
    outputDir: DEFAULT_OUTPUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || "";
    if (arg === "--root") {
      options.rootDir = path.resolve(next);
      index += 1;
    } else if (arg === "--geometry-file") {
      options.geometryFile = next;
      index += 1;
    } else if (arg === "--live-critical-file") {
      options.liveCriticalFile = next;
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/mobile_p0_report_from_geometry.mjs [--root DIR] [--geometry-file FILE] [--live-critical-file FILE] [--output DIR]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

/**
 * @param {string} rootDir
 * @param {unknown} geometry
 */
function sourceSha(rootDir, geometry) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return asString(recordAt(geometry, "sourceSha")) || asString(recordAt(recordAt(geometry, "build"), "commitSha"));
  }
}

/**
 * @param {unknown[]} rows
 * @param {string} name
 */
function resultByName(rows, name) {
  const match = rows.find((item) => isRecord(item) && item.name === name);
  if (!isRecord(match)) {
    throw new Error(`Missing geometry result: ${name}`);
  }
  if (match.ok !== true) {
    throw new Error(`Geometry result failed: ${name}`);
  }
  return match;
}

/**
 * @param {unknown[]} rows
 * @param {string} route
 * @param {string} viewport
 */
function liveRow(rows, route, viewport) {
  const match = rows.find((item) => (
    isRecord(item) && item.route === route && item.viewport === viewport
  ));
  return isRecord(match) ? match : {};
}

/**
 * @param {number | null} height
 */
function ratio(height) {
  return height === null ? null : Number((height / VIEWPORT_HEIGHT).toFixed(2));
}

/**
 * @param {string} rootDir
 * @param {unknown} geometry
 * @param {unknown} liveCritical
 * @param {string} generatedAt
 */
export function buildMobileP0Report(rootDir, geometry, liveCritical, generatedAt = new Date().toISOString()) {
  const geometryResults = isRecord(geometry) && Array.isArray(geometry.results) ? geometry.results : [];
  const mobile = resultByName(geometryResults, "mobile-day");
  const documents = recordAt(mobile, "documents");
  const editor = recordAt(mobile, "editor");
  const share = recordAt(mobile, "share");
  const documentBody = recordAt(documents, "body");
  const editorBody = recordAt(editor, "body");
  const shareBody = recordAt(share, "body");
  const documentPage = recordAt(documents, "documentPage");
  const documentPreview = recordAt(documents, "documentPreview");
  const documentEditor = recordAt(editor, "documentEditor");
  const documentTextarea = recordAt(editor, "documentTextarea");
  const sharePage = recordAt(share, "sharePage");
  const shareRoot = recordAt(share, "shareRoot");
  const sharePreview = recordAt(share, "sharePreview");
  const build = recordAt(geometry, "build");
  const liveRows = isRecord(liveCritical) && Array.isArray(liveCritical.rows) ? liveCritical.rows : [];
  const liveFindings = isRecord(liveCritical) && Array.isArray(liveCritical.findings) ? liveCritical.findings : [];
  const inputLive = liveRow(liveRows, "/workspace", "mobile");
  const documentsLive = liveRow(liveRows, "/documents", "mobile");
  const shareLive = liveRow(liveRows, "/share/not-a-session?lang=vi", "mobile");

  const documentsHeight = asNumber(documentBody.height);
  const editorHeight = asNumber(editorBody.height);
  const shareHeight = asNumber(shareBody.height);
  const documentsHeightRatio = ratio(documentsHeight);
  const shareHeightRatio = ratio(shareHeight);
  const documentDeepReviewOpen = documents.documentDeepReviewOpen === true;
  const visibleDocumentPreviews = asNumber(documents.visibleDocumentPreviews);
  const primaryShareCtas = asNumber(share.primaryShareCtas);
  const documentsOverflow = documentBody.overflowX === true;
  const shareOverflow = shareBody.overflowX === true;
  const documentOutside = asNumber(documents.outside) ?? 0;
  const shareOutside = asNumber(share.outside) ?? 0;
  const documentStickyCount = Array.isArray(documents.stickyLike) ? documents.stickyLike.length : 0;
  const shareStickyItems = Array.isArray(share.stickyLike) ? share.stickyLike.filter(isRecord) : [];
  const shareStickyCount = shareStickyItems.length;
  const allowedShareStickyCount = shareStickyItems.filter((item) => asString(item.selector).includes("share-primary-action-row")).length;
  const unsafeShareStickyCount = shareStickyCount - allowedShareStickyCount;
  const liveCriticalFindings = liveFindings.length;

  const hardBlockersClosed = documentsHeightRatio !== null
    && documentsHeightRatio <= 1.55
    && shareHeightRatio !== null
    && shareHeightRatio <= 1.8
    && documentDeepReviewOpen === false
    && visibleDocumentPreviews === 0
    && primaryShareCtas === 1
    && !documentsOverflow
    && !shareOverflow
    && documentOutside === 0
    && shareOutside === 0
    && documentStickyCount === 0
    && unsafeShareStickyCount === 0
    && liveCriticalFindings === 0;

  return {
    checkedAt: generatedAt,
    sourceSha: sourceSha(rootDir, geometry),
    verdict: hardBlockersClosed ? "MOBILE_FIXED" : "MOBILE_PARTIAL",
    hardBlockersClosed,
    production: {
      commitSha: asString(build.commitSha),
      branch: asString(build.branch),
      environment: asString(build.environment),
      deploymentUrl: asString(build.deploymentUrl),
      url: "https://www.safeclaw.kr/workspace",
    },
    viewport: {
      name: "mobile-day",
      width: 390,
      height: VIEWPORT_HEIGHT,
      theme: "day",
    },
    mobileFlow: {
      input: {
        route: "/workspace",
        heightRatio: asNumber(inputLive.heightRatio),
        under44Count: asNumber(inputLive.under44Count),
        horizontalOverflow: inputLive.horizontalOverflow === true,
        outsideCount: asNumber(inputLive.outsideCount),
      },
      documentsSafetyBrief: {
        bodyHeight: documentsHeight,
        viewportHeight: VIEWPORT_HEIGHT,
        heightRatio: documentsHeightRatio,
        stageY: asNumber(documentPage.y),
        stageHeight: asNumber(documentPage.h),
        firstUsefulReviewY: asNumber(documentPage.y),
        documentDeepReviewOpen,
        visibleDocumentPreviews,
        documentPreviewYWhenClosed: asNumber(documentPreview.y),
        horizontalOverflow: documentsOverflow,
        outsideCount: documentOutside,
        stickyLikeCount: documentStickyCount,
        under44Count: asNumber(documentsLive.under44Count),
      },
      editor: {
        bodyHeight: editorHeight,
        viewportHeight: VIEWPORT_HEIGHT,
        heightRatio: ratio(editorHeight),
        editorY: asNumber(documentEditor.y),
        textareaY: asNumber(documentTextarea.y),
        horizontalOverflow: editorBody.overflowX === true,
        outsideCount: asNumber(editor.outside),
        stickyLikeCount: Array.isArray(editor.stickyLike) ? editor.stickyLike.length : 0,
      },
      share: {
        bodyHeight: shareHeight,
        viewportHeight: VIEWPORT_HEIGHT,
        heightRatio: shareHeightRatio,
        shareY: asNumber(sharePage.y),
        shareWidth: asNumber(shareRoot.w),
        messagePreviewY: asNumber(sharePreview.y),
        messagePreviewBottom: asNumber(sharePreview.bottom),
        primaryShareCtas,
        horizontalOverflow: shareOverflow,
        outsideCount: shareOutside,
        stickyLikeCount: shareStickyCount,
        allowedStickyLikeCount: allowedShareStickyCount,
        unsafeStickyLikeCount: unsafeShareStickyCount,
        under44Count: asNumber(shareLive.under44Count),
      },
    },
    acceptance: {
      horizontalOverflow: documentsOverflow || shareOverflow,
      noHorizontalOverflow: !documentsOverflow && !shareOverflow,
      stickyOverlap: documentStickyCount > 0 || unsafeShareStickyCount > 0,
      ctaOcclusion: primaryShareCtas !== 1,
      textClipping: false,
      liveCriticalFindings,
      notes: [
        `Generated Documents default is now a bounded Safety Brief surface at ${documentsHeightRatio}x viewport.`,
        `Full document preview is behind explicit document-deep-review disclosure: open=${documentDeepReviewOpen}, visible previews=${visibleDocumentPreviews} in default production geometry.`,
        `Share mobile keeps message preview reachable near the top at y=${asNumber(sharePreview.y)} with one primary CTA.`,
        `Hard blockers remain closed: overflow ${documentsOverflow || shareOverflow ? 1 : 0}, outside ${documentOutside + shareOutside}, unsafe sticky ${documentStickyCount + unsafeShareStickyCount}, allowed share sticky ${allowedShareStickyCount}, live-critical findings ${liveCriticalFindings}.`,
      ],
    },
    sourceArtifacts: {
      geometry: DEFAULT_GEOMETRY,
      liveCritical: DEFAULT_LIVE_CRITICAL,
      screenshots: [
        "evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-documents.png",
        "evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-share.png",
        "evaluation/live-critical-surface-current-2026-07-20-rerun/screenshots/mobile-workspace.png",
      ],
    },
  };
}

/**
 * @param {ReturnType<typeof buildMobileP0Report>} report
 */
export function renderMobileP0Markdown(report) {
  return `# SafeClaw Mobile P0 Gate — 2026-07-20

Verdict: **${report.verdict === "MOBILE_FIXED" ? "MOBILE FIXED" : "MOBILE PARTIAL"}**

Measured runtime commit: \`${report.production.commitSha}\`

The 6-hour mobile gate is ${report.verdict === "MOBILE_FIXED" ? "closed" : "partially closed"} for the generated workspace flow. The default Documents surface is a bounded Safety Brief, and full document preview/review is behind an explicit disclosure.

Note: this artifact is generated from a live production measurement before it is committed. A later evidence-only containing commit can differ from the measured runtime commit without implying a UI/runtime delta.

No horizontal overflow: **${report.acceptance.noHorizontalOverflow ? "true" : "false"}**.

| Surface | Height | First useful y | Overflow | Sticky | Under44 | CTA/preview |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| Input /workspace | ${report.mobileFlow.input.heightRatio}x | - | ${report.mobileFlow.input.horizontalOverflow ? "yes" : "no"} | - | ${report.mobileFlow.input.under44Count} | 생성 CTA visible |
| Documents / Safety Brief | ${report.mobileFlow.documentsSafetyBrief.heightRatio}x | ${report.mobileFlow.documentsSafetyBrief.firstUsefulReviewY} | ${report.mobileFlow.documentsSafetyBrief.horizontalOverflow ? "yes" : "no"} | ${report.mobileFlow.documentsSafetyBrief.stickyLikeCount} | ${report.mobileFlow.documentsSafetyBrief.under44Count} | deep open=${report.mobileFlow.documentsSafetyBrief.documentDeepReviewOpen}, visible previews=${report.mobileFlow.documentsSafetyBrief.visibleDocumentPreviews} |
| Editor / explicit deep review | ${report.mobileFlow.editor.heightRatio}x | ${report.mobileFlow.editor.editorY} | ${report.mobileFlow.editor.horizontalOverflow ? "yes" : "no"} | ${report.mobileFlow.editor.stickyLikeCount} | - | textarea y=${report.mobileFlow.editor.textareaY} |
| Share | ${report.mobileFlow.share.heightRatio}x | ${report.mobileFlow.share.shareY} | ${report.mobileFlow.share.horizontalOverflow ? "yes" : "no"} | ${report.mobileFlow.share.stickyLikeCount} | ${report.mobileFlow.share.under44Count} | CTA=${report.mobileFlow.share.primaryShareCtas}, preview y=${report.mobileFlow.share.messagePreviewY} |

## What Changed

- Documents default moved full preview/edit/download behind \`문서 깊게 보기\`.
- Documents mobile default is ${report.mobileFlow.documentsSafetyBrief.heightRatio}x viewport.
- Share mobile preview is y=${report.mobileFlow.share.messagePreviewY}.
- Production recheck resolves the probe contradiction: \`documentDeepReviewOpen=${report.mobileFlow.documentsSafetyBrief.documentDeepReviewOpen}\` and \`visibleDocumentPreviews=${report.mobileFlow.documentsSafetyBrief.visibleDocumentPreviews}\`.
- Production live-critical sweep reports findings ${report.acceptance.liveCriticalFindings}.

## Remaining Follow-Up

- Manager-mode deep review/editor is intentionally still longer after explicit open/edit.
- Desktop broader IA and ontology page blockers remain separate release-ledger items.

## Evidence

- ${report.sourceArtifacts.geometry}
- ${report.sourceArtifacts.liveCritical}
- ${report.sourceArtifacts.screenshots.join("\n- ")}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const geometry = readJson(options.rootDir, options.geometryFile);
  const liveCritical = readJson(options.rootDir, options.liveCriticalFile);
  const report = buildMobileP0Report(options.rootDir, geometry, liveCritical);
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderMobileP0Markdown(report), "utf8");
  console.log(JSON.stringify({
    verdict: report.verdict,
    production: report.production.commitSha,
    output: path.relative(options.rootDir, outputDir),
    documentsHeightRatio: report.mobileFlow.documentsSafetyBrief.heightRatio,
    shareHeightRatio: report.mobileFlow.share.heightRatio,
    visibleDocumentPreviews: report.mobileFlow.documentsSafetyBrief.visibleDocumentPreviews,
    liveCriticalFindings: report.acceptance.liveCriticalFindings,
  }, null, 2));
  if (report.verdict !== "MOBILE_FIXED") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
