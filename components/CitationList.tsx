import { buildPhaseAReviewUiState, type PhaseAReviewUiState } from "@/lib/phase-a-review";
import type { PhaseAReview, SearchResult } from "@/lib/types";
import Link from "next/link";
import type { Route } from "next";

const citationGroups: Array<{ type: SearchResult["type"]; label: string }> = [
  { type: "law", label: "법령" },
  { type: "precedent", label: "판례" },
  { type: "interpretation", label: "해석례" }
];

const citationDocumentMap: Record<SearchResult["type"], string[]> = {
  law: ["위험성평가표", "작업계획서", "안전보건교육 기록"],
  precedent: ["위험성평가표", "비상대응 절차", "점검결과 요약"],
  interpretation: ["작업계획서", "TBM 브리핑", "안전보건교육 기록"]
};

function getCitationHref(item: SearchResult): Route {
  if (item.type === "law") return `/law/${item.id}` as Route;
  if (item.type === "precedent") return `/precedent/${item.id}` as Route;
  return `/interpretation/${item.id}` as Route;
}

function describeRelevance(item: SearchResult, question: string | undefined, authoritative: boolean) {
  if (!authoritative) {
    return "현재 작업과의 관련성을 Phase A 근거 계약으로 확인하기 전까지 연결 후보로만 표시합니다.";
  }
  const normalizedQuestion = (question || "").toLowerCase();
  const tags = item.tags || [];

  if (item.type === "precedent") {
    if (tags.some((tag) => tag.includes("작업위험 매핑") || tag.includes("Law.go 판례검색"))) {
      return "Law.go 판례검색으로 현재 작업의 위험요인과 유사한 안전조치·교육·보호구 쟁점을 매핑한 근거입니다.";
    }
    return "사고 이후 책임 판단에서 어떤 안전조치가 문제 되는지 확인해 문서 문구를 보강하는 근거입니다.";
  }
  if (normalizedQuestion.includes("강풍") || normalizedQuestion.includes("돌풍")) {
    return "오늘 작업의 기상 위험과 연결해 즉시 조치 기준을 설명하는 근거입니다.";
  }
  if (normalizedQuestion.includes("비계") || normalizedQuestion.includes("추락")) {
    return "추락·전도 위험을 위험성평가와 TBM 문안으로 번역할 때 참고하는 근거입니다.";
  }
  if (tags.some((tag) => tag.includes("보강검색"))) {
    return "기본 Law.go 흐름에 추가로 보강된 근거로, 설명 가능성을 높이는 역할을 합니다.";
  }
  return "현재 작업 조건과 유사한 위험 판단 기준을 빠르게 확인하기 위한 근거입니다.";
}

function sourceStatusLabel(item: SearchResult, phaseAState: PhaseAReviewUiState) {
  if (!phaseAState.authoritative) {
    return item.sourceSystem === "lawgo" ? phaseAState.lawCitationLabel : "출처 확인 후보";
  }
  if (item.sourceSystem === "lawgo") return "법제처 인용";
  if (item.sourceSystem === "korean-law-mcp") return "추가 근거";
  return "기본 근거";
}

function evidenceRoleLabel(item: SearchResult, phaseAState: PhaseAReviewUiState) {
  if (item.type === "law") return phaseAState.directEvidenceLabel;
  return phaseAState.supportingEvidenceLabel;
}

export function CitationList({
  citations,
  question,
  phaseAReview,
}: {
  citations: SearchResult[];
  question?: string;
  phaseAReview?: PhaseAReview;
}) {
  const phaseAState = buildPhaseAReviewUiState(phaseAReview);

  return (
    <div className="card list">
      <div className="row">
        <h2 className="h3">근거 출처</h2>
        <span className="badge">{phaseAState.connectionLabel}</span>
      </div>
      <p className="muted small route-section-description">
        {phaseAState.authoritative
          ? "법령, 판례, 해석례를 나눠 현재 작업의 위험 판단과 산출물 문구를 뒷받침합니다. 법률 검토 최종 의견이 아니라 현장 문서 초안용 근거입니다."
          : "표시된 출처는 연결 후보입니다. Phase A 근거 확인과 문서 반영 실적의 사람 확인 전에는 직접 근거나 확정 인용으로 사용하지 않습니다."}
      </p>
      {citationGroups.map((group) => {
        const groupItems = citations.filter((item) => item.type === group.type);
        if (!groupItems.length) return null;

        return (
          <section key={group.type} className="citation-group">
            <div className="row">
              <span className="badge">{group.label}</span>
              <span className="muted small">{groupItems.length}건</span>
            </div>
            {groupItems.map((c) => {
              const href = getCitationHref(c);
              return (
                <Link key={c.id} href={href} className="list citation-item" target="_blank" rel="noopener noreferrer">
                  <div className="row">
                    <span className="badge">{c.sourceLabel}</span>
                    <span className="badge">{evidenceRoleLabel(c, phaseAState)}</span>
                    <span className="badge">{sourceStatusLabel(c, phaseAState)}</span>
                    <span className="badge">새 탭</span>
                    {c.tags?.some((tag) => tag.includes("작업위험 매핑")) ? <span className="badge">작업위험 매핑</span> : null}
                  </div>
                  <h3 className="h3">{c.title}</h3>
                  <span className="muted">{c.summary}</span>
                  <span className="small relevance-note">
                    {phaseAState.authoritative ? "문서 반영 위치" : phaseAState.reflectionLabel}: {citationDocumentMap[c.type].join(" · ")}
                  </span>
                  <span className="small relevance-note">{describeRelevance(c, question, phaseAState.authoritative)}</span>
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
