import { describe, expect, it } from "vitest";

import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";
import type { McpAuthContext } from "@/lib/mcp-auth";
import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";

// 2026-11-22 원격 MCP 전수 점검(generate_risk_assessment, batch sc-ra-construction·sc-ra-manufacturing·e2e-claude)에서
// 반박 검증까지 통과한 결함의 재현 문장을 그대로 고정한다. 합성 입력이다(실사업장 아님).
// 위험요인·감소대책은 산업안전보건기준에 관한 규칙(2025-09-01 공포, 2026-03-02 시행) 법제처 원문과 맞춘 것이다.

function run(question: string) {
  const response = buildMockAskResponse(question, [], "mock", "test");
  const rows: RiskAssessmentRow[] = response.structured?.riskAssessmentRows ?? [];
  return { response, rows, scenario: response.scenario, taskId: response.scenario.taskClassification?.taskId ?? null };
}

function rowWith(rows: RiskAssessmentRow[], hazard: RegExp) {
  const row = rows.find((candidate) => hazard.test(candidate.hazard));
  expect(row, `위험요인 ${hazard} 행이 없다: ${rows.map((r) => r.hazard).join(" | ")}`).toBeDefined();
  return row as RiskAssessmentRow;
}

function allText(rows: RiskAssessmentRow[]) {
  return rows.map((row) => `${row.hazard} ${row.additionalControls} ${row.equipment} ${row.task} ${row.process}`).join("\n");
}

describe("① 지게차 하역 — 위험요인과 감소대책이 같은 행에 있어야 한다", () => {
  const q = "테스트상사 물류창고 지게차로 화물차 팔레트 하역 작업, 작업자 3명(지게차 운전 1, 신호수 1, 검수 1), 도크 경사로, 보행자 통로 인접";

  it("행마다 대책이 그 행의 위험에 맞는다", () => {
    const { rows, taskId } = run(q);
    expect(taskId).toBe("forklift-logistics");
    expect(rowWith(rows, /보행자 충돌/).additionalControls).toMatch(/동선|보행/);
    expect(rowWith(rows, /적재물 낙하/).additionalControls).toMatch(/낙하/);
    expect(rowWith(rows, /교차동선|혼잡/).additionalControls).toMatch(/신호수|동선|후진 경보/);
    expect(rowWith(rows, /적재물 낙하/).additionalControls).not.toMatch(/후진 경보/);
  });

  it("지게차와 보행자 충돌은 「부딪힘」, 적재물 낙하는 「맞음」", () => {
    const { rows } = run(q);
    expect(rowWith(rows, /보행자 충돌/).accidentType).toBe("collision");
    expect(rowWith(rows, /적재물 낙하/).accidentType).toBe("struckBy");
  });

  it("입력의 도크 경사로·화물차가 행에 반영된다", () => {
    const { rows } = run(q);
    const dock = rowWith(rows, /도크|경사로/);
    expect(dock.additionalControls).toMatch(/고임목|유도자/);
    expect(dock.accidentType).not.toBe("other");
  });
});

describe("같은 밀림 결함의 형제 — 전기작업·천장 누수 기본 틀", () => {
  it("배전반 점검: 절연보호구 위험에는 절연보호구 대책, 검전 절차 위험에는 검전 대책", () => {
    const { rows } = run("대전 빌딩 지하 수전반 차단기 교체 작업, 전기 작업자 2명");
    expect(rowWith(rows, /절연보호구/).additionalControls).toMatch(/절연/);
    expect(rowWith(rows, /검전 절차/).additionalControls).toMatch(/검전/);
  });

  it("천장 누수: 사다리 추락 위험에는 작업발판 대책, 미끄러짐에는 바닥 대책", () => {
    const { rows } = run("상가 천장 누수 보수 작업, 작업자 2명");
    expect(rowWith(rows, /사다리|작업발판/).additionalControls).toMatch(/작업발판|사다리/);
    expect(rowWith(rows, /미끄러짐/).additionalControls).toMatch(/바닥|미끄럼/);
    expect(rowWith(rows, /감전/).additionalControls).toMatch(/전원|검전/);
  });
});

