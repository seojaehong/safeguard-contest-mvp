#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalDocuments } from "./safeclaw_broad_document_review_runner.mjs";

const casesPath = path.resolve(
  process.env.SAFECLAW_EDITORIAL_CASES_PATH
    || path.join(process.cwd(), "evaluation", "live-document-quality-stress-matrix-2026-07-24", "scenarios.json")
);
const outDir = path.resolve(
  process.env.SAFECLAW_EDITORIAL_OUT_DIR
    || path.join(process.cwd(), "evaluation", "live-document-editorial-review-2026-07-25")
);
const payloadsPath = process.env.SAFECLAW_EDITORIAL_PAYLOADS_PATH
  ? path.resolve(process.env.SAFECLAW_EDITORIAL_PAYLOADS_PATH)
  : "";
const baseUrl = process.env.SAFECLAW_EDITORIAL_BASE_URL || "https://www.safeclaw.kr";
const liveEnabled = process.env.SAFECLAW_EDITORIAL_LIVE === "1";
const timeoutMs = Number.parseInt(process.env.SAFECLAW_EDITORIAL_TIMEOUT_MS || "60000", 10);
const localProduction = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/iu.test(baseUrl);

const placeholderPatterns = [
  { id: "unfinished-writing", pattern: /작성\s*(?:필요|예정|중)|추후\s*작성|입력\s*필요/iu },
  { id: "template-token", pattern: /\{\{[^}]+\}\}|<입력[^>]*>|\[(?:입력|작성)\s*(?:필요|예정)?\]/iu },
  { id: "todo-token", pattern: /\b(?:TODO|TBD|FIXME)\b/iu }
];
const legalOverclaimPatterns = [
  {
    id: "document-replaces-legal-duty",
    pattern: /(?:TBM|교육|작업\s*허가|위험성\s*평가).{0,40}(?:법적|법정)\s*(?:의무|서류|절차).{0,20}(?:대체|면제)/iu
  },
  {
    id: "automatic-legal-compliance",
    pattern: /(?:자동|즉시).{0,20}(?:법령|법적\s*의무|법정\s*의무).{0,20}(?:준수|충족|인정)/iu
  }
];
const awkwardCompositionPatterns = [
  { id: "action-sentence-question-splice", pattern: /절차를\s*누가\s*확인했는가/iu }
];
const evidenceDomainRules = [
  {
    id: "vehicle-rollover",
    evidencePattern: /(?:덤프트럭|건설기계|소형\s*작업차|작업차|차량).{0,100}(?:전도|전복|넘어지|굴러\s*떨어)|(?:전도|전복).{0,80}(?:덤프트럭|건설기계|작업차|차량)/iu,
    scenarioIdentityPattern: /지게차|덤프트럭|화물자동차|화물차량|화물차|트럭|작업차|차량|건설기계|굴삭기|굴착기|천공기|로더|운전|운행|주행|후진|하역/iu,
    requiredScenarioIdentity: "vehicle or mobile-equipment operation"
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInline(value) {
  return text(value).replace(/\s+/gu, " ");
}

function safeExcerpt(value, limit = 320) {
  const normalized = normalizeInline(value);
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function buildCases(matrix) {
  const variants = asArray(matrix.variants);
  const baseScenarios = asArray(matrix.baseScenarios);
  if (!baseScenarios.length || !variants.length) {
    throw new Error("editorial review requires baseScenarios and variants");
  }
  return baseScenarios.flatMap((scenario) => variants.map((variant) => ({
    id: `${scenario.id}__${variant.id}`,
    question: `${scenario.question} ${variant.promptSuffix || ""}`.replace(/\s+/gu, " ").trim(),
    expected: {
      ...(scenario.expected || {}),
      ...(variant.expected || {})
    }
  })));
}

function splitReviewLines(value) {
  return text(value)
    .split(/\r?\n/gu)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, "").replace(/\s+/gu, " ").trim())
    .filter((line) => line.length >= 28)
    .filter((line) => !/^(?:문서명|현장명|회사명|작성일|작업일|작업명|목적|대상|장소)\s*[:：]/u.test(line));
}

function lineTokens(value) {
  return new Set(
    value.toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/gu)
      .filter((token) => token.length >= 2)
  );
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function stripDocumentRolePrefix(value) {
  return normalizeInline(value)
    .replace(/^[⚠️\s]*/u, "")
    .replace(/^\[\d+\.\s*(.+)\]$/u, "$1")
    .replace(/^(?:작업조건\s*판단|작업조건|기상\s*및\s*작업조건|TBM\s*조건확인|TBM\s*기록조건|작업\s*전\s*조건확인|허가\s*전\s*조건확인|교육\s*전\s*조건확인|비상대응\s*조건|촬영\s*확인조건|핵심\s*위험요인|핵심\s*위험|핵심위험|가장\s*큰\s*위험|유해·위험요인|위험요인\s*\d+|현재\s*안전조치|안전조치\s*\d+|조치내용|공정|작업구간|세부작업|단계별\s*안전조치|즉시\s*조치|필수조치|작업중지\s*기준|변경관리\s*확인)\s*[:：]\s*/u, "")
    .toLocaleLowerCase();
}

function classifyExactDuplicate(line) {
  if (
    /현장\s*조건\s*미지정.{0,30}작업\s*전\s*실제\s*환경\s*확인\s*필요/u.test(line)
    || /현장\s*여건에\s*맞는\s*담당자.{0,80}전파\s*전\s*관리자가\s*확인/u.test(line)
  ) {
    return {
      reviewCategory: "generic-template-overuse",
      reviewRationale: "역할별 판단 없이 같은 일반 확인문이 여러 독립 문서에 복제됩니다."
    };
  }
  if (/^(?:필수\s*안전조치\s*반영|관련\s*조문\s*확인)\s*[:：]/u.test(line)) {
    return {
      reviewCategory: "legal-reference-consistency",
      reviewRationale: "법령·필수조치 근거가 독립 문서 사이에서 반복됩니다."
    };
  }
  if (/^(?:작업조건|기상\s*및\s*작업조건)\s*[:：]/u.test(line)) {
    return {
      reviewCategory: "independent-document-context",
      reviewRationale: "각 독립 문서가 같은 현장조건을 자체적으로 식별합니다."
    };
  }
  if (/(?:확인|통제|차단|지정|작업중지|작업\s*보류|착용|분리|복창|가동)/u.test(line)) {
    return {
      reviewCategory: "cross-document-control-consistency",
      reviewRationale: "동일 통제조치가 실행·교육·기록 문서에 일관되게 반복됩니다."
    };
  }
  return {
    reviewCategory: "human-review-required",
    reviewRationale: "문서 역할상 필요한 반복인지 템플릿 과다복제인지 사람이 확인해야 합니다."
  };
}

function classifyNearDuplicate(left, right) {
  const combined = `${left.line} ${right.line}`;
  const pair = `${left.key}->${right.key}`;
  if (
    /작업조건|조건확인/u.test(combined)
    && /^workpackSummaryDraft->(?:foreignWorkerBriefing|foreignWorkerTransmission|kakaoMessage)$/u.test(pair)
  ) {
    return {
      reviewCategory: "independent-document-context",
      reviewRationale: "같은 현장조건이 요약과 작업자 전달 문서에 독립적으로 유지됩니다."
    };
  }
  if (
    /위험요인|위험\]/u.test(combined)
    && /^(?:workpackSummaryDraft->safetyEducationRecordDraft|riskAssessmentDraft->(?:tbmBriefing|tbmLogDraft|photoEvidenceDraft))$/u.test(pair)
  ) {
    return {
      reviewCategory: "cross-document-hazard-consistency",
      reviewRationale: "같은 위험요인이 평가·교육·TBM·증빙 문서에 일관되게 전달됩니다."
    };
  }
  if (
    /안전조치|조치내용|단계별\s*안전조치|즉시\s*조치|필수조치/u.test(combined)
    && /^(?:riskAssessmentDraft->workPermitDraft|workPlanDraft->(?:safetyEducationRecordDraft|kakaoMessage)|workPermitDraft->(?:foreignWorkerBriefing|foreignWorkerTransmission|kakaoMessage))$/u.test(pair)
  ) {
    return {
      reviewCategory: "cross-document-control-consistency",
      reviewRationale: "같은 통제조치가 계획·허가·교육·전달 문서에 일관되게 유지됩니다."
    };
  }
  const leftLine = left.line;
  const rightLine = right.line;
  if (stripDocumentRolePrefix(leftLine) === stripDocumentRolePrefix(rightLine)) {
    return {
      reviewCategory: "document-role-prefix-variant",
      reviewRationale: "같은 사실을 문서 역할별 제목·접두어만 바꾸어 표현합니다."
    };
  }
  return {
    reviewCategory: "human-review-required",
    reviewRationale: "높은 문장 유사도가 필요한 일관성인지 과다복제인지 사람이 확인해야 합니다."
  };
}

