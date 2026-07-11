import { createHash } from "node:crypto";

import {
  buildSafetyReferenceOperationalMetadata,
  deriveSafetyReferenceOperationalView,
  filterAndRankSafetyReferencesByQuery,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";
import {
  buildDbHarnessAnswer,
  buildDbHarnessPacket,
  buildHarnessPromptContext
} from "@/lib/db-harness";

export const KOSHA_GUIDE_SOURCE_ID = "kosha-technical-support-regulations-2025";
export const KOSHA_GUIDE_OFFICIAL_DOWNLOAD_BASE = "https://portal.kosha.or.kr/openapi/v1/file/down";
export const KOSHA_AUDIT_REQUEST_TIMEOUT_MS = 20_000;
export const KOSHA_AUDIT_REQUEST_RETRIES = 1;

export type KoshaJsonResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
};

export type KoshaJsonFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<KoshaJsonResponse>;

export type KoshaJsonFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: KoshaJsonFetch;
};

export async function fetchKoshaJsonWithRetry(
  input: string | URL,
  init: RequestInit,
  label: string,
  options: KoshaJsonFetchOptions = {}
): Promise<{ response: KoshaJsonResponse; payload: unknown; attemptCount: number }> {
  const timeoutMs = options.timeoutMs ?? KOSHA_AUDIT_REQUEST_TIMEOUT_MS;
  const retries = options.retries ?? KOSHA_AUDIT_REQUEST_RETRIES;
  const fetchImpl: KoshaJsonFetch = options.fetchImpl || ((fetchInput, fetchInit) => fetch(fetchInput, fetchInit));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`${label} returned HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      return { response, payload, attemptCount: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new Error(`${label} failed after ${retries + 1} attempts: ${reason}`);
}

export type KoshaGuideItemType = "technical-guideline" | "technical-support-regulation";

export type KoshaArchiveEntry = {
  zipFile: string;
  internalPath: string;
  crc32: string;
  compressedSize: number;
  fileSize: number;
  itemType: KoshaGuideItemType;
};

export type KoshaArchiveInventory = {
  archiveCount: number;
  archiveNames: string[];
  pdfEntryCount: number;
  itemTypes: Record<KoshaGuideItemType, number>;
  entryManifestSha256: string;
  emptyPdfEntryCount: number;
  duplicateInternalPathGroups: number;
  duplicateContentCandidateGroups: number;
  duplicateContentCandidateRows: number;
  missingVersionCodeCount: number;
};

export type KoshaSupabaseVisibleExpectation = {
  sourceId: string;
  rowCount: number;
  itemTypes: Record<KoshaGuideItemType, number>;
  canonicalRowSha256?: string | null;
};

export type KoshaGuideAuditManifest = {
  version: 1;
  measuredAt: string;
  localArchive: Pick<
    KoshaArchiveInventory,
    "archiveCount" | "pdfEntryCount" | "entryManifestSha256" | "itemTypes"
  >;
  supabaseVisible: KoshaSupabaseVisibleExpectation;
  officialSnapshot?: KoshaOfficialSnapshotExpectation;
};

export type KoshaOfficialSnapshotExpectation = {
  currentCount: number;
  currentCanonicalSha256: string;
  retiredCount: number;
  retiredCanonicalSha256: string;
};

export type KoshaAuditCheck = {
  id: string;
  status: "pass" | "fail" | "boundary";
  count: number;
  detail: string;
};

export type KoshaOfficialGuideRecord = {
  code: string;
  stableKey: string;
  title: string;
  category: string;
  field: string;
  status: string;
  publishedAt: string | null;
  fileId: string | null;
  fileSeq: number | null;
};

export type KoshaGuideRowAudit = {
  rowCount: number;
  sourceIds: string[];
  itemTypes: Record<string, number>;
  emptyBodyCount: number;
  emptySummaryCount: number;
  emptyControlsCount: number;
  duplicateIdGroups: number;
  duplicateTitleGroups: number;
  duplicateSummaryGroups: number;
  duplicateSummaryRows: number;
  templatedFallbackSummaryGroups: number;
  templatedFallbackSummaryRows: number;
  nonTemplateDuplicateSummaryGroups: number;
  nonTemplateDuplicateSummaryRows: number;
  duplicateSummaryDetails: Array<{
    summary: string;
    rowCount: number;
    sampleIds: string[];
    templateFallback: boolean;
    nonEmptyBodyRows: number;
  }>;
  exactBodyDuplicateCandidateGroups: number;
  exactBodyDuplicateCandidateRows: number;
  missingSourceUrlCount: number;
  missingOfficialFileIdCount: number;
  missingOfficialPublishedAtCount: number;
  missingOfficialStatusCount: number;
  missingVersionCodeCount: number;
  rawTagStandaloneControlLeakCount: number;
  rawInitialControlContaminationCount: number;
  rawControlContaminationCount: number;
  rawControlGroundTruthClearedCount: number;
  rawControlReviewRequiredCount: number;
  rawControlHeuristicDeltaFlagCount: number;
  operationalInitialControlContaminationCount: number;
  operationalControlContaminationCount: number;
  operationalControlGroundTruthClearedCount: number;
  operationalControlReviewRequiredCount: number;
  operationalControlHeuristicDeltaFlagCount: number;
  sourceMutationCount: number;
  rawInitialControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  rawControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  operationalInitialControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  operationalControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  rawControlGroundTruthClearedRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
  }>;
  rawControlReviewRequiredRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
    unlabelledFlags: string[];
  }>;
  operationalControlGroundTruthClearedRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
  }>;
  operationalControlReviewRequiredRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
    unlabelledFlags: string[];
  }>;
};

export type KoshaControlGroundTruthLabels = Record<
  string,
  Record<string, "false-positive" | "confirmed-contamination">
>;

export type KoshaRetrievalScenario = {
  id: string;
  query: string;
  expectedCodes: string[];
  requiredControlTerms: string[];
  forbiddenTerms: string[];
};

export type KoshaRetrievalBranch = NonNullable<SafetyReferenceItem["retrieval_source"]>;

export type KoshaRetrievalScenarioAudit = {
  scenarioId: string;
  branch: KoshaRetrievalBranch;
  executionStatus: "tested" | "untested";
  selectedIds: string[];
  selectedTitles: string[];
  retrievalSources: KoshaRetrievalBranch[];
  promptContext: string;
  answer: string;
  documentReflections: Array<{
    code: string | null;
    title: string;
    documents: string[];
    label: string;
  }>;
  failures: string[];
};

export type KoshaVisibleStatus = KoshaSupabaseVisibleExpectation & {
  ok: true;
  configured: true;
  catalogStatus: string;
  totalSources: number;
  totalItems: number;
  sampleCount: number;
  fullRowSnapshotAvailable: false;
  canonicalRowSha256: null;
};

export const KOSHA_GUIDE_REFRESH_PLAN = {
  mode: "read-only-plan",
  mutationPerformed: false,
  checkpointField: "publishedAt",
  shardKeys: ["category", "status", "page"],
  emptyResponsePolicy: "reject-empty-page-and-empty-file-provenance",
  reconciliation: "full-stable-key-current-vs-retired",
  stableDocumentKey: "normalized-guide-code-without-year",
  versionKey: "normalized-full-guide-code",
  contentKey: "sha256-official-pdf-bytes",
  retry: {
    timeoutMs: 20_000,
    retries: 1
  },
  dryRunDiffs: ["insert", "update", "retire", "unchanged"],
  approvalRequiredBeforeMutation: true
} as const;

function codepointCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function decodeQuality(value: string): number {
  const hangulCount = value.match(/[가-힣]/gu)?.length || 0;
  const replacementCount = value.match(/�/gu)?.length || 0;
  return hangulCount * 4 - replacementCount * 20;
}

export function decodeKoshaArchiveEntryName(rawName: Uint8Array): string {
  const candidates = ["utf-8", "euc-kr"].map((encoding) => new TextDecoder(encoding).decode(rawName));
  return candidates
    .sort((left, right) => decodeQuality(right) - decodeQuality(left))[0]
    .replaceAll("\\", "/");
}

function countValues(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => codepointCompare(left, right)));
}

function duplicateGroups(values: string[]): { groups: number; rows: number } {
  const counts = Object.values(countValues(values.filter(Boolean))).filter((count) => count > 1);
  return {
    groups: counts.length,
    rows: counts.reduce((sum, count) => sum + count, 0)
  };
}

function itemTypeCounts(values: KoshaGuideItemType[]): Record<KoshaGuideItemType, number> {
  const counts = countValues(values);
  return {
    "technical-guideline": counts["technical-guideline"] || 0,
    "technical-support-regulation": counts["technical-support-regulation"] || 0
  };
}

function canonicalArchiveEntries(entries: KoshaArchiveEntry[]): KoshaArchiveEntry[] {
  return entries
    .map((entry) => ({ ...entry, internalPath: entry.internalPath.replaceAll("\\", "/") }))
    .sort((left, right) =>
      codepointCompare(left.zipFile, right.zipFile) || codepointCompare(left.internalPath, right.internalPath)
    );
}

export function normalizeKoshaVersionCode(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/[–—−]/gu, "-")
    .replace(/-\s+/gu, "-");
  const match = normalized.match(/^([A-Z](?:-[A-Z])?-\d+(?:-\d{4})?)(?=\b|[_\s.])/iu);
  if (!match) return null;
  return match[1]
    .toUpperCase()
    .split("-")
    .map((part) => /^\d+$/u.test(part) ? String(Number(part)) : part)
    .join("-");
}

export function toKoshaStableDocumentKey(value: string): string | null {
  const versionCode = normalizeKoshaVersionCode(value);
  if (!versionCode) return null;
  const parts = versionCode.split("-");
  if (/^\d{4}$/u.test(parts.at(-1) || "")) parts.pop();
  return parts.join("-");
}

export function buildKoshaArchiveInventory(entries: KoshaArchiveEntry[]): KoshaArchiveInventory {
  const canonical = canonicalArchiveEntries(entries);
  const internalPathDuplicates = duplicateGroups(canonical.map((entry) => entry.internalPath.toLowerCase()));
  const contentDuplicates = duplicateGroups(canonical.map((entry) => `${entry.crc32}:${entry.fileSize}`));
  const archiveNames = [...new Set(canonical.map((entry) => entry.zipFile))].sort(codepointCompare);
  return {
    archiveCount: archiveNames.length,
    archiveNames,
    pdfEntryCount: canonical.length,
    itemTypes: itemTypeCounts(canonical.map((entry) => entry.itemType)),
    entryManifestSha256: createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex"),
    emptyPdfEntryCount: canonical.filter((entry) => entry.fileSize <= 0).length,
    duplicateInternalPathGroups: internalPathDuplicates.groups,
    duplicateContentCandidateGroups: contentDuplicates.groups,
    duplicateContentCandidateRows: contentDuplicates.rows,
    missingVersionCodeCount: canonical.filter((entry) => !normalizeKoshaVersionCode(entry.internalPath)).length
  };
}

function compareItemTypes(
  actual: Record<KoshaGuideItemType, number>,
  expected: Record<KoshaGuideItemType, number>,
  prefix: string
): string[] {
  const failures: string[] = [];
  for (const itemType of ["technical-guideline", "technical-support-regulation"] as const) {
    if (actual[itemType] !== expected[itemType]) failures.push(`${prefix}-${itemType}:${actual[itemType]}`);
  }
  return failures;
}

export function listKoshaManifestGateFailures(
  actual: {
    localArchive: Pick<KoshaArchiveInventory, "archiveCount" | "pdfEntryCount" | "entryManifestSha256" | "itemTypes">;
    supabaseVisible: KoshaSupabaseVisibleExpectation | null;
    officialSnapshot?: KoshaOfficialSnapshotExpectation | null;
  },
  expected: KoshaGuideAuditManifest
): string[] {
  const failures: string[] = [];
  if (actual.localArchive.archiveCount !== expected.localArchive.archiveCount) {
    failures.push(`local-archives:${actual.localArchive.archiveCount}`);
  }
  if (actual.localArchive.pdfEntryCount !== expected.localArchive.pdfEntryCount) {
    failures.push(`local-pdf-rows:${actual.localArchive.pdfEntryCount}`);
  }
  if (actual.localArchive.entryManifestSha256 !== expected.localArchive.entryManifestSha256) {
    failures.push(`local-entry-manifest-sha256:${actual.localArchive.entryManifestSha256}`);
  }
  failures.push(...compareItemTypes(actual.localArchive.itemTypes, expected.localArchive.itemTypes, "local"));

  if (!actual.supabaseVisible) {
    failures.push("supabase-visible-unavailable");
    return failures;
  }
  if (actual.supabaseVisible.sourceId !== expected.supabaseVisible.sourceId) {
    failures.push(`supabase-visible-source:${actual.supabaseVisible.sourceId}`);
  }
  if (actual.supabaseVisible.rowCount !== expected.supabaseVisible.rowCount) {
    failures.push(`supabase-visible-rows:${actual.supabaseVisible.rowCount}`);
  }
  failures.push(...compareItemTypes(actual.supabaseVisible.itemTypes, expected.supabaseVisible.itemTypes, "supabase-visible"));
  if (
    expected.supabaseVisible.canonicalRowSha256 &&
    actual.supabaseVisible.canonicalRowSha256 !== expected.supabaseVisible.canonicalRowSha256
  ) {
    failures.push(`supabase-visible-row-sha256:${actual.supabaseVisible.canonicalRowSha256 || "unavailable"}`);
  }
  if (expected.officialSnapshot) {
    if (!actual.officialSnapshot) {
      failures.push("official-snapshot-unavailable");
    } else {
      if (actual.officialSnapshot.currentCount !== expected.officialSnapshot.currentCount) {
        failures.push(`official-current-rows:${actual.officialSnapshot.currentCount}`);
      }
      if (actual.officialSnapshot.currentCanonicalSha256 !== expected.officialSnapshot.currentCanonicalSha256) {
        failures.push(`official-current-sha256:${actual.officialSnapshot.currentCanonicalSha256}`);
      }
      if (actual.officialSnapshot.retiredCount !== expected.officialSnapshot.retiredCount) {
        failures.push(`official-retired-rows:${actual.officialSnapshot.retiredCount}`);
      }
      if (actual.officialSnapshot.retiredCanonicalSha256 !== expected.officialSnapshot.retiredCanonicalSha256) {
        failures.push(`official-retired-sha256:${actual.officialSnapshot.retiredCanonicalSha256}`);
      }
    }
  }
  return failures;
}

export function summarizeKoshaAuditChecks(checks: KoshaAuditCheck[]) {
  const failed = checks.filter((check) => check.status === "fail");
  const boundaries = checks.filter((check) => check.status === "boundary");
  return {
    checkCount: checks.length,
    passedCheckCount: checks.filter((check) => check.status === "pass").length,
    failedCheckCount: failed.length,
    boundaryCheckCount: boundaries.length,
    failures: failed.map((check) => `${check.id}:${check.count}`),
    boundaries: boundaries.map((check) => `${check.id}:${check.count}`)
  };
}

function payloadValue(payload: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!payload) return undefined;
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") return payload[key];
  }
  return undefined;
}

function controlContaminationFlags(
  item: SafetyReferenceItem,
  controls: string[],
  calibration: "initial" | "calibrated"
): string[] {
  const identity = normalizeWhitespace([
    item.title,
    item.summary,
    item.body || "",
    item.category || "",
    item.subcategory || "",
    ...item.keywords,
    ...item.risk_tags
  ].join(" "));
  const controlText = normalizeWhitespace(controls.join(" "));
  const flags: string[] = [];

  const machineryIdentity = /기계|설비|정비|가동부|회전체|프레스|컨베이어|드릴|크레인|지게차|전로|전기작업|정전전로|충전전로/u.test(identity);
  if (!machineryIdentity && /가동부|방호덮개|비상정지/u.test(controlText)) flags.push("machinery-control-cross-task");

  const transportIdentity = calibration === "calibrated"
    ? /지게차|운반|운송|하역|수거|창고|차량|자동차|리프트|주차장치|물류|이송/u.test(identity)
    : /지게차/u.test(identity);
  if (!transportIdentity && /지게차|보행자 동선과 장비 동선|후진 경보/u.test(controlText)) {
    flags.push("forklift-control-cross-task");
  }

  const confinedIdentity = calibration === "calibrated"
    ? /밀폐공간|산소결핍|유해가스|가스|탱크|맨홀|피트|질식|잠수|기압|호흡기체|불활성|산소|환기|노출|중독|응급대응/u.test(identity)
    : /밀폐공간|산소결핍|유해가스|탱크|맨홀|피트|질식/u.test(identity);
  if (!confinedIdentity && /산소·?유해가스|감시인 배치|구조장비/u.test(controlText)) {
    flags.push("confined-space-control-cross-task");
  }

  const fallIdentity = calibration === "calibrated"
    ? /추락|비계|작업발판|고소|외벽|사다리|개구부|지붕|달비계|낙하|떨어짐|승강/u.test(identity)
    : /추락|비계|작업발판|고소|외벽|사다리|개구부/u.test(identity);
  if (!fallIdentity && /작업발판|안전난간|안전대 체결|개구부/u.test(controlText)) {
    flags.push("fall-control-cross-task");
  }

  const fireChemicalIdentity = calibration === "calibrated"
    ? /화재|폭발|도장|도료|유기용제|화학|인화성|가연성|정전기|물질|노출|독성|MSDS|물질안전보건자료|작업환경|중독|세척|세정|미화/u.test(identity)
    : /화재|폭발|도장|도료|유기용제|화학|인화성|가연성|정전기/u.test(identity);
  if (!fireChemicalIdentity && /MSDS|점화원|방폭|유기용제|도료/u.test(controlText)) {
    flags.push("fire-chemical-control-cross-task");
  }

  return flags;
}

function isTemplatedFallbackSummary(summary: string): boolean {
  return /^.+ 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다\.$/u.test(summary);
}

export function auditKoshaGuideRows(
  rows: Array<SafetyReferenceItem & { payload?: Record<string, unknown> }>,
  groundTruthLabels: KoshaControlGroundTruthLabels = {}
): KoshaGuideRowAudit {
  const duplicateIds = duplicateGroups(rows.map((row) => row.id));
  const duplicateTitles = duplicateGroups(rows.map((row) => normalizeWhitespace(row.title).toLowerCase()));
  const duplicateSummaries = duplicateGroups(rows.map((row) => normalizeWhitespace(row.summary)));
  const duplicateBodies = duplicateGroups(
    rows.map((row) => normalizeWhitespace(row.body || "")).filter(Boolean)
  );
  const summaryRows = new Map<string, typeof rows>();
  for (const row of rows) {
    const summary = normalizeWhitespace(row.summary);
    if (!summary) continue;
    const group = summaryRows.get(summary) || [];
    group.push(row);
    summaryRows.set(summary, group);
  }
  const duplicateSummaryDetails = [...summaryRows.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([summary, groupedRows]) => ({
      summary,
      rowCount: groupedRows.length,
      sampleIds: groupedRows.map((row) => row.id).sort(codepointCompare).slice(0, 3),
      templateFallback: isTemplatedFallbackSummary(summary),
      nonEmptyBodyRows: groupedRows.filter((row) => normalizeWhitespace(row.body || "")).length
    }))
    .sort((left, right) => right.rowCount - left.rowCount || codepointCompare(left.summary, right.summary));
  const templatedFallbackSummaries = duplicateSummaryDetails.filter((detail) => detail.templateFallback);
  const nonTemplateDuplicateSummaries = duplicateSummaryDetails.filter((detail) => !detail.templateFallback);
  const rawInitialControlContaminationRows: KoshaGuideRowAudit["rawInitialControlContaminationRows"] = [];
  const rawControlContaminationRows: KoshaGuideRowAudit["rawControlContaminationRows"] = [];
  const operationalInitialControlContaminationRows: KoshaGuideRowAudit["operationalInitialControlContaminationRows"] = [];
  const operationalControlContaminationRows: KoshaGuideRowAudit["operationalControlContaminationRows"] = [];
  const rawControlGroundTruthClearedRows: KoshaGuideRowAudit["rawControlGroundTruthClearedRows"] = [];
  const rawControlReviewRequiredRows: KoshaGuideRowAudit["rawControlReviewRequiredRows"] = [];
  const operationalControlGroundTruthClearedRows: KoshaGuideRowAudit["operationalControlGroundTruthClearedRows"] = [];
  const operationalControlReviewRequiredRows: KoshaGuideRowAudit["operationalControlReviewRequiredRows"] = [];
  let sourceMutationCount = 0;
  let rawTagStandaloneControlLeakCount = 0;
  let rawControlHeuristicDeltaFlagCount = 0;
  let operationalControlHeuristicDeltaFlagCount = 0;

  for (const row of rows) {
    const before = JSON.stringify(row);
    const rawInitialFlags = controlContaminationFlags(row, row.controls, "initial");
    const rawFlags = controlContaminationFlags(row, row.controls, "calibrated");
    const rawRemovedFlags = rawInitialFlags.filter((flag) => !rawFlags.includes(flag));
    rawControlHeuristicDeltaFlagCount += rawRemovedFlags.length;
    if (rawInitialFlags.length) {
      rawInitialControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: rawInitialFlags,
        controls: [...row.controls]
      });
    }
    if (rawFlags.length) {
      rawControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: rawFlags,
        controls: [...row.controls]
      });
    }
    if (rawRemovedFlags.length) {
      const unlabelledFlags = rawRemovedFlags.filter(
        (flag) => groundTruthLabels[row.id]?.[flag] !== "false-positive"
      );
      const delta = {
        id: row.id,
        title: row.title,
        initialFlags: rawInitialFlags,
        removedFlags: rawRemovedFlags
      };
      if (unlabelledFlags.length) {
        rawControlReviewRequiredRows.push({ ...delta, unlabelledFlags });
      } else {
        rawControlGroundTruthClearedRows.push(delta);
      }
    }
    rawTagStandaloneControlLeakCount += row.controls.some((control) =>
      row.risk_tags.some((tag) => normalizeWhitespace(tag) === normalizeWhitespace(control))
    ) ? 1 : 0;
    const operationalView = deriveSafetyReferenceOperationalView(row);
    const operationalInitialFlags = controlContaminationFlags(row, operationalView.controls, "initial");
    const operationalFlags = controlContaminationFlags(row, operationalView.controls, "calibrated");
    const operationalRemovedFlags = operationalInitialFlags.filter((flag) => !operationalFlags.includes(flag));
    operationalControlHeuristicDeltaFlagCount += operationalRemovedFlags.length;
    if (operationalInitialFlags.length) {
      operationalInitialControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: operationalInitialFlags,
        controls: [...operationalView.controls]
      });
    }
    if (operationalFlags.length) {
      operationalControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: operationalFlags,
        controls: [...operationalView.controls]
      });
    }
    if (operationalRemovedFlags.length) {
      const unlabelledFlags = operationalRemovedFlags.filter(
        (flag) => groundTruthLabels[row.id]?.[flag] !== "false-positive"
      );
      const delta = {
        id: row.id,
        title: row.title,
        initialFlags: operationalInitialFlags,
        removedFlags: operationalRemovedFlags
      };
      if (unlabelledFlags.length) {
        operationalControlReviewRequiredRows.push({ ...delta, unlabelledFlags });
      } else {
        operationalControlGroundTruthClearedRows.push(delta);
      }
    }
    if (JSON.stringify(row) !== before) sourceMutationCount += 1;
  }

  return {
    rowCount: rows.length,
    sourceIds: [...new Set(rows.map((row) => row.source_id))].sort(codepointCompare),
    itemTypes: countValues(rows.map((row) => row.item_type)),
    emptyBodyCount: rows.filter((row) => !normalizeWhitespace(row.body || "")).length,
    emptySummaryCount: rows.filter((row) => !normalizeWhitespace(row.summary)).length,
    emptyControlsCount: rows.filter((row) => row.controls.length === 0).length,
    duplicateIdGroups: duplicateIds.groups,
    duplicateTitleGroups: duplicateTitles.groups,
    duplicateSummaryGroups: duplicateSummaries.groups,
    duplicateSummaryRows: duplicateSummaries.rows,
    templatedFallbackSummaryGroups: templatedFallbackSummaries.length,
    templatedFallbackSummaryRows: templatedFallbackSummaries.reduce((sum, detail) => sum + detail.rowCount, 0),
    nonTemplateDuplicateSummaryGroups: nonTemplateDuplicateSummaries.length,
    nonTemplateDuplicateSummaryRows: nonTemplateDuplicateSummaries.reduce((sum, detail) => sum + detail.rowCount, 0),
    duplicateSummaryDetails,
    exactBodyDuplicateCandidateGroups: duplicateBodies.groups,
    exactBodyDuplicateCandidateRows: duplicateBodies.rows,
    missingSourceUrlCount: rows.filter((row) => !row.source_url && !payloadValue(row.payload, [
      "officialDownloadUrl",
      "official_download_url",
      "officialUrl",
      "official_url",
      "sourceUrl",
      "source_url",
      "downloadUrl",
      "download_url"
    ])).length,
    missingOfficialFileIdCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialFileId",
      "official_file_id",
      "techGdlnOrgnlAtcflNo"
    ])).length,
    missingOfficialPublishedAtCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialPublishedAt",
      "official_published_at",
      "publishedAt",
      "techGdlnOfancYmd"
    ])).length,
    missingOfficialStatusCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialStatus",
      "official_status",
      "status",
      "techGdlnSttsSeCdSt"
    ])).length,
    missingVersionCodeCount: rows.filter((row) => !normalizeKoshaVersionCode(row.title)).length,
    rawTagStandaloneControlLeakCount,
    rawInitialControlContaminationCount: rawInitialControlContaminationRows.length,
    rawControlContaminationCount: rawControlContaminationRows.length,
    rawControlGroundTruthClearedCount: rawControlGroundTruthClearedRows.length,
    rawControlReviewRequiredCount: rawControlReviewRequiredRows.length,
    rawControlHeuristicDeltaFlagCount,
    operationalInitialControlContaminationCount: operationalInitialControlContaminationRows.length,
    operationalControlContaminationCount: operationalControlContaminationRows.length,
    operationalControlGroundTruthClearedCount: operationalControlGroundTruthClearedRows.length,
    operationalControlReviewRequiredCount: operationalControlReviewRequiredRows.length,
    operationalControlHeuristicDeltaFlagCount,
    sourceMutationCount,
    rawInitialControlContaminationRows,
    rawControlContaminationRows,
    operationalInitialControlContaminationRows,
    operationalControlContaminationRows,
    rawControlGroundTruthClearedRows,
    rawControlReviewRequiredRows,
    operationalControlGroundTruthClearedRows,
    operationalControlReviewRequiredRows
  };
}

export function buildKoshaOfficialDownloadUrl(record: KoshaOfficialGuideRecord): string | null {
  if (!record.fileId || record.fileSeq === null || record.fileSeq === undefined) return null;
  return `${KOSHA_GUIDE_OFFICIAL_DOWNLOAD_BASE}/${encodeURIComponent(record.fileId)}/${record.fileSeq}`;
}

function normalizeOfficialDate(value: unknown): string | null {
  const text = readString(value).replace(/[^0-9]/gu, "");
  if (!/^\d{8}$/u.test(text)) return null;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

export function toKoshaOfficialGuideRecord(value: unknown): KoshaOfficialGuideRecord | null {
  if (!isRecord(value)) return null;
  const code = normalizeKoshaVersionCode(readString(value.techGdlnNo));
  const stableKey = code ? toKoshaStableDocumentKey(code) : null;
  const title = readString(value.techGdlnNm);
  if (!code || !stableKey || !title) return null;
  const rawFileSeq = value.techGdlnOrgnlAtcflNoSeq;
  const parsedFileSeq = typeof rawFileSeq === "string" && /^\d+$/u.test(rawFileSeq)
    ? Number(rawFileSeq)
    : rawFileSeq;
  return {
    code,
    stableKey,
    title,
    category: readString(value.techGdlnCtgryCd),
    field: readString(value.techGdlnFldSeCd),
    status: readString(value.techGdlnSttsSeCdSt),
    publishedAt: normalizeOfficialDate(value.techGdlnOfancYmd),
    fileId: readString(value.techGdlnOrgnlAtcflNo) || null,
    fileSeq: readNonNegativeInteger(parsedFileSeq)
  };
}

export function summarizeKoshaVisibleStatus(value: unknown): KoshaVisibleStatus | null {
  if (!isRecord(value) || value.ok !== true || value.configured !== true) return null;
  const totalSources = readNonNegativeInteger(value.sources);
  const totalItems = readNonNegativeInteger(value.items);
  const rowCount = readNonNegativeInteger(value.technicalTotal);
  const technicalSupportRegulations = readNonNegativeInteger(value.technicalSupportRegulations);
  const technicalGuidelines = readNonNegativeInteger(value.technicalGuidelines);
  if (
    totalSources === null ||
    totalItems === null ||
    rowCount === null ||
    technicalSupportRegulations === null ||
    technicalGuidelines === null
  ) {
    return null;
  }
  const samples = Array.isArray(value.samples) ? value.samples : [];
  const sampleSourceId = samples
    .filter(isRecord)
    .map((sample) => readString(sample.source_id))
    .find(Boolean);
  return {
    ok: true,
    configured: true,
    catalogStatus: readString(value.status) || "unknown",
    totalSources,
    totalItems,
    sourceId: sampleSourceId || KOSHA_GUIDE_SOURCE_ID,
    rowCount,
    itemTypes: {
      "technical-guideline": technicalGuidelines,
      "technical-support-regulation": technicalSupportRegulations
    },
    sampleCount: samples.length,
    fullRowSnapshotAvailable: false,
    canonicalRowSha256: null
  };
}

export function reconcileKoshaVisibleSnapshots(
  production: KoshaSupabaseVisibleExpectation,
  fullRows: KoshaSupabaseVisibleExpectation | null
): {
  snapshot: KoshaSupabaseVisibleExpectation;
  parityFailures: string[];
  deploymentIdentityProven: false;
  identityBoundary: "deployment-project-identity-unverified";
} {
  const identity = {
    deploymentIdentityProven: false as const,
    identityBoundary: "deployment-project-identity-unverified" as const
  };
  if (!fullRows) {
    return {
      snapshot: { ...production, canonicalRowSha256: production.canonicalRowSha256 || null },
      parityFailures: [],
      ...identity
    };
  }
  const parityFailures: string[] = [];
  if (fullRows.sourceId !== production.sourceId) {
    parityFailures.push(`supabase-visible-source-parity:${fullRows.sourceId}/${production.sourceId}`);
  }
  if (fullRows.rowCount !== production.rowCount) {
    parityFailures.push(`supabase-visible-row-parity:${fullRows.rowCount}/${production.rowCount}`);
  }
  for (const itemType of ["technical-guideline", "technical-support-regulation"] as const) {
    if (fullRows.itemTypes[itemType] !== production.itemTypes[itemType]) {
      parityFailures.push(
        `supabase-visible-${itemType}-parity:${fullRows.itemTypes[itemType]}/${production.itemTypes[itemType]}`
      );
    }
  }
  return parityFailures.length
    ? {
        snapshot: { ...production, canonicalRowSha256: null },
        parityFailures,
        ...identity
      }
    : {
        snapshot: fullRows,
        parityFailures,
        ...identity
      };
}

export function compareKoshaInventoryToOfficial(
  localEntries: KoshaArchiveEntry[],
  currentRecords: KoshaOfficialGuideRecord[],
  retiredRecords: KoshaOfficialGuideRecord[]
) {
  const currentByStableKey = new Map(
    currentRecords.map((record) => [toKoshaStableDocumentKey(record.code) || record.stableKey, record])
  );
  const retiredStableKeys = new Set(
    retiredRecords.map((record) => toKoshaStableDocumentKey(record.code) || record.stableKey)
  );
  const local = canonicalArchiveEntries(localEntries).map((entry) => ({
    ...entry,
    code: normalizeKoshaVersionCode(entry.internalPath),
    stableKey: toKoshaStableDocumentKey(entry.internalPath)
  }));
  const stableKeyMatches = local.filter((entry) => entry.stableKey && currentByStableKey.has(entry.stableKey)).length;
  const exactVersionMatches = local.filter((entry) => {
    if (!entry.stableKey || !entry.code) return false;
    const officialRecord = currentByStableKey.get(entry.stableKey);
    return officialRecord ? normalizeKoshaVersionCode(officialRecord.code) === entry.code : false;
  }).length;
  const versionMismatches = local
    .filter((entry) => {
      if (!entry.stableKey || !entry.code) return false;
      const officialRecord = currentByStableKey.get(entry.stableKey);
      return Boolean(officialRecord && normalizeKoshaVersionCode(officialRecord.code) !== entry.code);
    })
    .map((entry) => {
      const officialRecord = currentByStableKey.get(entry.stableKey || "");
      return {
        stableKey: entry.stableKey || "",
        officialCode: normalizeKoshaVersionCode(officialRecord?.code || "") || officialRecord?.code || "",
        localCode: entry.code || "",
        internalPath: entry.internalPath
      };
    });
  const staleLocalRows = local
    .filter((entry) => entry.stableKey && !currentByStableKey.has(entry.stableKey))
    .map((entry) => ({
      stableKey: entry.stableKey || "",
      localCode: entry.code || "",
      internalPath: entry.internalPath,
      officialRetired: retiredStableKeys.has(entry.stableKey || "")
    }));
  const localStableKeys = new Set(local.map((entry) => entry.stableKey).filter((value): value is string => Boolean(value)));
  const officialMissingLocal = currentRecords
    .filter((record) => !localStableKeys.has(toKoshaStableDocumentKey(record.code) || record.stableKey))
    .map((record) => ({ code: record.code, stableKey: record.stableKey, title: record.title }));
  const retiredLocalRows = staleLocalRows.filter((entry) => entry.officialRetired);
  const unverifiedLocalRows = staleLocalRows.filter((entry) => !entry.officialRetired);
  const refreshDryRun = {
    readOnly: true as const,
    mutationPerformed: false as const,
    approvalRequiredBeforeMutation: true as const,
    counts: {
      insert: officialMissingLocal.length,
      update: versionMismatches.length,
      retire: retiredLocalRows.length,
      unchanged: exactVersionMatches
    },
    insert: officialMissingLocal,
    update: versionMismatches,
    retire: retiredLocalRows,
    unverifiedLocal: unverifiedLocalRows
  };

  return {
    localRows: local.length,
    localMissingStableKey: local.filter((entry) => !entry.stableKey).length,
    officialCurrentRows: currentRecords.length,
    officialRetiredRows: retiredRecords.length,
    stableKeyMatches,
    exactVersionMatches,
    versionMismatches,
    staleLocalRows,
    officialMissingLocal,
    refreshDryRun
  };
}

export function auditKoshaRetrievalScenario(
  scenario: KoshaRetrievalScenario,
  items: SafetyReferenceItem[],
  branch: KoshaRetrievalBranch
): KoshaRetrievalScenarioAudit {
  const candidates = items.filter((item) => item.retrieval_source === branch);
  if (!candidates.length) {
    return {
      scenarioId: scenario.id,
      branch,
      executionStatus: "untested",
      selectedIds: [],
      selectedTitles: [],
      retrievalSources: [],
      promptContext: "",
      answer: "",
      documentReflections: [],
      failures: [`branch-not-executed:${branch}`]
    };
  }
  const ranked = filterAndRankSafetyReferencesByQuery(scenario.query, candidates, candidates.length);
  const packet = buildDbHarnessPacket({ question: scenario.query, references: ranked });
  const promptContext = buildHarnessPromptContext(packet);
  const answer = buildDbHarnessAnswer(packet);
  const selected = [...packet.directEvidence, ...packet.sifCases, ...packet.supportingEvidence];
  const expectedCodeSet = new Set(scenario.expectedCodes.map((code) => normalizeKoshaVersionCode(code) || code));
  const expectedItems = selected.filter((item) => {
    const code = normalizeKoshaVersionCode(item.title);
    return code ? expectedCodeSet.has(code) : false;
  });
  const documentReflections = expectedItems.map((item) => {
    const metadata = buildSafetyReferenceOperationalMetadata(item);
    return {
      code: normalizeKoshaVersionCode(item.title),
      title: item.title,
      documents: [...item.primary_documents],
      label: metadata.document_reflection_label || ""
    };
  });
  const sourceEvidenceText = selected.map((item) => [
    item.title,
    item.summary,
    item.body || "",
    ...item.keywords,
    ...item.risk_tags,
    ...item.controls,
    ...item.primary_documents
  ].join("\n")).join("\n");
  const failures: string[] = [];

  for (const expectedCode of expectedCodeSet) {
    if (!expectedItems.some((item) => normalizeKoshaVersionCode(item.title) === expectedCode)) {
      failures.push(`missing-kosha-evidence:${expectedCode}`);
    }
  }
  for (const item of expectedItems) {
    if (!promptContext.includes(item.title)) failures.push(`prompt-missing-title:${item.id}`);
    if (item.retrieval_source !== branch) failures.push(`retrieval-source:${item.id}:${item.retrieval_source || "missing"}`);
  }
  for (const term of scenario.requiredControlTerms) {
    if (!sourceEvidenceText.includes(term)) failures.push(`missing-control-term:${term}`);
  }
  for (const term of scenario.forbiddenTerms) {
    if (sourceEvidenceText.includes(term)) failures.push(`cross-task-term:${term}`);
  }
  for (const reflection of documentReflections) {
    if (!reflection.documents.includes("위험성평가표")) failures.push(`missing-risk-document:${reflection.code || reflection.title}`);
    if (!reflection.label.includes("위험성평가표")) failures.push(`missing-document-reflection:${reflection.code || reflection.title}`);
  }

  return {
    scenarioId: scenario.id,
    branch,
    executionStatus: "tested",
    selectedIds: selected.map((item) => item.id),
    selectedTitles: selected.map((item) => item.title),
    retrievalSources: [...new Set(
      selected
        .map((item) => item.retrieval_source)
        .filter((source): source is KoshaRetrievalBranch => Boolean(source))
    )].sort(codepointCompare),
    promptContext,
    answer,
    documentReflections,
    failures
  };
}
