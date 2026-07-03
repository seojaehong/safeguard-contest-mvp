import { describe, expect, test } from "vitest";
import { assembleGraph } from "@/lib/ontology/graph-store";
import {
  reviewDocumentCoverage,
  matchesLabelTokens,
  matchesArticle,
  decideVerdict,
  QA_ADVISORY,
  QA_DOCUMENT_CAP,
} from "@/lib/ontology/qa-review";
import { SEED_NODES, SEED_EDGES } from "@/lib/ontology/seed/core-triples";

// published 게이트를 그대로 재현: 시드의 published 부분그래프로 검수한다.
const publishedGraph = assembleGraph(
  SEED_NODES.filter((n) => n.review_state === "published"),
  SEED_EDGES.filter((e) => e.review_state === "published")
);

// 용접 작업의 published 안전조치 4종(시드 실증):
//   가연성물질 별도 보관·격리 / 용접방화포·불티비산방지덮개 설치 /
//   화재감시자 배치(→ 기준규칙 제241조의2) / 차광보안면·방열복 착용
const WELDING_ALL_CONTROLS = [
  "가연성물질 별도 보관·격리",
  "용접방화포·불티비산방지덮개 설치",
  "화재감시자 배치",
  "차광보안면·방열복 착용",
].join("\n");

describe("matchesLabelTokens — 관대한 매칭(과반 임계값)", () => {
  test("표현 변형(띄어쓰기·조사)이 있어도 핵심 토큰이 있으면 covered", () => {
    expect(matchesLabelTokens("화재 감시자를 배치하고 순찰한다", "화재감시자 배치")).toBe(true);
  });

  test("중점(·) 표기 차이를 흡수한다", () => {
    expect(matchesLabelTokens("가연성물질을 별도 장소에 보관하고 격리했다", "가연성물질 별도 보관·격리")).toBe(true);
  });

  test("일반 접미어(배치)만 있고 특정 명사(화재감시자)가 없으면 covered 아님", () => {
    // 과반(엄격) — "소화기 배치"의 배치 하나로 화재감시자 누락이 가려지지 않는다.
    expect(matchesLabelTokens("작업 구역에 소화기 배치 완료", "화재감시자 배치")).toBe(false);
  });
});

describe("matchesArticle — 조번호 정규식 매칭", () => {
  test("제241조의2를 조번호로 매칭한다", () => {
    expect(matchesArticle("근거: 기준규칙 제241조의2에 따라 화재감시자를 둔다", "241의2")).toBe(true);
  });

  test("조번호가 없으면 매칭 실패", () => {
    expect(matchesArticle("화재감시자를 배치한다", "241의2")).toBe(false);
  });
});

describe("decideVerdict — 누락 안전조치 수 → 판정", () => {
  test("0=통과, 1~2=보완 권장, 3+=미흡", () => {
    expect(decideVerdict(0)).toBe("통과");
    expect(decideVerdict(1)).toBe("보완 권장");
    expect(decideVerdict(2)).toBe("보완 권장");
    expect(decideVerdict(3)).toBe("미흡");
  });
});

describe("reviewDocumentCoverage — 용접 문서 검수", () => {
  test("완전 문서(모든 안전조치 포함)는 통과 + coverageRate 1", () => {
    const result = reviewDocumentCoverage("용접", WELDING_ALL_CONTROLS, publishedGraph);
    expect(result.reviewable).toBe(true);
    if (!result.reviewable) return;
    expect(result.verdict).toBe("통과");
    expect(result.coverageRate).toBe(1);
    expect(result.missing.controls).toEqual([]);
    expect(result.advisory).toBe(QA_ADVISORY);
    expect(result.task).toBe("용접");
  });

  test("화재감시자 누락을 검출하고 근거 조문(제241조의2)을 병기한다", () => {
    // 화재감시자·배치 토큰만 빠진 문서(나머지 3종은 포함).
    const doc = [
      "가연성물질 별도 보관·격리",
      "용접방화포·불티비산방지덮개 설치",
      "차광보안면·방열복 착용",
    ].join("\n");
    const result = reviewDocumentCoverage("용접", doc, publishedGraph);
    expect(result.reviewable).toBe(true);
    if (!result.reviewable) return;

    const missingFire = result.missing.controls.find((c) => c.control.includes("화재감시자"));
    expect(missingFire).toBeDefined();
    expect(missingFire!.articles.some((a) => a.includes("제241조의2"))).toBe(true);
    // 1건 누락 → 보완 권장.
    expect(result.verdict).toBe("보완 권장");
  });

  test("거의 빈 문서는 3+ 누락 → 미흡", () => {
    const result = reviewDocumentCoverage("용접", "오늘 용접 작업을 한다.", publishedGraph);
    expect(result.reviewable).toBe(true);
    if (!result.reviewable) return;
    expect(result.missing.controls.length).toBeGreaterThanOrEqual(3);
    expect(result.verdict).toBe("미흡");
    expect(result.coverageRate).toBeLessThan(0.5);
  });
});

describe("reviewDocumentCoverage — 경계/미등록", () => {
  test("미등록 작업유형은 reviewable:false + 등록 목록 안내", () => {
    const result = reviewDocumentCoverage("우주유영", WELDING_ALL_CONTROLS, publishedGraph);
    expect(result.reviewable).toBe(false);
    if (result.reviewable) return;
    expect(result.registeredTasks.length).toBeGreaterThan(0);
    expect(result.registeredTasks).toContain("용접");
    expect(result.message).toContain("우주유영");
  });

  test("20000자 캡: 상한 밖의 안전조치는 검수 대상에서 잘려 누락 처리된다", () => {
    // 앞 20000자는 조치 토큰이 없는 패딩, 실제 조치 문구는 캡 뒤에 위치.
    const doc = "가".repeat(QA_DOCUMENT_CAP) + "\n" + WELDING_ALL_CONTROLS;
    const result = reviewDocumentCoverage("용접", doc, publishedGraph);
    expect(result.reviewable).toBe(true);
    if (!result.reviewable) return;
    // 캡이 적용되면 캡 뒤 조치는 보이지 않아 전부 누락 → 미흡.
    expect(result.covered.controls).toEqual([]);
    expect(result.verdict).toBe("미흡");
  });
});