function categoryCounts(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.reviewCategory] = (counts[finding.reviewCategory] || 0) + 1;
    return counts;
  }, {});
}

function duplicateFindings(documents) {
  const lines = documents.flatMap((document) => (
    [...new Set(splitReviewLines(document.rawText))].map((line) => ({
      key: document.key,
      line,
      normalized: line.toLocaleLowerCase()
    }))
  ));
  const exactGroups = new Map();
  for (const item of lines) {
    const group = exactGroups.get(item.normalized) || { line: item.line, documentKeys: new Set() };
    group.documentKeys.add(item.key);
    exactGroups.set(item.normalized, group);
  }
  const allExactLineOveruse = [...exactGroups.values()]
    .filter((group) => group.documentKeys.size >= 4)
    .map((group) => {
      const classification = classifyExactDuplicate(group.line);
      return {
        line: safeExcerpt(group.line, 180),
        documentKeys: [...group.documentKeys],
        ...classification,
        humanReviewRequired: true
      };
    });
  const exactLineOveruse = allExactLineOveruse.slice(0, 20);

  const nearDuplicateLineOveruse = [];
  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    const left = lines[leftIndex];
    const leftTokens = lineTokens(left.line);
    if (leftTokens.size < 5) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      const right = lines[rightIndex];
      if (left.key === right.key || left.normalized === right.normalized) continue;
      const similarity = jaccard(leftTokens, lineTokens(right.line));
      const roleNormalizedMatch = stripDocumentRolePrefix(left.line) === stripDocumentRolePrefix(right.line);
      if (similarity < 0.9 && !roleNormalizedMatch) continue;
      const classification = classifyNearDuplicate(left, right);
      nearDuplicateLineOveruse.push({
        leftDocumentKey: left.key,
        rightDocumentKey: right.key,
        similarity: Number(similarity.toFixed(3)),
        leftLine: safeExcerpt(left.line, 160),
        rightLine: safeExcerpt(right.line, 160),
        ...classification,
        humanReviewRequired: true
      });
      if (nearDuplicateLineOveruse.length >= 20) break;
    }
    if (nearDuplicateLineOveruse.length >= 20) break;
  }
  return {
    exactLineOveruse,
    allExactLineOveruse,
    nearDuplicateLineOveruse,
    duplicateReviewCategoryCounts: {
      exact: categoryCounts(allExactLineOveruse),
      near: categoryCounts(nearDuplicateLineOveruse)
    }
  };
}

