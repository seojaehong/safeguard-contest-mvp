import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { POST as exportPdf } from "@/app/api/export/pdf/route";
import { buildMockAskResponse } from "@/lib/mock-data";
import { buildPermitInspectionStructuredXlsx, buildWorkPlanStructuredXlsx } from "@/lib/xlsx-builder";
import { auditAskDeliverables } from "@/lib/deliverable-integrity-policy";
import { buildQualityContract } from "@/lib/quality-contract";
import { applyOntologyQaRemediation } from "@/lib/workpack-ontology-qa";
import {
  attachWorkPlanLegalForm,
  buildPermitRequiredTerms,
  buildWorkPlanLegalForm,
  resolvePermitCategory
} from "@/lib/permit-workplan-forms";
import type { AskResponse, PermitInspectionStructured, WorkPlanStructured } from "@/lib/types";

// 운영 4시나리오(합성 질문). sc-audit launch-depth-audit-2026-10-25 ask-full-*.json 의 question 과 같다.
const SCENARIOS = {
  excavation: "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.",
  confined: "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.",
  heat: "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘.",
  press: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘."
} as const;

const EXPECTED_PERMIT_CATEGORY: Record<keyof typeof SCENARIOS, string> = {
  excavation: "굴착작업",
  confined: "밀폐공간 작업",
  heat: "일반 위험작업",
  press: "설비 정비·격리 작업"
};

// 교정 전(2026-10-25 운영) 정화조 허가서 본문. 새 게이트가 이것을 FAIL 시키는지 자기시험한다.
const LEGACY_CONFINED_PERMIT = [
  "안전작업허가 확인서(초안)",
  "[1. 허가 기본정보]",
  "- 허가대상 작업: 지하 기계실 점검 및 정비 작업",
  "- 허가구분: 전기작업",
  "- 작업내용: 상가건물 지하 정화조 청소 작업",
  "- 작업시간: 작업 시작 전 허가 시각부터 종료 확인 시각까지",
  "[2. 작업 전 허가조건]",
  "- 안전조치 2: 전기판넬 접근 전 차단·잠금표시와 절연 보호구 확인",
  "- 보호구: 작업별 보호구의 종류, 손상 여부, 착용 상태를 작업 시작 전에 확인",
  "[3. 격리·차단 및 첨부 확인]",
  "- 에너지원 잠금·표지(LOTO), 잔류에너지 제거, 재가동 승인 상태를 확인",
  "[4. 작업 중 확인]",
  "- 변경관리 확인: 누수 구간과 미끄럼 위험 구역을 전원이 알고 있는가?",
  "[5. 종료 확인]",
  "- 종료시간, 종료상태, 확인자, 특이사항을 기록한 뒤 허가를 닫음"
].join("\n");

function respond(question: string): AskResponse {
  return buildMockAskResponse(question, [], "mock", "test");
}

function permitTypeLine(text: string): string | null {
  return text.match(/허가구분:\s*(.+)/)?.[1]?.trim() ?? null;
}

async function workbookText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const values: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => values.push(String(cell.text ?? "")));
    });
  });
  return values.join("\n");
}

describe("허가구분 단일 판정 (WP-02·WP-08·EXP-01)", () => {
  it.each(Object.entries(SCENARIOS))("%s: 본문·구조화·xlsx 의 허가구분이 작업 분류 한 곳에서 나온 같은 값이다", async (key, question) => {
    const response = respond(question);
    const expected = EXPECTED_PERMIT_CATEGORY[key as keyof typeof SCENARIOS];
    const structured = response.deliverables.permitInspectionStructured as PermitInspectionStructured;

    expect(resolvePermitCategory(response.scenario.taskClassification?.taskId, question)).toBe(expected);
    expect(structured?.basicInfo.permitType).toBe(expected);
    // hwp·pdf·html·화면은 workPermitDraft 본문을 줄 단위로 쓴다.
    expect(permitTypeLine(response.deliverables.workPermitDraft ?? "")).toBe(expected);
    const xlsx = await workbookText(await buildPermitInspectionStructuredXlsx(response.scenario, structured as unknown as Record<string, unknown>));
    expect(xlsx).toContain(expected);
  });

  it("동시작업은 질문에 화기작업이 있을 때만 화기작업 허가로 본다(양쪽 분기)", () => {
    expect(resolvePermitCategory("simultaneous-work", "용접과 크레인 동시작업")).toBe("화기작업");
    expect(resolvePermitCategory("simultaneous-work", "상하부 동시작업, 자재 인양")).toBe("일반 위험작업");
    expect(resolvePermitCategory("press", "프레스 금형 교체, 용접 없음 확인")).toBe("설비 정비·격리 작업");
  });

  it("작업 유형을 판정하지 못하면 허가 구조화 데이터를 만들지 않는다(보류 문서팩에서 허가서가 멀쩡히 나오지 않음)", () => {
    const response = respond("오늘 작업 문서 만들어줘");
    expect(response.scenario.taskClassification?.status).toBe("review_required");
    expect(response.deliverables.permitInspectionStructured).toBeUndefined();
  });
});

