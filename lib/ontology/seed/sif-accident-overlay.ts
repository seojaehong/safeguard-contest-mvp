import type { OntologyEdgeInput, OntologyNodeInput } from "@/lib/ontology/schema";

export const SIF_ACCIDENT_CORPUS_HASH =
  "2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e";

const SIF_ACCIDENT_DEFINITIONS = [
  {
    nodeId: "Accident_SIF_construction_00323",
    hazardId: "Hazard_추락",
    itemId: "sif-아카이브-건설업-00323",
    label: "SIF 322 / 철근콘크리트 공사 / 거푸집 작업 사고",
    contentHash: "e6035abf293df3d2b5d4a59083c1276955f8f47ee7c37743bc0646d185dea770",
    excerpt:
      "2021년 03월경 ○○현장에서 피재자가 멍에(각관)설치상태 확인을 위해 발붙임 겸용 신축형 사다리(A형) 최상부 디딤대(9단)에 올라가 확인 하던 중 2.5m 아래 바닥으로 떨어져 사망"
  },
  {
    nodeId: "Accident_SIF_construction_00024",
    hazardId: "Hazard_충돌_협착_끼임",
    itemId: "sif-아카이브-건설업-00024",
    label: "SIF 23 / 토공사 / 굴착 작업 사고",
    contentHash: "4ae1315616343d8dcc50385276c2d6d847a6f5be613c2825fabdf2525cfc288f",
    excerpt:
      "2017년 12월경 ○○ 신축공사 현장에서 굴삭기 후미로 이동하던 설비 작업자가 회전하는 굴삭기 몸체 후미와 콘크리트 구조물 사이에 협착되어 쓰러져 있는 재해자를 주변 근로자가 발견하여 119에 연락 응급조치 및 병원으로 후송 하였으나 사망"
  },
  {
    nodeId: "Accident_SIF_construction_01798",
    hazardId: "Hazard_감전_직접_간접_접촉",
    itemId: "sif-아카이브-건설업-01798",
    label: "SIF 1797 / 전기·기계 설비공사 / 전기 설비 작업 사고",
    contentHash: "ba16f6e2587914f70b8a37d1f7b95e0b3ab8b29e8debea6570141cf1b8c3374a",
    excerpt: "2021년 07월경 ○○현장에서 수·변전반 결선작업 중 380V 노출충전부에 신체가 접촉되어 감전 사망"
  }
] as const;

function provenance(itemId: string, contentHash: string): Record<string, unknown> {
  return {
    source_item_id: itemId,
    content_hash: contentHash,
    corpus_hash: SIF_ACCIDENT_CORPUS_HASH,
    evidence_role: "hazard_priority_only",
    llm_role: "naturalize_only"
  };
}

export const SIF_ACCIDENT_NODES: OntologyNodeInput[] = SIF_ACCIDENT_DEFINITIONS.map((definition) => ({
  node_id: definition.nodeId,
  kind: "Accident",
  label: definition.label,
  text_excerpt: definition.excerpt,
  cited_uids: [`ref:safety_reference_items:${definition.itemId}`],
  meta: provenance(definition.itemId, definition.contentHash),
  review_state: "draft"
}));

export const SIF_ACCIDENT_EDGES: OntologyEdgeInput[] = SIF_ACCIDENT_DEFINITIONS.map((definition) => ({
  src: definition.hazardId,
  rel: "evidencedBy",
  dst: definition.nodeId,
  cited_uids: [`ref:safety_reference_items:${definition.itemId}`],
  meta: provenance(definition.itemId, definition.contentHash),
  review_state: "draft"
}));
