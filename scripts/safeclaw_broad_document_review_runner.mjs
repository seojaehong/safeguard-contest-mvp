#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reviewPayload } from "./safeclaw_wording_review_runner.mjs";

const canonicalDocuments = [
  ["workpackSummaryDraft", "점검결과 요약"],
  ["riskAssessmentDraft", "위험성평가표"],
  ["workPlanDraft", "작업계획서"],
  ["workPermitDraft", "안전작업허가 확인서"],
  ["tbmBriefing", "TBM 브리핑"],
  ["tbmLogDraft", "TBM 기록"],
  ["safetyEducationRecordDraft", "안전보건교육 기록"],
  ["emergencyResponseDraft", "비상대응 절차"],
  ["photoEvidenceDraft", "사진·증빙"],
  ["foreignWorkerBriefing", "외국인 근로자 출력본"],
  ["foreignWorkerTransmission", "외국인 전송본"],
  ["kakaoMessage", "현장 공유 메시지"]
];
const permitRequiredTerms = ["허가", "격리", "차단", "종료", "작업시간", "보호구"];
const permitScenarioPattern = /(화학|세척|SDS|GHS|화기|용접|절단|불꽃|밀폐|탱크|맨홀|질식|고소|비계|추락|지붕|외벽|전기|감전|분전반|재통전|정전|크레인|지게차|굴삭|양중|중장비|정비|끼임|컨베이어|방호장치|설비)/iu;

const casesPath = path.resolve(
  process.env.SAFECLAW_BROAD_DOCUMENT_CASES_PATH
    || path.join(process.cwd(), "evaluation", "live-document-quality-stress-matrix-2026-07-24", "scenarios.json")
);
const outDir = path.resolve(
  process.env.SAFECLAW_BROAD_DOCUMENT_OUT_DIR
    || path.join(process.cwd(), "evaluation", "live-document-broad-review-2026-07-25")
);
const payloadsPath = process.env.SAFECLAW_BROAD_DOCUMENT_PAYLOADS_PATH
  ? path.resolve(process.env.SAFECLAW_BROAD_DOCUMENT_PAYLOADS_PATH)
  : "";
const baseUrl = process.env.SAFECLAW_BROAD_DOCUMENT_BASE_URL || "https://www.safeclaw.kr";
const liveEnabled = process.env.SAFECLAW_BROAD_DOCUMENT_LIVE === "1";
const timeoutMs = Number.parseInt(process.env.SAFECLAW_BROAD_DOCUMENT_TIMEOUT_MS || "60000", 10);
const localProduction = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/iu.test(baseUrl);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildCases(matrix) {
  const variants = asArray(matrix.variants);
  const baseScenarios = asArray(matrix.baseScenarios);
  if (!baseScenarios.length || !variants.length) {
    throw new Error("broad document review requires baseScenarios and variants");
  }
  const fieldIsolationProfiles = baseScenarios.map((scenario) => ({
    id: scenario.id,
    terms: asArray(scenario.expected?.fieldIsolationExclusiveTerms).map(text).filter(Boolean)
  }));
  return baseScenarios.flatMap((scenario) => variants.map((variant) => ({
    id: `${scenario.id}__${variant.id}`,
    question: `${scenario.question} ${variant.promptSuffix || ""}`.replace(/\s+/g, " ").trim(),
    expected: {
      ...(scenario.expected || {}),
      ...(variant.expected || {}),
      fieldIsolationTerms: [
        ...new Set([
          ...asArray(scenario.expected?.fieldIsolationTerms),
          ...asArray(variant.expected?.fieldIsolationTerms)
        ].map(text).filter(Boolean))
      ],
      otherFieldIsolationProfiles: fieldIsolationProfiles.filter((profile) => profile.id !== scenario.id)
    }
  })));
}

export function classifyDeliverablePresence(value) {
  const normalized = text(value).replace(/\s+/g, " ");
  if (!normalized) {
    return {
      status: "missingUnexpected",
      reason: "문서 원본이 비어 있어 재생성이 필요합니다."
    };
  }
  const match = normalized.match(/해당\s*없음\s*(?:[:：\-–—]\s*|\(\s*)(.+?)(?:\)|$)/u);
  const reason = text(match?.[1]);
  if (/해당\s*없음/u.test(normalized)) {
    return reason.length >= 5
      ? { status: "explicitNotApplicable", reason }
      : {
        status: "missingUnexpected",
        reason: "해당 없음 표시는 있으나 사용자가 확인할 사유가 없습니다."
      };
  }
  return { status: "presentNonEmpty", reason: "" };
}

