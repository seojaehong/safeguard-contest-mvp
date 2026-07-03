// QA 검수 (2층) — 생성된 안전 문서 본문을 온톨로지의 법정 필수 요소와 대조해 "빠진 것"을 잡는다.
//
// 아키텍처: "게이트(1층)는 틀린 것을 막고, QA(2층)는 빠진 것을 잡는다"의 2층.
//   1층(validate_safety_citations)은 잘못된/환각 조문 인용을 차단하고,
//   여기(reviewDocumentCoverage)는 작업유형의 필수 위험요인·안전조치·법조문이
//   문서에 실제로 담겼는지 대조해 누락을 검출한다.
//
// 순수 함수(graph-in): 이미 조립된 published 부분그래프를 입력받아 대조만 한다.
// 실제 그래프 조회(loadGraph)는 lib/ontology/qa-review-tool.ts가 배선한다.
//
// 매칭 철학(관대한 매칭): 라벨 문자열 완전 포함이 아니라
//   - 안전조치·위험요인: 핵심 명사 토큰(2글자+) 중 "과반(more-than-half)" 포함이면 covered.
//     정규화로 공백·중점 차이를 흡수하되(관대), 임계값은 엄격(과반) — 2층은 false-covered가
//     가장 위험한 오류이므로(누락을 놓침) "배치/설치/착용" 같은 일반 접미어 하나로 특정
//     명사(예: 화재감시자)의 누락이 가려지지 않게 한다.
//   - 법조문: 조번호 정규식 매칭(예: "제241조의2"). 조문은 verdict를 좌우하지 않는다.

import { type OntologyNode } from "@/lib/ontology/schema";
import {
  queryByTask,
  attachControlArticles,
  listTaskLabels,
  type QueryableGraph,
} from "@/lib/ontology/query";

/** 검수 고지 문구(고정) — 시드 기준이며 현장 확인을 대체하지 않는다. */
export const QA_ADVISORY =
  "이 검수는 온톨로지 시드 기준이며 현장 여건 확인을 대체하지 않습니다";

/** 문서 본문 길이 상한(자). 초과분은 잘라내고 검수한다. */
export const QA_DOCUMENT_CAP = 20000;

export type QaVerdict = "통과" | "보완 권장" | "미흡";

/** 누락 안전조치 1건 + 그 근거 법조문 라벨(병기). */
export type MissingControl = {
  control: string;
  articles: string[];
};

export type QaReviewFound = {
  reviewable: true;
  task: string;
  covered: { hazards: string[]; controls: string[]; articles: string[] };
  missing: { hazards: string[]; controls: MissingControl[]; articles: string[] };
  /** 안전조치 커버리지(coveredControls / totalControls, 0~1). controls 0건이면 1. */
  coverageRate: number;
  verdict: QaVerdict;
  advisory: string;
};

export type QaReviewNotFound = {
  reviewable: false;
  message: string;
  registeredTasks: string[];
};

export type QaReviewResult = QaReviewFound | QaReviewNotFound;

// ── 매칭 유틸(별도 export — 테스트 대상) ──────────────────────────────────

/** 매칭용 정규화: NFC + 공백·중점 제거. 표현 변형(띄어쓰기·중점)을 흡수한다. */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFC").replace(/[\s·・•]/g, "");
}

