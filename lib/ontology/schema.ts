// 안전 온톨로지 스키마 — 노드 7kind / 엣지 7rel / cited_uids 네임스페이스.
// 설계: SafeClaw2_안전온톨로지_구현계획.md §2 (2026-07-03 확정본).
// 불변식: 식별자는 영어(정렬 안정성), 표시만 한글(KIND_KO/REL_KO).
// provenance 게이트: cited_uids ≥ 1 — 무출처 노드/엣지는 그래프 조립 단계에서 드롭.

import { z } from "zod";

export const NODE_KINDS = ["Task", "Hazard", "Control", "Article", "Accident", "Document", "Duty"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_RELS = [
  "entailsHazard",
  "mitigatedBy",
  "mandatedBy",
  "evidencedBy",
  "documentedIn",
  "fulfillsDuty",
  "relatedTo"
] as const;
export type EdgeRel = (typeof EDGE_RELS)[number];

export const REVIEW_STATES = ["draft", "verified", "published"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const KIND_KO: Readonly<Record<NodeKind, string>> = {
  Task: "작업유형",
  Hazard: "위험요인",
  Control: "안전조치",
  Article: "법조문",
  Accident: "재해사례",
  Document: "문서종",
  Duty: "중처법 의무"
};

export const REL_KO: Readonly<Record<EdgeRel, string>> = {
  entailsHazard: "위험요인 수반",
  mitigatedBy: "안전조치로 저감",
  mandatedBy: "법조문 근거",
  evidencedBy: "재해사례 입증",
  documentedIn: "문서화",
  fulfillsDuty: "중처법 의무 이행 증빙(부분)",
  relatedTo: "관련"
};

// ---- cited_uids 네임스페이스 파서 ----
// law:{법령명}:{조문} / ref:safety_reference_items:{id} / case:kosha:{id}
// kb:kb_chunks:{id} / manual:{노무사 감수 문서명}

export type ParsedCitedUid =
  | { namespace: "law"; lawName: string; article: string }
  | { namespace: "ref"; table: "safety_reference_items"; id: string }
  | { namespace: "case"; source: "kosha"; id: string }
  | { namespace: "kb"; table: "kb_chunks"; id: string }
  | { namespace: "manual"; document: string };

export function parseCitedUid(uid: string): ParsedCitedUid | null {
  const trimmed = uid.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return null;
  const namespace = trimmed.slice(0, colon);
  const rest = trimmed.slice(colon + 1);
  if (!rest) return null;

  if (namespace === "law") {
    // 법령명에 콜론이 들어가지 않는다는 전제(현행 시드 전건 해당) — 마지막 콜론 기준 분리.
    const lastColon = rest.lastIndexOf(":");
    if (lastColon <= 0 || lastColon === rest.length - 1) return null;
    return { namespace: "law", lawName: rest.slice(0, lastColon), article: rest.slice(lastColon + 1) };
  }
  if (namespace === "ref") {
    const m = rest.match(/^safety_reference_items:(.+)$/);
    return m ? { namespace: "ref", table: "safety_reference_items", id: m[1] } : null;
  }
  if (namespace === "case") {
    const m = rest.match(/^kosha:(.+)$/);
    return m ? { namespace: "case", source: "kosha", id: m[1] } : null;
  }
  if (namespace === "kb") {
    const m = rest.match(/^kb_chunks:(.+)$/);
    return m ? { namespace: "kb", table: "kb_chunks", id: m[1] } : null;
  }
  if (namespace === "manual") {
    return { namespace: "manual", document: rest };
  }
  return null;
}

export function isValidCitedUid(uid: string): boolean {
  return parseCitedUid(uid) !== null;
}

// ---- zod 스키마 ----

const citedUidSchema = z.string().refine(isValidCitedUid, {
  message: "cited_uid는 law:/ref:/case:/kb:/manual: 네임스페이스 형식이어야 합니다"
});

const metaSchema = z.record(z.string(), z.unknown());

export const ontologyNodeSchema = z.object({
  node_id: z.string().min(1),
  kind: z.enum(NODE_KINDS),
  label: z.string().min(1),
  text_excerpt: z.string().nullable().default(null),
  cited_uids: z.array(citedUidSchema),
  meta: metaSchema.default({}),
  review_state: z.enum(REVIEW_STATES).default("draft")
});

export const ontologyEdgeSchema = z.object({
  src: z.string().min(1),
  rel: z.enum(EDGE_RELS),
  dst: z.string().min(1),
  cited_uids: z.array(citedUidSchema),
  meta: metaSchema.default({}),
  review_state: z.enum(REVIEW_STATES).default("draft")
});

export type OntologyNode = z.infer<typeof ontologyNodeSchema>;
export type OntologyEdge = z.infer<typeof ontologyEdgeSchema>;
export type OntologyNodeInput = z.input<typeof ontologyNodeSchema>;
export type OntologyEdgeInput = z.input<typeof ontologyEdgeSchema>;

// 라벨 정규화 — 노드 동일성·퍼지 매칭 공용 (공백 제거, NFC).
export function normalizeLabel(label: string): string {
  return label.normalize("NFC").replace(/\s+/g, "");
}