describe("밀폐공간 허가서 틀 (WP-02·EXP-05)", () => {
  it("정화조 허가서에 제619조② 1~6호 확인 칸과 산소·황화수소 측정 칸(값·시각·측정자·기준)이 있다", async () => {
    const response = respond(SCENARIOS.confined);
    const permit = response.deliverables.permitInspectionStructured as PermitInspectionStructured;
    const measurements = permit.measurements ?? [];
    const oxygen = measurements.find((row) => row.item.includes("산소"));
    const h2s = measurements.find((row) => row.item.includes("황화수소"));
    expect(oxygen?.standard).toBe("18% 이상 23.5% 미만");
    expect(h2s?.standard).toBe("10ppm 미만");
    // 측정값은 지어내지 않는다.
    expect(measurements.every((row) => row.value === "(현장 기재)" && row.measurer === "(현장 기재)" && row.measuredAt === "(현장 기재)")).toBe(true);
    const checks = permit.statutoryChecks ?? [];
    for (const basis of ["제619조②1호", "제619조②2호", "제619조②3호", "제619조②4호", "제619조②5호", "제619조②6호", "제619조③"]) {
      expect(checks.map((check) => check.basis)).toContain(basis);
    }

    const text = response.deliverables.workPermitDraft ?? "";
    for (const term of ["산소", "황화수소", "측정자", "측정 시각", "감시인", "출입구 게시", "18% 이상 23.5% 미만", "10ppm 미만"]) {
      expect(text).toContain(term);
    }
    expect(text).not.toContain("전기판넬");

    const xlsx = await workbookText(await buildPermitInspectionStructuredXlsx(response.scenario, permit as unknown as Record<string, unknown>));
    for (const term of ["황화수소", "측정자", "측정 시각", "감시인", "10ppm 미만"]) {
      expect(xlsx).toContain(term);
    }
  });

  it("밀폐공간이 아닌 프레스 허가서에는 가스 측정 칸이 없다(양쪽 분기)", () => {
    const permit = respond(SCENARIOS.press).deliverables.permitInspectionStructured as PermitInspectionStructured;
    expect(permit.measurements ?? []).toHaveLength(0);
    expect(respond(SCENARIOS.press).deliverables.workPermitDraft).not.toContain("황화수소");
  });

  it("허가조건의 조치는 같은 위험의 조치이고, 같은 조치를 되풀이하지 않으며, 첨부 상태는 「확인 전」이다(WP-12)", () => {
    for (const question of Object.values(SCENARIOS)) {
      const permit = respond(question).deliverables.permitInspectionStructured as PermitInspectionStructured;
      const actions = permit.conditions.map((condition) => condition.action).filter((action) => action !== "(현장 기재)");
      expect(new Set(actions).size).toBe(actions.length);
      expect(permit.attachments.every((attachment) => attachment.status !== "첨부")).toBe(true);
    }
  });

  it("변경관리 칸은 재허가 기준이다(WP-15)", () => {
    const text = respond(SCENARIOS.confined).deliverables.workPermitDraft ?? "";
    expect(text).toMatch(/변경관리 확인: .*재허가/);
  });

  it("화기작업 허가서에는 제241조② 확인 칸과 화재감시자 칸이 있다", () => {
    const permit = respond("조선소 블록 용접 작업. 작업자 4명.").deliverables.permitInspectionStructured as PermitInspectionStructured;
    expect(permit.basicInfo.permitType).toBe("화기작업");
    expect((permit.statutoryChecks ?? []).map((check) => check.basis)).toEqual(expect.arrayContaining(["제241조②1호", "제241조②6호", "제241조④", "제241조의2"]));
  });
});

