"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FieldOperationsWorkspace } from "@/components/FieldOperationsWorkspace";
import type { DocumentKey } from "@/components/WorkpackEditor";
import { AgentConsole } from "@/components/AgentConsole";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { fetchAskStream } from "@/lib/ask-stream-client";
import { nextConsoleLines, type AgentConsoleLine } from "@/lib/agent-console-copy";
import type { AskResponse, IntegrationMode, QualityContractStatus } from "@/lib/types";
import type { FieldExample } from "@/lib/field-examples";
import { formatEvidenceBadge } from "@/lib/smsa-mapping";
import {
  buildHazardPhotoCandidates,
  buildPhotoAnalysisCandidate as buildPhotoAnalysisCandidateText
} from "@/lib/operation-improvements";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  parseOperationImprovements,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import {
  buildWorkspaceStepStatuses,
  canOpenWorkspacePage,
  nextWorkspacePageAfterGenerationError,
  nextWorkspacePageAfterGenerate,
  type WorkspacePage,
  type WorkspaceStepStatus
} from "@/lib/workspace-pages";

type SafeGuardCommandCenterProps = {
  examples: FieldExample[];
  initialScenarioId: string;
  initialQuestion: string;
  autoGenerate: boolean;
  workspaceTheme?: WorkspaceTheme;
};

type WorkspaceTheme = "night" | "day";

type GenerationState = "idle" | "generating" | "ready" | "error";

type WorkflowStep = {
  key: WorkspacePage;
  id: string;
  label: string;
  caption: string;
};

type StepStatus = WorkspaceStepStatus;

type FieldBrief = {
  companyName: string;
  siteName: string;
  industry: string;
  workSummary: string;
  workerCount: string;
  weather: string;
  sourceLabel: string;
  foreignWorkerSignal: string;
};

type WeatherBrief = AskResponse["externalData"]["weather"];

type WeatherBriefResponse = {
  ok: boolean;
  weather?: WeatherBrief;
  message?: string;
};

type ReadinessTone = "ready" | "pending" | "warn";

type ReadinessRailItem = {
  key: string;
  label: string;
  status: string;
  detail: string;
  tone: ReadinessTone;
};

type GenerationStage = {
  label: string;
  detail: string;
  tone: ReadinessTone;
};

type DocumentSourceRailItem = {
  label: string;
  value: string;
  detail: string;
  meta: string;
  tone: ReadinessTone;
  href?: string;
};

type LocalPhoto = {
  name: string;
  url: string;
  file: File;
};

type ImprovementSaveState = "idle" | "saving" | "saved" | "local";

type WorkpackSaveResult = {
  ok: boolean;
  configured?: boolean;
  workpackId: string | null;
  message: string;
};

type ImprovementApiResult = {
  ok: boolean;
  configured?: boolean;
  improvementId: string | null;
  sourceType?: "manual" | "photo_analysis";
  vision?: {
    status?: "analyzed" | "unconfigured" | "failed";
    analysisMode?: "vision_ocr" | "photo_pair_unanalyzed" | "manual_text";
    photoPairAttached?: boolean;
    userLabel?: string;
    exportable?: boolean;
    provider?: string;
    model?: string;
    summary?: string;
    observedImprovement?: string;
    detectedHazards?: string[];
    ocrText?: string;
    reflectedDocuments?: string[];
    errorMessage?: string;
  };
  message: string;
};

const workflowSteps: WorkflowStep[] = [
  { id: "01", key: "input", label: "입력", caption: "현장 상황" },
  { id: "02", key: "document", label: "문서", caption: "결과 검토" },
  { id: "03", key: "share", label: "공유", caption: "열람·확인" }
];

const outputItems: Array<{ title: string; key: DocumentKey }> = [
  { title: "점검결과 요약", key: "workpackSummaryDraft" },
  { title: "위험성평가표", key: "riskAssessmentDraft" },
  { title: "작업계획서", key: "workPlanDraft" },
  { title: "허가서/첨부", key: "workPermitDraft" },
  { title: "TBM 브리핑", key: "tbmBriefing" },
  { title: "TBM 기록", key: "tbmLogDraft" },
  { title: "안전보건교육 기록", key: "safetyEducationRecordDraft" },
  { title: "비상대응 절차", key: "emergencyResponseDraft" },
  { title: "사진/증빙", key: "photoEvidenceDraft" },
  { title: "외국인 근로자 안내문", key: "foreignWorkerBriefing" },
  { title: "외국인 전송본", key: "foreignWorkerTransmission" },
  { title: "현장 전파 메시지", key: "kakaoMessage" }
];

const totalDocumentCount = outputItems.length;
const primaryDocumentKeys = new Set<DocumentKey>([
  "riskAssessmentDraft",
  "tbmBriefing",
  "tbmLogDraft"
]);
const focusDocumentItems = outputItems.filter((item) => primaryDocumentKeys.has(item.key));
function statusCopy(state: GenerationState) {
  if (state === "generating") return "문서 생성 중";
  if (state === "ready") return "문서팩 준비됨";
  if (state === "error") return "연결 점검 필요";
  return "작업 입력 대기";
}

function stepStatusCopy(status: StepStatus) {
  if (status === "done") return "완료";
  if (status === "active") return "진행 중";
  if (status === "locked") return "잠김";
  return "대기";
}

function workspaceStepStatusCopy(
  page: WorkspacePage,
  status: StepStatus,
  state: GenerationState,
  hasWorkpack: boolean
) {
  if (page === "document" && status === "active" && hasWorkpack && state === "ready") {
    return "준비됨";
  }
  if (page === "share" && status === "active" && hasWorkpack && state === "ready") {
    return "확인 중";
  }
  return stepStatusCopy(status);
}

function lawCount(data: AskResponse | null, state: GenerationState) {
  if (data) return data.citations.length;
  if (state === "generating") return 3;
  return 0;
}

function docProgress(data: AskResponse | null, state: GenerationState) {
  if (data) return totalDocumentCount;
  if (state === "generating") return 3;
  return 0;
}

function elapsedLabel(state: GenerationState) {
  if (state === "generating") return "진행 중";
  if (state === "ready") return "완료";
  if (state === "error") return "점검";
  return "대기";
}

function operationalStatus(data: AskResponse | null, state: GenerationState) {
  if (state === "error") return "연결 점검 필요";
  if (data) return data.status.summary || "근거 연결됨";
  return "입력 대기";
}

function compactWeatherBrief(weather: string) {
  const [summary, ...detailParts] = weather.split(" (");
  const detail = detailParts.length ? `(${detailParts.join(" (")}` : "";
  return {
    summary: summary.trim() || weather,
    detail: detail.trim()
  };
}

function statusDetailCopy(state: GenerationState) {
  if (state === "generating") return "법령·기상·교육·재해사례를 확인하고 있습니다.";
  if (state === "ready") return "문서팩 편집, 작업자 교육 확인, 전파, 이력 저장을 진행할 수 있습니다.";
  if (state === "error") return "외부 연결 상태를 확인한 뒤 다시 시도해 주세요.";
  return "현장 상황을 입력하고 문서팩 생성을 시작하세요.";
}

function riskToneClass(level: string) {
  if (level.includes("상")) return "risk-high";
  if (level.includes("중")) return "risk-medium";
  return "risk-low";
}

function inferLocationFromText(text: string, fallback: string) {
  const locationMatch = text.match(/(서울|인천|경기|안산|부산|대구|광주|대전|울산|창원|천안|청주|수원|성수동|남동공단|하남산단|달서구|해운대)[^\s,.]*/);
  return locationMatch?.[0] || fallback;
}

function inferCompanyFromText(text: string, fallback: string) {
  const trimmed = text.trim();
  const companyMatch = trimmed.match(/([가-힣A-Za-z0-9]+(?:테크인씨|테크이엔씨|엔지니어링|주식회사|건설|산업|전기|설비|이엔씨|테크|관리|로지스|메탈|창고|시설|기업|공사|㈜))/);
  if (companyMatch) return companyMatch[1].replace(/^㈜/, "").trim();

  const firstToken = trimmed.split(/\s+/)[0];
  if (firstToken && !/(서울|인천|경기|부산|대구|광주|대전|울산|오늘|작업|현장)/.test(firstToken)) {
    return firstToken.replace(/[,.]$/, "");
  }

  return fallback;
}

function inferIndustryFromText(text: string, fallback: string) {
  if (/누수|비가\s*새|천장|유지보수|정비|점검|시설/.test(text)) return "시설관리·유지보수";
  if (/용접|절단|제조|화기/.test(text)) return "제조업";
  if (/지게차|상하차|피킹|창고|물류|운반/.test(text)) return "물류·창고업";
  if (/비계|외벽|도장|건설|고소/.test(text)) return "건설업";
  if (/세척|청소|화학|세제/.test(text)) return "서비스업";
  return fallback;
}