/** 라벨을 공백·중점 기준으로 쪼개 2글자 이상 토큰만 남긴다(핵심 명사 근사치). */
export function labelTokens(label: string): string[] {
  return label
    .normalize("NFC")
    .split(/[\s·・•]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * 안전조치·위험요인 라벨이 문서에 담겼는지 판정한다(관대한 매칭).
 * 핵심 토큰 중 과반(more-than-half)이 정규화 문서에 부분 포함되면 covered.
 * 2글자+ 토큰이 없으면 라벨 전체를 정규화해 부분 포함 여부로 폴백(div-by-zero 방지).
 */
export function matchesLabelTokens(documentText: string, label: string): boolean {
  const normDoc = normalizeForMatch(documentText);
  const tokens = labelTokens(label);
  if (tokens.length === 0) {
    const norm = normalizeForMatch(label);
    return norm.length > 0 && normDoc.includes(norm);
  }
  const covered = tokens.filter((t) => normDoc.includes(normalizeForMatch(t))).length;
  return covered * 2 > tokens.length; // 과반(엄격) — false-covered 방지
}

/** article_no("241의2"|"236")를 조번호 정규식으로 변환한다. 숫자형이 아니면 null. */
function articleNoToRegex(articleNo: string): RegExp | null {
  const m = articleNo.trim().match(/^(\d+)(?:의(\d+))?$/);
  if (!m) return null;
  const suffix = m[2] ? `\\s*의\\s*${m[2]}` : "";
  return new RegExp(`제\\s*${m[1]}\\s*조${suffix}`);
}

/** 법조문이 문서에 인용됐는지 조번호 정규식으로 판정한다(예: "제241조의2"). */
export function matchesArticle(documentText: string, articleNo: string): boolean {
  const re = articleNoToRegex(articleNo);
  return re ? re.test(documentText) : false;
}

function readArticleNo(node: OntologyNode): string | null {
  const meta = node.meta as Record<string, unknown>;
  return typeof meta.article_no === "string" ? meta.article_no : null;
}

/** 누락 안전조치 수 → verdict. 0=통과, 1~2=보완 권장, 3+=미흡. */
export function decideVerdict(missingControlCount: number): QaVerdict {
  if (missingControlCount === 0) return "통과";
  if (missingControlCount <= 2) return "보완 권장";
  return "미흡";
}

// ── 본체 ──────────────────────────────────────────────────────────────────

/**
 * 작업유형의 필수 요소(위험요인·안전조치+근거조문·법조문)를 문서 본문과 대조해 누락을 검출한다.
 * queryByTask 재사용(hazard 폴백 없음) — 미등록 작업유형은 reviewable:false + 등록 목록.
 * published 부분그래프만 입력받는다(호출부 loadGraph("published")가 보장).
 */
export function reviewDocumentCoverage(
  taskQuery: string,
  documentText: string,
  graph: QueryableGraph
): QaReviewResult {
  const query = queryByTask(graph, taskQuery);
  if (!query) {
    return {
      reviewable: false,
      message: `'${taskQuery}'은(는) 등록된 작업유형이 아닙니다. 아래 등록된 작업유형 중 하나로 다시 조회하세요.`,
      registeredTasks: listTaskLabels(graph),
    };
  }

  // 캡: 본문이 아무리 길어도 앞 QA_DOCUMENT_CAP자만 검수한다(테스트 가능한 순수 단계).
  const doc = documentText.slice(0, QA_DOCUMENT_CAP);

  const coveredHazards: string[] = [];
  const missingHazards: string[] = [];
  for (const h of query.hazards) {
    (matchesLabelTokens(doc, h.label) ? coveredHazards : missingHazards).push(h.label);
  }

  const coveredArticles: string[] = [];
  const missingArticles: string[] = [];
  for (const a of query.articles) {
    const articleNo = readArticleNo(a);
    const ok = articleNo ? matchesArticle(doc, articleNo) : false;
    (ok ? coveredArticles : missingArticles).push(a.label);
  }

  const coveredControls: string[] = [];
  const missingControls: MissingControl[] = [];
  for (const cwa of attachControlArticles(graph, query.controls)) {
    if (matchesLabelTokens(doc, cwa.control.label)) {
      coveredControls.push(cwa.control.label);
    } else {
      missingControls.push({
        control: cwa.control.label,
        articles: cwa.articles.map((art) => art.label),
      });
    }
  }

  const totalControls = query.controls.length;
  const coverageRate = totalControls === 0 ? 1 : coveredControls.length / totalControls;

  return {
    reviewable: true,
    task: query.task.label,
    covered: { hazards: coveredHazards, controls: coveredControls, articles: coveredArticles },
    missing: { hazards: missingHazards, controls: missingControls, articles: missingArticles },
    coverageRate,
    verdict: decideVerdict(missingControls.length),
    advisory: QA_ADVISORY,
  };
}