describe("허가서 필수어 게이트 (WP-14)", () => {
  it("교정 전 정화조 허가서(허가구분 전기작업)는 밀폐공간 필수 항목이 없어 FAIL 한다", () => {
    const terms = buildPermitRequiredTerms("밀폐공간 작업");
    const [audit] = auditAskDeliverables({
      deliverables: { workPermitDraft: LEGACY_CONFINED_PERMIT },
      requiredKeys: ["workPermitDraft"],
      requiredTermsByKey: { workPermitDraft: terms }
    });
    expect(audit.verdict).toBe("blocked");
    expect(audit.missingRequiredTerms).toEqual(expect.arrayContaining(["허가구분: 밀폐공간 작업", "황화수소", "감시인"]));
  });

  it.each(Object.entries(SCENARIOS))("%s: 새 허가서는 허가구분별 필수 항목 게이트를 통과한다", (_key, question) => {
    const response = respond(question);
    const contract = buildQualityContract(response);
    const integrity = contract.items.find((item) => item.key === "integrity");
    expect(integrity?.status).toBe("ready");
    expect(integrity?.detail ?? "").not.toContain("workPermitDraft");
  });

  it("허가구분이 본문과 맞지 않으면 품질 계약이 허가서를 막는다", () => {
    const response = respond(SCENARIOS.confined);
    const tampered = { ...response, deliverables: { ...response.deliverables, workPermitDraft: LEGACY_CONFINED_PERMIT } };
    const contract = buildQualityContract(tampered);
    const integrity = contract.items.find((item) => item.key === "integrity");
    expect(integrity?.status).not.toBe("ready");
  });
});