function inferWorkSummaryFromText(text: string, fallback: string) {
  const compact = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(위험성평가|위험성 평가|TBM|안전보건교육|안전교육|기록|초안|문서팩|작업계획서|일지)(와|과|,|·|\s)*/g, "")
    .replace(/(까지\s*)?(반영해|포함해|연계해|고려해)?\s*(만들어\s*줘|작성해\s*줘|생성해\s*줘|정리해\s*줘|만들어주세요|작성해주세요|생성해주세요|정리해주세요)\.?$/i, "")
    .trim();

  if (/누수|비가\s*새|천장/.test(compact)) return "천장 누수 유지보수 작업";
  const workSentence = compact.split(/(?<=[.!?。])\s+/).find((sentence) => /작업|점검|운반|도장|상하차|용접|세척|굴착|피킹|적재|유지보수/.test(sentence));
  return (workSentence || compact || fallback).replace(/\.$/, "").trim();
}

function inferWorkerCountFromText(text: string) {
  const compact = text.replace(/\s+/g, " ");
  const totalPatterns = [
    /(?:총\s*작업자|전체\s*작업자|작업자\s*총|총\s*작업인원|작업인원\s*총|투입\s*인원|전체\s*인원|참석\s*대상)\s*(\d+)\s*명/g,
    /(?:작업자|작업인원|인력|참석)\s*(\d+)\s*명/g
  ];
  const subgroupHints = /(외국인|신규|고령|숙련|운전자|피킹|감시자|관리자)\s*$/;

  for (const pattern of totalPatterns) {
    for (const match of compact.matchAll(pattern)) {
      const before = compact.slice(Math.max(0, (match.index || 0) - 12), match.index || 0);
      if (subgroupHints.test(before)) continue;
      return `${match[1]}명`;
    }
  }

  const allCounts = [...compact.matchAll(/(\d+)\s*명/g)].map((match) => Number(match[1]));
  if (allCounts.length) return `${Math.max(...allCounts)}명`;
  return "입력 필요";
}

function readApiMessage(value: unknown, fallback: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
  const message = (value as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function inferWeatherFromText(text: string, fallback: string) {
  const weatherKeywords = ["강풍", "우천", "폭염", "고온", "환기", "집중호우", "눈", "결빙", "실내", "밀폐"];
  const found = weatherKeywords.filter((keyword) => text.includes(keyword));
  return found.length ? found.join(" · ") : fallback;
}

function inferForeignSignal(text: string, fallback: boolean) {
  if (/외국인|베트남|중국|몽골|태국|필리핀|우즈벡|캄보디아|네팔|다국어/.test(text)) return "외국인/다국어 확인";
  return fallback ? "외국인 포함 가능" : "국내 인력 중심";
}

function buildInputFieldBrief(
  question: string,
  example: FieldExample,
  weather: WeatherBrief | null,
  isWeatherLoading: boolean
): FieldBrief {
  const companyName = inferCompanyFromText(question, example.companyName);
  const siteFallback = companyName === example.companyName ? example.region : `${companyName} 작업현장`;
  const weatherSummary = weather?.summary || inferWeatherFromText(question, example.weatherSignal);
  return {
    companyName,
    siteName: weather?.locationLabel || inferLocationFromText(question, siteFallback),
    industry: inferIndustryFromText(question, example.industry),
    workSummary: inferWorkSummaryFromText(question, example.workType),
    workerCount: inferWorkerCountFromText(question),
    weather: isWeatherLoading ? "현재 기상 확인 중" : weatherSummary,
    sourceLabel: isWeatherLoading ? "기상청 확인 중" : weather?.mode === "live" ? "현재 기상 반영" : "입력+기상 보강",
    foreignWorkerSignal: inferForeignSignal(question, example.hasForeignWorkers)
  };
}

function buildApiFieldBrief(data: AskResponse, fallbackExample: FieldExample): FieldBrief {
  return {
    companyName: data.scenario.companyName || fallbackExample.companyName,
    siteName: data.scenario.siteName || fallbackExample.region,
    industry: data.scenario.companyType || fallbackExample.industry,
    workSummary: data.scenario.workSummary || fallbackExample.workType,
    workerCount: `${data.scenario.workerCount}명`,
    weather: data.externalData.weather.summary || data.scenario.weatherNote || fallbackExample.weatherSignal,
    sourceLabel: data.externalData.weather.mode === "live" ? "API 반영 브리프" : "입력+보강 브리프",
    foreignWorkerSignal: inferForeignSignal(data.question, fallbackExample.hasForeignWorkers)
  };
}

function qualityStatusCopy(status: QualityContractStatus) {
  if (status === "ready") return "준비됨";
  if (status === "blocked") return "확인 필요";
  if (status === "degraded") return "보강 필요";
  return "확인 중";
}

function qualityProofClass(status: QualityContractStatus) {
  if (status === "ready") return "api-proof live";
  if (status === "blocked" || status === "degraded") return "api-proof warn";
  return "api-proof";
}

function readinessClass(tone: ReadinessTone) {
  if (tone === "ready") return "ready";
  if (tone === "warn") return "warn";
  return "pending";
}

function modeTone(mode: IntegrationMode | "unconfigured" | undefined): ReadinessTone {
  if (mode === "live") return "ready";
  if (mode === "fallback" || mode === "mock" || mode === "unconfigured") return "warn";
  return "pending";
}

function modeCopy(mode: IntegrationMode | "unconfigured" | undefined) {
  if (mode === "live") return "매칭됨";
  if (mode === "fallback") return "보조 근거";
  if (mode === "mock") return "예시 기준";
  if (mode === "unconfigured") return "연결 대기";
  return "조회 예정";
}

function buildReadinessRail(
  data: AskResponse | null,
  state: GenerationState,
  liveWeather: WeatherBrief | null,
  isWeatherLoading: boolean
): ReadinessRailItem[] {
  const referenceCount = data?.externalData.safetyReference?.count || 0;
  const knowledgeCount = data?.externalData.safetyKnowledge?.matches.length || 0;
  const koshaCount = data?.externalData.kosha.references.length || 0;
  const ontologyReviewable = data?.ontologyQa?.result.reviewable;
  const generated = Boolean(data);
  const generating = state === "generating";
  const weatherMode = data?.externalData.weather.mode || liveWeather?.mode;

  return [
    {
      key: "sif",
      label: "고위험요인 사례",
      status: referenceCount ? `${referenceCount}건 반영` : generating ? "조회 중" : "조회 예정",
      detail: referenceCount
        ? "SIF·공정·장비 자료를 위험성평가/TBM 후보로 압축했습니다."
        : "입력 작업과 유사한 SIF 사례와 작업별 참고자료를 찾습니다.",
      tone: referenceCount ? "ready" : generating ? "pending" : "pending"
    },
    {
      key: "kosha",
      label: "KOSHA 공식자료",
      status: koshaCount ? `${koshaCount}건 연결` : generated ? modeCopy(data?.externalData.kosha.mode) : "조회 예정",
      detail: koshaCount
        ? "기술지침·교육자료가 문서 근거와 교육 항목에 연결됩니다."
        : "공식자료와 교육 추천을 문서 하단 근거로 붙입니다.",
      tone: koshaCount ? "ready" : modeTone(data?.externalData.kosha.mode)
    },
    {
      key: "ontology",
      label: "위험요인-조치 그래프",
      status: ontologyReviewable
        ? data?.ontologyQa?.result.verdict || "검수됨"
        : generated ? "검수 보류" : "생성 후 검수",
      detail: ontologyReviewable
        ? "작업유형, 위험요인, 감소대책, 조문 경로를 문서 본문과 대조했습니다."
        : "승인된 작업 이력과 안전조치 기준으로 누락 항목을 확인합니다.",
      tone: ontologyReviewable
        ? data?.ontologyQa?.result.verdict === "통과" ? "ready" : "warn"
        : generated ? "warn" : "pending"
    },
    {
      key: "history",
      label: "현장 이력",
      status: generated ? "저장 준비" : "생성 후 연결",
      detail: "오늘 작업과 개선사항은 workpack 이력에 남겨 다음 유사 작업/TBM의 후보가 됩니다.",
      tone: generated ? "ready" : "pending"
    },
    {
      key: "weather",
      label: "기상·조건",
      status: isWeatherLoading ? "확인 중" : modeCopy(weatherMode),
      detail: liveWeather || data ? "입력 지역의 기상 조건을 현장 브리프와 TBM에 반영합니다." : "입력 중 현재 기상 신호를 먼저 확인합니다.",
      tone: isWeatherLoading ? "pending" : modeTone(weatherMode)
    }
  ];
}

function buildGenerationStages(data: AskResponse | null, state: GenerationState): GenerationStage[] {
  const generating = state === "generating";
  const generated = Boolean(data);
  return [
    {
      label: "기상 확인",
      detail: generated ? "현장 조건 반영" : "지역·날씨 신호 확인",
      tone: generated ? "ready" : generating ? "pending" : "pending"
    },
    {
      label: "법령 매칭",
      detail: generated ? "문서 근거 연결" : "산안법·중처법 근거 탐색",
      tone: generated ? "ready" : generating ? "pending" : "pending"
    },
    {
      label: "SIF/KOSHA DB",
      detail: generated ? "유사사례 압축" : "고위험 사례와 기술자료 조회",
      tone: generated ? "ready" : generating ? "pending" : "pending"
    },
    {
      label: "안전조치 검수",
      detail: generated ? "누락 조치 대조" : "작업유형 그래프 준비",
      tone: generated ? "ready" : generating ? "pending" : "pending"
    },
    {
      label: "문서 생성",
      detail: generated ? "위험성평가/TBM 준비" : "핵심 문서 작성",
      tone: generated ? "ready" : generating ? "pending" : "pending"
    }
  ];
}

function documentMatchesTitle(documentNames: string[] | undefined, documentTitle: string): boolean {
  if (!documentNames?.length) return false;
  const normalizedTitle = documentTitle.replace(/표$/, "");
  return documentNames.some((name) => {
    const normalizedName = name.replace(/표$/, "");
    return normalizedName.includes(normalizedTitle) || normalizedTitle.includes(normalizedName);
  });
}

function selectedDocumentEvidence(data: AskResponse | null, key: DocumentKey): DocumentSourceRailItem[] {
  if (!data) {
    return [
      {
        label: "직접 근거",
        value: "생성 후 표시",
        detail: "법령·KOSHA·문서 반영 위치를 확인합니다.",
        meta: "원문 확인 전",
        tone: "pending"
      },
      {
        label: "보조 근거",
        value: "생성 후 표시",
        detail: "유사 사례와 현장 조건을 함께 확인합니다.",
        meta: "현장 판단 보조",
        tone: "pending"
      }
    ];
  }

  const documentTitle = outputItems.find((item) => item.key === key)?.title || "선택 문서";
  const evidenceLabel = data.evidenceLabels?.[key];
  const referenceItems = data.externalData.safetyReference?.items || [];
  const directReference = referenceItems.find((item) =>
    item.evidenceRoleLabel?.includes("직접") && documentMatchesTitle(item.primaryDocuments, documentTitle)
  )
    || referenceItems.find((item) => documentMatchesTitle(item.primaryDocuments, documentTitle))
    || referenceItems.find((item) => item.evidenceRoleLabel?.includes("직접"))
    || referenceItems[0];
  const supportReference = referenceItems.find((item) =>
    item.id !== directReference?.id
      && item.evidenceRoleLabel?.includes("보조")
      && documentMatchesTitle(item.primaryDocuments, documentTitle)
  )
    || referenceItems.find((item) => item.id !== directReference?.id && item.evidenceRoleLabel?.includes("보조"))
    || data.externalData.safetyKnowledge?.matches.find((item) => documentMatchesTitle(item.primaryDocuments, documentTitle))
    || data.externalData.safetyKnowledge?.matches[0];
  const koshaReference = data.externalData.kosha.references.find((item) =>
    documentMatchesTitle(item.appliedTo, documentTitle) || documentMatchesTitle(item.appliesTo, documentTitle)
  ) || data.externalData.kosha.references[0];
  const lawCitation = data.citations.find((item) => item.citation) || data.citations[0];
  const supportDetail = supportReference
    ? "documentReflectionLabel" in supportReference
      ? supportReference.documentReflectionLabel
      : "operationSignalLabel" in supportReference
        ? supportReference.operationSignalLabel
        : undefined
    : undefined;
  const qa = data.ontologyQa?.result;
  const missingControls = qa?.reviewable ? qa.missing.controls : [];
  const items: DocumentSourceRailItem[] = [];

  if (evidenceLabel || directReference || lawCitation) {
    items.push({
      label: "직접 근거",
      value: evidenceLabel
        ? formatEvidenceBadge(evidenceLabel.article)
        : directReference?.title || lawCitation?.title || "원문 확인 권장",
      detail: directReference?.operationSignalLabel
        || directReference?.shortSummary
        || evidenceLabel?.purpose
        || lawCitation?.summary
        || "법령·공식자료 원문과 문서 본문을 함께 확인하세요.",
      meta: evidenceLabel ? "법령 조항" : directReference?.sourceKindLabel || lawCitation?.sourceLabel || "원문 확인 권장",
      tone: evidenceLabel || directReference ? "ready" : "warn",
      href: lawCitation?.sourceUrl
    });
  }

  if (supportReference) {
    items.push({
      label: "보조 근거",
      value: "보조 근거 연결",
      detail: supportReference?.shortSummary || supportDetail || "유사사례와 현장 조건은 현장 확인 후 참고합니다.",
      meta: "현장 판단 보조",
      tone: "ready"
    });
  }

  if (koshaReference) {
    items.push({
      label: "공식자료",
      value: koshaReference.title,
      detail: koshaReference.summary || koshaReference.impact,
      meta: koshaReference.agency || "KOSHA",
      tone: koshaReference.verified === false ? "warn" : "ready",
      href: koshaReference.url
    });
  }

  items.push({
      label: "안전조치 검수",
      value: qa?.reviewable ? qa.verdict : "원문 확인 권장",
      detail: qa?.reviewable
        ? missingControls.length
          ? missingControls.slice(0, 2).map((item) => item.control).join(" · ")
          : "필수 안전조치가 문서 본문에 반영됐습니다."
        : "검증된 작업유형 기준과 원문을 함께 확인하세요.",
      meta: data.qualityContract ? qualityStatusCopy(data.qualityContract.overall) : "검수 대기",
      tone: qa?.reviewable ? missingControls.length ? "warn" : "ready" : "warn"
    });

  if (!evidenceLabel) {
    items.push({
      label: "원문 확인",
      value: "원문 확인 권장",
      detail: "제출 전 선택 문서의 법령·공식자료 원문과 현장 조건을 한 번 더 대조하세요.",
      meta: data.mode === "live" ? "근거 연결됨" : "보조 근거",
      tone: qa?.reviewable ? missingControls.length ? "warn" : "ready" : "pending"
    });
  }

  return items.slice(0, 5);
}

function parseStoredImprovements(): OperationImprovement[] {
  if (typeof window === "undefined") return [];
  return parseOperationImprovements(window.localStorage.getItem(OPERATION_IMPROVEMENTS_STORAGE_KEY));
}

function formatImprovementTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatVisionStatus(status?: OperationImprovement["visionStatus"], label?: string) {
  if (label) return label;
  if (status === "analyzed") return "vision/OCR 분석 완료";
  if (status === "failed") return "사진쌍 저장 · vision/OCR 실패";
  if (status === "unconfigured") return "사진쌍 저장 · vision/OCR 보류";
  return "사진 분석 없음";
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="step-dot done" aria-hidden="true">
        ✓
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="step-dot locked" aria-hidden="true">
        ▣
      </span>
    );
  }
  return <span className={`step-dot ${status}`} aria-hidden="true" />;
}

