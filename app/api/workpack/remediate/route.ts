import { NextRequest, NextResponse } from "next/server";
import {
  publicSafetyDocumentRubric,
  rubricCategoryLabel,
  rubricStatusLabel,
  type RubricDocumentKey
} from "@/lib/safety-document-rubric";
import { matchSafetyKnowledge } from "@/lib/safety-knowledge";
import { generateKnowledgeText } from "@/lib/ai";
import { searchSafetyReferences, type SafetyReferenceItem } from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

const documentLabels: Record<RubricDocumentKey, string> = {
  workpackSummaryDraft: "점검결과 요약",
  riskAssessmentDraft: "위험성평가표",
  workPlanDraft: "작업계획서",
  tbmBriefing: "TBM/작업 전 안전점검회의",
  tbmLogDraft: "TBM 기록",
  safetyEducationRecordDraft: "안전보건교육 기록",
  emergencyResponseDraft: "비상대응 절차",
  photoEvidenceDraft: "사진/증빙",
  foreignWorkerBriefing: "외국인 근로자 출력본",
  foreignWorkerTransmission: "외국인 근로자 전송본",
  kakaoMessage: "현장 공유 메시지"
};

type RemediationRequest = {
  question: string;
  documentKey: RubricDocumentKey;
  documentText: string;
  rubricItemId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readRequest(value: unknown): { ok: true; request: RemediationRequest } | { ok: false; message: string } {
  if (!isRecord(value)) {
    return { ok: false, message: "JSON object body is required" };
  }

  const question = readString(value, "question");
  const documentKey = readString(value, "documentKey") as RubricDocumentKey;
  const documentText = readString(value, "documentText");
  const rubricItemId = readString(value, "rubricItemId");

  if (!question) return { ok: false, message: "question is required" };
  if (!documentKey || !(documentKey in documentLabels)) return { ok: false, message: "valid documentKey is required" };
  if (!rubricItemId) return { ok: false, message: "rubricItemId is required" };

  return {
    ok: true,
    request: {
      question,
      documentKey,
      documentText,
      rubricItemId
    }
  };
}

function trimForPrompt(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildFallbackText(itemTitle: string, improvementAction: string): string {
  return [
    `[보완 제안: ${itemTitle}]`,
    `- ${improvementAction}`,
    "- 현장 확인: 작업반장 또는 관리감독자가 작업 전 확인 후 서명합니다.",
    "- 근거 확인: 법령·KOSHA·공공기관 서식 기준은 최종 제출 전 다시 확인합니다."
  ].join("\n");
}

function mapCatalogEvidence(items: SafetyReferenceItem[]) {
  return items.map((item, index) => ({
    order: index + 1,
    title: item.title,
    type: item.item_type,
    category: item.category,
    documents: item.primary_documents,
    controls: item.controls,
    keywords: item.keywords.slice(0, 8),
    sourceUrl: item.source_url,
    summary: item.summary
  }));
}

function labelCatalogAgency(itemType: string) {
  if (itemType.includes("technical")) return "Supabase 지식 DB · KOSHA";
  if (itemType.includes("sif")) return "Supabase 지식 DB · 재해사례";
  if (itemType.includes("manual") || itemType.includes("training")) return "Supabase 지식 DB · 교육자료";
  return "Supabase 지식 DB";
}

async function buildPrompt(request: RemediationRequest) {
  const rubricItem = publicSafetyDocumentRubric.find((item) => item.id === request.rubricItemId);
  if (!rubricItem) return null;

  const matches = matchSafetyKnowledge(request.question, 4);
  const catalogQuery = [
    request.question,
    rubricItem.title,
    rubricItem.improvementAction,
    rubricItem.researchAction
  ].join(" ");
  const catalog = await searchSafetyReferences({ query: catalogQuery, limit: 6 });
  const evidence = matches.map((match, index) => ({
    order: index + 1,
    title: match.title,
    documents: match.primaryDocuments,
    controls: match.controls,
    sources: match.sources.map((source) => ({
      agency: source.agency,
      title: source.title,
      url: source.url,
      summary: source.summary
    })),
    legalMappings: match.legalMappings.map((mapping) => ({
      title: mapping.title,
      plainLanguage: mapping.plainLanguage,
      caution: mapping.caution
    }))
  }));

  return {
    rubricItem,
    matches,
    prompt: [
      "당신은 산업안전 문서팩 보완 편집자다.",
      "목표는 사용자가 이미 생성한 문서에 덧붙일 수 있는 짧은 보완 문단 또는 체크리스트를 만드는 것이다.",
      "절대 기존 문서를 통째로 다시 쓰지 말라. 보완 삽입용 블록만 작성하라.",
      "법적 효력 보장, 확률, 점수, 적중률 표현은 쓰지 말라.",
      "불확실한 내용은 '현장 확인 필요'로 표시하라.",
      "출력은 바로 문서에 삽입 가능한 한국어 텍스트만 반환하라.",
      "형식은 [보완 제안: 항목명] 제목 1줄, 체크리스트 3~5줄, 확인자/근거 확인 1줄로 제한하라.",
      `작업 조건: ${trimForPrompt(request.question, 700)}`,
      `대상 문서: ${documentLabels[request.documentKey]}`,
      `현재 문서 일부: ${trimForPrompt(request.documentText, 1200) || "현재 문서 본문 없음"}`,
      `루브릭 분류: ${rubricCategoryLabel(rubricItem.category)}`,
      `루브릭 항목: ${rubricItem.title}`,
      `현재 상태 설명: ${rubricStatusLabel("needs-improvement")}`,
      `보완 방향: ${rubricItem.improvementAction}`,
      `리서치 방향: ${rubricItem.researchAction}`,
      `내장 서식/루브릭 지식 근거: ${JSON.stringify(evidence)}`,
      `마이그레이션된 안전 지식 DB 근거: ${JSON.stringify(mapCatalogEvidence(catalog.items))}`,
      `안전 지식 DB 상태: ${catalog.configured ? catalog.message : "Supabase 지식 DB 미설정. 내장 지식만 사용."}`
    ].join("\n"),
    catalog
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  const parsed = readRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const promptBundle = await buildPrompt(parsed.request);
  if (!promptBundle) {
    return NextResponse.json({ ok: false, message: "rubric item not found" }, { status: 404 });
  }

  const generated = await generateKnowledgeText(promptBundle.prompt);
  const fallbackText = buildFallbackText(promptBundle.rubricItem.title, promptBundle.rubricItem.improvementAction);
  const text = generated.text.trim() || fallbackText;
  const sources = promptBundle.matches.flatMap((match) => (
    match.sources.map((source) => ({
      title: source.title,
      agency: `${source.agency} · 내장 서식/루브릭`,
      url: source.url,
      sourceType: "seed"
    }))
  ));
  const catalogSources = mapCatalogEvidence(promptBundle.catalog.items).map((source) => ({
    title: source.title,
    agency: labelCatalogAgency(source.type),
    url: source.sourceUrl || `/knowledge?reference=${encodeURIComponent(source.title)}`,
    sourceType: "catalog"
  }));
  const catalogStatus = {
    configured: promptBundle.catalog.configured,
    ok: promptBundle.catalog.ok,
    count: promptBundle.catalog.count,
    message: promptBundle.catalog.message
  };
  const catalogNotice = promptBundle.catalog.ok
    ? `Supabase 지식 DB ${promptBundle.catalog.count.toLocaleString("ko-KR")}건을 보완 근거 후보로 확인했습니다.`
    : `Supabase 지식 DB 검색 실패 또는 미설정: ${promptBundle.catalog.message} 내장 법령·KOSHA seed 기준으로 보완했습니다.`;

  return NextResponse.json({
    ok: true,
    configured: generated.configured,
    providerLabel: generated.providerLabel,
    policyNote: generated.text
      ? `${generated.policyNote} ${catalogNotice}`
      : `AI 제공자 응답이 없어 규칙 기반 보완 제안을 반환했습니다. ${catalogNotice}`,
    catalogStatus,
    rubricItem: {
      id: promptBundle.rubricItem.id,
      title: promptBundle.rubricItem.title,
      category: promptBundle.rubricItem.category,
      categoryLabel: rubricCategoryLabel(promptBundle.rubricItem.category)
    },
    documentKey: parsed.request.documentKey,
    text,
    sources: [...sources.slice(0, 4), ...catalogSources.slice(0, 3)]
  });
}