describe("작업계획서 별표4 호별 양식 (WP-04·WP-06·WP-13·WP-16)", () => {
  it("굴착 2.5m: 6호 사전조사 4행·계획 가~사, 3호 가~다, 작업지휘자 칸이 있고 자기참조 문장이 없다", () => {
    const text = respond(SCENARIOS.excavation).deliverables.workPlanDraft;
    for (const label of [
      "형상·지질 및 지층의 상태",
      "균열·함수·용수 및 동결의 유무 또는 상태",
      "매설물 등의 유무 또는 상태",
      "지반의 지하수위 상태",
      "가. 굴착방법 및 순서, 토사등 반출 방법",
      "나. 필요한 인원 및 장비 사용계획",
      "다. 매설물 등에 대한 이설·보호대책",
      "라. 사업장 내 연락방법 및 신호방법",
      "마. 흙막이 지보공 설치방법 및 계측계획",
      "바. 작업지휘자의 배치계획",
      "사. 그 밖에 안전·보건에 관련된 사항",
      "가. 사용하는 차량계 건설기계의 종류 및 성능",
      "나. 차량계 건설기계의 운행경로",
      "다. 차량계 건설기계에 의한 작업방법"
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("작업지휘자");
    expect(text).toContain("2.5m");
    expect(text).not.toContain("첨부자료로 확인");
    expect(text).not.toContain("작성일: 작업 시작 전");
    expect(text).not.toContain("현장 서식 기준:");
    expect(text.split("\n")[0]).not.toBe("작업계획서(초안)");
  });

  it("굴착 1.5m 이면 6호 섹션을 강제하지 않는다(양쪽 분기)", () => {
    const form = buildWorkPlanLegalForm({
      taskId: "excavation",
      question: "상수도관 굴착공사. 굴착 깊이 1.5m, 작업자 3명, 소형 굴착기 1대."
    });
    expect(form.sections.map((section) => section.annexItem)).not.toContain(6);
    expect(form.sections.map((section) => section.annexItem)).toContain(3);
    expect(form.applicability.join(" ")).toContain("2m 미만");
  });

  it("강풍 예보면 제37조① 작업중지 기준 칸(풍속·측정 수단·판단자)을 두고 풍속 숫자는 지어내지 않는다(WP-09)", () => {
    const text = respond(SCENARIOS.excavation).deliverables.workPlanDraft;
    expect(text).toContain("작업중지 풍속 기준: (현장 기재)");
    expect(text).toContain("중지 판단자: (현장 기재)");
    expect(text).not.toContain("30m/s");
  });

  it("폭염 상하차: 제562조② 기록 칸과 제38조① 대상 여부 칸이 있다(WP-16)", () => {
    const text = respond(SCENARIOS.heat).deliverables.workPlanDraft;
    expect(text).toContain("제562조②");
    expect(text).toContain("온·습도계 비치 위치(제562조②1호): (현장 기재)");
    expect(text).toContain("측정 체감온도");
    expect(text).toContain("12월 31일");
    expect(text).toContain("제38조① 대상 여부");
    expect(text).toMatch(/제11호 중량물의 취급작업.*\(현장 기재\)/);
  });

  it("폭염 조건이 없으면 제562조② 칸이 없다(양쪽 분기)", () => {
    expect(respond(SCENARIOS.press).deliverables.workPlanDraft).not.toContain("제562조②");
  });

  it("AI 가 만든 구조화 계획서 xlsx 에도 별표4 섹션이 실린다", async () => {
    const form = buildWorkPlanLegalForm({ taskId: "excavation", question: SCENARIOS.excavation });
    const structured: WorkPlanStructured = {
      workOverview: { workName: "굴착", description: "배관 굴착", workerCount: 8, location: "현장", condition: "강풍", equipment: ["굴착기"] },
      workSteps: [{ stepNo: 1, action: "굴착", equipment: "굴착기", safetyMeasure: "출입통제", owner: "작업반장" }],
      stopCriteria: ["붕괴 징후"],
      emergencyResponse: { contacts: [], evacRoute: "출입구", firstAid: "119" },
      approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" },
      applicability: form.applicability,
      statutorySections: form.sections
    };
    const buffer = await buildWorkPlanStructuredXlsx(respond(SCENARIOS.excavation).scenario, structured as unknown as Record<string, unknown>);
    const xlsx = await workbookText(buffer);
    expect(xlsx).toContain("지반의 지하수위 상태");
    expect(xlsx).toContain("마. 흙막이 지보공 설치방법 및 계측계획");
  });
});

describe("AI 구조화 계획서에 서버가 별표4 섹션을 붙인다 (WP-06 full 경로)", () => {
  const aiPlan: WorkPlanStructured = {
    workOverview: { workName: "굴착", description: "배관 굴착", workerCount: 8, location: "현장", condition: "강풍", equipment: ["굴착기"] },
    workSteps: [{ stepNo: 1, action: "굴착", equipment: "굴착기", safetyMeasure: "출입통제", owner: "작업반장" }],
    stopCriteria: ["붕괴 징후"],
    emergencyResponse: { contacts: [], evacRoute: "출입구", firstAid: "119" },
    approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" }
  };

  it("AI 가 법정 칸 없이 낸 구조화 계획서에 6호 사전조사·계획, 3호 칸을 붙이고 AI 값을 지우지 않는다", () => {
    const attached = attachWorkPlanLegalForm(aiPlan, { taskId: "excavation", question: SCENARIOS.excavation, workerCount: 8 });
    const annexItems = (attached?.statutorySections ?? []).map((section) => section.annexItem);
    expect(annexItems).toContain(6);
    expect(annexItems).toContain(3);
    expect(attached?.applicability?.join(" ")).toContain("2.5m");
    expect(attached?.workSteps).toEqual(aiPlan.workSteps);
  });

  it("AI 가 스스로 적은 법정 칸은 서버 판정으로 덮는다(작업 분류가 정본)", () => {
    const forged = { ...aiPlan, applicability: ["대상 아님"], statutorySections: [] };
    const attached = attachWorkPlanLegalForm(forged, { taskId: "excavation", question: SCENARIOS.excavation });
    expect(attached?.applicability).not.toContain("대상 아님");
    expect(attached?.statutorySections?.length).toBeGreaterThan(0);
  });

  it("작업 유형 보류(taskId 없음)면 그대로 돌려준다", () => {
    expect(attachWorkPlanLegalForm(aiPlan, { taskId: null, question: "작업" })).toBe(aiPlan);
    expect(attachWorkPlanLegalForm(undefined, { taskId: "excavation", question: SCENARIOS.excavation })).toBeUndefined();
  });

  it("검색 파이프라인이 구조화 계획서에 법정 칸을 붙인다(lib/search.ts 배선)", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/search.ts"), "utf8");
    expect(source).toMatch(/attachWorkPlanLegalForm\(\s*linkWorkPlanToRiskRows\(baseDeliverables\.workPlanStructured/);
  });
});

describe("4형식 허가구분·법정 칸 일치 (EXP-01: hwp·pdf/html 은 본문 행을 그대로 쓴다)", () => {
  // 화면 parseSheetRows 와 같은 규칙: [절] → section, 「키: 값」 → item/content.
  function rowsFromText(title: string, text: string) {
    const rows: Array<{ document: string; section: string; item: string; content: string }> = [];
    let section = "기본정보";
    let index = 1;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) { section = sectionMatch[1]; index = 1; continue; }
      const colon = line.indexOf(":");
      if (colon > 0) rows.push({ document: title, section, item: line.slice(0, colon).trim(), content: line.slice(colon + 1).trim() });
      else { rows.push({ document: title, section, item: String(index), content: line }); index += 1; }
    }
    return rows;
  }

  function hwpText(binary: Buffer): string {
    const document = new HwpDocument(new Uint8Array(binary));
    const texts: string[] = [];
    try {
      for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
        const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
        if (!Array.isArray(positions)) continue;
        positions.forEach((_position, controlIdx) => {
          for (let cellIdx = 0; cellIdx < 2000; cellIdx += 1) {
            try {
              const length = document.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
              texts.push(document.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length));
            } catch {
              break;
            }
          }
        });
      }
    } finally {
      document.free();
    }
    return texts.join("\n");
  }

  it.each(Object.entries(SCENARIOS))("%s: pdf(html)·hwp 에 같은 허가구분이 찍히고, 정화조는 측정 칸이 실린다", async (key, question) => {
    const response = respond(question);
    const expected = EXPECTED_PERMIT_CATEGORY[key as keyof typeof SCENARIOS];
    const title = "안전작업허가 확인서";
    const rows = rowsFromText(title, response.deliverables.workPermitDraft ?? "");
    const body = JSON.stringify({ title, rows, profile: { layout: "permit" }, scenario: response.scenario });

    const html = await (await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST", headers: { "content-type": "application/json" }, body
    }))).text();
    expect(html).toContain(expected);

    const hwpResponse = await exportHwp(new NextRequest("http://localhost/api/export/hwp", {
      method: "POST", headers: { "content-type": "application/json" }, body
    }));
    expect(hwpResponse.status).toBe(200);
    const hwp = hwpText(Buffer.from(await hwpResponse.arrayBuffer()));
    expect(hwp).toContain(expected);

    if (key === "confined") {
      for (const term of ["황화수소", "10ppm 미만", "측정자", "감시인"]) {
        expect(html).toContain(term);
        expect(hwp).toContain(term);
      }
    } else {
      expect(html).not.toContain("황화수소");
    }
  });

  it("굴착 계획서 본문을 행으로 바꿔도 별표4 칸이 남고 제목·서식 설명 행이 없다(WP-13)", async () => {
    const text = respond(SCENARIOS.excavation).deliverables.workPlanDraft;
    const rows = rowsFromText("작업계획서", text);
    const contents = rows.map((row) => `${row.item} ${row.content}`).join("\n");
    expect(contents).toContain("라. 지반의 지하수위 상태");
    expect(contents).toContain("바. 작업지휘자의 배치계획");
    expect(contents).not.toContain("작업계획서(초안)");
    expect(contents).not.toContain("현장 서식 기준");
    expect(rows.find((row) => row.item.includes("작성일"))?.content).toBe("(현장 기재)");
    const html = await (await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "작업계획서", rows, profile: { layout: "workPlan" }, scenario: respond(SCENARIOS.excavation).scenario })
    }))).text();
    expect(html).toContain("지반의 지하수위 상태");
  });
});

