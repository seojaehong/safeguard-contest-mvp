// PR-12 근거 게이트 재개 — 결함 H1·H2·H3·H5·H6 와 published 조회 필터를 실패 시험으로 먼저 고정한다.
// 고정 자료는 운영 /api/ask(full) 응답에서 뽑은 실제 형태의 패킷(tests/fixtures/grounding-packets)이다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildDeliverablePromptsForAudit } from "@/lib/ai-deliverables";
import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  buildGroundedGenerationPacket,
  validateGroundedGenerationOutput,
  type GroundedGenerationPacket
} from "@/lib/grounded-generation-contract";
import {
  assembleInjectionGraph,
  buildOntologyGroundingSources,
  resolveInjectionTaskLabels
} from "@/lib/grounding-ontology-injection";
import { searchSafetyReferences, type SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

type Fixture = {
  question: string;
  dbHarnessPacket: DbHarnessPacket;
  citations: SearchResult[];
};

const FIXTURE_DIR = path.resolve(__dirname, "fixtures/grounding-packets");
const SCENARIOS = ["mfg-press", "con-excavation", "confined-space", "logistics-heat"] as const;

function loadFixture(id: (typeof SCENARIOS)[number]): Fixture {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${id}.json`), "utf8")) as Fixture;
}

function packetOf(fixture: Fixture, extra: Partial<Parameters<typeof buildGroundedGenerationPacket>[0]> = {}) {
  return buildGroundedGenerationPacket({
    dbHarnessPacket: fixture.dbHarnessPacket,
    legalCandidates: fixture.citations.slice(0, 6),
    eligibleKoshaIds: new Set<string>(),
    ...extra
  });
}

const REVIEW_META_CONTROL_RE = /관리감독자 검토 완료 전|SIF 사고개요|provenance|검토 필요/;

const graph = assembleInjectionGraph(null);

describe("H1 — 패킷 상태와 체크리스트 분리", () => {
  it("저장된 mfg-press 패킷: 체크리스트가 review_required 여도 controls 있는 출처가 있으면 ready", () => {
    const fixture = loadFixture("mfg-press");
    expect(fixture.dbHarnessPacket.ontologyChecklist.status).toBe("review_required");
    const packet = packetOf(fixture);
    expect(packet.sources.some((source) => source.controls.length > 0)).toBe(true);
    expect(packet.status).toBe("ready");
    expect(packet.checklist).toEqual(fixture.dbHarnessPacket.ontologyChecklist);
  });

  it("저장된 mfg-press·logistics-heat 패킷 + controls 원문 출력 → grounded", () => {
    for (const id of ["mfg-press", "logistics-heat"] as const) {
      const fixture = loadFixture(id);
      const packet = packetOf(fixture, {
        ontologySources: buildOntologyGroundingSources(
          graph,
          resolveInjectionTaskLabels({ taskId: id === "mfg-press" ? "press" : "manual-loading-heat", layers: id === "mfg-press" ? [] : ["폭염·고온"] })
        )
      });
      const steps = packet.sources
        .filter((source) => source.controls.length > 0)
        .flatMap((source) => source.controls.map((control) => ({
          stepNo: 1,
          action: "작업",
          safetyMeasure: control,
          evidenceRefs: [source.referenceKey]
        })));
      expect(steps.length, `${id} 패킷에 controls 출처가 없다`).toBeGreaterThan(0);
      const validation = validateGroundedGenerationOutput({ workPlanStructured: { workSteps: steps } }, packet);
      expect(validation, id).toEqual({ status: "grounded", violations: [] });
    }
  });

  it("출처 0건이면 빈 출력도 review_required (P7 유지)", () => {
    const fixture = loadFixture("logistics-heat");
    const stripped: DbHarnessPacket = {
      ...fixture.dbHarnessPacket,
      directEvidence: [],
      sifCases: [],
      supportingEvidence: []
    };
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: stripped,
      legalCandidates: fixture.citations.slice(0, 6),
      eligibleKoshaIds: new Set<string>()
    });
    expect(packet.sources.filter((source) => source.controls.length > 0)).toHaveLength(0);
    expect(packet.status).toBe("review_required");
    expect(validateGroundedGenerationOutput({}, packet).status).toBe("review_required");
  });

  it("sourceIdentity 해시는 같은 입력에 같고, 출처 kind 가 바뀌면 다르다", () => {
    const fixture = loadFixture("confined-space");
    const first = packetOf(fixture);
    const second = packetOf(fixture);
    expect(first.sourceIdentity).toBe(second.sourceIdentity);
    const withOntology = packetOf(fixture, {
      ontologySources: buildOntologyGroundingSources(graph, ["밀폐공간 작업"])
    });
    expect(withOntology.sourceIdentity).not.toBe(first.sourceIdentity);
  });
});

describe("H2 — 온톨로지 published 조회 결과를 생성 전에 패킷에 싣는다", () => {
  it("굴착 질문: 온톨로지 굴착 조치가 ONT 출처로 들어가고 그 조치 원문은 grounded", () => {
    const fixture = loadFixture("con-excavation");
    const ontologySources = buildOntologyGroundingSources(graph, resolveInjectionTaskLabels({ taskId: "excavation", layers: [] }));
    expect(ontologySources.length).toBeGreaterThan(0);
    const packet = packetOf(fixture, { ontologySources });
    const ont = packet.sources.filter((source) => source.kind === "ontology");
    expect(ont.length).toBe(ontologySources.length);
    expect(ont.every((source) => /^ONT:/.test(source.referenceKey) && source.controls.length === 1)).toBe(true);
    expect(ont.some((source) => /굴착면|흙막이|부석/.test(source.controls[0]))).toBe(true);
    const output = {
      tbmBriefingStructured: {
        measures: ont.map((source) => ({ action: source.controls[0], evidenceRefs: [source.referenceKey] }))
      }
    };
    expect(validateGroundedGenerationOutput(output, packet)).toEqual({ status: "grounded", violations: [] });
  });

  it("프레스·폭염·굴착 작업유형이 온톨로지 Task 로 존재하고 조문이 연결돼 있다", () => {
    for (const label of ["프레스 금형 교체", "굴착 작업", "폭염 작업"]) {
      const sources = buildOntologyGroundingSources(graph, [label]);
      expect(sources.length, label).toBeGreaterThan(0);
      expect(sources.every((source) => source.articles.length > 0), label).toBe(true);
    }
  });

  it("published 가 아닌 노드·엣지는 주입 그래프에서 빠진다", () => {
    const draftGraph = assembleInjectionGraph({
      nodes: [
        { node_id: "Task_draft", kind: "Task", label: "초안 작업", text_excerpt: null, cited_uids: ["manual:x"], meta: {}, review_state: "draft" },
        { node_id: "Hazard_draft", kind: "Hazard", label: "초안 위험", text_excerpt: null, cited_uids: ["manual:x"], meta: {}, review_state: "published" },
        { node_id: "Control_draft", kind: "Control", label: "초안 조치", text_excerpt: null, cited_uids: ["manual:x"], meta: {}, review_state: "published" }
      ],
      edges: [
        { src: "Task_draft", rel: "entailsHazard", dst: "Hazard_draft", cited_uids: ["manual:x"], meta: {}, review_state: "published" },
        { src: "Hazard_draft", rel: "mitigatedBy", dst: "Control_draft", cited_uids: ["manual:x"], meta: {}, review_state: "published" }
      ]
    });
    expect(buildOntologyGroundingSources(draftGraph, ["초안 작업"])).toEqual([]);
  });
});

describe("H3 — 주입용 작업유형 해석기는 QA 용과 분리되고 hazard 폴백을 쓰지 않는다", () => {
  it("프레스는 지게차 상하차로 해석되지 않는다", () => {
    const labels = resolveInjectionTaskLabels({ taskId: "press", layers: [] });
    expect(labels).toContain("프레스 금형 교체");
    expect(labels).not.toContain("지게차 상하차");
    const sources = buildOntologyGroundingSources(graph, labels);
    expect(sources.some((source) => /지게차|포크/.test(source.controlLabel))).toBe(false);
  });

  it("폭염 상하차는 하역·운반 + 폭염 작업으로 해석되고 「일반 작업」이 아니다", () => {
    const labels = resolveInjectionTaskLabels({ taskId: "manual-loading-heat", layers: ["폭염·고온"] });
    expect(labels).toEqual(expect.arrayContaining(["하역·운반", "폭염 작업"]));
    const sources = buildOntologyGroundingSources(graph, labels);
    expect(sources.some((source) => /33도|20분|온·습도계|온ㆍ습도계/.test(source.controlLabel))).toBe(true);
  });

  it("그래프에 없는 라벨은 hazard 폴백 없이 빈 결과", () => {
    expect(buildOntologyGroundingSources(graph, ["끼임"])).toEqual([]);
    expect(resolveInjectionTaskLabels({ taskId: null, layers: [] })).toEqual([]);
  });
});

describe("H4 — 패킷 모드 프롬프트는 게이트와 같은 형식만 요구한다", () => {
  const FORBIDDEN = [/5~7개/, /X-XX-YYYY/, /H-XXX-YYYY/, /KOSHA 지침/, /1500~3500자/];
  const scenario = {
    companyName: "",
    siteName: "현장",
    workSummary: "프레스 금형 교체 작업",
    workerCount: 6,
    weatherNote: "현장 확인"
  };

  it("패킷이 있으면 모든 프롬프트 빌더 출력에 「5~7개」「KOSHA 지침 X-XX-YYYY」 0회", () => {
    const fixture = loadFixture("mfg-press");
    const packet = packetOf(fixture, {
      ontologySources: buildOntologyGroundingSources(graph, resolveInjectionTaskLabels({ taskId: "press", layers: [] }))
    });
    const prompts = buildDeliverablePromptsForAudit({ scenario, question: fixture.question, groundingPacket: packet, citations: fixture.citations });
    expect(Object.keys(prompts).length).toBeGreaterThanOrEqual(8);
    for (const [name, prompt] of Object.entries(prompts)) {
      for (const pattern of FORBIDDEN) {
        expect(prompt.match(pattern), `${name} 프롬프트에 ${pattern} 가 남아 있다`).toBeNull();
      }
      expect(prompt).toContain("패킷 controls 문구를 한 문장에 하나씩 그대로");
    }
  });

  it("패킷이 없으면(비패킷 모드) 기존 지시가 그대로다 — 자기시험", () => {
    const fixture = loadFixture("mfg-press");
    const prompts = buildDeliverablePromptsForAudit({ scenario, question: fixture.question, citations: fixture.citations });
    expect(prompts.riskAssessment).toMatch(/5~7개/);
    expect(prompts.workPlanStructured).toMatch(/KOSHA 지침 X-XX-YYYY/);
  });
});

describe("H5 — 검토 메모(메타 통제문구)는 패킷 controls 에 들어가지 않는다", () => {
  it("4개 고정 자료 전부에서 메타 문구 0", () => {
    for (const id of SCENARIOS) {
      const packet = packetOf(loadFixture(id));
      const controls = packet.sources.flatMap((source) => source.controls);
      expect(controls.filter((control) => REVIEW_META_CONTROL_RE.test(control)), id).toEqual([]);
    }
  });

  it("메타 문구를 TBM 조치로 내면 거절된다", () => {
    const packet = packetOf(loadFixture("con-excavation"));
    const sif = packet.sources.find((source) => source.kind === "sif");
    expect(sif).toBeDefined();
    const output = {
      tbmBriefingStructured: {
        measures: [{ action: "관리감독자 검토 완료 전 사고사례 관리대책을 현장 통제대책으로 확정하지 않음", evidenceRefs: [sif!.referenceKey] }]
      }
    };
    expect(validateGroundedGenerationOutput(output, packet).status).toBe("review_required");
  });
});

describe("H6 — 조문 인용은 법령명과 함께 써야 하고, 조문 없는 접미는 거절", () => {
  const fixture = loadFixture("confined-space");
  const ontologySources = buildOntologyGroundingSources(graph, ["밀폐공간 작업"]);
  const packet = packetOf(fixture, { ontologySources });
  const watcher = packet.sources.find((source) => source.kind === "ontology" && /감시인/.test(source.controls[0]));

  it("고정 자료에는 「제4조」가 든 법령 후보가 있다(거짓 수용의 조건)", () => {
    expect(fixture.citations.some((citation) => /제4조/.test(`${citation.title} ${citation.summary}`))).toBe(true);
  });

  it("「(제4조)」 맨 조번호 접미는 거절한다", () => {
    expect(watcher).toBeDefined();
    const output = {
      tbmBriefingStructured: { measures: [{ action: `${watcher!.controls[0]} (제4조)`, evidenceRefs: [watcher!.referenceKey] }] }
    };
    const validation = validateGroundedGenerationOutput(output, packet);
    expect(validation.status).toBe("review_required");
    expect(validation.violations.map((violation) => violation.code)).toContain("control_claim_not_in_packet");
  });

  it("「(안전보건규칙 제623조)」는 그 조문을 가진 온톨로지 출처가 있을 때만 통과한다", () => {
    const ok = validateGroundedGenerationOutput({
      tbmBriefingStructured: { measures: [{ action: `${watcher!.controls[0]} (안전보건규칙 제623조)`, evidenceRefs: [watcher!.referenceKey] }] }
    }, packet);
    expect(ok).toEqual({ status: "grounded", violations: [] });
    const wrongArticle = validateGroundedGenerationOutput({
      tbmBriefingStructured: { measures: [{ action: `${watcher!.controls[0]} (안전보건규칙 제999조)`, evidenceRefs: [watcher!.referenceKey] }] }
    }, packet);
    expect(wrongArticle.status).toBe("review_required");
    const bareInSuffix = validateGroundedGenerationOutput({
      tbmBriefingStructured: { measures: [{ action: `${watcher!.controls[0]} (제623조)`, evidenceRefs: [watcher!.referenceKey] }] }
    }, packet);
    expect(bareInSuffix.status).toBe("review_required");
  });

  it("서술문의 맨 「제619조」는 unknown_reference, 법령명 붙은 「산업안전보건기준에 관한 규칙 제623조」는 통과", () => {
    const bare = validateGroundedGenerationOutput({ tbmBriefingStructured: { todayWork: { name: "밀폐공간 작업(제619조)" } } }, packet);
    expect(bare.violations.some((violation) => violation.code === "unknown_reference" && violation.value === "제619조")).toBe(true);
    const named = validateGroundedGenerationOutput({ tbmBriefingStructured: { todayWork: { name: "밀폐공간 작업(산업안전보건기준에 관한 규칙 제623조)" } } }, packet);
    expect(named.violations.filter((violation) => violation.code === "unknown_reference")).toEqual([]);
  });
});

describe("국외 참고자료 — 패킷에는 참고 표시로만, 조문 매핑에는 쓰지 않는다", () => {
  const overseas: SafetyReferenceItem = {
    id: "hse-press-1",
    source_id: "uk-hse-press",
    item_type: "incident-case",
    category: "prosecution",
    subcategory: null,
    title: "Worker fell through fragile roof",
    summary: "",
    keywords: ["fragile roof"],
    risk_tags: ["추락"],
    primary_documents: [],
    controls: ["Fragile roof work should be planned with suitable edge protection."],
    country: "GB",
    language: "en",
    review_status: "published",
    legal_basis_scope: "overseas_reference",
    task_ids: ["roof"]
  };

  it("kind=overseas, controls 비움, 「국내 법령 근거 아님(참고 사례)」 표시", () => {
    const fixture = loadFixture("logistics-heat");
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: { ...fixture.dbHarnessPacket, supportingEvidence: [overseas] },
      legalCandidates: [],
      eligibleKoshaIds: new Set<string>()
    });
    const source = packet.sources.find((item) => item.sourceId === "hse-press-1");
    expect(source?.kind).toBe("overseas");
    expect(source?.referenceKey).toBe("OVS:hse-press-1");
    expect(source?.controls).toEqual([]);
    expect(source?.summary).toContain("국내 법령 근거 아님(참고 사례)");
  });
});

describe("조회 — safety_reference 검색은 published 만 쓰고 taskId → task_ids 묶음으로 찾는다", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function row(overrides: Partial<SafetyReferenceItem>): SafetyReferenceItem {
    return {
      id: "row-1",
      source_id: "kr-kosha-case-board",
      item_type: "incident-case",
      category: null,
      subcategory: null,
      title: "프레스 금형 교체 중 끼임 사고",
      summary: "",
      body: "",
      keywords: ["프레스", "금형"],
      risk_tags: ["끼임"],
      primary_documents: ["위험성평가표"],
      controls: ["금형 교체 전 안전블록을 설치한다"],
      country: "KR",
      language: "ko",
      review_status: "published",
      legal_basis_scope: "domestic",
      task_ids: ["press"],
      ...overrides
    };
  }

  it("REST 조회 URL 에 review_status=eq.published 와 task_ids 필터가 들어가고, review_required 행은 떨어진다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    const seen: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/rpc/search_safety_references_ranked")) {
        return new Response(JSON.stringify({ message: "missing" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      if (!url.pathname.endsWith("/rest/v1/safety_reference_items")) throw new Error(`Unexpected fetch URL: ${url.pathname}`);
      seen.push(url);
      return new Response(JSON.stringify([
        row({ id: "published-1" }),
        row({ id: "review-1", review_status: "review_required" })
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const result = await searchSafetyReferences({ query: "프레스 금형 교체", limit: 5, taskIds: ["press"] });
    expect(seen.length).toBeGreaterThan(0);
    for (const url of seen) {
      expect(url.searchParams.get("review_status")).toBe("eq.published");
      const select = (url.searchParams.get("select") || "").split(",");
      expect(select).toEqual(expect.arrayContaining(["review_status", "country", "legal_basis_scope", "task_ids"]));
    }
    expect(seen.some((url) => url.searchParams.get("task_ids") === "cs.{press}")).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual(["published-1"]);
  });

  it("011 칸이 없는 DB(42703)에서는 핵심 칸으로 재조회하고, task_ids 묶음은 빈 결과로 끝낸다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
    const seen: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/rpc/search_safety_references_ranked")) {
        return new Response(JSON.stringify({ message: "missing" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      if (!url.pathname.endsWith("/rest/v1/safety_reference_items")) throw new Error(`Unexpected fetch URL: ${url.pathname}`);
      seen.push(url);
      const select = (url.searchParams.get("select") || "").split(",");
      if (select.includes("review_status") || url.searchParams.has("review_status") || url.searchParams.has("task_ids")) {
        return new Response(JSON.stringify({ code: "42703", message: "column safety_reference_items.review_status does not exist" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      const legacy = { ...row({ id: "legacy-1" }) };
      delete (legacy as Partial<SafetyReferenceItem>).review_status;
      delete (legacy as Partial<SafetyReferenceItem>).country;
      delete (legacy as Partial<SafetyReferenceItem>).task_ids;
      delete (legacy as Partial<SafetyReferenceItem>).legal_basis_scope;
      delete (legacy as Partial<SafetyReferenceItem>).language;
      return new Response(JSON.stringify([legacy]), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const plain = await searchSafetyReferences({ query: "프레스 금형 교체", limit: 5 });
    expect(plain.ok).toBe(true);
    expect(plain.items.map((item) => item.id)).toEqual(["legacy-1"]);
    expect(seen.filter((url) => !url.searchParams.has("review_status")).length).toBeGreaterThan(0);

    const task = await searchSafetyReferences({ query: "프레스 금형 교체", limit: 5, taskIds: ["press"] });
    expect(task.ok).toBe(true);
    expect(task.items).toEqual([]);
    expect(task.errorCode).toBeUndefined();
  });
});