describe("② 외벽 시스템비계 해체 — 이동식 비계 틀을 쓰지 않는다", () => {
  const q = "테스트건설 가상01 현장, 지상 5층 근린생활시설 외벽 시스템비계 해체 작업. 작업자 5명, 고소작업대(차량탑재형 붐형) 1대 사용, 비계 높이 약 18m, 하부 보행로 인접, 오후 강풍 예보";

  it("이동식 비계 문구(바퀴 잠금)가 없고 시스템비계 해체 행이 있다", () => {
    const { rows, taskId, scenario } = run(q);
    expect(taskId).toBe("scaffold-assembly");
    const text = allText(rows);
    expect(text).not.toMatch(/바퀴|이동식 비계/);
    expect(scenario.siteName).not.toMatch(/이동식/);
    expect(rowWith(rows, /벽 연결재/).accidentType).toBe("collapse");
    expect(rowWith(rows, /추락/).additionalControls).toMatch(/안전대/);
    expect(rowWith(rows, /보행로|하부/).additionalControls).toMatch(/출입/);
  });

  it("입력의 고소작업대가 행에 들어간다", () => {
    const { rows } = run(q);
    const aerial = rows.filter((row) => /고소작업대/.test(row.hazard));
    expect(aerial.length).toBeGreaterThanOrEqual(2);
    expect(aerial.every((row) => row.equipment === "고소작업대")).toBe(true);
    expect(rowWith(rows, /고소작업대.*전도/).accidentType).toBe("overturn");
  });

  it("강풍 예보는 악천후 작업중지 행으로 들어간다", () => {
    const { rows } = run(q);
    expect(rows.some((row) => /악천후|강풍/.test(row.hazard) && /중지/.test(row.additionalControls))).toBe(true);
  });

  it("이동식 비계를 적으면 이동식 비계 틀을 그대로 쓴다", () => {
    const { rows, taskId } = run("이동식 비계 조립·해체 작업, 작업자 2명");
    expect(taskId).toBe("scaffold-assembly");
    expect(allText(rows)).toMatch(/바퀴/);
  });
});

describe("③ 굴착 4m 흙막이 — 덤프트럭 운반으로 분류하지 않는다", () => {
  const q = "가상02 오피스텔 신축현장 지하 터파기, 굴착 깊이 4m, H-pile+토류판 흙막이 설치 중, 굴착기(0.8㎥) 1대와 덤프트럭 2대, 작업자 6명, 인접 도로와 상수도관 매설, 전날 비";

  it("굴착작업으로 분류하고 붕괴·흙막이·매설물·굴착기·덤프트럭 행을 낸다", () => {
    const { rows, taskId } = run(q);
    expect(taskId).toBe("excavation");
    expect(rows[0].hazard).toMatch(/붕괴|매몰/);
    expect(rowWith(rows, /흙막이/).additionalControls).toMatch(/제347조/);
    rowWith(rows, /매설물/);
    rowWith(rows, /굴착기/);
    rowWith(rows, /덤프/);
    expect(rowWith(rows, /굴착.*추락|추락/).accidentType).toBe("fall");
  });

  it("전날 비를 굴착 조건에 반영한다", () => {
    const { scenario } = run(q);
    expect(scenario.weatherNote).toMatch(/우천|비/);
    expect(scenario.weatherNote).not.toMatch(/미지정/);
  });

  it("「터파기 작업」처럼 접미어가 붙은 문장과 같은 분류다", () => {
    expect(run(q.replace("지하 터파기,", "지하 터파기 작업,")).taskId).toBe("excavation");
  });

  it("굴착기만 적힌 철거 작업은 여전히 보류한다", () => {
    expect(run("서울 노후 주택 철거 해체 작업, 굴착기 1대, 작업자 5명").taskId).toBeNull();
  });
});