describe("「준제출형·제출 필수 항목 반영」 라벨 제거 (WP-11)", () => {
  it("화면 소스와 내려받기 버튼에 「준제출형」「제출 필수 항목을 반영」 문구가 없다", () => {
    for (const file of ["components/WorkpackEditor.tsx", "components/SafeGuardCommandCenter.tsx", "lib/xlsx-builder.ts"]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toContain("준제출형");
      expect(source).not.toContain("제출 필수 항목을 반영");
      expect(source).not.toContain("비치하거나 제출하세요");
    }
  });

  it("화면에 허가구분을 따로 판정하는 함수가 없다(EXP-01·WP-08)", () => {
    const source = readFileSync(path.join(process.cwd(), "components/WorkpackEditor.tsx"), "utf8");
    expect(source).not.toMatch(/function inferPermitType|function buildPermitInspectionStructured|허가구분: 위험작업/);
  });
});

describe("작업계획서 보완 부록 라벨 (WP-09·WP-10)", () => {
  it("계획서 보완 줄은 「반영」이 아니라 「추가 확인 필요」이고 담당·확인 칸을 가지며, 주행 크레인 조문(제140조)은 이동식 크레인 작업에 싣지 않는다", () => {
    const response = respond(SCENARIOS.excavation);
    const remediated = applyOntologyQaRemediation(response, "굴착작업", {
      reviewable: true,
      task: "굴착작업",
      registeredTasks: [],
      missing: {
        hazards: [],
        controls: [
          { control: "순간풍속 30m/s 초과 시 이탈방지장치 작동", articles: ["기준규칙 제140조"] },
          { control: "흙막이 지보공 설치", articles: ["기준규칙 제347조"] }
        ],
        articles: []
      }
    } as unknown as Parameters<typeof applyOntologyQaRemediation>[2]);
    const plan = remediated.deliverables.workPlanDraft;
    expect(plan).not.toContain("필수 안전조치 반영");
    expect(plan).toContain("추가 확인 필요: 흙막이 지보공 설치");
    expect(plan).toMatch(/흙막이 지보공 설치.*담당: \(현장 기재\).*확인 시각: \(현장 기재\)/);
    expect(plan).not.toContain("제140조");
  });
});