export function reviewDeliverableMatrix(payload, question) {
  const deliverables = payload?.deliverables && typeof payload.deliverables === "object"
    ? payload.deliverables
    : {};
  const permitRequired = permitScenarioPattern.test(text(question));
  const documents = canonicalDocuments.map(([key, title]) => {
    const raw = deliverables[key];
    const normalized = text(raw);
    const presence = classifyDeliverablePresence(raw);
    const required = key !== "workPermitDraft" || permitRequired;
    const missingRequiredTerms = key === "workPermitDraft" && presence.status === "presentNonEmpty"
      ? permitRequiredTerms.filter((term) => !normalized.includes(term))
      : [];
    const failures = [];
    if (presence.status === "missingUnexpected") failures.push("missingUnexpected");
    if (required && presence.status === "explicitNotApplicable") failures.push("requiredButNotApplicable");
    if (presence.status === "presentNonEmpty" && normalized.length < 40) failures.push("tooShort");
    if (missingRequiredTerms.length) failures.push("missingRequiredTerms");
    return {
      key,
      title,
      status: presence.status,
      reason: presence.reason,
      charCount: normalized.length,
      required,
      missingRequiredTerms,
      verdict: failures.length ? "RED" : "PASS",
      failures
    };
  });
  return {
    ok: documents.every((item) => item.verdict === "PASS"),
    permitRequired,
    uiDocumentCount: canonicalDocuments.length,
    integrityRequiredCount: canonicalDocuments.length,
    reviewedDocumentCount: documents.length,
    missingUnexpected: documents.filter((item) => item.status === "missingUnexpected").map((item) => item.key),
    explicitNotApplicable: documents.filter((item) => item.status === "explicitNotApplicable").map((item) => ({
      key: item.key,
      reason: item.reason
    })),
    documents
  };
}

async function fetchPayload(testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: testCase.question }),
      signal: controller.signal
    });
    const body = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
    return {
      payload,
      api: {
        status: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startedAt
      }
    };
  } finally {
    clearTimeout(timer);
  }
}

function readSourceHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

async function readBuildInfo() {
  if (!liveEnabled) return null;
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}/api/build-info?codexCacheBust=broad-document-review`);
    if (!response.ok) return { ok: false, status: response.status };
    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function writeMarkdown(report) {
  const rows = report.cases.flatMap((testCase) => testCase.documents.map((document) => (
    `| ${testCase.id} | ${document.key} | ${document.status} | ${document.required ? "yes" : "no"} | ${document.charCount} | ${document.verdict} | ${document.failures.join(", ") || "-"} |`
  ))).join("\n");
  const markdown = `# Live 12-Deliverable Broad Review

- Verdict: \`${report.verdict}\`
- Source mode: \`${report.mode}\`
- Base URL: \`${report.baseUrl || "fixture"}\`
- Source HEAD: \`${report.sourceHead || "unavailable"}\`
- Production commit: \`${report.productionBuild?.commitSha || "not measured"}\`
- Cases: ${report.total}, pass ${report.pass}, fail ${report.fail}
- UI document count: ${report.uiDocumentCount}
- Integrity required count: ${report.integrityRequiredCount}
- Reviewed document count: ${report.reviewedDocumentCount}
- Missing unexpected: ${report.missingUnexpectedCount}
- Explicit not applicable: ${report.explicitNotApplicableCount}
- DB mutation performed: \`false\`
- Share session created: \`false\`
- Provider dispatch called: \`false\`
- Exact saved Share reproduced: \`false\`

| Case | Deliverable | Classification | Required | Characters | Verdict | Failures |
|---|---|---|---:|---:|---:|---|
${rows}

## Classification Contract

- \`presentNonEmpty\`: raw API deliverable contains a substantive visible document.
- \`explicitNotApplicable\`: raw API deliverable visibly states \`해당 없음\` and includes a user-readable reason.
- \`missingUnexpected\`: the raw deliverable is absent, blank, or says \`해당 없음\` without a reason. UI fallback text never upgrades this state.
- Permit-like chemical, hot-work, confined-space, height, electrical, heavy-equipment, and maintenance scenarios require a non-empty \`workPermitDraft\`.

## Boundary

This gate enumerates all 12 UI deliverables and keeps the existing six-document wording review as a separate supporting check. It does not create or mutate a saved Share session, dispatch a provider, mutate the database, or reproduce an exact saved \`/share/[sessionId]\` user session.
`;
  fs.writeFileSync(path.join(outDir, "report.md"), markdown, "utf8");
}