function matchPatterns(value, patterns) {
  return patterns
    .filter((entry) => entry.pattern.test(value))
    .map((entry) => entry.id);
}

export function reviewEditorialPayload(payload, question, expected = {}) {
  const deliverables = payload?.deliverables && typeof payload.deliverables === "object"
    ? payload.deliverables
    : {};
  const forbiddenDocumentFragments = asArray(expected.forbiddenDocumentFragments)
    .map(text)
    .filter(Boolean);
  const documents = canonicalDocuments.map(([key, title]) => {
    const rawText = text(deliverables[key]);
    const normalizedText = normalizeInline(rawText);
    const placeholderFindings = matchPatterns(rawText, placeholderPatterns);
    const legalOverclaimFindings = matchPatterns(rawText, legalOverclaimPatterns);
    const awkwardCompositionFindings = matchPatterns(rawText, awkwardCompositionPatterns);
    const matchedForbiddenDocumentFragments = forbiddenDocumentFragments
      .filter((fragment) => normalizedText.includes(normalizeInline(fragment)));
    const evidenceDomainMismatches = evidenceDomainRules
      .filter((rule) => rule.evidencePattern.test(rawText) && !rule.scenarioIdentityPattern.test(question))
      .map((rule) => ({
        domain: rule.id,
        requiredScenarioIdentity: rule.requiredScenarioIdentity,
        scenarioIdentityMatched: false
      }));
    const failures = [];
    if (!rawText) failures.push("missingEditorialSource");
    if (placeholderFindings.length) failures.push("placeholderOrTemplateRemnant");
    if (legalOverclaimFindings.length) failures.push("legalOverclaim");
    if (awkwardCompositionFindings.length) failures.push("awkwardSentenceComposition");
    if (matchedForbiddenDocumentFragments.length) failures.push("scenarioIrrelevantContext");
    if (evidenceDomainMismatches.length) failures.push("scenarioEvidenceDomainMismatch");
    return {
      key,
      title,
      charCount: rawText.length,
      excerpt: safeExcerpt(rawText),
      placeholderFindings,
      legalOverclaimFindings,
      awkwardCompositionFindings,
      matchedForbiddenDocumentFragments,
      evidenceDomainMismatches,
      verdict: failures.length ? "RED" : "PASS",
      failures,
      rawText
    };
  });
  const duplicates = duplicateFindings(documents);
  const genericTemplateOveruseCount = duplicates.allExactLineOveruse
    .filter((finding) => finding.reviewCategory === "generic-template-overuse")
    .length;
  return {
    ok: documents.every((document) => document.verdict === "PASS") && genericTemplateOveruseCount === 0,
    reviewedDocumentCount: documents.length,
    passedDocumentCount: documents.filter((document) => document.verdict === "PASS").length,
    failedDocumentCount: documents.filter((document) => document.verdict === "RED").length,
    placeholderFindingCount: documents.reduce((sum, document) => sum + document.placeholderFindings.length, 0),
    legalOverclaimFindingCount: documents.reduce((sum, document) => sum + document.legalOverclaimFindings.length, 0),
    awkwardCompositionFindingCount: documents.reduce((sum, document) => sum + document.awkwardCompositionFindings.length, 0),
    scenarioIrrelevantContextFindingCount: documents.reduce(
      (sum, document) => sum + document.matchedForbiddenDocumentFragments.length,
      0
    ),
    evidenceDomainMismatchCount: documents.reduce((sum, document) => sum + document.evidenceDomainMismatches.length, 0),
    exactLineOveruseCount: duplicates.allExactLineOveruse.length,
    displayedExactLineOveruseCount: duplicates.exactLineOveruse.length,
    nearDuplicateLineOveruseCount: duplicates.nearDuplicateLineOveruse.length,
    genericTemplateOveruseCount,
    duplicateReviewCategoryCounts: duplicates.duplicateReviewCategoryCounts,
    exactLineOveruse: duplicates.exactLineOveruse,
    nearDuplicateLineOveruse: duplicates.nearDuplicateLineOveruse,
    documents: documents.map(({ rawText, ...document }) => document)
  };
}