describe("④ 철골 12m 볼트 체결 — 크레인 양중 틀로 분류하지 않는다", () => {
  const q = "테스트상사 물류창고 철골 공사, 높이 12m 보-기둥 접합부 고장력 볼트 체결 작업, 작업자 4명, 이동식 크레인으로 부재 양중, 안전대 부착설비 일부 미설치, 임팩트렌치 사용";

  it("철골 고소 작업으로 분류하고 1행이 추락이다", () => {
    const { rows, taskId } = run(q);
    expect(taskId).toBe("steel-erection");
    expect(rows[0].accidentType).toBe("fall");
    expect(rows[0].hazard).toMatch(/추락/);
  });

  it("입력의 「안전대 부착설비 일부 미설치」가 행에 들어간다", () => {
    const { rows } = run(q);
    expect(rowWith(rows, /부착설비/).additionalControls).toMatch(/제44조/);
  });

  it("크레인 행은 남고, 크레인 전도는 추락으로 적지 않는다", () => {
    const { rows } = run(q);
    rowWith(rows, /인양/);
    expect(rows.filter((row) => /전도/.test(row.hazard)).every((row) => row.accidentType !== "fall")).toBe(true);
  });

  it("타워크레인 철골 양중만 적힌 문장은 크레인 양중 그대로다", () => {
    expect(run("부산 아파트 건설현장 타워크레인 철골 양중 작업, 신호수 2명").taskId).toBe("crane-lifting");
  });
});

describe("⑤ 사무실 천장 조명 교체(A형 사다리) — 문장을 바꿔도 같은 분류", () => {
  const paraphrases = [
    "A형 사다리 위에서 사무실 천장 형광등 교체, 작업자 2명",
    "오늘 테스트상사 2층 사무실 천장 조명 교체 작업을 합니다. 작업자 2명, A형 사다리 사용. SafeClaw 로 위험성평가표를 만들어 주세요.",
    "천장 조명기구(형광등·LED 등기구) 교체 전기 작업. A형 사다리를 딛고 올라가 천장 높이에서 하는 작업",
    "사무실 천장 LED 등기구 교체. A형 사다리 위에서 작업",
    "2층 사무실 천장 조명(등기구) 교체, 전기 차단 후 작업"
  ];

  it.each(paraphrases)("%s → 조명 교체(사다리·전기)", (q) => {
    const { rows, taskId, scenario } = run(q);
    expect(taskId).toBe("ladder-lighting");
    expect(rowWith(rows, /사다리.*추락|추락/).accidentType).toBe("fall");
    expect(rowWith(rows, /사다리.*추락|추락/).additionalControls).toMatch(/제42조/);
    expect(rowWith(rows, /감전/).additionalControls).toMatch(/검전/);
    const surface = `${allText(rows)}\n${scenario.siteName}\n${scenario.workSummary}\n${scenario.weatherNote}`;
    expect(surface).not.toMatch(/누수|배전반|젖은 바닥/);
  });

  it("고소작업대로 천장 배관을 설치하면 고소작업대 그대로다", () => {
    expect(run("평택 반도체 공장 천장 배관 설치, 시저형 고소작업대 사용").taskId).toBe("aerial-work-platform");
  });
});

describe("⑤ 식당 주방 조리 — 0행으로 보류하지 않는다", () => {
  const q = "음식점 주방 조리 작업: 튀김기로 튀김 조리, 칼·도마로 채소 손질, 가스레인지 사용, 조리원 3명";

  it("주방 조리로 분류하고 화상·베임·미끄러짐·가스 행을 낸다", () => {
    const { rows, taskId } = run(q);
    expect(taskId).toBe("kitchen-cooking");
    expect(rowWith(rows, /튀김|기름/).accidentType).toBe("burn");
    expect(rowWith(rows, /칼|베임/).accidentType).toBe("cut");
    expect(rowWith(rows, /미끄러/).accidentType).toBe("slip");
    expect(rowWith(rows, /미끄러/).additionalControls).toMatch(/제3조/);
    expect(rowWith(rows, /가스/).accidentType).toBe("fireExplosion");
  });
});

