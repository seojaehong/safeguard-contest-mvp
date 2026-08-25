#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEFAULT_CASES_PATH = path.join(process.cwd(), "scripts", "knowledge_candidate_content_matrix_cases.json");
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "evaluation", "llm-wiki-candidate-content-matrix-2026-08-25");

function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readString(value) {
  return typeof value === "string" ? value : "";
}

function includesAny(text, terms) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(readString(term).toLowerCase()));
}

function compactExcerpt(text, limit = 720) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function evaluateCandidateMatrixPayload(testCase, responseStatus, payload, options = {}) {
  const record = asRecord(payload);
  const candidate = asRecord(record.candidate);
  const reviewContract = asRecord(record.reviewContract);
  const readiness = asRecord(record.contentReadiness);
  const generatedText = readString(candidate.generatedText);
  const generated = asRecord(record.generated);
  const generationMode = options.generationMode === "deterministic" ? "deterministic" : "provider";
  const matchedHazardIds = asArray(candidate.matchedHazardIds).filter((value) => typeof value === "string");
  const requiredAnyGroups = asArray(testCase.requiredAnyGroups).map((group) => asArray(group));
  const missingTermGroups = requiredAnyGroups
    .filter((group) => !includesAny(generatedText, group))
    .map((group) => group.map(readString));
  const missingHazardIds = asArray(testCase.expectedHazardIds)
    .filter((hazardId) => !matchedHazardIds.includes(readString(hazardId)));
  const failures = [
    ...(responseStatus !== 200 ? [`http_status:${responseStatus}`] : []),
    ...(record.ok !== true ? ["response_not_ok"] : []),
    ...(generationMode === "provider" && record.configured !== true ? ["provider_not_configured"] : []),
    ...(generationMode === "provider" && candidate.generatedBy !== "hermes_or_llm" ? ["provider_generation_not_used"] : []),
    ...(generationMode === "deterministic" && candidate.generatedBy !== "safeclaw_candidate_builder" ? ["deterministic_builder_not_used"] : []),
    ...(generationMode === "deterministic" && generated.fallbackUsed !== true ? ["deterministic_fallback_not_reported"] : []),
    ...(record.storageMode !== "stateless_candidate" ? ["storage_not_stateless"] : []),
    ...(record.savedRunId !== null ? ["saved_run_created"] : []),
    ...(candidate.contractVersion !== "knowledge-candidate.v2" ? ["candidate_contract_mismatch"] : []),
    ...(candidate.reviewStatus !== "pending_review" ? ["candidate_not_pending_review"] : []),
    ...(candidate.publicationState !== "unpublished" ? ["candidate_publication_state_changed"] : []),
    ...(candidate.dbMutationAllowed !== false || candidate.dbMutationPerformed !== false ? ["candidate_db_mutation_boundary_failed"] : []),
    ...(candidate.publishAllowed !== false ? ["candidate_publish_allowed"] : []),
    ...(reviewContract.status !== "human_review_required" ? ["human_review_not_required"] : []),
    ...(reviewContract.machineEvidenceReplacesHumanReview !== false ? ["machine_evidence_replaces_human_review"] : []),
    ...(reviewContract.dbMutationAllowed !== false || reviewContract.publishAllowed !== false ? ["review_contract_mutation_boundary_failed"] : []),
    ...(readiness.contractVersion !== "knowledge-candidate-content-readiness.v1" ? ["readiness_contract_mismatch"] : []),
    ...(readiness.status !== "ready_for_human_review" ? [`readiness:${readString(readiness.status) || "missing"}`] : []),
    ...(readiness.requiredSectionCount !== 4 || readiness.presentSectionCount !== 4 || readiness.nonEmptySectionCount !== 4 ? ["required_sections_incomplete"] : []),
    ...(readiness.placeholderFindingCount !== 0 ? ["placeholder_content"] : []),
    ...(readiness.legalOverclaimFindingCount !== 0 ? ["legal_overclaim"] : []),
    ...(readiness.lawProvenancePresent !== true ? ["law_provenance_missing"] : []),
    ...(readiness.hazardGroundingPresent !== true ? ["hazard_grounding_missing"] : []),
    ...(asArray(readiness.unresolvedReviewItems).length > 0 ? ["unresolved_review_items"] : []),
    ...(readiness.humanReviewCompleted !== false ? ["human_review_overclaimed"] : []),
    ...(readiness.publicationState !== "unpublished" || readiness.publishAllowed !== false ? ["readiness_publication_boundary_failed"] : []),
    ...missingHazardIds.map((hazardId) => `missing_hazard:${hazardId}`),
    ...missingTermGroups.map((group) => `missing_term_group:${group.join("|")}`)
  ];

  return {
    id: readString(testCase.id),
    ok: failures.length === 0,
    responseStatus,
    failures,
    missingHazardIds,
    missingTermGroups,
    matchedHazardIds,
    generatedTextLength: generatedText.length,
    generatedTextExcerpt: compactExcerpt(generatedText),
    readiness: {
      status: readiness.status ?? null,
      requiredSectionCount: readiness.requiredSectionCount ?? null,
      presentSectionCount: readiness.presentSectionCount ?? null,
      nonEmptySectionCount: readiness.nonEmptySectionCount ?? null,
      placeholderFindingCount: readiness.placeholderFindingCount ?? null,
      legalOverclaimFindingCount: readiness.legalOverclaimFindingCount ?? null,
      statutoryClaimDetected: readiness.statutoryClaimDetected ?? null,
      lawProvenancePresent: readiness.lawProvenancePresent ?? null,
      hazardGroundingPresent: readiness.hazardGroundingPresent ?? null,
      unresolvedReviewItems: asArray(readiness.unresolvedReviewItems)
    },
    boundary: {
      storageMode: record.storageMode ?? null,
      savedRunId: record.savedRunId ?? null,
      publicationState: candidate.publicationState ?? null,
      dbMutationAllowed: candidate.dbMutationAllowed ?? null,
      dbMutationPerformed: candidate.dbMutationPerformed ?? null,
      publishAllowed: candidate.publishAllowed ?? null,
      humanReviewRequired: reviewContract.humanReviewRequired ?? null,
      machineEvidenceReplacesHumanReview: reviewContract.machineEvidenceReplacesHumanReview ?? null
    },
    generation: {
      mode: generationMode,
      configured: record.configured ?? null,
      generatedBy: candidate.generatedBy ?? null,
      fallbackUsed: generated.fallbackUsed ?? null,
      providerLabel: generated.providerLabel ?? null
    }
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fetchJson(url, init, timeoutMs) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

function currentHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function markdownFor(report) {
  const rows = report.results.map((result) => (
    `| ${result.id} | ${result.responseStatus} | ${result.matchedHazardIds.join(", ")} | ${result.readiness.presentSectionCount}/4 | ${result.failures.join("; ") || "none"} | ${result.ok ? "PASS" : "RED"} |`
  )).join("\n");
  return `# LLM Wiki Candidate Content Matrix\n\n- Verdict: \`${report.verdict}\`\n- Mode: \`${report.mode}\`\n- Generation mode: \`${report.generationMode}\`\n- Base URL: \`${report.baseUrl}\`\n- Source head: \`${report.sourceHead}\`\n- Production commit: \`${report.productionBuild.commitSha ?? "not-live"}\`\n- Cases: ${report.passedCount}/${report.totalCount} PASS\n\n| Scenario | HTTP | Matched hazards | Sections | Failures | Verdict |\n| --- | ---: | --- | ---: | --- | --- |\n${rows}\n\n## Contract\n\n- Each scenario uses the deployed stateless \`/api/knowledge/regenerate\` path.\n- Deterministic mode proves the built-in safety-knowledge fallback; provider mode separately proves enhanced LLM generation when runtime admission is available.\n- The response must expose the server-derived four-section content-readiness contract.\n- Scenario hazard IDs and scenario-specific term groups must remain grounded in generated text.\n- Placeholder text, legal overclaim, missing law provenance, and missing hazard grounding fail closed.\n- All candidates remain unpublished and require human review.\n\n## Boundary\n\n- This matrix does not read the actual production candidate queue.\n- No DB write, Wiki publication, provider dispatch, Share-session creation, embedding/vector mutation, or KOSHA registry mutation is performed.\n- Exact saved Share remains \`MISSING_EVIDENCE\`.\n- LLM Wiki publication and Supabase RLS isolation remain \`APPROVAL_GATED\`.\n`;
}

export async function runKnowledgeCandidateContentMatrix(options = {}) {
  const checkedAt = new Date().toISOString();
  const baseUrl = options.baseUrl ?? process.env.SAFECLAW_KNOWLEDGE_MATRIX_BASE_URL ?? "http://127.0.0.1:3000";
  const casesPath = path.resolve(options.casesPath ?? process.env.SAFECLAW_KNOWLEDGE_MATRIX_CASES ?? DEFAULT_CASES_PATH);
  const outputDir = path.resolve(options.outputDir ?? process.env.SAFECLAW_KNOWLEDGE_MATRIX_OUTPUT ?? DEFAULT_OUTPUT_DIR);
  const timeoutMs = Number.parseInt(String(options.timeoutMs ?? process.env.SAFECLAW_KNOWLEDGE_MATRIX_TIMEOUT_MS ?? "90000"), 10);
  const generationMode = options.generationMode ?? process.env.SAFECLAW_KNOWLEDGE_MATRIX_GENERATION_MODE ?? "deterministic";
  if (generationMode !== "deterministic" && generationMode !== "provider") {
    throw new Error("SAFECLAW_KNOWLEDGE_MATRIX_GENERATION_MODE must be deterministic or provider");
  }
  const liveMode = /^https:\/\/www\.safeclaw\.kr(?:\/|$)/u.test(baseUrl);
  const sourceHead = currentHead();
  const matrix = await readJson(casesPath);
  const cases = asArray(matrix.cases);
  const productionBuild = liveMode
    ? await fetchJson(`${baseUrl}/api/build-info?codexCacheBust=${encodeURIComponent(checkedAt)}`, {}, timeoutMs)
        .then(({ status, payload }) => ({ status, ...asRecord(payload) }))
        .catch((error) => ({ status: null, ok: false, error: error instanceof Error ? error.message : String(error) }))
    : { status: null, ok: false, commitSha: null, branch: null, environment: "local", deploymentUrl: null };
  const results = [];

  for (const testCase of cases) {
    try {
      const response = await fetchJson(`${baseUrl}/api/knowledge/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: testCase.question,
          generate: generationMode === "provider",
          limit: 4,
          tenantContext: {
            organizationId: "matrix-no-mutation-org",
            siteId: `matrix-${testCase.id}`
          },
          rawEvents: [testCase.rawEvent]
        })
      }, timeoutMs);
      results.push(evaluateCandidateMatrixPayload(testCase, response.status, response.payload, { generationMode }));
    } catch (error) {
      results.push({
        id: readString(testCase.id),
        ok: false,
        responseStatus: null,
        failures: [`request_error:${error instanceof Error ? error.message : String(error)}`],
        missingHazardIds: asArray(testCase.expectedHazardIds),
        missingTermGroups: asArray(testCase.requiredAnyGroups),
        matchedHazardIds: [],
        generatedTextLength: 0,
        generatedTextExcerpt: "",
        readiness: {},
        boundary: {}
      });
    }
  }

  const failedCount = results.filter((result) => !result.ok).length;
  const productionAligned = liveMode
    && productionBuild.ok === true
    && productionBuild.commitSha === sourceHead
    && productionBuild.branch === "master"
    && productionBuild.environment === "production";
  const verdict = failedCount === 0
    ? liveMode && productionAligned
      ? "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX"
      : liveMode
        ? "PASS_LIVE_CONTENT_MATRIX_SOURCE_ALIGNMENT_PENDING"
        : "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_MATRIX"
    : liveMode
      ? "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX"
      : "RED_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_MATRIX";
  const report = {
    schemaVersion: "safeclaw-llm-wiki-candidate-content-matrix/v1",
    verdict,
    checkedAt,
    mode: liveMode ? "live-production" : "current-source-local-production",
    generationMode,
    baseUrl,
    sourceHead,
    productionBuild,
    productionAligned,
    totalCount: results.length,
    passedCount: results.length - failedCount,
    failedCount,
    requiredSectionCount: 4,
    scenarioCandidateBuildExecuted: results.length,
    llmGenerationAttempted: generationMode === "provider",
    actualProductionCandidateQueueRead: false,
    routeControlledBrowserFixtureIsNotActualProductionQueue: true,
    humanReviewCompleted: false,
    publicationState: "unpublished",
    publishAllowed: false,
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      ontologyPublicationPerformed: false,
      vectorOrEmbeddingMutationPerformed: false,
      koshaRegistryMutationPerformed: false
    },
    remainingBoundaries: {
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      llmWikiPublication: "APPROVAL_GATED",
      supabaseRlsLaunchIsolation: "APPROVAL_GATED"
    },
    results
  };
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDir, "report.md"), markdownFor(report), "utf8");
  return report;
}

async function main() {
  const report = await runKnowledgeCandidateContentMatrix();
  process.stdout.write(`${JSON.stringify({ verdict: report.verdict, passed: report.passedCount, failed: report.failedCount })}\n`);
  if (report.failedCount > 0 || (report.mode === "live-production" && !report.productionAligned)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