async function fetchPayload(testCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/gu, "")}/api/ask`, {
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
    const response = await fetch(`${baseUrl.replace(/\/+$/gu, "")}/api/build-info?codexCacheBust=editorial-review`);
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
    `| ${testCase.id} | ${document.key} | ${document.excerpt.replaceAll("|", "\\|")} | ${document.placeholderFindings.join(", ") || "-"} | ${document.legalOverclaimFindings.join(", ") || "-"} | ${document.awkwardCompositionFindings.join(", ") || "-"} | ${document.matchedForbiddenDocumentFragments.join(", ") || "-"} | ${document.evidenceDomainMismatches.map((finding) => finding.domain).join(", ") || "-"} | ${document.verdict} |`
  ))).join("\n");
  const markdown = `# Live 12-Deliverable Editorial Contract Review

- Verdict: \`${report.verdict}\`
- Mode: \`${report.mode}\`
- Base URL: \`${report.baseUrl || "fixture"}\`
- Source HEAD: \`${report.sourceHead || "unavailable"}\`
- Production commit: \`${report.productionBuild?.commitSha || "not measured"}\`
- Cases: ${report.total}, pass ${report.pass}, fail ${report.fail}
- Reviewed documents: ${report.reviewedDocumentSurfaceCount}
- Placeholder/template findings: ${report.placeholderFindingCount}
- Legal overclaim findings: ${report.legalOverclaimFindingCount}
- Awkward composition findings: ${report.awkwardCompositionFindingCount}
- Scenario-irrelevant context findings: ${report.scenarioIrrelevantContextFindingCount}
- Scenario/evidence domain mismatches: ${report.evidenceDomainMismatchCount}
- Exact repeated-line groups: ${report.exactLineOveruseCount} (review finding)
- Near-duplicate line pairs: ${report.nearDuplicateLineOveruseCount} (review finding)
- Generic template overuse groups: ${report.genericTemplateOveruseCount} (fail closed)
- Duplicate review categories: \`${JSON.stringify(report.duplicateReviewCategoryCounts)}\`
- Human review completed: \`false\`
- DB mutation performed: \`false\`
- Share session created: \`false\`
- Provider dispatch called: \`false\`
- Exact saved Share reproduced: \`false\`

| Case | Deliverable | Reviewer excerpt | Placeholder | Legal overclaim | Awkward composition | Scenario-irrelevant context | Evidence mismatch | Verdict |
|---|---|---|---|---|---|---|---|---|
${rows}

## Contract

- Every case and all 12 canonical deliverables expose a reviewer-readable excerpt from the raw API text.
- Placeholder or template remnants, legal-duty replacement claims, awkward action/question splices, manifest-declared scenario-irrelevant context, and scenario/evidence domain mismatches fail closed.
- Generic fallback or disclaimer lines copied across four or more independent documents fail closed.
- Exact and near-duplicate lines are recorded as reviewer findings. They do not fail automatically because bounded operational controls may intentionally repeat across documents.
- Supporting nine documents use the same automated editorial failure budget as the core three; UI visibility is a separate layout contract.

## Boundary

This is an automated editorial contract and reviewer-ready evidence, not completed human review. It does not combine the six-core wording gate with the 12-deliverable presence gate into a human wording PASS. It does not mutate the database, create a Share session, call a provider, or prove an exact saved \`/share/[sessionId]\` user session.
`;
  fs.writeFileSync(path.join(outDir, "report.md"), markdown, "utf8");
}