describe("⑥ 프레스 금형 교체(천장크레인) — 금형 낙하는 추락이 아니다", () => {
  const q = "테스트상사 프레스 공정 200톤 기계식 프레스 금형 교체 작업, 작업자 2명, 천장크레인으로 금형 인양, 슬라이드 하강 상태에서 볼트 체결";

  it("금형 낙하 행은 「맞음」이고 장비는 천장크레인이다", () => {
    const { rows, taskId } = run(q);
    expect(taskId).toBe("press");
    const drop = rowWith(rows, /금형 낙하/);
    expect(drop.accidentType).toBe("struckBy");
    expect(drop.equipment).toBe("천장크레인");
    expect(drop.hazard).not.toMatch(/지게차/);
    expect(drop.additionalControls).toMatch(/제146조/);
    expect(drop.additionalControls).not.toMatch(/제172조/);
    expect(rows.some((row) => row.equipment === "지게차")).toBe(false);
  });

  it("불시기동 행은 「끼임」이다", () => {
    const { rows } = run(q);
    expect(rowWith(rows, /불시기동/).accidentType).toBe("caughtIn");
  });

  it("지게차로 금형을 옮기면 지게차 행·제172조가 그대로다", () => {
    const { rows } = run("경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 지게차로 금형 운반");
    const drop = rowWith(rows, /금형 낙하/);
    expect(drop.equipment).toBe("지게차");
    expect(drop.additionalControls).toMatch(/제172조/);
    expect(drop.accidentType).toBe("struckBy");
  });
});

describe("분류 반례 — 새 틀이 다른 작업을 끌어오지 않는다", () => {
  it("주차장 램프(경사로) 보수 공사는 조명 교체가 아니다", () => {
    expect(run("주차장 램프 보수 공사, 작업자 3명").taskId).not.toBe("ladder-lighting");
  });

  it("야간 조명 설치 후 크레인 양중은 크레인 양중이다", () => {
    expect(run("야간 조명 설치 후 이동식 크레인으로 자재 인양 작업, 신호수 1명").taskId).toBe("crane-lifting");
  });

  it("관로가 주변 매설물로만 적힌 터파기는 그 관로 굴착공사로 부르지 않는다", () => {
    const { scenario } = run("가상02 오피스텔 신축현장 지하 터파기, 굴착 깊이 4m, H-pile+토류판 흙막이 설치 중, 굴착기(0.8㎥) 1대와 덤프트럭 2대, 작업자 6명, 인접 도로와 상수도관 매설, 전날 비");
    expect(scenario.siteName).not.toMatch(/상수도관 굴착공사/);
    expect(run("광주 상수도관 터파기 작업, 깊이 3m, 굴착기 1대").scenario.siteName).toMatch(/상수도관 굴착공사/);
  });

  it.each(["급식실 조리원 튀김 작업", "식당 주방에서 칼로 채소 손질 작업 2명"])("%s → 주방 조리", (q) => {
    const { taskId, rows } = run(q);
    expect(taskId).toBe("kitchen-cooking");
    rowWith(rows, /미끄러/);
  });

  // 「주방」은 장소다. 주방에서 하는 용접·누수 보수·바닥 세척은 그 작업 틀로 간다(기준 a0fc6338 과 같은 분류).
  it.each([
    ["식당 주방 후드 덕트 용접 작업", "hotwork"],
    ["식당 주방 후드 덕트 용접 작업, 화재감시자 1명", "hotwork"],
    ["주방 가스 배관 교체 용접", "hotwork"],
    ["주방 천장 누수 보수 작업", "leak-maintenance"],
    ["식당 주방 천장 누수 보수 작업", "leak-maintenance"],
    ["급식실 바닥 세척 세제 사용 작업", "floor-cleaning"],
    ["급식실 바닥 세척 세제 작업", "floor-cleaning"]
  ])("%s → %s(주방 조리가 아니다)", (q, expected) => {
    expect(run(q).taskId).toBe(expected);
  });

  // 조리 문장의 「화기」·「절단」은 화기작업이 아니다(주방 규칙이 화기작업보다 앞에 있는 이유).
  it.each(["주방 조리 작업, 가스레인지 화기 사용", "식당 주방에서 칼로 식재료 절단 작업"])("%s → 주방 조리", (q) => {
    expect(run(q).taskId).toBe("kitchen-cooking");
  });

  it("주방 용접은 화재·불티 행을 잃지 않는다", () => {
    const { rows } = run("식당 주방 후드 덕트 용접 작업, 화재감시자 1명");
    expect(rows.some((row) => /불티|화재/.test(row.hazard))).toBe(true);
    expect(rows.some((row) => /튀김|기름/.test(row.hazard))).toBe(false);
  });

  it("급식실 바닥 세척은 세제 노출 행을, 주방 천장 누수 보수는 감전 행을 잃지 않는다", () => {
    expect(run("급식실 바닥 세척 세제 사용 작업").rows.some((row) => /세제|세척제|화학/.test(row.hazard))).toBe(true);
    expect(run("주방 천장 누수 보수 작업").rows.some((row) => /감전|전기/.test(row.hazard))).toBe(true);
  });
});

