import { describe, expect, test } from "vitest";
import {
  NODE_KINDS,
  EDGE_RELS,
  KIND_KO,
  REL_KO,
  parseCitedUid,
  isValidCitedUid,
  normalizeLabel,
  ontologyNodeSchema,
  ontologyEdgeSchema
} from "@/lib/ontology/schema";

describe("kind/rel enum과 한글 표시 매핑", () => {
  test("노드 kind 7종·엣지 rel 7종이 확정본과 일치한다", () => {
    expect(NODE_KINDS).toEqual(["Task", "Hazard", "Control", "Article", "Accident", "Document", "Duty"]);
    expect(EDGE_RELS).toEqual([
      "entailsHazard",
      "mitigatedBy",
      "mandatedBy",
      "evidencedBy",
      "documentedIn",
      "fulfillsDuty",
      "relatedTo"
    ]);
  });

  test("모든 kind/rel에 한글 표시가 있다 (식별자는 영어, 표시만 한글)", () => {
    for (const kind of NODE_KINDS) expect(KIND_KO[kind]).toBeTruthy();
    for (const rel of EDGE_RELS) expect(REL_KO[rel]).toBeTruthy();
  });
});

describe("cited_uids 네임스페이스 파서", () => {
  test("law: — 법령명과 조문을 분리한다", () => {
    expect(parseCitedUid("law:산업안전보건기준에 관한 규칙:제619조")).toEqual({
      namespace: "law",
      lawName: "산업안전보건기준에 관한 규칙",
      article: "제619조"
    });
    expect(parseCitedUid("law:산업안전보건기준에 관한 규칙:제241조의2")).toEqual({
      namespace: "law",
      lawName: "산업안전보건기준에 관한 규칙",
      article: "제241조의2"
    });
  });

  test("ref:/case:/kb: — 고정 테이블 네임스페이스", () => {
    expect(parseCitedUid("ref:safety_reference_items:1234")).toEqual({
      namespace: "ref",
      table: "safety_reference_items",
      id: "1234"
    });
    expect(parseCitedUid("case:kosha:5678")).toEqual({ namespace: "case", source: "kosha", id: "5678" });
    expect(parseCitedUid("kb:kb_chunks:42")).toEqual({ namespace: "kb", table: "kb_chunks", id: "42" });
  });

  test("manual: — 노무사 감수 문서명", () => {
    expect(parseCitedUid("manual:온톨로지_시드트리플_감수용_v1")).toEqual({
      namespace: "manual",
      document: "온톨로지_시드트리플_감수용_v1"
    });
  });

  test("잘못된 uid는 null (알 수 없는 네임스페이스, 빈 본문, 테이블 불일치)", () => {
    expect(parseCitedUid("unknown:foo")).toBeNull();
    expect(parseCitedUid("law:조문없음")).toBeNull();
    expect(parseCitedUid("manual:")).toBeNull();
    expect(parseCitedUid("ref:wrong_table:1")).toBeNull();
    expect(parseCitedUid("")).toBeNull();
    expect(isValidCitedUid("law:산업안전보건법:제36조")).toBe(true);
  });
});

describe("zod 스키마", () => {
  const validNode = {
    node_id: "Task_welding",
    kind: "Task",
    label: "용접",
    text_excerpt: null,
    cited_uids: ["manual:온톨로지_시드트리플_감수용_v1"],
    meta: {},
    review_state: "published"
  };

  test("유효 노드를 통과시키고 kind 위반을 거부한다", () => {
    expect(ontologyNodeSchema.safeParse(validNode).success).toBe(true);
    expect(ontologyNodeSchema.safeParse({ ...validNode, kind: "Issue" }).success).toBe(false);
  });

  test("uid 형식 위반 cited_uids를 거부한다", () => {
    expect(ontologyNodeSchema.safeParse({ ...validNode, cited_uids: ["bogus"] }).success).toBe(false);
  });

  test("엣지 rel 위반과 review_state 위반을 거부한다", () => {
    const validEdge = {
      src: "Task_welding",
      rel: "entailsHazard",
      dst: "Hazard_감전",
      cited_uids: ["manual:온톨로지_시드트리플_감수용_v1"],
      meta: {},
      review_state: "draft"
    };
    expect(ontologyEdgeSchema.safeParse(validEdge).success).toBe(true);
    expect(ontologyEdgeSchema.safeParse({ ...validEdge, rel: "evolvesInto" }).success).toBe(false);
    expect(ontologyEdgeSchema.safeParse({ ...validEdge, review_state: "live" }).success).toBe(false);
  });
});

describe("normalizeLabel", () => {
  test("공백 제거 + NFC 정규화", () => {
    expect(normalizeLabel("밀폐공간 작업")).toBe("밀폐공간작업");
    expect(normalizeLabel(" 용접  ")).toBe("용접");
  });
});