async function main() {
  const matrix = readJson(casesPath);
  const cases = buildCases(matrix);
  const fixtures = payloadsPath ? readJson(payloadsPath) : {};
  if (!liveEnabled && !payloadsPath) {
    throw new Error("set SAFECLAW_EDITORIAL_LIVE=1 or provide SAFECLAW_EDITORIAL_PAYLOADS_PATH");
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
    const review = reviewEditorialPayload(payload, testCase.question, testCase.expected);
    const ok = !runnerError && (!api || api.ok) && review.ok;
    results.push({
      id: testCase.id,
      verdict: ok ? "PASS" : "RED",
      elapsedMs: Date.now() - caseStartedAt,
      api,
      runnerError,
      ...review
    });
  }

  const pass = results.filter((item) => item.verdict === "PASS").length;
  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    verdict: pass === results.length
      ? liveEnabled
        ? localProduction
          ? "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
          : "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
        : "PASS_FIXTURE_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
      : liveEnabled
        ? localProduction
          ? "RED_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT"
          : "RED_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT"
        : "RED_FIXTURE_12_DELIVERABLE_EDITORIAL_CONTRACT",
    mode: liveEnabled ? localProduction ? "current-source-local-production" : "live-production" : "fixture",
    baseUrl: liveEnabled ? baseUrl : null,
    sourceHead,
    productionBuild,
    total: results.length,
    pass,
    fail: results.length - pass,
    canonicalDocumentCount: canonicalDocuments.length,
    reviewedDocumentSurfaceCount: results.reduce((sum, item) => sum + item.reviewedDocumentCount, 0),
    placeholderFindingCount: results.reduce((sum, item) => sum + item.placeholderFindingCount, 0),
    legalOverclaimFindingCount: results.reduce((sum, item) => sum + item.legalOverclaimFindingCount, 0),
    awkwardCompositionFindingCount: results.reduce((sum, item) => sum + item.awkwardCompositionFindingCount, 0),
    scenarioIrrelevantContextFindingCount: results.reduce(
      (sum, item) => sum + item.scenarioIrrelevantContextFindingCount,
      0
    ),
    evidenceDomainMismatchCount: results.reduce((sum, item) => sum + item.evidenceDomainMismatchCount, 0),
    exactLineOveruseCount: results.reduce((sum, item) => sum + item.exactLineOveruseCount, 0),
    displayedExactLineOveruseCount: results.reduce((sum, item) => sum + item.displayedExactLineOveruseCount, 0),
    nearDuplicateLineOveruseCount: results.reduce((sum, item) => sum + item.nearDuplicateLineOveruseCount, 0),
    genericTemplateOveruseCount: results.reduce((sum, item) => sum + item.genericTemplateOveruseCount, 0),
    duplicateReviewCategoryCounts: results.reduce((summary, item) => {
      for (const [scope, counts] of Object.entries(item.duplicateReviewCategoryCounts)) {
        for (const [category, count] of Object.entries(counts)) {
          summary[scope][category] = (summary[scope][category] || 0) + count;
        }
      }
      return summary;
    }, { exact: {}, near: {} }),
    humanReviewCompleted: false,
    mutationBoundary: {
      dbMutationPerformed: false,
      shareSessionCreated: false,
      providerDispatchCalled: false,
      exactSavedShareReproduced: false
    },
    evidenceBoundary: {
      sixCoreWordingGateCombinedAsHumanPass: false,
      twelveDeliverablePresenceGateCombinedAsHumanPass: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE"
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
    reviewedDocumentSurfaceCount: report.reviewedDocumentSurfaceCount,
    outDir: path.relative(process.cwd(), outDir)
  }, null, 2));
  process.exitCode = report.fail === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
