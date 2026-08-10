import { NextRequest, NextResponse } from "next/server";
import { withPublicDocumentExportAdmission } from "@/lib/public-distributed-rate-limit";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import fontkit, { type Font, type SubsetStream } from "@pdf-lib/fontkit";
import {
  PDFDocument,
  beginText,
  endText,
  setCharacterSpacing,
  setFontAndSize,
  setLineHeight,
  setTextMatrix,
  showText
} from "pdf-lib";
import {
  buildRiskAssessmentText,
  parseStructuredRiskAssessmentRows,
  type StructuredRiskAssessmentRow
} from "@/lib/risk-assessment-renderer";
import type { AccidentType, FourM } from "@/lib/risk-assessment-schema";

export const dynamic = "force-dynamic";

const MAX_PDF_REQUEST_BYTES = 256 * 1024;
const MAX_PDF_ROWS = 128;
const MAX_PDF_FIELD_CHARACTERS = 4_000;
const MAX_PDF_RENDER_LINES = 512;
const MAX_PDF_PAGES = 8;
const PDF_PAGE_TOP = 790;
const PDF_PAGE_BOTTOM = 48;

type PdfRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

type PdfScenario = {
  companyName: string;
  siteName: string;
  workSummary: string;
  workerCount: number;
  weatherNote: string;
};

type PdfDocumentKind = "risk" | "workPlan" | "permit" | "tbm" | "education" | "generic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/pdf",
      methods: ["POST"],
      formats: ["html", "pdf"],
      message: "POST SafeClaw document rows to render binary PDF by default. Use ?format=html for print-ready HTML source."
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class PdfExportLimitError extends Error {
  constructor() {
    super("PDF export request exceeds a resource budget");
    this.name = "PdfExportLimitError";
  }
}

function assertPdfFieldBudget(value: unknown): void {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === "string") {
      if (Array.from(current).length > MAX_PDF_FIELD_CHARACTERS) throw new PdfExportLimitError();
      continue;
    }
    if (Array.isArray(current)) {
      current.forEach((item) => pending.push(item));
      continue;
    }
    if (isRecord(current)) {
      Object.values(current).forEach((item) => pending.push(item));
    }
  }
}

async function readPdfRequestJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_REQUEST_BYTES) {
    throw new PdfExportLimitError();
  }
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_PDF_REQUEST_BYTES) {
        await reader.cancel();
        throw new PdfExportLimitError();
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks, totalBytes).toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function pdfExportLimitResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "PDF_EXPORT_LIMIT_EXCEEDED",
      message: "PDF 내보내기 요청이 허용된 크기 한도를 초과했습니다."
    },
    { status: 413, headers: { "cache-control": "no-store" } }
  );
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function localizeRiskLevel(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "high") return "상";
  if (normalized === "medium") return "중";
  if (normalized === "low") return "하";
  return value?.trim() || "확인";
}

function localizeVerificationStatus(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "planned") return "조치 예정";
  if (normalized === "done") return "조치 완료";
  if (normalized === "needsreview") return "검토 필요";
  return value?.trim() || "확인";
}

const FOUR_M_LABELS = {
  Man: "인적 요인",
  Machine: "기계·설비 요인",
  Media: "작업환경 요인",
  Management: "관리 요인"
} satisfies Readonly<Record<FourM, string>>;

const ACCIDENT_TYPE_LABELS = {
  fall: "추락",
  slip: "미끄러짐",
  struckBy: "맞음",
  caughtIn: "끼임",
  cut: "베임",
  burn: "화상",
  electricShock: "감전",
  chemicalExposure: "화학물질 노출",
  asphyxiation: "질식",
  heatIllness: "온열질환",
  traffic: "교통사고",
  collapse: "붕괴",
  fireExplosion: "화재·폭발",
  other: "기타"
} satisfies Readonly<Record<AccidentType, string>>;

function localizeFourM(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized in FOUR_M_LABELS
    ? FOUR_M_LABELS[normalized as FourM]
    : normalized || "확인";
}

function localizeAccidentType(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized in ACCIDENT_TYPE_LABELS
    ? ACCIDENT_TYPE_LABELS[normalized as AccidentType]
    : normalized || "확인";
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-document";
}

function parseScenario(value: unknown): PdfScenario {
  const record = isRecord(value) ? value : {};
  return {
    companyName: readString(record.companyName, "SafeClaw 현장"),
    siteName: readString(record.siteName, "현장명 확인"),
    workSummary: readString(record.workSummary, "작업내용 확인"),
    workerCount: readNumber(record.workerCount, 0),
    weatherNote: readString(record.weatherNote, "기상 정보 확인")
  };
}

function parseRows(value: unknown, documentTitle: string): PdfRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PdfRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content) return [];
    return [{
      document: readString(item.document, documentTitle),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
}

function parseBodyText(value: unknown, documentTitle: string): PdfRow[] {
  const text = readString(value);
  if (!text) return [];
  const rows: PdfRow[] = [];
  let section = "본문";
  let index = 1;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      index = 1;
      return;
    }
    const keyed = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    const bullet = line.match(/^[-ㆍ]\s*(.+)$/);
    if (keyed) {
      rows.push({ document: documentTitle, section, item: keyed[1].trim(), content: keyed[2].trim() });
      return;
    }
    if (numbered) {
      rows.push({ document: documentTitle, section, item: numbered[1].trim(), content: numbered[2].trim() });
      return;
    }
    if (bullet) {
      rows.push({ document: documentTitle, section, item: String(index), content: bullet[1].trim() });
      index += 1;
      return;
    }
    rows.push({ document: documentTitle, section, item: String(index), content: line });
    index += 1;
  });

  return rows;
}

function getStructuredRiskRowCandidates(body: Record<string, unknown>): unknown[] {
  const structured = isRecord(body.structured) ? body.structured : {};
  const response = isRecord(body.response) ? body.response : {};
  const responseStructured = isRecord(response.structured) ? response.structured : {};
  return [
    body.structuredRiskRows,
    body.riskAssessmentRows,
    body.structuredRows,
    body.canonicalRows,
    structured.riskAssessmentRows,
    structured.structuredRiskRows,
    responseStructured.riskAssessmentRows,
    responseStructured.structuredRiskRows
  ];
}

