#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_TEMPLATE_PATH = path.join(
  "evaluation",
  "kosha-exact-promotion-review-gate-2026-07-22",
  "review-template.json",
);
const DEFAULT_PDF_AUDIT_PATH = path.join(
  "evaluation",
  "kosha-exact-official-pdf-audit-2026-07-25",
  "report.json",
);
const DEFAULT_LIFECYCLE_AUDIT_PATH = path.join(
  "evaluation",
  "kosha-exact-official-lifecycle-audit-2026-07-25",
  "report.json",
);
const DEFAULT_OUTPUT_DIR = path.join(
  "evaluation",
  "kosha-exact-promotion-reviewer-cockpit-2026-07-25",
);
const REVIEW_CHECK_LABELS = new Map([
  [
    "official URL opens the expected KOSHA file for the selected stable key",
    "공식 URL이 선택한 KOSHA 식별자의 파일을 여는지 확인",
  ],
  [
    "official file id, version, and publication date match metadata and body-corpus provenance",
    "파일 ID·버전·게시일이 메타데이터와 본문 출처에 일치",
  ],
  [
    "body SHA-256 and PDF SHA-256 are rechecked against immutable acquisition evidence",
    "본문·PDF SHA-256이 변경 불가 취득 증거와 일치",
  ],
  [
    "operator confirms lifecycle/current status and excludes stale superseded versions",
    "현재판 여부를 확인하고 폐기·대체 버전을 제외",
  ],
  [
    "human confirmation is recorded before any exact-kosha registry JSON is created",
    "exact-kosha registry 생성 전에 사람 확인을 기록",
  ],
]);
const RATIONALE_LABELS = new Map([
  ["D-C-10", "이동식크레인·항타기·항발기·타워크레인 작업계획서 시나리오를 보강합니다."],
  ["D-C-11", "굴착·토공 작업에서 반복되는 건설 위험 입력을 보강합니다."],
  ["A-G-1", "비계·외벽도장 exact 근거에 추락방호망 통제를 보완합니다."],
  ["A-G-15", "작업중지·보고·현장보존을 포함한 비상조치계획 흐름을 보강합니다."],
  ["B-E-11", "기존 정전 전기작업 exact 근거에 활선작업 통제를 보완합니다."],
  ["B-E-9", "전기 격리·충전부 통제와 함께 접지장치 근거를 보강합니다."],
  ["D-C-4", "굴착기 작업계획과 건설장비 위험성평가 행을 보강합니다."],
  ["E-G-4", "중량물 취급·반복작업의 근골격계질환 예방 근거를 보강합니다."],
]);

/** @typedef {Record<string, unknown>} JsonRecord */

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
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {JsonRecord}
 */
function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`kosha-reviewer-cockpit-invalid-${label}`);
  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {JsonRecord[]}
 */
function requireRecords(value, label) {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isRecord)) {
    throw new Error(`kosha-reviewer-cockpit-invalid-${label}`);
  }
  return value;
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("kosha-reviewer-cockpit-path-outside-root");
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {unknown} value
 */
function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/**
 * @param {string} rootDir
 */
function gitHead(rootDir) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
}

/**
 * @param {JsonRecord} template
 * @param {JsonRecord} pdfAudit
 * @param {JsonRecord} lifecycleAudit
 */