async function main() {
  const matrix = readJson(casesPath);
  const cases = buildCases(matrix);
  const fixtures = payloadsPath ? readJson(payloadsPath) : {};
  if (!liveEnabled && !payloadsPath) {
    throw new Error("set SAFECLAW_BROAD_DOCUMENT_LIVE=1 or provide SAFECLAW_BROAD_DOCUMENT_PAYLOADS_PATH");
  }

  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = Date.now();
  const sourceHead = readSourceHead();
  const productionBuild = await readBuildInfo();
  const results = [];
  for (const testCase of cases) {
    const caseStartedAt = Date.now();
    let api = null;
    let payload = fixtures[testCase.id] || null;
    let runnerError = "";
    try {
      if (liveEnabled) {
        const fetched = await fetchPayload(testCase);
        payload = fetched.payload;
        api = fetched.api;
      }
    } catch (error) {
      runnerError = error instanceof Error ? error.message : String(error);
    }
    const matrixReview = reviewDeliverableMatrix(payload, testCase.question);
    const wordingReview = runnerError
      ? {
        ok: false,
        checks: [{ id: "runner:error", ok: false, detail: runnerError }],
        metrics: { riskRowCount: 0, reviewedDocumentCount: 0 }
      }
      : reviewPayload(payload, testCase.expected, testCase.question);
    const apiOk = !api || api.ok;
    const ok = apiOk && matrixReview.ok && wordingReview.ok;
    results.push({
      id: testCase.id,
      verdict: ok ? "PASS" : "RED",
      elapsedMs: Date.now() - caseStartedAt,
      api,
      permitRequired: matrixReview.permitRequired,
      missingUnexpected: matrixReview.missingUnexpected,
      explicitNotApplicable: matrixReview.explicitNotApplicable,
      documents: matrixReview.documents,
      wordingFailedChecks: wordingReview.checks.filter((check) => !check.ok)
    });
  }

  const pass = results.filter((item) => item.verdict === "PASS").length;
  const missingUnexpected = results.flatMap((item) => item.missingUnexpected.map((key) => ({
    caseId: item.id,
    key
  })));
  const explicitNotApplicable = results.flatMap((item) => item.explicitNotApplicable.map((entry) => ({
    caseId: item.id,
    ...entry
  })));
  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    verdict: pass === results.length
      ? liveEnabled
        ? localProduction
          ? "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW"
          : "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW"
        : "PASS_FIXTURE_12_DELIVERABLE_BROAD_REVIEW"
      : liveEnabled
        ? localProduction
          ? "RED_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW"
          : "RED_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW"
        : "RED_FIXTURE_12_DELIVERABLE_BROAD_REVIEW",
    mode: liveEnabled ? localProduction ? "current-source-local-production" : "live-production" : "fixture",
    baseUrl: liveEnabled ? baseUrl : null,
    sourceHead,
    productionBuild,
    uiDocumentCount: canonicalDocuments.length,
    integrityRequiredCount: canonicalDocuments.length,
    reviewedDocumentCount: canonicalDocuments.length,
    total: results.length,
    pass,
    fail: results.length - pass,
    missingUnexpectedCount: missingUnexpected.length,
    missingUnexpected,
    explicitNotApplicableCount: explicitNotApplicable.length,
    explicitNotApplicable,
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false
    },
    cases: results
  };
  fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeMarkdown(report);
  console.log(JSON.stringify({
    verdict: report.verdict,
    total: report.total,
    pass: report.pass,
    fail: report.fail,
    missingUnexpectedCount: report.missingUnexpectedCount,
    outDir: path.relative(process.cwd(), outDir)
  }, null, 2));
  process.exitCode = report.fail === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