function assertPdfRowBudget(body: Record<string, unknown>): void {
  const candidates = [body.rows, body.riskRows, ...getStructuredRiskRowCandidates(body)];
  const countedArrays = new Set<unknown[]>();
  let rowCount = 0;
  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate) || countedArrays.has(candidate)) return;
    countedArrays.add(candidate);
    rowCount += candidate.length;
    if (rowCount > MAX_PDF_ROWS) throw new PdfExportLimitError();
  });
}

function assertParsedPdfRowBudget(rowGroups: ReadonlyArray<ReadonlyArray<unknown>>): void {
  const rowCount = rowGroups.reduce((total, rows) => total + rows.length, 0);
  if (rowCount > MAX_PDF_ROWS) throw new PdfExportLimitError();
}

function parseRiskRowsFromBody(body: Record<string, unknown>): StructuredRiskAssessmentRow[] {
  for (const candidate of getStructuredRiskRowCandidates(body)) {
    const rows = parseStructuredRiskAssessmentRows(candidate);
    if (rows.length) return rows;
  }
  return [];
}

function structuredRiskRowsToPdfRows(rows: StructuredRiskAssessmentRow[], documentTitle: string): PdfRow[] {
  return rows.map((row) => {
    const localizedStatus = localizeVerificationStatus(row.verificationStatus || row.status);
    const localizedRow: StructuredRiskAssessmentRow = {
      ...row,
      fourM: localizeFourM(row.fourM),
      accidentType: localizeAccidentType(row.accidentType),
      riskLevel: localizeRiskLevel(row.riskLevel),
      status: localizedStatus,
      verificationStatus: localizedStatus
    };
    return {
      document: documentTitle,
      section: row.section || "위험성평가",
      item: row.hazard,
      content: buildRiskAssessmentText(localizedRow)
    };
  });
}

function groupRows(rows: PdfRow[]) {
  const groups = new Map<string, PdfRow[]>();
  rows.forEach((row) => {
    const current = groups.get(row.section) || [];
    current.push(row);
    groups.set(row.section, current);
  });
  return Array.from(groups.entries()).map(([section, sectionRows]) => ({ section, rows: sectionRows }));
}

function detectDocumentKind(title: string): PdfDocumentKind {
  if (/위험성평가/.test(title)) return "risk";
  if (/작업계획/.test(title)) return "workPlan";
  if (/허가/.test(title)) return "permit";
  if (/TBM|작업 전 안전점검|툴박스/i.test(title)) return "tbm";
  if (/교육/.test(title)) return "education";
  return "generic";
}

