// query_safety_knowledge 계약 시험 (261122 원격 MCP 전수 점검 P0).
//
// 결함: 응답의 registeredTasks 에 나열된 작업유형 10개 중 7개(용접·밀폐공간 작업 등)를
// 그 이름 그대로 물어도 found:false 였다. 도구 설명문의 예시(밀폐공간·용접·산소결핍 질식)와
// 위험요인(추락·낙하물) 조회도 실패했다. 원인은 Phase A evidence chain 3개(고소·지게차·전기)에
// 없는 조회를 전부 fail-closed 로 막은 것(f1d3735f). 이 시험은 MCP·클로가 실제로 부르는
// 진입점(buildPublishedSafetyKnowledge)으로 친다. queryKnowledge 를 직접 부르면 이 결함을 못 잡는다.
//
// 지키는 경계(07-16 output-boundary): 정확 일치가 아닌 질의(「추락 위험」 등)는 계속 found:false,
// Phase A 체인 밖의 결과는 evidenceContract·phaseAProduct 가 null 이라 문서 생성 grounding 이 되지 않는다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { listTaskLabels } from "@/lib/ontology/query";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

const PHASE_A_TASKS = new Set(["고소작업", "지게차 상하차", "전기 작업"]);

// 시드 감수본에 조문이 붙지 않은 안전조치(알려진 결함, 보고 대상). 새로 생기면 시험이 잡는다.
const KNOWN_CONTROLS_WITHOUT_ARTICLE = new Set(["발끝막이판 설치"]);

function readRepoFile(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

/** 도구 설명문(쌍둥이 2곳)에서 query_safety_knowledge 의 입력 예시를 뽑는다. */
function descriptionExamples(source: string): string[] {
  const start = source.indexOf("작업유형(용접·밀폐공간 등)이나 위험요인으로");
  expect(start).toBeGreaterThanOrEqual(0);
  const block = source.slice(start, start + 800);
  const inline = /작업유형\(([^)]+?) 등\)/.exec(block)?.[1] ?? "";
  const listed = /작업유형 또는 위험요인 라벨 \(예: ([^)]+)\)/.exec(block)?.[1] ?? "";
  expect(inline).not.toBe("");
  expect(listed).not.toBe("");
  return [...new Set(
    [...inline.split("·"), ...listed.split(",")].map((value) => value.trim()).filter(Boolean),
  )];
}

describe("query_safety_knowledge 계약 — 등록 작업유형 전수", () => {
  const registered = listTaskLabels(publishedGraph);

  test("등록 작업유형 목록이 비어 있지 않다", () => {
    expect(registered.length).toBeGreaterThanOrEqual(10);
  });

  test.each(registered)("등록 작업유형 「%s」를 그 이름 그대로 물으면 found:true", (label) => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, label);
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("expected found knowledge");
    expect(payload.matchedBy).toBe("task");
    expect(payload.task).toBe(label);
    expect(payload.hazards.length).toBeGreaterThan(0);
    expect(payload.controls.length).toBeGreaterThan(0);
    for (const control of payload.controls) {
      if (KNOWN_CONTROLS_WITHOUT_ARTICLE.has(control.control)) continue;
      expect(control.articles.length, `${label} / ${control.control}`).toBeGreaterThan(0);
    }
    if (PHASE_A_TASKS.has(label)) {
      expect(payload.evidenceContract).not.toBeNull();
    } else {
      // Phase A 체인 밖: 핵심 지식만 내고 문서 생성 grounding 은 열지 않는다.
      expect(payload.evidenceChainState).toBe("not_registered");
      expect(payload.evidenceContract).toBeNull();
      expect(payload.phaseAProduct).toBeNull();
    }
  });
});

describe("query_safety_knowledge 계약 — 도구 설명문 예시", () => {
  const mcpExamples = descriptionExamples(readRepoFile("app/api/mcp/[transport]/implementation.ts"));
  const clawExamples = descriptionExamples(readRepoFile("lib/agent-loop.ts"));

  test("MCP 와 클로 설명문의 예시가 같다(쌍둥이)", () => {
    expect(clawExamples).toEqual(mcpExamples);
    expect(mcpExamples).toEqual(expect.arrayContaining(["밀폐공간", "용접", "산소결핍 질식"]));
  });

  test.each(mcpExamples)("설명문 예시 「%s」는 found:true", (example) => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, example);
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("expected found knowledge");
    expect(payload.controls.length).toBeGreaterThan(0);
  });

  test("「밀폐공간」은 「밀폐공간 작업」으로 잡힌다", () => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, "밀폐공간");
    expect(payload).toMatchObject({ found: true, matchedBy: "task", task: "밀폐공간 작업" });
  });
});

describe("query_safety_knowledge 계약 — 위험요인 정확 일치", () => {
  test.each(["추락", "낙하물", "산소결핍 질식"])("위험요인 「%s」는 그 위험요인 하나로 found:true", (hazard) => {
    const payload = buildPublishedSafetyKnowledge(publishedGraph, hazard);
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("expected found knowledge");
    expect(payload.matchedBy).toBe("hazard");
    expect(payload.hazards).toEqual([hazard]);
    expect(payload.controls.length).toBeGreaterThan(0);
    expect(payload.evidenceContract).toBeNull();
    expect(payload.phaseAProduct).toBeNull();
  });
});

describe("query_safety_knowledge 계약 — 정확 일치가 아니면 계속 닫는다", () => {
  test.each(["추락 위험", "용접흄", "용접 화재", "작업", " 작업 ", "건설기계 인접 작업"])(
    "부분 문자열 「%s」는 found:false",
    (query) => {
      const payload = buildPublishedSafetyKnowledge(publishedGraph, query);
      expect(payload).toMatchObject({
        found: false,
        evidenceContract: null,
        phaseAProduct: null,
      });
    },
  );
});