describe("MCP generate_risk_assessment 처리기(공개 template) — 재현 문장이 그대로 나간다", () => {
  const AUTH: McpAuthContext = { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null };
  const call = async (question: string) => {
    const { runAsk } = await import("@/lib/search");
    const handler = createGenerateRiskAssessmentHandler({
      defaultMode: "template",
      generateResponse: (q, m) => runAsk(q, { aiMode: m }),
      renderXlsx: renderXlsxDocumentExport,
      renderHwp: renderHwpDocumentExport
    });
    const result = await handler({ question, mode: "template" }, AUTH, { signal: new AbortController().signal });
    return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
  };

  it.each([
    ["테스트상사 물류창고 지게차로 화물차 팔레트 하역 작업, 작업자 3명(지게차 운전 1, 신호수 1, 검수 1), 도크 경사로, 보행자 통로 인접", "forklift-logistics", /보행자 충돌/, "collision"],
    ["테스트건설 가상01 현장, 지상 5층 근린생활시설 외벽 시스템비계 해체 작업. 작업자 5명, 고소작업대(차량탑재형 붐형) 1대 사용, 비계 높이 약 18m, 하부 보행로 인접, 오후 강풍 예보", "scaffold-assembly", /벽 연결재/, "collapse"],
    ["가상02 오피스텔 신축현장 지하 터파기, 굴착 깊이 4m, H-pile+토류판 흙막이 설치 중, 굴착기(0.8㎥) 1대와 덤프트럭 2대, 작업자 6명, 인접 도로와 상수도관 매설, 전날 비", "excavation", /흙막이/, "collapse"],
    ["테스트상사 물류창고 철골 공사, 높이 12m 보-기둥 접합부 고장력 볼트 체결 작업, 작업자 4명, 이동식 크레인으로 부재 양중, 안전대 부착설비 일부 미설치, 임팩트렌치 사용", "steel-erection", /부착설비/, "fall"],
    ["A형 사다리 위에서 사무실 천장 형광등 교체, 작업자 2명", "ladder-lighting", /사다리/, "fall"],
    ["음식점 주방 조리 작업: 튀김기로 튀김 조리, 칼·도마로 채소 손질, 가스레인지 사용, 조리원 3명", "kitchen-cooking", /튀김/, "burn"],
    ["테스트상사 프레스 공정 200톤 기계식 프레스 금형 교체 작업, 작업자 2명, 천장크레인으로 금형 인양, 슬라이드 하강 상태에서 볼트 체결", "press", /금형 낙하/, "struckBy"]
  ] as const)("%s", async (question, taskId, hazard, accidentType) => {
    const payload = await call(question);
    expect(payload.status).not.toBe("review_required");
    expect(payload.scenario.taskClassification?.taskId).toBe(taskId);
    const row = payload.riskAssessment.structuredRows.find((candidate) => hazard.test(candidate.hazard));
    expect(row?.accidentType).toBe(accidentType);
    // 공개 경로의 출력 게이트를 지나도 대책 문장(조문 표기 포함)이 기본 틀 그대로다.
    const source = rowWith(run(question).rows, hazard);
    expect(row?.additionalControls).toBe(source.additionalControls);
  }, 60_000);
});

describe("크레인 전도 행의 재해유형", () => {
  it("크레인 전도는 「깔림·뒤집힘」이다", () => {
    const { rows } = run("김포 이동식 크레인으로 자재 인양 작업, 신호수 1명");
    expect(rowWith(rows, /크레인 전도/).accidentType).toBe("overturn");
  });
});