function findByKeywords(rows: PdfRow[], keywords: string[], limit: number) {
  const matches = rows.filter((row) => {
    const haystack = `${row.section} ${row.item} ${row.content}`;
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  const source = matches.length ? matches : rows;
  return source.slice(0, limit);
}

function compactCell(row: PdfRow | undefined, fallback: string) {
  if (!row) return fallback;
  const value = row.content || row.item || fallback;
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function renderRiskAssessmentRows(rows: PdfRow[], scenario: PdfScenario, topRisk: string) {
  const hazards = findByKeywords(rows, ["위험", "추락", "전도", "충돌", "끼임", "화재", "중독", "질식", "붕괴"], 5);
  const controls = findByKeywords(rows, ["조치", "대책", "통제", "점검", "작업중지", "보호구"], 5);
  return `
    <section class="section">
      <h2>1. 사전준비</h2>
      <table class="meta-table">
        <tbody>
          <tr><th>평가대상 작업</th><td>${escapeHtml(scenario.workSummary)}</td><th>평가 장소</th><td>${escapeHtml(scenario.siteName)}</td></tr>
          <tr><th>평가 참여자</th><td>관리감독자, 작업반장, 근로자 대표</td><th>작업 조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr>
          <tr><th>검토 기준</th><td colspan="3">작업계획서, TBM, 안전보건교육 기록, 법령·KOSHA 근거, 현장 사진 증빙</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>2. 유해·위험요인 파악 및 위험성 결정</h2>
      <table>
        <thead><tr><th class="no">연번</th><th>단위작업</th><th>유해·위험요인</th><th>4M</th><th>재해형태</th><th>위험성</th><th>현재 안전조치</th></tr></thead>
        <tbody>
          ${hazards.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(scenario.workSummary)}</td><td>${escapeHtml(compactCell(row, topRisk || "핵심 위험 확인"))}</td><td>인적 요인/기계·설비 요인/작업환경 요인/관리 요인</td><td>추락·충돌·전도 등</td><td>상/중/하</td><td>${escapeHtml(compactCell(controls[index], "작업 전 통제대책 지정"))}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>3. 감소대책 수립·실행</h2>
      <table>
        <thead><tr><th>추가 감소대책</th><th>담당자</th><th>기한</th><th>증빙</th><th>확인</th></tr></thead>
        <tbody>
          ${controls.map((row) => `<tr><td>${escapeHtml(compactCell(row, "위험요인별 감소대책"))}</td><td>작업반장</td><td>작업 전</td><td>사진·TBM·점검표</td><td>□</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>4. 공유·교육 및 재평가</h2>
      <table><tbody><tr><th>공유 방법</th><td>작업 전 TBM, 안전보건교육, 문자/메일 전파</td><th>재평가 기준</th><td>작업조건·장비·기상·인원 변경 또는 잔류위험 발생 시</td></tr></tbody></table>
    </section>`;
}

function renderCanonicalRiskAssessmentRows(rows: StructuredRiskAssessmentRow[], scenario: PdfScenario) {
  return `
    <section class="section">
      <h2>1. 평가 기본정보</h2>
      <table class="meta-table">
        <tbody>
          <tr><th>평가대상 작업</th><td>${escapeHtml(scenario.workSummary)}</td><th>평가 장소</th><td>${escapeHtml(scenario.siteName)}</td></tr>
          <tr><th>평가 참여자</th><td>관리감독자, 작업반장, 근로자 대표</td><th>작업 조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>2. 유해·위험요인 파악 및 감소대책</h2>
      <table>
        <thead>
          <tr><th class="no">연번</th><th>세부작업</th><th>유해·위험요인</th><th>현재 안전보건조치</th><th>위험성</th><th>감소대책</th><th>담당/기한</th><th>확인</th></tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `<tr><td>${escapeHtml(row.id || String(index + 1))}</td><td>${escapeHtml(row.unitTask)}</td><td>${escapeHtml(row.hazard)}</td><td>${escapeHtml(row.currentControls || "현장 확인")}</td><td>${escapeHtml(localizeRiskLevel(row.riskLevel))}</td><td>${escapeHtml(row.additionalControls)}</td><td>${escapeHtml(`${row.owner || "작업반장"} / ${row.dueDate || "작업 전"}`)}</td><td>${escapeHtml(localizeVerificationStatus(row.verificationStatus || row.status))}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>3. 공유·재평가 및 증빙</h2>
      <table>
        <thead><tr><th>대상</th><th>공유 방법</th><th>증빙</th><th>재평가 기준</th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr><td>${escapeHtml(row.unitTask)}</td><td>작업 전 TBM 및 서명 확인</td><td>${escapeHtml(row.evidence || "사진·TBM·점검표")}</td><td>작업조건·장비·기상·인원 변경 시</td></tr>`).join("")}
        </tbody>
      </table>
    </section>`;
}

function renderWorkPlanRows(rows: PdfRow[], scenario: PdfScenario) {
  const steps = findByKeywords(rows, ["작업", "순서", "장비", "인원", "구간", "방법"], 6);
  const stopRules = findByKeywords(rows, ["중지", "비상", "강풍", "우천", "폭염", "위험"], 4);
  return `
    <section class="section">
      <h2>1. 작업개요</h2>
      <table class="meta-table"><tbody><tr><th>현장</th><td>${escapeHtml(scenario.siteName)}</td><th>작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr><tr><th>작업인원</th><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 세부 작업순서 및 안전대책</h2>
      <table><thead><tr><th class="no">연번</th><th>세부작업</th><th>작업방법</th><th>안전대책</th><th>확인</th></tr></thead><tbody>${steps.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(compactCell(row, "작업방법 확인"))}</td><td>위험성평가·TBM 반영</td><td>□</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 장비·인원·첨부서류</h2>
      <table><thead><tr><th>확인 항목</th><th>해당</th><th>첨부</th><th>비고</th></tr></thead><tbody><tr><td>위험성평가표</td><td>■</td><td>□</td><td>감소대책 포함</td></tr><tr><td>TBM 참석명단</td><td>■</td><td>□</td><td>서명 포함</td></tr><tr><td>장비 검사증·자격증·MSDS</td><td>□</td><td>□</td><td>해당 시 첨부</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>4. 작업중지 및 재개 기준</h2>
      <table><thead><tr><th>중지 기준</th><th>판단자</th><th>전파 방법</th><th>재개 조건</th></tr></thead><tbody>${stopRules.map((row) => `<tr><td>${escapeHtml(compactCell(row, scenario.weatherNote))}</td><td>관리감독자</td><td>TBM·무전·문자</td><td>위험 제거 후 재확인</td></tr>`).join("")}</tbody></table>
    </section>`;
}

function renderPermitRows(rows: PdfRow[], scenario: PdfScenario) {
  const checks = findByKeywords(rows, ["허가", "차단", "격리", "보호구", "가스", "화재", "종료"], 6);
  return `
    <section class="section">
      <h2>1. 허가 기본정보</h2>
      <table class="meta-table"><tbody><tr><th>허가번호</th><td>PTW-${new Date().getFullYear()}-____</td><th>작업명</th><td>${escapeHtml(scenario.workSummary)}</td></tr><tr><th>장소</th><td>${escapeHtml(scenario.siteName)}</td><th>작업시간</th><td>____:____ ~ ____:____</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 작업 전 허가조건</h2>
      <table><thead><tr><th>확인 항목</th><th>적합</th><th>보완</th><th>확인 내용</th></tr></thead><tbody>${checks.map((row) => `<tr><td>${escapeHtml(row.item)}</td><td>□</td><td>□</td><td>${escapeHtml(compactCell(row, "허가조건 확인"))}</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 첨부서류 및 종료 확인</h2>
      <table><thead><tr><th>서류/상태</th><th>해당</th><th>확인</th><th>서명</th></tr></thead><tbody><tr><td>작업계획서</td><td>■</td><td>□</td><td></td></tr><tr><td>위험성평가표</td><td>■</td><td>□</td><td></td></tr><tr><td>작업 종료·원상복구</td><td>■</td><td>□</td><td></td></tr></tbody></table>
    </section>`;
}

function renderTbmRows(rows: PdfRow[], scenario: PdfScenario, topRisk: string, riskRows: PdfRow[]) {
  const riskSourceRows = riskRows.length ? riskRows : rows;
  const risks = findByKeywords(riskSourceRows, ["위험", "추락", "전도", "충돌", "끼임", "화재", "중독", "노출"], 5);
  const tbmRows = findByKeywords(rows, ["조치", "작업중지", "기상", "보호구", "질문", "복창"], 5);
  return `
    <section class="section">
      <h2>1. TBM 회의 정보</h2>
      <table class="meta-table"><tbody><tr><th>일시</th><td>____년 ____월 ____일 ____시</td><th>장소</th><td>${escapeHtml(scenario.siteName)}</td></tr><tr><th>작업내용</th><td>${escapeHtml(scenario.workSummary)}</td><th>기상/환경</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 위험성평가 기반 전달사항</h2>
      <table><thead><tr><th class="no">연번</th><th>주요 유해·위험요인</th><th>오늘 기상/환경 신호</th><th>출처 연결</th><th>TBM 전달 문구</th><th>복창</th></tr></thead><tbody>${risks.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(compactCell(row, topRisk || "핵심위험"))}</td><td>${escapeHtml(scenario.weatherNote)}</td><td>위험성평가표 → TBM</td><td>${escapeHtml(compactCell(tbmRows[index], "위험성평가 결과를 작업 전 공유하고 이해하지 못하면 작업을 시작하지 않습니다."))}</td><td>□</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 참석자 확인</h2>
      <table><thead><tr><th>연번</th><th>성명</th><th>소속/역할</th><th>오전</th><th>오후</th><th>서명</th></tr></thead><tbody>${Array.from({ length: Math.max(4, Math.min(8, scenario.workerCount || 4)) }, (_, index) => `<tr><td>${index + 1}</td><td></td><td></td><td>□</td><td>□</td><td></td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>4. 미조치 위험 및 증빙</h2>
      <table><thead><tr><th>미조치 위험</th><th>후속조치</th><th>사진/영상 파일</th><th>확인자</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
    </section>`;
}

function renderEducationRows(rows: PdfRow[], scenario: PdfScenario) {
  const contents = findByKeywords(rows, ["교육", "보호구", "위험", "확인", "외국인", "신규"], 5);
  return `
    <section class="section">
      <h2>1. 교육 개요</h2>
      <table class="meta-table"><tbody><tr><th>교육명</th><td>${escapeHtml(scenario.workSummary)} 작업 전 안전보건교육</td><th>교육대상</th><td>투입 근로자 ${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr><tr><th>교육방법</th><td>TBM 연계 구두교육·서명</td><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 교육 내용 및 이해 확인</h2>
      <table><thead><tr><th class="no">연번</th><th>교육 항목</th><th>주요 내용</th><th>확인방법</th></tr></thead><tbody>${contents.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(compactCell(row, "교육 내용"))}</td><td>구두 복창·서명</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 교육 실시 및 보관</h2>
      <table><tbody><tr><th>교육 실시자</th><td>____________________</td><th>보관 위치</th><td>문서철/전자폴더: ____________________</td></tr><tr><th>미이해자 조치</th><td colspan="3">□ 재설명 □ 통역 확인 □ 작업 배치 전 보완교육</td></tr></tbody></table>
    </section>`;
}

function renderStructuredRows(
  kind: PdfDocumentKind,
  scenario: PdfScenario,
  rows: PdfRow[],
  topRisk: string,
  riskRows: PdfRow[],
  structuredRiskRows: StructuredRiskAssessmentRow[]
) {
  if (kind === "risk" && structuredRiskRows.length) return renderCanonicalRiskAssessmentRows(structuredRiskRows, scenario);
  if (kind === "risk") return renderRiskAssessmentRows(rows, scenario, topRisk);
  if (kind === "workPlan") return renderWorkPlanRows(rows, scenario);
  if (kind === "permit") return renderPermitRows(rows, scenario);
  if (kind === "tbm") return renderTbmRows(rows, scenario, topRisk, riskRows);
  if (kind === "education") return renderEducationRows(rows, scenario);
  return renderRows(rows);
}

function renderRows(rows: PdfRow[]) {
  const groups = groupRows(rows);
  if (!groups.length) {
    return `
      <section class="section">
        <h2>본문 확인</h2>
        <p class="empty">문서 본문이 비어 있습니다. 현장 확인 후 내용을 입력하세요.</p>
      </section>`;
  }

  return groups.map((group) => `
    <section class="section">
      <h2>${escapeHtml(group.section)}</h2>
      <table>
        <thead>
          <tr>
            <th class="no">연번</th>
            <th>항목</th>
            <th>내용</th>
            <th class="check">확인</th>
          </tr>
        </thead>
        <tbody>
          ${group.rows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.item)}</td>
              <td>${escapeHtml(row.content)}</td>
              <td>□ 확인<br />담당: ___</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function buildPdfReadyHtml(
  title: string,
  scenario: PdfScenario,
  rows: PdfRow[],
  riskLevel: string,
  topRisk: string,
  riskRows: PdfRow[],
  structuredRiskRows: StructuredRiskAssessmentRow[]
) {
  const generatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const kind = detectDocumentKind(title);
  const kindLabels: Record<PdfDocumentKind, string> = {
    risk: "위험성평가표: 위험요인·등급·감소대책 중심",
    workPlan: "작업계획서: 작업순서·장비·인원·작업중지 기준 중심",
    permit: "허가/점검: 허가조건·첨부서류·종료 확인 중심",
    tbm: "TBM일지: 위험성평가 위험요인과 기상 신호를 작업 전 전달 중심",
    education: "안전교육: 교육대상·이해 확인·보관 중심",
    generic: "일반 문서: 현장 확인 항목 중심"
  };
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f1e8;
      color: #15171b;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      line-height: 1.55;
    }
    .page {
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fffdf7;
      padding: 18mm 16mm;
      border: 1px solid #d7d0c2;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      border-bottom: 3px solid #17191d;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.04em; }
    .subtitle { margin: 8px 0 0; color: #5c6472; font-size: 13px; }
    .approval { display: grid; grid-template-columns: repeat(3, 70px); border: 1px solid #17191d; }
    .approval div { min-height: 58px; border-left: 1px solid #17191d; padding: 6px; text-align: center; font-size: 12px; }
    .approval div:first-child { border-left: 0; }
    .approval b { display: block; margin-bottom: 14px; }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border: 1px solid #17191d;
      margin-bottom: 16px;
    }
    .meta div { padding: 10px 12px; border-right: 1px solid #17191d; border-bottom: 1px solid #17191d; }
    .meta div:nth-child(2n) { border-right: 0; }
    .meta div:nth-last-child(-n+2) { border-bottom: 0; }
    .meta b { display: block; color: #4f5663; font-size: 12px; margin-bottom: 3px; }
    .riskbox {
      display: grid;
      grid-template-columns: 130px 1fr;
      border: 2px solid #17191d;
      margin-bottom: 18px;
    }
    .riskbox b { padding: 12px; background: #f5de41; border-right: 2px solid #17191d; }
    .riskbox span { padding: 12px; }
    .section { margin-top: 18px; break-inside: avoid; }
    h2 { margin: 0 0 8px; font-size: 18px; border-left: 5px solid #17191d; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #17191d; padding: 8px; vertical-align: top; font-size: 12px; word-break: keep-all; overflow-wrap: anywhere; }
    th { background: #ebe6dc; }
    .meta-table th { width: 18%; }
    .meta-table td { width: 32%; }
    .no { width: 44px; }
    .check { width: 92px; }
    .signature {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid #17191d;
      margin-top: 22px;
    }
    .signature div { min-height: 54px; border-right: 1px solid #17191d; padding: 9px; font-size: 12px; }
    .signature div:last-child { border-right: 0; }
    .notice {
      margin-top: 18px;
      border: 2px solid #17191d;
      padding: 10px 12px;
      font-size: 12px;
      background: #fff8d8;
    }
    .empty { color: #6b7280; }
    body.doc-risk .topline { border-bottom-color: #7a2e25; }
    body.doc-risk h2 { border-left-color: #7a2e25; }
    body.doc-risk th, body.doc-risk .riskbox b { background: #fff2ef; }
    body.doc-workPlan .topline { border-bottom-color: #1f4d7a; }
    body.doc-workPlan h2 { border-left-color: #1f4d7a; }
    body.doc-workPlan th, body.doc-workPlan .riskbox b { background: #edf5ff; }
    body.doc-permit .topline { border-bottom-color: #6f4b16; }
    body.doc-permit h2 { border-left-color: #6f4b16; }
    body.doc-permit th, body.doc-permit .riskbox b { background: #fff7df; }
    body.doc-tbm .topline { border-bottom-color: #285f45; }
    body.doc-tbm h2 { border-left-color: #285f45; }
    body.doc-tbm th, body.doc-tbm .riskbox b { background: #edf8ef; }
    .kind-note {
      margin: 0 0 16px;
      border: 1px solid #17191d;
      padding: 9px 12px;
      background: #fff8d8;
      font-size: 12px;
      font-weight: 700;
    }
    @media print {
      body { background: #fff; }
      .page { border: 0; padding: 0; }
    }
  </style>
</head>
<body class="doc-${kind}">
  <main class="page">
    <header class="topline">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">SafeClaw 공식자료 기반 현장 검토용 출력 초안 · 생성 ${escapeHtml(generatedAt)}</p>
      </div>
      <div class="approval">
        <div><b>작성</b>서명</div>
        <div><b>검토</b>서명</div>
        <div><b>승인</b>서명</div>
      </div>
    </header>
    <section class="meta">
      <div><b>사업장</b>${escapeHtml(scenario.companyName)}</div>
      <div><b>현장</b>${escapeHtml(scenario.siteName)}</div>
      <div><b>작업내용</b>${escapeHtml(scenario.workSummary)}</div>
      <div><b>인원/기상</b>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</div>
    </section>
    <p class="kind-note">서식 구분: ${escapeHtml(kindLabels[kind])} · 원본 서식 1:1 재현이 아니며 발주처 지정 양식 확인이 필요합니다.</p>
    <section class="riskbox">
      <b>위험수준 ${escapeHtml(localizeRiskLevel(riskLevel))}</b>
      <span>${escapeHtml(topRisk || "핵심 위험요인을 현장에서 최종 확인하세요.")}</span>
    </section>
    ${renderStructuredRows(kind, scenario, rows, topRisk, riskRows, structuredRiskRows)}
    <section class="signature">
      <div><b>작성자</b><br />성명/서명:</div>
      <div><b>관리감독자</b><br />성명/서명:</div>
      <div><b>TBM·교육 확인</b><br />성명/서명:</div>
      <div><b>보관 위치</b><br />문서번호/철:</div>
    </section>
    <p class="notice">본 출력물은 공식자료 기반 현장 검토용 초안입니다. 발주처 지정 원본 양식, 현장 실측, 작업중지 기준, 법령 원문, 서명·결재선을 최종 확인한 뒤 사용하세요.</p>
  </main>
</body>
</html>`;
}

function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wrapPdfLine(value: string, maxChars: number) {
  const normalized = normalizePdfText(value);
  const lines: string[] = [];
  let current = "";
  Array.from(normalized).forEach((char) => {
    if ((current + char).length > maxChars) {
      if (current.trim()) lines.push(current.trim());
      current = char;
      return;
    }
    current += char;
  });
  if (current.trim()) lines.push(current.trim());
  return lines.length ? lines : [""];
}

type TrueTypeTableRecord = {
  tag: string;
  data: Buffer;
};

const trueTypeChecksumMagic = 0xb1b0afba;

function alignTrueTypeOffset(value: number) {
  return (value + 3) & ~3;
}

function assertTrueTypeRange(font: Buffer, offset: number, length: number, label: string) {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > font.length
  ) {
    throw new Error(`Invalid TrueType ${label} range`);
  }
}

function calculateTrueTypeChecksum(value: Buffer) {
  let checksum = 0;
  const paddedLength = alignTrueTypeOffset(value.length);
  for (let offset = 0; offset < paddedLength; offset += 4) {
    let word = 0;
    for (let index = 0; index < 4; index += 1) {
      word = ((word << 8) | (value[offset + index] ?? 0)) >>> 0;
    }
    checksum = (checksum + word) >>> 0;
  }
  return checksum;
}

class PdfFontSubsetError extends Error {
  constructor(readonly source: unknown) {
    super("PDF font subset is invalid");
    this.name = "PdfFontSubsetError";
  }
}

function repairTrueTypeChecksums(value: Uint8Array) {
  const font = Buffer.from(value);
  assertTrueTypeRange(font, 0, 12, "subset header");
  const tableCount = font.readUInt16BE(4);
  assertTrueTypeRange(font, 0, 12 + tableCount * 16, "subset table directory");

  let headOffset = -1;
  const tableRecords: Array<{ recordOffset: number; tag: string; offset: number; length: number }> = [];
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = font.toString("ascii", recordOffset, recordOffset + 4);
    const offset = font.readUInt32BE(recordOffset + 8);
    const length = font.readUInt32BE(recordOffset + 12);
    assertTrueTypeRange(font, offset, length, `subset table ${tag}`);
    if (tag === "head") {
      assertTrueTypeRange(font, offset, 12, "subset head table");
      headOffset = offset;
    }
    tableRecords.push({ recordOffset, tag, offset, length });
  }
  if (headOffset < 0) throw new Error("TrueType subset head table is missing");

  font.writeUInt32BE(0, headOffset + 8);
  tableRecords.forEach(({ recordOffset, offset, length }) => {
    const table = font.subarray(offset, offset + length);
    font.writeUInt32BE(calculateTrueTypeChecksum(table), recordOffset + 4);
  });
  const checksumAdjustment = (trueTypeChecksumMagic - calculateTrueTypeChecksum(font)) >>> 0;
  font.writeUInt32BE(checksumAdjustment, headOffset + 8);
  if (calculateTrueTypeChecksum(font) !== trueTypeChecksumMagic) {
    throw new Error("TrueType subset checksum repair failed");
  }
  return font;
}

type ErrorAwareSubsetStream = {
  on(eventType: "data", callback: (data: Uint8Array) => unknown): ErrorAwareSubsetStream;
  on(eventType: "end", callback: () => unknown): ErrorAwareSubsetStream;
  on(eventType: "error", callback: (error: unknown) => unknown): ErrorAwareSubsetStream;
};

function createChecksumCorrectingSubsetStream(source: SubsetStream): SubsetStream {
  const output = new EventEmitter();
  const chunks: Buffer[] = [];
  const errorAwareSource = source as unknown as ErrorAwareSubsetStream;
  errorAwareSource
    .on("data", (data) => chunks.push(Buffer.from(data)))
    .on("end", () => {
      try {
        output.emit("data", repairTrueTypeChecksums(Buffer.concat(chunks)));
        output.emit("end");
      } catch (error) {
        output.emit("error", new PdfFontSubsetError(error));
      }
    })
    .on("error", (error) => output.emit("error", new PdfFontSubsetError(error)));
  return output as unknown as SubsetStream;
}

const checksumCorrectingFontkit = {
  create(fontData: Uint8Array, postscriptName?: string): Font {
    const font = fontkit.create(fontData, postscriptName);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset();
      const encodeStream = subset.encodeStream.bind(subset);
      subset.encodeStream = () => createChecksumCorrectingSubsetStream(encodeStream());
      return subset;
    };
    return font;
  }
};

// fontkit emits short loca offsets for subsets, so source glyph records must end on 2-byte boundaries.
function normalizeTrueTypeGlyphAlignment(font: Buffer) {
  assertTrueTypeRange(font, 0, 12, "header");
  const tableCount = font.readUInt16BE(4);
  const directoryLength = 12 + tableCount * 16;
  assertTrueTypeRange(font, 0, directoryLength, "table directory");

  const tables: TrueTypeTableRecord[] = [];
  const tablesByTag = new Map<string, TrueTypeTableRecord>();
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = font.toString("ascii", recordOffset, recordOffset + 4);
    const tableOffset = font.readUInt32BE(recordOffset + 8);
    const tableLength = font.readUInt32BE(recordOffset + 12);
    assertTrueTypeRange(font, tableOffset, tableLength, `table ${tag}`);
    if (tablesByTag.has(tag)) throw new Error(`Duplicate TrueType table ${tag}`);
    const record = { tag, data: font.subarray(tableOffset, tableOffset + tableLength) };
    tables.push(record);
    tablesByTag.set(tag, record);
  }

  const head = tablesByTag.get("head")?.data;
  const maxp = tablesByTag.get("maxp")?.data;
  const loca = tablesByTag.get("loca")?.data;
  const glyf = tablesByTag.get("glyf")?.data;
  if (!head || head.length < 54 || !maxp || maxp.length < 6 || !loca || !glyf) {
    throw new Error("Required TrueType outline tables are missing");
  }

  const glyphCount = maxp.readUInt16BE(4);
  const sourceLocaFormat = head.readInt16BE(50);
  if (sourceLocaFormat !== 0 && sourceLocaFormat !== 1) {
    throw new Error("Unsupported TrueType loca format");
  }
  const sourceLocaEntrySize = sourceLocaFormat === 0 ? 2 : 4;
  assertTrueTypeRange(loca, 0, (glyphCount + 1) * sourceLocaEntrySize, "loca entries");

  const sourceGlyphOffsets: number[] = [];
  for (let index = 0; index <= glyphCount; index += 1) {
    const entryOffset = index * sourceLocaEntrySize;
    const glyphOffset = sourceLocaFormat === 0
      ? loca.readUInt16BE(entryOffset) * 2
      : loca.readUInt32BE(entryOffset);
    const previousOffset = sourceGlyphOffsets[index - 1] ?? 0;
    if (glyphOffset < previousOffset || glyphOffset > glyf.length) {
      throw new Error("Invalid TrueType glyph offset");
    }
    sourceGlyphOffsets.push(glyphOffset);
  }

  const normalizedGlyphs: Buffer[] = [];
  const normalizedGlyphOffsets = [0];
  let normalizedGlyfLength = 0;
  let requiresNormalization = false;
  for (let index = 0; index < glyphCount; index += 1) {
    const start = sourceGlyphOffsets[index];
    const end = sourceGlyphOffsets[index + 1];
    const glyph = glyf.subarray(start, end);
    normalizedGlyphs.push(glyph);
    normalizedGlyfLength += glyph.length;
    if (glyph.length % 2 !== 0) {
      normalizedGlyphs.push(Buffer.alloc(1));
      normalizedGlyfLength += 1;
      requiresNormalization = true;
    }
    normalizedGlyphOffsets.push(normalizedGlyfLength);
  }
  if (!requiresNormalization) return font;

  const normalizedGlyf = Buffer.concat(normalizedGlyphs, normalizedGlyfLength);
  const normalizedLocaFormat = normalizedGlyf.length / 2 <= 0xffff ? sourceLocaFormat : 1;
  const normalizedLocaEntrySize = normalizedLocaFormat === 0 ? 2 : 4;
  const normalizedLoca = Buffer.alloc((glyphCount + 1) * normalizedLocaEntrySize);
  normalizedGlyphOffsets.forEach((offset, index) => {
    if (normalizedLocaFormat === 0) normalizedLoca.writeUInt16BE(offset / 2, index * 2);
    else normalizedLoca.writeUInt32BE(offset, index * 4);
  });

  const normalizedHead = Buffer.from(head);
  normalizedHead.writeUInt32BE(0, 8);
  normalizedHead.writeInt16BE(normalizedLocaFormat, 50);
  const replacements = new Map<string, Buffer>([
    ["glyf", normalizedGlyf],
    ["loca", normalizedLoca],
    ["head", normalizedHead]
  ]);

  let outputLength = alignTrueTypeOffset(directoryLength);
  tables.forEach((table) => {
    outputLength = alignTrueTypeOffset(outputLength + (replacements.get(table.tag) ?? table.data).length);
  });
  const output = Buffer.alloc(outputLength);
  font.copy(output, 0, 0, 12);
  let tableDataOffset = alignTrueTypeOffset(directoryLength);
  let normalizedHeadOffset = -1;
  tables.forEach((table, index) => {
    const data = replacements.get(table.tag) ?? table.data;
    const recordOffset = 12 + index * 16;
    output.write(table.tag, recordOffset, 4, "ascii");
    output.writeUInt32BE(calculateTrueTypeChecksum(data), recordOffset + 4);
    output.writeUInt32BE(tableDataOffset, recordOffset + 8);
    output.writeUInt32BE(data.length, recordOffset + 12);
    data.copy(output, tableDataOffset);
    if (table.tag === "head") normalizedHeadOffset = tableDataOffset;
    tableDataOffset = alignTrueTypeOffset(tableDataOffset + data.length);
  });
  if (normalizedHeadOffset < 0) throw new Error("TrueType head table was not written");
  const checksumAdjustment = (0xb1b0afba - calculateTrueTypeChecksum(output)) >>> 0;
  output.writeUInt32BE(checksumAdjustment, normalizedHeadOffset + 8);
  return output;
}

let embeddedPdfFonts: { regular: Buffer; bold: Buffer } | null = null;
const regularPdfFontPath = path.join(process.cwd(), "public/fonts/NotoSansKR-Regular.ttf");
const boldPdfFontPath = path.join(process.cwd(), "public/fonts/NotoSansKR-Bold.ttf");
const pdfFontLicensePath = path.join(process.cwd(), "public/fonts/NotoSansKR-OFL.txt");

class PdfFontAssetError extends Error {
  constructor(readonly source: unknown) {
    super("PDF font assets are unavailable or invalid");
    this.name = "PdfFontAssetError";
  }
}

function assertEmbeddablePdfFont(fontData: Buffer): void {
  const font = fontkit.create(fontData);
  if (!Number.isSafeInteger(font.unitsPerEm) || font.unitsPerEm <= 0 || font.numGlyphs <= 0) {
    throw new Error("PDF font metrics are invalid");
  }
  if (!font.hasGlyphForCodePoint(0xac00)) {
    throw new Error("PDF font does not contain the required Korean glyphs");
  }
  const subset = font.createSubset();
  subset.includeGlyph(font.glyphForCodePoint(0xac00));
  subset.includeGlyph(font.glyphForCodePoint(0x41));
}

function loadEmbeddedPdfFonts(): { regular: Buffer; bold: Buffer } {
  if (embeddedPdfFonts) return embeddedPdfFonts;
  try {
    fs.accessSync(pdfFontLicensePath, fs.constants.R_OK);
    const regular = normalizeTrueTypeGlyphAlignment(fs.readFileSync(regularPdfFontPath));
    const bold = normalizeTrueTypeGlyphAlignment(fs.readFileSync(boldPdfFontPath));
    assertEmbeddablePdfFont(regular);
    assertEmbeddablePdfFont(bold);
    embeddedPdfFonts = { regular, bold };
  } catch (error) {
    throw new PdfFontAssetError(error);
  }
  return embeddedPdfFonts;
}

type PdfTextRole = "title" | "section" | "body" | "table" | "note";
type PdfContentLine = { text: string; role: PdfTextRole; gap?: number };

const pdfTextStyles = {
  title: { font: "F2", size: 20, leading: 24, tracking: -0.4 },
  section: { font: "F2", size: 14, leading: 18, tracking: -0.14 },
  body: { font: "F1", size: 10, leading: 15, tracking: 0 },
  table: { font: "F1", size: 8.5, leading: 12, tracking: 0 },
  note: { font: "F1", size: 8, leading: 11, tracking: 0 }
} as const;

function placePdfContentLine(y: number, line: PdfContentLine) {
  const typography = pdfTextStyles[line.role];
  const gap = line.gap || 0;
  const blankLineHeight = line.text ? 0 : typography.leading;
  if (y - gap - blankLineHeight < PDF_PAGE_BOTTOM) {
    return { startsNewPage: true, y: PDF_PAGE_TOP };
  }
  return { startsNewPage: false, y: y - gap };
}

function assertPdfRenderBudget(lines: PdfContentLine[]): void {
  if (lines.length > MAX_PDF_RENDER_LINES) throw new PdfExportLimitError();

  let pageCount = 1;
  let y = PDF_PAGE_TOP;
  lines.forEach((line) => {
    const placement = placePdfContentLine(y, line);
    if (placement.startsNewPage) pageCount += 1;
    if (pageCount > MAX_PDF_PAGES) throw new PdfExportLimitError();
    y = placement.y - pdfTextStyles[line.role].leading;
  });
}

function buildPdfContentLines(
  title: string,
  scenario: PdfScenario,
  rows: PdfRow[],
  riskLevel: string,
  topRisk: string,
  riskRows: PdfRow[],
  structuredRiskRows: StructuredRiskAssessmentRow[]
) {
  const generatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const kind = detectDocumentKind(title);
  const lines: PdfContentLine[] = [
    { text: title, role: "title", gap: 18 },
    { text: `SafeClaw 현장 검토용 PDF 초안 · 생성 ${generatedAt}`, role: "note", gap: 16 },
    { text: `사업장: ${scenario.companyName}`, role: "body" },
    { text: `현장: ${scenario.siteName}`, role: "body" },
    { text: `작업: ${scenario.workSummary}`, role: "body" },
    { text: `인원/기상: ${scenario.workerCount.toLocaleString("ko-KR")}명 · ${scenario.weatherNote}`, role: "body", gap: 14 },
    { text: `위험수준: ${localizeRiskLevel(riskLevel)}`, role: "section" },
    { text: `핵심위험: ${topRisk || "현장 최종 확인 필요"}`, role: "body", gap: 16 },
    { text: `서식 구분: ${kind === "risk" ? "위험성평가표" : kind === "workPlan" ? "작업계획서" : kind === "permit" ? "허가/점검" : kind === "tbm" ? "TBM일지" : "일반 문서"}`, role: "body", gap: 12 },
    { text: "확인 항목", role: "section", gap: 10 }
  ];

  const canonicalRiskRows = kind === "risk" && structuredRiskRows.length
    ? structuredRiskRowsToPdfRows(structuredRiskRows, title)
    : [];
  const fallbackRows = [{
    document: title,
    section: "본문",
    item: "확인",
    content: "문서 본문을 현장에서 확인하세요."
  }];
  const sourceRows = canonicalRiskRows.length
    ? canonicalRiskRows
    : kind === "tbm"
      ? (riskRows.length ? [...riskRows, ...rows] : (rows.length ? rows : fallbackRows))
      : (rows.length ? rows : fallbackRows);
  if (kind === "tbm") {
    lines.push({ text: "위험성평가표 위험요인과 오늘 기상/환경 신호를 TBM 전달사항으로 연결합니다.", role: "table" });
    lines.push({ text: `오늘 기상/환경 신호: ${scenario.weatherNote}`, role: "table", gap: 8 });
  }
  sourceRows.forEach((row, index) => {
    const prefix = kind === "tbm"
      ? index < riskRows.length
        ? `${index + 1}. [위험성평가표 → TBM] `
        : `${index + 1}. [TBM 전달사항] `
      : `${index + 1}. [${row.section}] ${row.item}: `;
    wrapPdfLine(`${prefix}${row.content}`, 42).forEach((line, lineIndex) => {
      lines.push({ text: lineIndex === 0 ? line : `   ${line}`, role: "table" });
    });
  });

  lines.push(
    { text: "", role: "note", gap: 14 },
    { text: "작성자: ____________________    검토: ____________________    승인: ____________________", role: "table" },
    { text: "본 출력물은 공식자료 기반 현장 검토용 초안입니다. 발주처 지정 양식, 현장 실측, 법령 원문, 서명·결재선을 최종 확인한 뒤 사용하세요.", role: "note" }
  );
  return lines;
}

async function buildBinaryPdf(
  title: string,
  scenario: PdfScenario,
  rows: PdfRow[],
  riskLevel: string,
  topRisk: string,
  riskRows: PdfRow[],
  structuredRiskRows: StructuredRiskAssessmentRow[]
) {
  const lines = buildPdfContentLines(title, scenario, rows, riskLevel, topRisk, riskRows, structuredRiskRows);
  assertPdfRenderBudget(lines);
  const fonts = loadEmbeddedPdfFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(checksumCorrectingFontkit);
  const regularFont = await pdf.embedFont(fonts.regular, { subset: true });
  const boldFont = await pdf.embedFont(fonts.bold, { subset: true });
  const createPage = () => {
    const page = pdf.addPage([595, 842]);
    return {
      page,
      regularFontKey: page.node.newFontDictionary(regularFont.name, regularFont.ref),
      boldFontKey: page.node.newFontDictionary(boldFont.name, boldFont.ref)
    };
  };
  const pageStates: Array<ReturnType<typeof createPage>> = [];
  let pageState = createPage();
  pageStates.push(pageState);
  let y = PDF_PAGE_TOP;
  for (const line of lines) {
    const typography = pdfTextStyles[line.role];
    const placement = placePdfContentLine(y, line);
    if (placement.startsNewPage) {
      pageState = createPage();
      pageStates.push(pageState);
    }
    y = placement.y;
    if (!line.text) {
      y -= typography.leading;
      continue;
    }
    const font = typography.font === "F2" ? boldFont : regularFont;
    const fontKey = typography.font === "F2" ? pageState.boldFontKey : pageState.regularFontKey;
    pageState.page.pushOperators(
      beginText(),
      setFontAndSize(fontKey, typography.size),
      setLineHeight(typography.leading),
      setCharacterSpacing(typography.tracking),
      setTextMatrix(1, 0, 0, 1, 42, y),
      showText(font.encodeText(line.text)),
      endText()
    );
    y -= typography.leading;
  }
  pageStates.forEach((state, index) => {
    const headerText = Array.from(normalizePdfText(`${title} · ${scenario.companyName}`)).slice(0, 56).join("");
    const pageText = `${index + 1} / ${pageStates.length}쪽`;
    state.page.pushOperators(
      beginText(),
      setFontAndSize(state.boldFontKey, 8),
      setCharacterSpacing(0),
      setTextMatrix(1, 0, 0, 1, 42, 818),
      showText(boldFont.encodeText(headerText)),
      endText(),
      beginText(),
      setFontAndSize(state.regularFontKey, 8),
      setCharacterSpacing(0),
      setTextMatrix(1, 0, 0, 1, 500, 24),
      showText(regularFont.encodeText(pageText)),
      endText()
    );
  });
  try {
    return Buffer.from(await pdf.save({ useObjectStreams: false }));
  } catch (error) {
    if (error instanceof PdfFontSubsetError) throw new PdfFontAssetError(error.source);
    throw error;
  }
}

async function exportPdf(request: NextRequest) {
  try {
    const parsed = await readPdfRequestJson(request);
    assertPdfFieldBudget(parsed);
    const body = isRecord(parsed) ? parsed : {};
    assertPdfRowBudget(body);
    const title = readString(body.title, "SafeClaw 제출 문서");
    const scenario = parseScenario(body.scenario);
    const rows = parseRows(body.rows, title);
    const riskRows = parseRows(body.riskRows, "위험성평가표");
    const structuredRiskRows = parseRiskRowsFromBody(body);
    const bodyRows = rows.length ? rows : parseBodyText(body.documentText, title);
    assertParsedPdfRowBudget([bodyRows, riskRows, structuredRiskRows]);
    const riskLevel = readString(body.riskLevel, "확인");
    const topRisk = readString(body.topRisk, "");
    const requestedFormat = request.nextUrl.searchParams.get("format");
    const wantsHtml = requestedFormat === "html";
    const wantsBinaryPdf = !wantsHtml;

    if (wantsBinaryPdf) {
      let pdf: Buffer;
      try {
        pdf = await buildBinaryPdf(title, scenario, bodyRows, riskLevel, topRisk, riskRows, structuredRiskRows);
      } catch (error) {
        if (error instanceof PdfExportLimitError) throw error;
        if (error instanceof PdfFontAssetError) {
          console.error("PDF export font assets are unavailable or invalid", error.source);
          return NextResponse.json(
            { ok: false, error: "PDF_FONT_ASSET_UNAVAILABLE" },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
        console.error("PDF export failed", error);
        throw error;
      }
      const pdfFileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="safeclaw-document.pdf"; filename*=UTF-8''${encodeURIComponent(pdfFileName)}`,
          "cache-control": "no-store"
        }
      });
    }

    const html = buildPdfReadyHtml(title, scenario, bodyRows, riskLevel, topRisk, riskRows, structuredRiskRows);
    const fileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.html`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `inline; filename="safeclaw-pdf-ready.html"; filename*=UTF-8''${encodedFileName}`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof PdfExportLimitError) return pdfExportLimitResponse();
    throw error;
  }
}

export async function POST(request: NextRequest) {
  return withPublicDocumentExportAdmission(request, () => exportPdf(request));
}