function SafeClawHomepage({ onStart }: { onStart: () => void }) {
  const navItems = [
    ["시스템", "system"],
    ["선언", "manifesto"],
    ["실행", "execution"],
    ["언어", "language"],
    ["도입사례", "proof"],
    ["작업공간", "command"]
  ] as const;
  const pipeline = [
    { code: "01 · INPUT", title: "입력", body: "오늘 작업 한 줄에서 현장 브리프와 근거 후보를 준비", metric: "현장 상황" },
    { code: "02 · DOCS", title: "문서", body: "위험성평가와 TBM을 중심으로 공식 근거와 누락 조치를 대조", metric: "위험성평가/TBM" },
    { code: "03 · SHARE", title: "공유", body: "작업자 열람, 언어 전환, 확인 이력, 개선사항 후보를 남김", metric: "열람·확인" }
  ];
  const proofSources = [
    ["L.14991", "산업안전보건법", "법령 조항"],
    ["KOSHA-2024", "KOSHA Guide", "공식자료"],
    ["MOEL", "고용노동부 고시", "교육·지침"],
    ["KMA", "기상청", "현재·예보"],
    ["WORK24", "고용24", "후속 교육"],
    ["AI", "Gemini", "문서 초안"]
  ];
  const languages = [
    ["KO", "한국어", "오늘의 안전 수칙"],
    ["VI", "Tiếng Việt", "Quy tắc an toàn hôm nay"],
    ["TH", "ภาษาไทย", "กฎความปลอดภัยวันนี้"],
    ["UZ", "O'zbek", "Bugungi xavfsizlik qoidalari"],
    ["MN", "Монгол", "Өнөөдрийн аюулгүй"],
    ["ZH", "中文", "今日安全守则"],
    ["KM", "ភាសាខ្មែរ", "ច្បាប់សុវត្ថិភាពថ្ងៃនេះ"],
    ["NE", "नेपाली", "आजको सुरक्षा नियम"],
    ["ID", "Bahasa", "Aturan keselamatan"],
    ["MY", "မြန်မာ", "ယနေ့ဘေးကင်းရေး"]
  ];

  function jumpTo(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="safeclaw-landing" aria-label="SafeClaw 회사 홈페이지">
      <header className="safeclaw-landing-nav">
        <Link href="/" className="safeclaw-os-brand" aria-label="SafeClaw OS 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark-Inverse.svg" alt="" className="safeclaw-os-mark" width={28} height={28} />
          <strong>safeclaw/<em>os</em></strong>
        </Link>
        <nav aria-label="SafeClaw 홈페이지 메뉴">
          {navItems.map(([label, id]) => (
            <button key={id} type="button" onClick={() => jumpTo(id)}>{label}</button>
          ))}
        </nav>
        <div className="safeclaw-landing-actions">
          <button type="button" className="safeclaw-login" onClick={onStart}>로그인</button>
          <button type="button" className="safeclaw-contact" onClick={onStart}>도입 문의 →</button>
        </div>
      </header>

      <section className="safeclaw-os-hero" id="system">
        <div className="safeclaw-os-status">
          <span><i /> 시스템 · 정상 가동</span>
          <b>REGION · KR-CENTRAL</b>
          <b>FIELD OS · ACTIVE</b>
          <b>UTC+9 · 2026-05-01</b>
        </div>
        <div className="safeclaw-os-hero-body">
          <div>
            <span className="safeclaw-os-tag">산업안전 · 현장 운영 체제</span>
            <h1>
              서류는<br />
              <mark>안전이 아니다.</mark><br />
              실행만이 안전이다.
            </h1>
            <p>safeclaw는 산업 현장의 운영 체제입니다.</p>
            <p>한 줄 입력으로 위험성평가, TBM, 안전교육, 외국인 전파, 증빙 이력까지 연결합니다.</p>
            <div className="safeclaw-os-cta">
              <button type="button" onClick={onStart}>작업 생성 시작 →</button>
              <Link href="/documents">문서팩 확인</Link>
            </div>
          </div>
          <aside className="safeclaw-os-console" aria-label="실행 콘솔">
            <span>safeclaw@field-os ~ %</span>
            <b># 아래 버튼을 눌러 샘플 작업을 배포하세요</b>
            <button type="button" onClick={onStart}>작업공간 열기</button>
          </aside>
        </div>
      </section>

      <section className="safeclaw-os-section" id="manifesto">
        <div className="safeclaw-os-section-head">
          <span>§ 01</span>
          <b>선언</b>
        </div>
        <h2>한 줄 입력에서 확인 이력까지,<br /><mark>3단계 워크벤치</mark>로.</h2>
        <div className="safeclaw-pipeline-grid">
          {pipeline.map((item) => (
            <article key={item.code}>
              <span>{item.code}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <b>{item.metric}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section compact" id="execution">
        <div className="safeclaw-os-section-head">
          <span>§ 02</span>
          <b>학습된 코퍼스 · 인용 가능 근거</b>
        </div>
        <div className="safeclaw-proof-matrix">
          {proofSources.map(([code, title, meta]) => (
            <article key={code}>
              <span>{code}</span>
              <h3>{title}</h3>
              <p>{meta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section" id="language">
        <div className="safeclaw-os-section-head">
          <span>§ 03</span>
          <b>언어</b>
        </div>
        <h2>외국인 작업자에게<br /><mark>"알아서 통역"</mark>은 끝났습니다.</h2>
        <div className="safeclaw-language-matrix">
          {languages.map(([code, title, sub]) => (
            <article key={code}>
              <span>{code}</span>
              <h3>{title}</h3>
              <p>{sub}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section terminal" id="proof">
        <div className="safeclaw-os-section-head">
          <span>§ 04</span>
          <b>실행</b>
        </div>
        <h2>작업 명령. <mark>실행.</mark></h2>
        <div className="safeclaw-terminal">
          <div><span /> <span /> <span /> <b>safeclaw@field-os ~ %</b><em>접속됨</em></div>
          <pre>{`# 샘플 작업을 실제 API 조합으로 생성합니다
질문: 서울 성수동 외벽 도장 · 이동식 비계 · 강풍 · 신규 작업자
출력: 위험성평가표 / TBM / 안전교육 / 외국인 전송본 / 현장 전파 메시지`}</pre>
          <button type="button" onClick={onStart}>샘플 작업 생성으로 이동 →</button>
        </div>
      </section>
    </section>
  );
}

export function SafeGuardCommandCenter({
  examples,
  initialScenarioId,
  initialQuestion,
  autoGenerate,
  workspaceTheme = "day"
}: SafeGuardCommandCenterProps) {
  const initialExample = examples.find((example) => example.id === initialScenarioId) || examples[0];
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(initialExample.id);
  const selectedExample = useMemo(
    () => examples.find((example) => example.id === selectedExampleId) || examples[0],
    [examples, selectedExampleId]
  );
  const [question, setQuestion] = useState(initialQuestion || selectedExample.question);
  const [data, setData] = useState<AskResponse | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<GenerationState>("idle");
  const [checkedActions, setCheckedActions] = useState<boolean[]>([]);
  const [liveWeather, setLiveWeather] = useState<WeatherBrief | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [workspacePage, setWorkspacePage] = useState<WorkspacePage>("input");
  const [editorFocusToken, setEditorFocusToken] = useState(0);
  const [requestedDocumentKey, setRequestedDocumentKey] = useState<DocumentKey>("riskAssessmentDraft");
  const [consoleLines, setConsoleLines] = useState<AgentConsoleLine[]>([]);
  const [improvementText, setImprovementText] = useState("");
  const [operationImprovements, setOperationImprovements] = useState<OperationImprovement[]>(() => parseStoredImprovements());
  const [beforePhoto, setBeforePhoto] = useState<LocalPhoto | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<LocalPhoto | null>(null);
  const [inputHazardPhoto, setInputHazardPhoto] = useState<LocalPhoto | null>(null);
  const [savedWorkpackId, setSavedWorkpackId] = useState<string | null>(null);
  const [improvementSaveState, setImprovementSaveState] = useState<ImprovementSaveState>("idle");
  const [activeWorkspaceTheme, setActiveWorkspaceTheme] = useState<WorkspaceTheme>(workspaceTheme);
  const [aiMode, setAiMode] = useState<"template" | "enhanced" | "full">(() => {
    if (typeof window === "undefined") return "enhanced";
    const stored = window.localStorage.getItem("safeclaw.aiMode");
    if (stored === "enhanced" || stored === "full") return stored;
    return "enhanced";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("safeclaw.aiMode", aiMode);
    } catch {
      /* ignore quota */
    }
  }, [aiMode]);

  useEffect(() => () => {
    if (beforePhoto) URL.revokeObjectURL(beforePhoto.url);
  }, [beforePhoto]);

  useEffect(() => () => {
    if (afterPhoto) URL.revokeObjectURL(afterPhoto.url);
  }, [afterPhoto]);

  useEffect(() => () => {
    if (inputHazardPhoto) URL.revokeObjectURL(inputHazardPhoto.url);
  }, [inputHazardPhoto]);

  function moveToWorkspacePage(targetPage: WorkspacePage) {
    const gate = canOpenWorkspacePage({
      targetPage,
      hasWorkpack: Boolean(data),
      isGenerating: state === "generating"
    });
    if (!gate.allowed) {
      setMessage(gate.reason || "문서 생성 후 열 수 있습니다.");
      return;
    }
    setWorkspacePage(targetPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusWorkpackEditor(key: DocumentKey) {
    setRequestedDocumentKey(key);
    setWorkspacePage("document");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setEditorFocusToken((current) => current + 1);
    setMessage("선택한 문서를 편집·다운로드 영역으로 열었습니다. PDF·XLS·HWPX 버튼으로 출력하세요.");
  }

  function persistCurrentWorkpack(payload: AskResponse) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        CURRENT_WORKPACK_STORAGE_KEY,
        JSON.stringify(buildStoredCurrentWorkpack(payload))
      );
    } catch (error) {
      console.warn("safeclaw current workpack save failed", error);
    }
  }

  function attachImprovementPhoto(kind: "before" | "after", fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const nextPhoto = { name: file.name, url, file };
    if (kind === "before") {
      if (beforePhoto) URL.revokeObjectURL(beforePhoto.url);
      setBeforePhoto(nextPhoto);
    } else {
      if (afterPhoto) URL.revokeObjectURL(afterPhoto.url);
      setAfterPhoto(nextPhoto);
    }
  }

  function attachInputHazardPhoto(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (inputHazardPhoto) URL.revokeObjectURL(inputHazardPhoto.url);
    setInputHazardPhoto({ name: file.name, url, file });
    setMessage("사진 기반 위험요인 후보를 준비했습니다. 후보는 생성 전 관리자가 확인해야 합니다.");
  }

  function inputPhotoHazardCandidates() {
    return buildHazardPhotoCandidates(question, inputHazardPhoto?.name);
  }

  function applyInputPhotoCandidate(label: string, detail: string) {
    const addition = `${label}: ${detail}`;
    if (question.includes(addition)) return;
    setQuestion((current) => `${current.trim()}\n사진 후보 - ${addition}`.trim());
    setMessage("사진 위험요인 후보를 입력에 반영했습니다. 최종 문서 생성 전 현장 확인이 필요합니다.");
  }

  function buildPhotoAnalysisCandidate() {
    return buildPhotoAnalysisCandidateText({
      beforePhoto,
      afterPhoto,
      workSummary: fieldBrief.workSummary,
      topRisk: data?.riskSummary.topRisk,
      reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    });
  }

  async function ensureSavedWorkpackId(): Promise<WorkpackSaveResult> {
    if (savedWorkpackId) {
      return { ok: true, configured: true, workpackId: savedWorkpackId, message: "이미 저장된 문서팩을 사용합니다." };
    }
    if (!data) {
      return { ok: false, configured: false, workpackId: null, message: "문서팩 생성 후 DB 개선사항 저장을 사용할 수 있습니다." };
    }

    const response = await fetch("/api/workpacks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data,
        question: data.question,
        scenario: data.scenario,
        deliverables: data.deliverables,
        status: data.status
      })
    });
    const parsed = (await response.json().catch((): unknown => ({}))) as unknown;
    if (!response.ok || typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        configured: response.status !== 503,
        workpackId: null,
        message: readApiMessage(parsed, `문서팩 저장 요청 실패: HTTP ${response.status}`)
      };
    }

    const record = parsed as Record<string, unknown>;
    const workpackId = typeof record.workpackId === "string" ? record.workpackId : null;
    const ok = record.ok === true && Boolean(workpackId);
    if (ok && workpackId) {
      setSavedWorkpackId(workpackId);
    }
    return {
      ok,
      configured: typeof record.configured === "boolean" ? record.configured : undefined,
      workpackId,
      message: readApiMessage(record, ok ? "문서팩을 저장했습니다." : "문서팩 저장에 실패했습니다.")
    };
  }

  async function saveImprovementToApi(input: {
    workpackId: string;
    text: string;
  }): Promise<ImprovementApiResult> {
    const form = new FormData();
    form.set("taskLabel", fieldBrief.workSummary);
    form.set("hazardLabel", data?.riskSummary.topRisk || "현장 개선사항");
    form.set("improvementText", input.text);
    form.set("reflectedDocuments", ["위험성평가표", "TBM 브리핑", "TBM 기록"].join(","));
    if (beforePhoto) form.set("beforePhoto", beforePhoto.file, beforePhoto.name);
    if (afterPhoto) form.set("afterPhoto", afterPhoto.file, afterPhoto.name);

    const response = await fetch(`/api/workpacks/${encodeURIComponent(input.workpackId)}/improvements`, {
      method: "POST",
      body: form
    });
    const parsed = (await response.json().catch((): unknown => ({}))) as unknown;
    if (!response.ok || typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        configured: response.status !== 503,
        improvementId: null,
        message: readApiMessage(parsed, `개선사항 저장 요청 실패: HTTP ${response.status}`)
      };
    }

    const record = parsed as Record<string, unknown>;
    const improvementId = typeof record.improvementId === "string" ? record.improvementId : null;
    const vision = typeof record.vision === "object" && record.vision !== null && !Array.isArray(record.vision)
      ? record.vision as ImprovementApiResult["vision"]
      : undefined;
    return {
      ok: record.ok === true && Boolean(improvementId),
      configured: typeof record.configured === "boolean" ? record.configured : undefined,
      improvementId,
      sourceType: record.sourceType === "photo_analysis" ? "photo_analysis" : "manual",
      vision,
      message: readApiMessage(record, "개선사항 저장 결과를 확인했습니다.")
    };
  }

  function persistOperationImprovements(items: OperationImprovement[]) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(OPERATION_IMPROVEMENTS_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn("safeclaw improvements save failed", error);
    }
  }

  async function saveOperationImprovement() {
    const photoCandidate = buildPhotoAnalysisCandidate();
    const text = improvementText.trim() || photoCandidate;
    if (!text) {
      setMessage("오늘 작업 개선사항을 입력하거나 Before/After 사진을 첨부해 주세요.");
      return;
    }
    setImprovementSaveState("saving");

    let storageMode: OperationImprovement["storageMode"] = "local";
    let remoteImprovementId: string | undefined;
    let workpackId: string | undefined;
    let sourceType: OperationImprovement["sourceType"] = beforePhoto && afterPhoto ? "photo_analysis" : "manual";
    let visionStatus: OperationImprovement["visionStatus"];
    let analysisMode: OperationImprovement["analysisMode"];
    let photoPairAttached: boolean | undefined;
    let visionUserLabel: string | undefined;
    let visionSummary: string | undefined;
    let detectedHazards: string[] | undefined;
    let observedImprovement: string | undefined;
    let ocrText: string | undefined;
    let saveMessage = "로컬 후보로 보관했습니다.";

    try {
      const workpackSave = await ensureSavedWorkpackId();
      if (!workpackSave.ok || !workpackSave.workpackId) {
        saveMessage = workpackSave.message;
      } else {
        workpackId = workpackSave.workpackId;
        const improvementSave = await saveImprovementToApi({ workpackId: workpackSave.workpackId, text });
        saveMessage = improvementSave.message;
        if (improvementSave.ok && improvementSave.improvementId) {
          storageMode = "db";
          remoteImprovementId = improvementSave.improvementId;
          sourceType = improvementSave.sourceType || sourceType;
          visionStatus = improvementSave.vision?.status;
          analysisMode = improvementSave.vision?.analysisMode;
          photoPairAttached = improvementSave.vision?.photoPairAttached;
          visionUserLabel = improvementSave.vision?.userLabel;
          visionSummary = improvementSave.vision?.summary || improvementSave.vision?.observedImprovement;
          detectedHazards = improvementSave.vision?.detectedHazards;
          observedImprovement = improvementSave.vision?.observedImprovement;
          ocrText = improvementSave.vision?.ocrText;
        }
      }
    } catch (error) {
      console.warn("safeclaw improvement API save failed", error);
      saveMessage = error instanceof Error ? error.message : "DB 저장 연결이 보류되어 로컬 후보로 보관합니다.";
    }

    const nextItem: OperationImprovement = {
      id: remoteImprovementId || `improvement-${Date.now()}`,
      createdAt: new Date().toISOString(),
      siteName: fieldBrief.siteName,
      workSummary: fieldBrief.workSummary,
      hazardLabel: data?.riskSummary.topRisk || "현장 개선사항",
      improvementText: text,
      reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
      beforePhotoName: beforePhoto?.name,
      afterPhotoName: afterPhoto?.name,
      photoAnalysisSummary: visionSummary || photoCandidate || undefined,
      storageMode,
      sourceType,
      workpackId,
      remoteImprovementId,
      visionStatus,
      analysisMode,
      photoPairAttached,
      visionUserLabel,
      visionSummary,
      detectedHazards,
      observedImprovement,
      ocrText,
      saveMessage
    };
    const nextItems = [nextItem, ...operationImprovements].slice(0, 10);
    setOperationImprovements(nextItems);
    setImprovementText("");
    if (beforePhoto) URL.revokeObjectURL(beforePhoto.url);
    if (afterPhoto) URL.revokeObjectURL(afterPhoto.url);
    setBeforePhoto(null);
    setAfterPhoto(null);
    persistOperationImprovements(nextItems);
    setImprovementSaveState(storageMode === "db" ? "saved" : "local");
    setMessage(storageMode === "db"
      ? saveMessage
      : `오늘 작업 개선사항을 로컬 후보로 보관했습니다. ${saveMessage}`);
  }

  async function fetchViaLegacyEndpoint(trimmed: string): Promise<AskResponse> {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: trimmed, aiMode })
    });
    if (!response.ok) {
      throw new Error(`문서팩 생성 요청 실패: HTTP ${response.status}`);
    }
    return (await response.json()) as AskResponse;
  }

  function applyGeneratedPayload(payload: AskResponse) {
    persistCurrentWorkpack(payload);
    setData(payload);
    setSavedWorkpackId(null);
    setImprovementSaveState("idle");
    setCheckedActions(payload.riskSummary.immediateActions.map(() => false));
    setState("ready");
    setWorkspacePage("document");
    setMessage("문서팩을 준비했습니다. 편집, 다운로드, 근거 확인, 현장 전파를 이어가세요.");
  }

  async function generateWorkpack(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      setMessage("현장 상황을 입력해 주세요.");
      return;
    }

    setState("generating");
    setWorkspacePage(nextWorkspacePageAfterGenerate());
    setMessage("법령, 기상, 교육, 재해사례 근거를 확인하며 문서팩을 작성하고 있습니다.");
    setConsoleLines([]);

    // template mode: D-2a's stream only carries the final payload for template
    // scope, so keep it on the plain /api/ask path — simpler, no console needed.
    if (aiMode === "template") {
      try {
        const payload = await fetchViaLegacyEndpoint(trimmed);
        applyGeneratedPayload(payload);
      } catch (error) {
        console.error("workpack generation failed", error);
        setState("error");
        setWorkspacePage(nextWorkspacePageAfterGenerationError());
        setMessage("문서팩 생성 중 연결을 확인해야 합니다. 잠시 후 다시 시도해 주세요.");
      }
      return;
    }

    try {
      const payload = (await fetchAskStream({ question: trimmed, aiMode }, (event) => {
        setConsoleLines((current) => nextConsoleLines(current, event));
      })) as AskResponse;
      applyGeneratedPayload(payload);
    } catch (streamError) {
      // Stream fetch failed (non-200, network error, or ended without a final
      // event) — fall back to the existing non-streaming path. Existing
      // behavior/state contract must be preserved 100% on fallback.
      console.warn("AI 작업 콘솔 스트림 생성 실패 — 기존 경로로 재시도합니다.", streamError);
      setConsoleLines((current) => [
        ...current,
        {
          id: `fallback-${Date.now()}`,
          label: "실시간 작업 이력 연결 보류 — 기본 생성 경로로 재시도",
          status: "warn"
        }
      ]);
      try {
        const payload = await fetchViaLegacyEndpoint(trimmed);
        applyGeneratedPayload(payload);
      } catch (error) {
        console.error("workpack generation failed", error);
        setState("error");
        setWorkspacePage(nextWorkspacePageAfterGenerationError());
        setMessage("문서팩 생성 중 연결을 확인해야 합니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateWorkpack();
  }

  function selectExample(example: FieldExample) {
    setSelectedExampleId(example.id);
    setQuestion(example.question);
    setData(null);
    setSavedWorkpackId(null);
    setImprovementSaveState("idle");
    setLiveWeather(null);
    setState("idle");
    setWorkspacePage("input");
    setMessage(`${example.label} 현장 예시를 불러왔습니다. 필요하면 작업 조건을 수정한 뒤 생성하세요.`);
  }

  useEffect(() => {
    const trimmed = question.trim();
    if (data || trimmed.length < 8) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsWeatherLoading(true);
      fetch(`/api/weather?question=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as WeatherBriefResponse;
          if (!response.ok || !payload.ok || !payload.weather) {
            throw new Error(payload.message || `weather request failed: HTTP ${response.status}`);
          }
          setLiveWeather(payload.weather);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.warn("weather brief refresh failed", error);
          setLiveWeather(null);
        })
        .finally(() => setIsWeatherLoading(false));
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [data, question]);

  useEffect(() => {
    if (!autoGenerate) return;
    void generateWorkpack(initialQuestion);
    // Run once for URL-provided queries only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state === "generating";
  const hasWorkpack = Boolean(data);
  const currentStep = workspacePage;
  const statuses = buildWorkspaceStepStatuses({
    currentPage: workspacePage,
    hasWorkpack,
    isGenerating: state === "generating"
  });
  const fieldBrief = data ? buildApiFieldBrief(data, selectedExample) : buildInputFieldBrief(question, selectedExample, liveWeather, isWeatherLoading);
  const currentLawCount = lawCount(data, state);
  const currentDocProgress = docProgress(data, state);
  const inputLimit = 600;
  const inputWarning = question.length > Math.floor(inputLimit * 0.9);
  const weatherBrief = compactWeatherBrief(fieldBrief.weather);
  const selectedOutputItem = outputItems.find((item) => item.key === requestedDocumentKey) ?? focusDocumentItems[0];
  const selectedDocumentBody = data ? (data.deliverables as Record<string, unknown>)[selectedOutputItem.key] : "";
  const readinessRail = buildReadinessRail(data, state, liveWeather, isWeatherLoading);
  const generationStages = buildGenerationStages(data, state);
  const documentEvidence = selectedDocumentEvidence(data, selectedOutputItem.key);
  const supportingDocumentItems = outputItems.filter((item) => !primaryDocumentKeys.has(item.key));
  const photoAnalysisCandidate = buildPhotoAnalysisCandidate();
  const inputPhotoCandidates = inputPhotoHazardCandidates();
  const currentWorkflowStep = workflowSteps.find((step) => step.key === workspacePage) ?? workflowSteps[0];
  const themeShellClass = activeWorkspaceTheme === "day"
    ? "workspace-theme-day workspace-theme-field"
    : "workspace-theme-night";

  return (
    <main className={`command-center-shell ${themeShellClass}`}>
      <header className="command-topbar workspace-command-topbar">
        <Link href="/" className="brand-lockup safeclaw-lockup" aria-label="SafeClaw 홈으로 이동">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark.svg" alt="" className="brand-mark" width={32} height={32} />
          <span>
            <strong>SafeClaw</strong>
            <small>현장 안전 문서팩</small>
          </span>
        </Link>
        <div className="workspace-top-title">
          <span>{currentWorkflowStep.caption}</span>
          <strong>{currentWorkflowStep.label}</strong>
        </div>
        <div className="workspace-theme-toggle" aria-label="작업공간 테마 선택">
          <button
            type="button"
            className={activeWorkspaceTheme === "day" ? "active" : ""}
            aria-pressed={activeWorkspaceTheme === "day"}
            onClick={() => setActiveWorkspaceTheme("day")}
          >
            Day
          </button>
          <button
            type="button"
            className={activeWorkspaceTheme === "night" ? "active" : ""}
            aria-pressed={activeWorkspaceTheme === "night"}
            onClick={() => setActiveWorkspaceTheme("night")}
          >
            Night
          </button>
        </div>
        <div className="topbar-status" aria-live="polite">
          <span>{statusCopy(state)}</span>
          <b>{operationalStatus(data, state)}</b>
          <Link href="/documents" className="topbar-v2-link">문서팩</Link>
        </div>
      </header>

      <section className="command-viewport linear-workspace-layout" id="command">
        <aside className="workspace-side-nav" aria-label="작업공간 메뉴">
          <div className="workspace-side-group">
            <span>작업공간</span>
            {workflowSteps.map((step) => {
              const gate = canOpenWorkspacePage({
                targetPage: step.key,
                hasWorkpack,
                isGenerating: state === "generating"
              });
              return (
                <button
                  type="button"
                  key={step.key}
                  className={step.key === currentStep ? "active" : ""}
                  disabled={!gate.allowed}
                  onClick={() => moveToWorkspacePage(step.key)}
                >
                  <StepDot status={statuses[step.key]} />
                  <span>{step.label}</span>
                  <small>{workspaceStepStatusCopy(step.key, statuses[step.key], state, hasWorkpack)}</small>
                </button>
              );
            })}
          </div>
          <div className="workspace-side-group workspace-current-brief">
            <span>현재 작업</span>
            <strong>{fieldBrief.workSummary}</strong>
            <small>{fieldBrief.siteName} · {fieldBrief.workerCount}</small>
          </div>
          <div className="workspace-side-group workspace-source-status">
            <span>근거 준비</span>
            {readinessRail.slice(0, 3).map((item) => (
              <p key={item.key}>
                <b>{item.label}</b>
                <small>{item.status}</small>
              </p>
            ))}
          </div>
          <div className="workspace-side-group workspace-recent-list">
            <span>최근 예시</span>
            {examples.slice(0, 4).map((example) => (
              <button
                key={example.id}
                type="button"
                className={example.id === selectedExampleId ? "active" : ""}
                onClick={() => selectExample(example)}
              >
                <span>{example.label}</span>
                <small>{example.region}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className={`command-main card command-main-studio workspace-${workspacePage}-page`}>
          {workspacePage === "input" ? (
            <section className="workspace-step-page workspace-input-page" id="workspace-input-page">
          <div className="command-copy">
            <span className="eyebrow">현장 작업 입력</span>
            <h1>오늘 작업은 무엇인가요?</h1>
            <p>지역, 작업, 인원, 주요 위험만 적어도 됩니다.</p>
          </div>

          <form className="command-console" onSubmit={submit}>
            <div className="console-head">
              <label htmlFor="field-command-input">현장 상황 입력</label>
              <span className={inputWarning ? "counter warning" : "counter"}>{question.length}/{inputLimit}자</span>
            </div>
            <textarea
              id="field-command-input"
              className="textarea command-console-input"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setSelectedExampleId(null);
                setData(null);
                setState("idle");
                setWorkspacePage("input");
              }}
              maxLength={inputLimit}
              placeholder="오늘 작업 내용을 한 줄로 입력하세요."
              aria-describedby="field-command-tips"
            />
            <p className="input-helper" id="field-command-tips">
              작성 팁: 지역, 업종, 작업인원, 장비, 날씨/조건, 신규·외국인 근로자 여부, 핵심 위험을 포함하면 정확도가 올라갑니다.
            </p>
            <div className="field-brief-chip-row" aria-label="자동 인식 현장 요약">
              <span>{fieldBrief.siteName}</span>
              <span>{fieldBrief.industry}</span>
              <span>{weatherBrief.summary}</span>
              <span>{fieldBrief.workerCount}</span>
              <span>{fieldBrief.foreignWorkerSignal}</span>
            </div>
            <section className="input-photo-hazard-panel" aria-label="현장 사진 위험요인 후보">
              <div className="input-photo-copy">
                <span>Photo risk input</span>
                <strong>현장 사진으로 위험요인 후보 찾기</strong>
                <p>사진은 확정 판단이 아니라 추락, 차량동선, 정리정돈 같은 후보를 먼저 띄우는 보조 입력입니다.</p>
              </div>
              <label className={inputHazardPhoto ? "input-photo-dropzone has-photo" : "input-photo-dropzone"}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => attachInputHazardPhoto(event.currentTarget.files)}
                  disabled={busy}
                />
                {inputHazardPhoto ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inputHazardPhoto.url} alt="" />
                    <span>{inputHazardPhoto.name}</span>
                  </>
                ) : (
                  <>
                    <strong>사진 첨부</strong>
                    <span>작업면, 장비, 통로, 보호구 상태</span>
                  </>
                )}
              </label>
              <div className="input-photo-candidates">
                {inputPhotoCandidates.length ? (
                  inputPhotoCandidates.map((candidate) => (
                    <button
                      key={candidate.label}
                      type="button"
                      onClick={() => applyInputPhotoCandidate(candidate.label, candidate.detail)}
                    >
                      <strong>{candidate.label}</strong>
                      <span>{candidate.detail}</span>
                    </button>
                  ))
                ) : (
                  <p>사진을 첨부하면 위험성평가서에 반영할 검토 후보가 이곳에 표시됩니다.</p>
                )}
              </div>
            </section>
            <div className="evidence-readiness-rail" aria-label="근거 준비 레일">
              {readinessRail.map((item) => (
                <article key={item.key} className={`evidence-readiness-card ${readinessClass(item.tone)}`}>
                  <span>{item.label}</span>
                  <strong>{item.status}</strong>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
            <details className="advanced-settings">
              <summary>고급 설정</summary>
              <fieldset className="ai-mode-toggle" aria-label="AI 강도 선택">
                <legend>AI 본문 생성 강도</legend>
                <label className={`ai-mode-option ${aiMode === "template" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="ai-mode"
                    value="template"
                    checked={aiMode === "template"}
                    onChange={() => setAiMode("template")}
                    disabled={busy}
                  />
                  <span>
                    <strong>템플릿 (빠른 생성)</strong>
                    <small>응답 5–15초 · 무료 · 검증된 본문</small>
                  </span>
                </label>
                <label className={`ai-mode-option ${aiMode === "enhanced" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="ai-mode"
                    value="enhanced"
                    checked={aiMode === "enhanced"}
                    onChange={() => setAiMode("enhanced")}
                    disabled={busy}
                  />
                  <span>
                    <strong>강화 (기본)</strong>
                    <small>응답 +5–15초 · 위험성평가/TBM 본문 시나리오 맞춤 생성</small>
                  </span>
                </label>
                <label className={`ai-mode-option ${aiMode === "full" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="ai-mode"
                    value="full"
                    checked={aiMode === "full"}
                    onChange={() => setAiMode("full")}
                    disabled={busy}
                  />
                  <span>
                    <strong>풀 AI (전체 문서 생성)</strong>
                    <small>응답 +30–60초 · 문서 12종 + 외국인 안내문 5개 언어 모두 AI 생성</small>
                  </span>
                </label>
              </fieldset>
            </details>
            <div className="command-actions">
              <button type="submit" className="button command-primary" disabled={busy} aria-busy={busy}>
                {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
                {busy ? "근거 확인 중" : "안전 문서 생성"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (question !== selectedExample.question && !window.confirm("현재 입력한 내용을 예시 문장으로 되돌릴까요?")) {
                    return;
                  }
                  setQuestion(selectedExample.question);
                  setData(null);
                  setState("idle");
                  setWorkspacePage("input");
                }}
              >
                예시로 되돌리기
              </button>
            </div>
          </form>

          <details className="quick-scenario-chips" aria-label="현장 예시">
            <summary>예시 불러오기</summary>
            <div className="quick-scenario-chip-list">
              {examples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={`quick-chip ${example.id === selectedExampleId ? "active" : ""}`}
                  onClick={() => selectExample(example)}
                  aria-pressed={example.id === selectedExampleId}
                >
                  {example.id === selectedExampleId ? <span aria-hidden="true">✓</span> : null}
                  {example.label}
                </button>
              ))}
            </div>
          </details>
            </section>
          ) : null}

          {workspacePage === "document" ? (
            <section className="workspace-step-page workspace-document-page" id="workspace-document-page">
          <section className="output-card-grid document-workbench" id="workpack">
            <div className="compact-head document-workbench-head">
              <div>
                <span className="eyebrow">안전조치 검수</span>
                <strong>{selectedOutputItem.title}</strong>
                <small>{message || "선택 문서의 본문, 인용 근거, 원문 확인 상태를 함께 검토합니다."}</small>
              </div>
              <div className="document-progress-summary" aria-label={`문서팩 진행 ${currentDocProgress}/${totalDocumentCount}`}>
                <span>{currentDocProgress}/{totalDocumentCount}</span>
                <b>{currentLawCount ? `${currentLawCount}건 근거` : "근거 준비"}</b>
              </div>
            </div>
            {busy ? (
              <div className="generation-focus" role="status" aria-live="polite">
                <span className="button-spinner" aria-hidden="true" />
                <div>
                  <strong>문서팩 생성 중</strong>
                  <small>기상, 법령, SIF/KOSHA DB, 안전조치 검수를 순서대로 확인하고 있습니다.</small>
                </div>
              </div>
            ) : null}
            <div className="document-review-status-strip" aria-label="문서 검수 상태">
              {generationStages.map((stage) => (
                <article key={stage.label} className={readinessClass(stage.tone)}>
                  <span>{stage.label}</span>
                  <strong>{stage.tone === "ready" ? "완료" : state === "generating" ? "진행" : "대기"}</strong>
                </article>
              ))}
            </div>
            <div className={`inline-progress document-review-meter ${busy ? "animated" : ""}`} aria-label={`문서 작성 진행률 ${currentDocProgress}/${totalDocumentCount}`}>
              <span style={{ width: `${Math.max(8, (currentDocProgress / totalDocumentCount) * 100)}%` }} />
            </div>
            <div className="document-viewer-shell">
              <div className="document-viewer-list" aria-label="문서 목록">
                {focusDocumentItems.map((item, index) => {
                  const evidenceLabel = data?.evidenceLabels?.[item.key];
                  const selected = item.key === selectedOutputItem.key;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`${selected ? "selected" : ""} primary`}
                      onClick={() => setRequestedDocumentKey(item.key)}
                      aria-pressed={selected}
                    >
                      <span>핵심 · {String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.title}</strong>
                      <small>{evidenceLabel ? formatEvidenceBadge(evidenceLabel.article) : "안전조치 검수"}</small>
                    </button>
                  );
                })}
              </div>
              <div className="document-preview-grid">
                <article className="document-preview-pane">
                  <div className="document-preview-head">
                    <div>
                      <span>{data ? "문서 미리보기" : "생성 대기"}</span>
                      <strong>{selectedOutputItem.title}</strong>
                    </div>
                    {data ? (
                      <div className="doc-card-actions">
                        <button type="button" onClick={() => focusWorkpackEditor(selectedOutputItem.key)}>편집</button>
                        <button
                          type="button"
                          onClick={() => focusWorkpackEditor(selectedOutputItem.key)}
                          title={`${selectedOutputItem.title} 준제출형 내려받기`}
                        >
                          다운로드 영역 열기
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {data?.evidenceLabels?.[selectedOutputItem.key] ? (
                    <span
                      className="doc-card-evidence-badge"
                      title={`${data.evidenceLabels[selectedOutputItem.key].article} — ${data.evidenceLabels[selectedOutputItem.key].purpose}${data.evidenceLabels[selectedOutputItem.key].related ? ` (병기: ${data.evidenceLabels[selectedOutputItem.key].related})` : ""}`}
                    >
                      {formatEvidenceBadge(data.evidenceLabels[selectedOutputItem.key].article)}
                    </span>
                  ) : null}
                  <pre>
                    {typeof selectedDocumentBody === "string" && selectedDocumentBody
                      ? selectedDocumentBody.slice(0, 1200)
                      : "현장 상황을 입력하고 문서팩을 생성하면 이곳에서 문서 본문과 근거를 바로 검토합니다."}
                  </pre>
                  <button
                    type="button"
                    className="button command-primary document-next-button"
                    disabled={!data}
                    onClick={() => moveToWorkspacePage("share")}
                  >
                    다음: 공유
                  </button>
                </article>
                <aside className="document-evidence-panel" aria-label="선택 문서 인용 근거">
                  <div className="compact-head">
                    <span className="eyebrow">인용 근거</span>
                    <strong>{selectedOutputItem.title}</strong>
                  </div>
                  {documentEvidence.map((item) => (
                    <article key={item.label} className={readinessClass(item.tone)}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.detail}</small>
                      <em>{item.meta}</em>
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          원문 열기
                        </a>
                      ) : null}
                    </article>
                  ))}
                </aside>
              </div>
            </div>
            <details className="document-work-history" open={busy}>
              <summary>
                <span>작업 이력</span>
                <strong>{busy ? "진행 중" : data ? "완료" : "생성 후 기록"}</strong>
              </summary>
              <div className="document-work-history-body">
                <p>{message || "문서 생성 과정의 확인 이력이 이곳에 남습니다."}</p>
                {consoleLines.length ? (
                  <AgentConsole lines={consoleLines} active={busy} />
                ) : (
                  <p className="work-history-empty">아직 표시할 작업 이력이 없습니다.</p>
                )}
              </div>
            </details>
            <details className="supporting-doc-cards">
              <summary>+ {supportingDocumentItems.length}개 문서 더 보기</summary>
              <div className="supporting-doc-list" aria-label="보조 문서 목록">
                {supportingDocumentItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => focusWorkpackEditor(item.key)}
                    disabled={!data}
                  >
                    <strong>{item.title}</strong>
                    <span>{data ? "편집·다운로드 영역에서 열기" : "핵심 문서 생성 후 확인"}</span>
                  </button>
                ))}
              </div>
            </details>
          </section>
            </section>
          ) : null}

          {workspacePage === "share" ? (
            <section className="workspace-step-page workspace-share-page" id="workspace-share-page">
          <section className="dispatch-preview-panel" id="dispatch-overview">
            <div className="share-workbench-title">
              <span className="eyebrow">Share</span>
              <strong>권한·확인·증빙 워크플로</strong>
              <p>공유 범위, 작업자 권한, 확인 상태, 저장될 근거를 전송 전에 같은 화면에서 검토합니다.</p>
            </div>
            <div className="share-session-grid">
              <section>
                <span>Permission</span>
                <strong>{fieldBrief.companyName} 현장팀</strong>
                <p>초대된 관리자와 작업자 snapshot 기준으로만 열람합니다. 공개 링크 익명 확인은 기본으로 열지 않습니다.</p>
                <small>초대된 사람만 열람 가능</small>
              </section>
              <section>
                <span>Role</span>
                <strong>관리자 편집 · 작업자 열람</strong>
                <p>작업자는 자동 언어 보기와 수동 언어 전환을 함께 사용합니다.</p>
                <small>작업자 표시명 기준 확인</small>
              </section>
              <section>
                <span>Acknowledgment</span>
                <strong>{data ? "확인 버튼 준비" : "문서 생성 후 활성화"}</strong>
                <p>열람 전용 화면의 확인 기록을 TBM·교육 확인 후보로 연결합니다.</p>
                <small>판정 문구 없이 이력으로 보관</small>
              </section>
              <section>
                <span>Evidence</span>
                <strong>workpack · 교육 · 전파</strong>
                <p>문서팩, 교육 확인, provider 전송 로그를 분리해서 남깁니다. 확인 세션 저장은 승인 후 확장합니다.</p>
                <small>메일·문자는 보조 채널</small>
              </section>
            </div>
            <section className="operation-ontology-panel" aria-label="그날 작업 개선사항">
              <div className="operation-capture-head">
                <div>
                  <span>Improvement capture</span>
                  <strong>Before/After 개선 캡처</strong>
                  <p>
                    같은 작업을 다시 입력했을 때 이전 개선사항이 위험성평가와 TBM 후보로 돌아오도록 사진과 메모를 함께 보관합니다.
                  </p>
                </div>
                <aside aria-label="개선 캡처 저장 상태">
                  <span>저장 방식</span>
                  <strong>
                    {improvementSaveState === "saving"
                      ? "저장 중"
                      : savedWorkpackId
                        ? "DB 후보"
                        : data
                          ? "DB 연결 준비"
                          : "로컬 후보"}
                  </strong>
                  <small>{savedWorkpackId ? "사진쌍과 vision/OCR 상태를 export에 포함" : "로그인·DB 미연결 시 로컬 후보로 보관"}</small>
                </aside>
              </div>
              <div className="operation-capture-layout">
                <div className="before-after-photo-grid" aria-label="Before After 사진 첨부">
                  {[
                    { key: "before" as const, label: "Before", title: "개선 전", photo: beforePhoto },
                    { key: "after" as const, label: "After", title: "개선 후", photo: afterPhoto }
                  ].map((item) => (
                    <label key={item.key} className={item.photo ? "has-photo" : ""}>
                      <span>{item.label}</span>
                      <strong>{item.title}</strong>
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo.url} alt={`${item.title} 사진 미리보기`} />
                      ) : (
                        <em>사진 첨부</em>
                      )}
                      <small>{item.photo?.name || "현장 상태 사진 1장"}</small>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => attachImprovementPhoto(item.key, event.currentTarget.files)}
                      />
                    </label>
                  ))}
                </div>
                <div className="operation-capture-form">
                  <label htmlFor="operation-improvement-input">개선사항 메모</label>
                  <textarea
                    id="operation-improvement-input"
                    value={improvementText}
                    onChange={(event) => setImprovementText(event.target.value)}
                    placeholder="예: 강풍 예보 시 이동식 비계 상부 작업 전 난간·아웃트리거 재점검을 TBM 질문에 추가"
                  />
                  {photoAnalysisCandidate ? (
                    <article className="photo-analysis-candidate">
                      <span>사진 비교 후보</span>
                      <p>{photoAnalysisCandidate}</p>
                      <small>{data ? "저장 시 Before/After 파일을 서버 vision/OCR 분석으로 전달합니다." : "문서팩 생성 후 DB 저장과 함께 분석합니다."}</small>
                    </article>
                  ) : null}
                  <div className="operation-evidence-summary" aria-label="개선사항 반영 후보">
                    <article>
                      <span>반영 후보</span>
                      <strong>위험성평가표 · TBM</strong>
                      <small>다음 유사 작업의 검토 후보로 사용</small>
                    </article>
                    <article>
                      <span>사진 상태</span>
                      <strong>{beforePhoto || afterPhoto ? "첨부됨" : "대기"}</strong>
                      <small>{[beforePhoto?.name, afterPhoto?.name].filter(Boolean).join(" · ") || "Before/After 사진을 각각 첨부"}</small>
                    </article>
                  </div>
                  <div className="operation-ontology-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() => void saveOperationImprovement()}
                      disabled={improvementSaveState === "saving"}
                    >
                      {improvementSaveState === "saving" ? "보관 중..." : "개선사항 보관"}
                    </button>
                    <small>DB 저장이 가능하면 workpack 개선 이력으로, 아니면 로컬 후보로 남깁니다.</small>
                  </div>
                </div>
              </div>
              {operationImprovements.length ? (
                <div className="operation-improvement-list" aria-label="최근 개선사항 후보">
                  {operationImprovements.slice(0, 3).map((item) => (
                    <article key={item.id}>
                      <span>{formatImprovementTime(item.createdAt)} · {item.siteName}</span>
                      <strong>{item.hazardLabel}</strong>
                      <p>{item.improvementText}</p>
                      {item.beforePhotoName || item.afterPhotoName ? (
                        <small>사진: {item.beforePhotoName || "Before 미첨부"} → {item.afterPhotoName || "After 미첨부"}</small>
                      ) : null}
                      {item.visionStatus || item.visionUserLabel ? (
                        <small>vision/OCR: {formatVisionStatus(item.visionStatus, item.visionUserLabel)}</small>
                      ) : null}
                      {item.photoAnalysisSummary ? <small>{item.photoAnalysisSummary}</small> : null}
                      {item.detectedHazards?.length ? <small>위험요인: {item.detectedHazards.join(" · ")}</small> : null}
                      {item.observedImprovement ? <small>관찰 개선: {item.observedImprovement}</small> : null}
                      {item.ocrText ? <small>OCR: {item.ocrText}</small> : null}
                      {item.storageMode ? <small>{item.storageMode === "db" ? "DB 후보 저장됨" : "로컬 후보"}{item.saveMessage ? ` · ${item.saveMessage}` : ""}</small> : null}
                      <small>{item.reflectedDocuments.join(" · ")} 후보</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </section>
            </section>
          ) : null}
        </section>
      </section>

      {workspacePage === "document" && data ? (
        <>
          <section className="result-ribbon" aria-label="생성 결과 요약">
            <article>
              <span>위험도</span>
              <strong className={`risk-badge ${riskToneClass(data.riskSummary.riskLevel)}`}>위험도 {data.riskSummary.riskLevel}</strong>
            </article>
            <article>
              <span>핵심 위험</span>
              <strong>{data.riskSummary.topRisk}</strong>
            </article>
            <article>
              <span>연결 상태</span>
              <strong>{data.status.summary}</strong>
              <small className="muted">{statusDetailCopy(state)}</small>
            </article>
          </section>
          <section className="action-strip">
            {data.riskSummary.immediateActions.map((item, index) => (
              <article key={item} className="action-tile">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
                <label className="action-check">
                  <input
                    type="checkbox"
                    checked={checkedActions[index] || false}
                    onChange={(event) => setCheckedActions((current) => current.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked))}
                  />
                  확인 완료
                </label>
              </article>
            ))}
          </section>
          <FieldOperationsWorkspace
            data={data}
            editorFocusToken={editorFocusToken}
            requestedDocumentKey={requestedDocumentKey}
          />
        </>
      ) : null}
    </main>
  );
}