describe("크레인 조문·장비 분류 문서 간 정합 (WP-09·별표6)", () => {
  const craneQa = (articles: string[] = []) => ({
    reviewable: true,
    task: "굴착작업",
    registeredTasks: [],
    missing: {
      hazards: [],
      controls: [
        { control: "순간풍속 30m/s 초과 시 이탈방지장치 작동", articles: ["기준규칙 제140조"] },
        { control: "흙막이 지보공 설치", articles: ["기준규칙 제347조"] }
      ],
      articles
    }
  } as unknown as Parameters<typeof applyOntologyQaRemediation>[2]);
  const DOC_KEYS = [
    "riskAssessmentDraft",
    "workPlanDraft",
    "tbmBriefing",
    "tbmLogDraft",
    "safetyEducationRecordDraft",
    "emergencyResponseDraft"
  ] as const;

  it("주행 크레인이 입력에 없으면 문서팩 6종 어디에도 제140조·이탈방지장치 줄이 없고, 다른 보완 조치는 남는다", () => {
    const remediated = applyOntologyQaRemediation(
      respond(SCENARIOS.excavation),
      "굴착작업",
      craneQa(["기준규칙 제140조", "기준규칙 제347조"])
    );
    for (const key of DOC_KEYS) {
      const text = remediated.deliverables[key] ?? "";
      expect(text, key).not.toContain("제140조");
      expect(text, key).not.toContain("이탈방지장치");
      expect(text, key).toContain("흙막이 지보공 설치");
    }
  });

  it("옥외 주행 크레인이 입력에 있으면 제140조 보완 줄이 문서팩 6종에 모두 실린다(양쪽 분기)", () => {
    const response = respond(SCENARIOS.excavation);
    const withCrane = { ...response, question: `${response.question} 옥외 주행 크레인 1대 사용.` };
    const remediated = applyOntologyQaRemediation(withCrane, "굴착작업", craneQa(["기준규칙 제140조"]));
    for (const key of DOC_KEYS) {
      expect(remediated.deliverables[key] ?? "", key).toContain("제140조");
    }
  });

  it("별표4 제3호 가 칸에는 별표6 차량계 건설기계만 싣고, 이동식 크레인은 제6호 나(인원·장비)에만 둔다", () => {
    const form = buildWorkPlanLegalForm({ taskId: "excavation", question: SCENARIOS.excavation, workerCount: 8 });
    const item3 = form.sections.find((section) => section.annexItem === 3);
    const crewEntry = form.sections
      .filter((section) => section.annexItem === 6)
      .flatMap((section) => section.items)
      .find((item) => item.label.startsWith("나. 필요한 인원 및 장비"))?.entry ?? "";
    const kind = item3?.items.find((item) => item.label.startsWith("가. 사용하는 차량계 건설기계"))?.entry ?? "";
    expect(kind).toContain("굴착기 1대");
    expect(kind).not.toContain("크레인");
    expect(crewEntry).toContain("굴착기 1대");
    expect(crewEntry).toContain("이동식 크레인 1대");
  });

  it("차량계 건설기계 없이 크레인·지게차만 있으면 제3호 가 칸에 장비를 적지 않는다(양쪽 분기)", () => {
    const form = buildWorkPlanLegalForm({
      taskId: "excavation",
      question: "굴착 깊이 2.5m, 백호 작업. 이동식 크레인 1대와 지게차 2대 사용."
    });
    const item3 = form.sections.find((section) => section.annexItem === 3);
    const kind = item3?.items.find((item) => item.label.startsWith("가. 사용하는 차량계 건설기계"))?.entry ?? "";
    expect(kind).not.toMatch(/크레인|지게차/);
  });
});