export function buildReviewerCockpit(template, pdfAudit, lifecycleAudit) {
  if (asString(template.schemaVersion) !== "safeclaw-kosha-exact-promotion-review/v1") {
    throw new Error("kosha-reviewer-cockpit-template-schema");
  }
  if (template.reviewTemplateOnly !== true || template.exactPromotionPerformed !== false) {
    throw new Error("kosha-reviewer-cockpit-template-boundary");
  }
  if (asString(pdfAudit.verdict) !== "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED") {
    throw new Error("kosha-reviewer-cockpit-pdf-audit-not-ready");
  }
  if (asString(lifecycleAudit.verdict) !== "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED") {
    throw new Error("kosha-reviewer-cockpit-lifecycle-audit-not-ready");
  }

  const candidateReviews = requireRecords(template.candidateReviews, "candidate-reviews");
  const pdfRows = requireRecords(pdfAudit.results, "pdf-results");
  const lifecycleRows = requireRecords(lifecycleAudit.results, "lifecycle-results");
  const pdfByKey = new Map(pdfRows.map((row) => [asString(row.stableKey), row]));
  const lifecycleByKey = new Map(lifecycleRows.map((row) => [asString(row.stableKey), row]));
  const candidates = candidateReviews.map((candidate, index) => {
    const stableKey = asString(candidate.stableKey);
    const version = asString(candidate.version);
    const support = requireRecord(candidate.machineReviewerSupport, `support-${stableKey}`);
    const semanticGroups = requireRecords(support.semanticGroups, `semantic-groups-${stableKey}`);
    const requiredChecks = requireRecords(candidate.requiredReviewChecks, `required-checks-${stableKey}`);
    const pdfRow = pdfByKey.get(stableKey);
    const lifecycleRow = lifecycleByKey.get(stableKey);
    if (
      !stableKey
      || !version
      || !pdfRow
      || !lifecycleRow
      || asString(pdfRow.version) !== version
      || asString(lifecycleRow.packetVersion) !== version
      || pdfRow.machineVerificationPassed !== true
      || lifecycleRow.machineLifecycleSupported !== true
      || semanticGroups.length !== 3
      || requiredChecks.length !== 5
      || support.contentRationaleMachineSupported !== true
      || semanticGroups.some((group) => !asString(group.excerpt))
      || semanticGroups.some((group) => !Array.isArray(group.matchedTerms) || group.matchedTerms.length === 0)
    ) {
      throw new Error(`kosha-reviewer-cockpit-candidate-not-ready:${stableKey || index}`);
    }
    return {
      order: index + 1,
      stableKey,
      version,
      title: asString(candidate.title),
      category: asString(candidate.category),
      publishedAt: asString(candidate.publishedAt),
      officialFileId: asString(candidate.officialFileId),
      officialUrl: asString(candidate.officialUrl),
      bodySha256: asString(candidate.bodySha256),
      pdfSha256: asString(candidate.pdfSha256),
      pageCount: typeof candidate.pageCount === "number" ? candidate.pageCount : 0,
      rationale: asString(candidate.rationale),
      displayRationale: RATIONALE_LABELS.get(stableKey) || asString(candidate.rationale),
      machineEvidence: {
        pdfVerified: true,
        lifecycleVerified: true,
        currentStatusLabel: asString(lifecycleRow.currentStatusLabel),
        currentPublishedAt: asString(lifecycleRow.currentPublishedAt),
        currentVersions: Array.isArray(lifecycleRow.currentVersions)
          ? lifecycleRow.currentVersions.filter((item) => typeof item === "string")
          : [],
      },
      semanticGroups: semanticGroups.map((group) => ({
        group: typeof group.group === "number" ? group.group : 0,
        requiredAny: Array.isArray(group.requiredAny)
          ? group.requiredAny.filter((item) => typeof item === "string")
          : [],
        matchedTerms: Array.isArray(group.matchedTerms)
          ? group.matchedTerms.filter((item) => typeof item === "string")
          : [],
        excerpt: asString(group.excerpt),
      })),
      requiredReviewChecks: requiredChecks.map((check) => ({
        text: asString(check.text),
        confirmed: false,
      })),
      reviewer: "",
      reviewedAt: "",
      humanConfirmed: false,
    };
  });

  if (candidates.length !== 8 || pdfRows.length !== 8 || lifecycleRows.length !== 8) {
    throw new Error("kosha-reviewer-cockpit-candidate-count");
  }

  const checklistInputCount = candidates.length * 8;
  const payload = {
    schemaVersion: "safeclaw-kosha-exact-promotion-reviewer-cockpit/v1",
    candidateCount: candidates.length,
    semanticGroupCount: candidates.length * 3,
    checklistInputCount,
    candidates,
    boundary: {
      localReviewOnly: true,
      dbMutationPerformed: false,
      exactRegistryWriteArtifactCreated: false,
      exactPromotionPerformed: false,
      machineEvidenceReplacesHumanReview: false,
      separatePromotionApprovalRequired: true,
    },
  };

  const candidateButtons = candidates.map((candidate, index) => `
    <button class="candidate-button" type="button" data-candidate-button="${index}" aria-pressed="${index === 0}">
      <span>${escapeHtml(candidate.stableKey)}</span>
      <strong>${escapeHtml(candidate.version)}</strong>
      <small data-candidate-progress="${index}">0/8</small>
    </button>`).join("");

  const candidatePanels = candidates.map((candidate, index) => {
    const evidenceGroups = candidate.semanticGroups.map((group) => `
      <article class="evidence-group">
        <header><span>근거 ${group.group}</span><strong>${escapeHtml(group.matchedTerms.join(" · "))}</strong></header>
        <p>${escapeHtml(group.excerpt)}</p>
      </article>`).join("");
    const checks = candidate.requiredReviewChecks.map((check, checkIndex) => `
      <label class="check-row">
        <input type="checkbox" data-check="${index}:${checkIndex}">
        <span title="${escapeHtml(check.text)}">${escapeHtml(REVIEW_CHECK_LABELS.get(check.text) || check.text)}</span>
      </label>`).join("");
    return `
      <section class="candidate-panel" data-candidate-panel="${index}" data-mobile-view="evidence" ${index === 0 ? "" : "hidden"}>
        <nav class="mobile-mode" aria-label="${escapeHtml(candidate.stableKey)} 검토 보기">
          <button type="button" data-mobile-mode="${index}:evidence" aria-pressed="true">근거</button>
          <button type="button" data-mobile-mode="${index}:review" aria-pressed="false">체크리스트</button>
        </nav>
        <main class="evidence-pane">
          <header class="candidate-heading">
            <div><span>${escapeHtml(candidate.category)}</span><h1>${escapeHtml(candidate.title)}</h1></div>
            <a href="${escapeHtml(candidate.officialUrl)}" target="_blank" rel="noreferrer">공식 PDF 열기</a>
          </header>
          <dl class="identity-grid">
            <div><dt>현재 버전</dt><dd>${escapeHtml(candidate.version)}</dd></div>
            <div><dt>공식 게시일</dt><dd>${escapeHtml(candidate.publishedAt)}</dd></div>
            <div><dt>PDF 검증</dt><dd>SHA 일치</dd></div>
            <div><dt>수명주기</dt><dd>${escapeHtml(candidate.machineEvidence.currentStatusLabel || "현재")}</dd></div>
          </dl>
          <section class="rationale"><strong>선정 이유</strong><p>${escapeHtml(candidate.displayRationale)}</p></section>
          <section class="evidence-stack" aria-label="기계 보조 근거">${evidenceGroups}</section>
          <details class="hash-details">
            <summary>파일·본문 식별자</summary>
            <dl>
              <div><dt>공식 파일 ID</dt><dd>${escapeHtml(candidate.officialFileId)}</dd></div>
              <div><dt>본문 SHA-256</dt><dd>${escapeHtml(candidate.bodySha256)}</dd></div>
              <div><dt>PDF SHA-256</dt><dd>${escapeHtml(candidate.pdfSha256)}</dd></div>
            </dl>
          </details>
        </main>
        <aside class="review-pane" aria-label="${escapeHtml(candidate.stableKey)} 사람 검토">
          <header><span>사람 검토</span><strong data-review-status="${index}">8개 입력 필요</strong></header>
          <p class="boundary-note">기계 근거는 검토를 돕지만 판단을 대신하지 않습니다.</p>
          <div class="check-stack">${checks}</div>
          <label class="field-label">검토자<input type="text" maxlength="120" autocomplete="name" data-reviewer="${index}"></label>
          <label class="field-label">검토 시각<input type="datetime-local" data-reviewed-at="${index}"></label>
          <label class="human-confirm">
            <input type="checkbox" data-human-confirm="${index}">
            <span>이 후보의 전체 근거와 현재성을 직접 확인했습니다.</span>
          </label>
        </aside>
      </section>`;
  }).join("");

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KOSHA exact promotion reviewer cockpit</title>
  <style>
    :root{color-scheme:light;--ink:#17211c;--muted:#637069;--line:#cbd4ce;--panel:#fff;--soft:#f1f5f2;--accent:#087f5b;--warn:#a75800}
    *{box-sizing:border-box}body{margin:0;background:#e8eeea;color:var(--ink);font-family:"Segoe UI","Noto Sans KR",sans-serif;letter-spacing:0}
    button,input{font:inherit}.shell{height:100dvh;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto}.topbar{display:flex;align-items:center;gap:20px;padding:14px 20px;background:#14231c;color:#fff}
    .topbar h1{font-size:18px;margin:0}.topbar p{margin:2px 0 0;color:#c7d5cd;font-size:13px}.metrics{margin-left:auto;display:flex;gap:16px;font-size:13px}.metrics strong{display:block;font-size:16px}
    .workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:0;min-height:0;height:auto}.candidate-rail{background:#f7faf8;border-right:1px solid var(--line);padding:12px;overflow:auto}
    .rail-label{display:block;color:var(--muted);font-size:12px;font-weight:700;margin:4px 4px 10px}.candidate-list{display:grid;gap:6px}
    .candidate-button{width:100%;border:1px solid transparent;background:transparent;text-align:left;padding:9px 10px;display:grid;grid-template-columns:1fr auto;gap:2px 8px;color:var(--ink);cursor:pointer;border-radius:6px}
    .candidate-button:hover{background:#eaf1ed}.candidate-button[aria-pressed="true"]{background:#dcece4;border-color:#9ec5b2}.candidate-button span{font-size:12px;color:var(--muted)}.candidate-button strong{grid-column:1;font-size:13px}.candidate-button small{grid-column:2;grid-row:1/3;align-self:center;color:var(--accent);font-weight:700}
    .content{min-width:0;min-height:0}.candidate-panel{display:grid;grid-template-columns:minmax(0,1fr) 360px;height:100%;min-height:0}.candidate-panel[hidden]{display:none}.evidence-pane,.review-pane{overflow:auto;padding:18px 20px}.review-pane{background:#f8faf9;border-left:1px solid var(--line)}
    .candidate-heading{display:flex;gap:16px;align-items:flex-start}.candidate-heading div{min-width:0}.candidate-heading span{color:var(--accent);font-size:12px;font-weight:700}.candidate-heading h1{font-size:20px;line-height:1.35;margin:4px 0 0}.candidate-heading a{margin-left:auto;white-space:nowrap;color:#075e45;font-weight:700;font-size:13px}
    .identity-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);margin:16px 0 12px}.identity-grid div{padding:9px 10px;border-right:1px solid var(--line)}.identity-grid div:last-child{border:0}dt{font-size:11px;color:var(--muted)}dd{margin:3px 0 0;font-size:13px;font-weight:700}
    .rationale{border-left:3px solid var(--accent);padding:8px 12px;background:var(--soft)}.rationale p{margin:4px 0 0;font-size:13px}.evidence-stack{display:grid;gap:8px;margin-top:12px}.evidence-group{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:10px 12px}
    .evidence-group header{display:flex;gap:10px;align-items:center;font-size:12px}.evidence-group header span{color:var(--muted)}.evidence-group p{font-size:13px;line-height:1.55;margin:8px 0 0;overflow-wrap:anywhere}.hash-details{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.hash-details summary{cursor:pointer;font-size:13px;font-weight:700}.hash-details dl{display:grid;gap:8px}.hash-details dd{font-family:Consolas,monospace;font-size:11px;overflow-wrap:anywhere}
    .review-pane>header{display:flex;justify-content:space-between;align-items:center}.review-pane>header span{font-size:12px;color:var(--muted);font-weight:700}.review-pane>header strong{font-size:13px;color:var(--warn)}.boundary-note{font-size:12px;color:#704100;background:#fff4dd;border:1px solid #e3bf75;padding:8px 10px;border-radius:6px}
    .check-stack{display:grid;gap:6px}.check-row,.human-confirm{display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;border:1px solid var(--line);background:#fff;padding:9px;border-radius:6px;font-size:12px;line-height:1.4}.check-row input,.human-confirm input{margin:2px 0 0;accent-color:var(--accent)}
    .field-label{display:grid;gap:5px;margin-top:10px;font-size:12px;font-weight:700}.field-label input{width:100%;border:1px solid #aebbb3;background:#fff;padding:9px;border-radius:4px}.human-confirm{margin-top:10px;border-color:#9ec5b2;background:#eef8f2}
    .footer-actions{display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;background:#e8eeea;border-top:1px solid var(--line)}.footer-actions button{border:1px solid #295d48;padding:9px 12px;border-radius:5px;background:#fff;color:#184b38;font-weight:700;cursor:pointer}.footer-actions .primary{background:#087f5b;color:#fff;white-space:nowrap}.footer-actions button:disabled{cursor:not-allowed;opacity:.45}
    .mobile-mode{display:none}.status-live{color:#8ce0bc}.complete .candidate-button small{color:#087f5b}
    @media(max-width:767px){.topbar{align-items:flex-start;padding:12px;height:68px}.metrics{display:none}.workspace{display:flex;flex-direction:column;height:auto;overflow:hidden}.candidate-rail{flex:none;border-right:0;border-bottom:1px solid var(--line);padding:8px;overflow-x:auto}.rail-label{display:none}.candidate-list{display:flex;width:max-content}.candidate-button{width:132px}.content{flex:1;min-height:0}.candidate-panel{display:flex;flex-direction:column;height:100%;min-height:0}.candidate-panel[hidden]{display:none}.mobile-mode{display:grid;grid-template-columns:1fr 1fr;flex:none;border-bottom:1px solid var(--line);background:#f7faf8;padding:6px 8px}.mobile-mode button{border:0;border-bottom:2px solid transparent;background:transparent;padding:8px;color:var(--muted);font-weight:700}.mobile-mode button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}.candidate-panel[data-mobile-view="evidence"] .review-pane,.candidate-panel[data-mobile-view="review"] .evidence-pane{display:none}.evidence-pane,.review-pane{flex:1;min-height:0;overflow:auto;padding:14px 12px}.review-pane{border-left:0}.identity-grid{grid-template-columns:repeat(2,1fr)}.identity-grid div:nth-child(2){border-right:0}.candidate-heading{display:block}.candidate-heading a{display:inline-block;margin-top:8px}.footer-actions{padding:7px 8px}.footer-actions button{padding:8px 9px;font-size:13px}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div><h1>KOSHA exact promotion 검토 작업대</h1><p>기계 검증을 읽고 사람이 직접 판단하는 로컬 전용 cockpit</p></div>
      <div class="metrics"><div><strong>${candidates.length}</strong>후보</div><div><strong>${candidates.length * 3}</strong>근거 묶음</div><div><strong>${checklistInputCount}</strong>필수 입력</div><div><strong class="status-live">0</strong>외부 변경</div></div>
    </header>
    <div class="workspace">
      <aside class="candidate-rail"><span class="rail-label">검토 후보</span><div class="candidate-list">${candidateButtons}</div></aside>
      <div class="content">${candidatePanels}</div>
    </div>
    <div class="footer-actions">
      <button type="button" data-reset title="이 브라우저에 저장된 입력을 모두 지웁니다">입력 초기화</button>
      <button class="primary" type="button" data-export disabled>검토 JSON 내보내기 · 64개 입력 필요</button>
    </div>
  </div>
  <script id="cockpit-data" type="application/json">${jsonForScript(payload)}</script>
  <script>
    (() => {
      const payload = JSON.parse(document.getElementById("cockpit-data").textContent);
      const storageKey = "safeclaw-kosha-reviewer-cockpit-v1";
      const emptyState = () => payload.candidates.map((candidate) => ({
        stableKey: candidate.stableKey,
        reviewer: "",
        reviewedAt: "",
        humanConfirmed: false,
        requiredReviewChecks: candidate.requiredReviewChecks.map((check) => ({ text: check.text, confirmed: false }))
      }));
      let state = emptyState();
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (Array.isArray(stored) && stored.length === state.length) state = stored;
      } catch (error) {
        console.warn("KOSHA reviewer cockpit local state could not be restored", error);
      }
      const panels = [...document.querySelectorAll("[data-candidate-panel]")];
      const buttons = [...document.querySelectorAll("[data-candidate-button]")];
      const exportButton = document.querySelector("[data-export]");
      const completedInputs = (row) =>
        row.requiredReviewChecks.filter((check) => check.confirmed).length
        + (row.reviewer.trim() ? 1 : 0)
        + (row.reviewedAt ? 1 : 0)
        + (row.humanConfirmed ? 1 : 0);
      const render = () => {
        state.forEach((row, index) => {
          row.requiredReviewChecks.forEach((check, checkIndex) => {
            document.querySelector('[data-check="' + index + ':' + checkIndex + '"]').checked = check.confirmed;
          });
          document.querySelector("[data-reviewer='" + index + "']").value = row.reviewer;
          document.querySelector("[data-reviewed-at='" + index + "']").value = row.reviewedAt;
          document.querySelector("[data-human-confirm='" + index + "']").checked = row.humanConfirmed;
          const count = completedInputs(row);
          document.querySelector("[data-candidate-progress='" + index + "']").textContent = count + "/8";
          const status = document.querySelector("[data-review-status='" + index + "']");
          status.textContent = count === 8 ? "입력 완료" : (8 - count) + "개 입력 필요";
          status.style.color = count === 8 ? "#087f5b" : "#a75800";
        });
        const completeCount = state.reduce((sum, row) => sum + completedInputs(row), 0);
        exportButton.disabled = completeCount !== payload.checklistInputCount;
        exportButton.textContent = completeCount === payload.checklistInputCount
          ? "검토 JSON 내보내기"
          : "검토 JSON 내보내기 · " + (payload.checklistInputCount - completeCount) + "개 입력 필요";
        localStorage.setItem(storageKey, JSON.stringify(state));
      };
      const selectCandidate = (index) => {
        panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
        buttons.forEach((button, buttonIndex) => button.setAttribute("aria-pressed", String(buttonIndex === index)));
      };
      buttons.forEach((button, index) => button.addEventListener("click", () => selectCandidate(index)));
      document.querySelectorAll("[data-mobile-mode]").forEach((button) => button.addEventListener("click", (event) => {
        const [candidateIndex, mode] = event.currentTarget.dataset.mobileMode.split(":");
        const panel = document.querySelector("[data-candidate-panel='" + candidateIndex + "']");
        panel.dataset.mobileView = mode;
        panel.querySelectorAll("[data-mobile-mode]").forEach((modeButton) => {
          modeButton.setAttribute("aria-pressed", String(modeButton.dataset.mobileMode.endsWith(":" + mode)));
        });
      }));
      document.querySelectorAll("[data-check]").forEach((input) => input.addEventListener("change", (event) => {
        const [candidateIndex, checkIndex] = event.currentTarget.dataset.check.split(":").map(Number);
        state[candidateIndex].requiredReviewChecks[checkIndex].confirmed = event.currentTarget.checked;
        render();
      }));
      document.querySelectorAll("[data-reviewer]").forEach((input) => input.addEventListener("input", (event) => {
        state[Number(event.currentTarget.dataset.reviewer)].reviewer = event.currentTarget.value.slice(0, 120);
        render();
      }));
      document.querySelectorAll("[data-reviewed-at]").forEach((input) => input.addEventListener("input", (event) => {
        state[Number(event.currentTarget.dataset.reviewedAt)].reviewedAt = event.currentTarget.value;
        render();
      }));
      document.querySelectorAll("[data-human-confirm]").forEach((input) => input.addEventListener("change", (event) => {
        state[Number(event.currentTarget.dataset.humanConfirm)].humanConfirmed = event.currentTarget.checked;
        render();
      }));
      document.querySelector("[data-reset]").addEventListener("click", () => {
        if (!window.confirm("이 브라우저에 저장된 KOSHA 검토 입력을 모두 지울까요?")) return;
        state = emptyState();
        render();
      });
      exportButton.addEventListener("click", () => {
        if (exportButton.disabled) return;
        const output = {
          schemaVersion: "safeclaw-kosha-exact-promotion-review/v1",
          generatedAt: new Date().toISOString(),
          sourceHead: payload.sourceHead || "",
          reviewTemplateOnly: false,
          exactPromotionPerformed: false,
          machineEvidenceReplacesHumanReview: false,
          candidateReviews: payload.candidates.map((candidate, index) => ({
            ...candidate,
            reviewer: state[index].reviewer.trim(),
            reviewedAt: new Date(state[index].reviewedAt).toISOString(),
            humanConfirmed: state[index].humanConfirmed,
            requiredReviewChecks: state[index].requiredReviewChecks
          }))
        };
        const blob = new Blob([JSON.stringify(output, null, 2) + "\\n"], { type: "application/json" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = "kosha-exact-promotion-human-review.json";
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      });
      render();
    })();
  </script>
</body>
</html>`;

  return { html, payload };
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = {
    rootDir: REPO_ROOT,
    templatePath: DEFAULT_TEMPLATE_PATH,
    pdfAuditPath: DEFAULT_PDF_AUDIT_PATH,
    lifecycleAuditPath: DEFAULT_LIFECYCLE_AUDIT_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.rootDir = path.resolve(argv[++index] || "");
    else if (value === "--template") options.templatePath = argv[++index] || "";
    else if (value === "--pdf-audit") options.pdfAuditPath = argv[++index] || "";
    else if (value === "--lifecycle-audit") options.lifecycleAuditPath = argv[++index] || "";
    else if (value === "--output") options.outputDir = argv[++index] || "";
    else throw new Error(`kosha-reviewer-cockpit-unknown-argument:${value}`);
  }
  return options;
}

/**
 * @param {ReturnType<typeof parseArgs>} options
 */
export function runReviewerCockpit(options) {
  const template = requireRecord(readJson(options.rootDir, options.templatePath), "template");
  const pdfAudit = requireRecord(readJson(options.rootDir, options.pdfAuditPath), "pdf-audit");
  const lifecycleAudit = requireRecord(readJson(options.rootDir, options.lifecycleAuditPath), "lifecycle-audit");
  const { html, payload } = buildReviewerCockpit(template, pdfAudit, lifecycleAudit);
  const outputPayload = { ...payload, sourceHead: gitHead(options.rootDir) };
  const outputDir = path.resolve(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    html.replace(jsonForScript(payload), jsonForScript(outputPayload)),
    "utf8",
  );
  const report = {
    schemaVersion: outputPayload.schemaVersion,
    verdict: "PASS_NO_MUTATION_KOSHA_REVIEWER_COCKPIT_READY",
    checkedAt: new Date().toISOString(),
    sourceHead: outputPayload.sourceHead,
    candidateCount: outputPayload.candidateCount,
    semanticGroupCount: outputPayload.semanticGroupCount,
    checklistInputCount: outputPayload.checklistInputCount,
    initialCompletedInputCount: 0,
    exportInitiallyDisabled: true,
    outputHtml: path.relative(options.rootDir, path.join(outputDir, "index.html")),
    boundary: outputPayload.boundary,
  };
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), `# KOSHA Exact Promotion Reviewer Cockpit

Verdict: \`${report.verdict}\`

- Candidates: ${report.candidateCount}
- Machine semantic groups: ${report.semanticGroupCount}
- Required human inputs: ${report.checklistInputCount}
- Initial completed inputs: ${report.initialCompletedInputCount}
- Export initially disabled: ${report.exportInitiallyDisabled}
- HTML: \`${report.outputHtml}\`

## Boundary

This cockpit stores draft input only in the operator browser and exports a local review JSON after all 64 required inputs are complete. It performs no DB, provider, Share, embedding, vector, publication, or exact-registry mutation. Completed human review remains separate from exact-trust promotion approval.
`, "utf8");
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  const report = runReviewerCockpit(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
