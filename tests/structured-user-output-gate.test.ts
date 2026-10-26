// PR-12 반박 검수 결함 2종 — 구조화 문서(*Structured)의 사람이 읽는 글자 칸이 사용자 출력 게이트를 지나지 않고,
// AI 가 패킷 참조 키(SIF:·DB:·접두사 없는 sif-·「패킷」)를 사용자 칸에 베껴 쓴다.
// 고정 문자열은 run1 실출력(press·excavation·septic)에서 그대로 뽑았다(scratch-final 은 커밋하지 않으므로 여기 인라인).
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { buildDeliverablePromptsForAudit } from "@/lib/ai-deliverables";
import type { DbHarnessPacket } from "@/lib/db-harness";
import { buildGroundedGenerationPacket, validateGroundedGenerationOutput } from "@/lib/grounded-generation-contract";
import type { SearchResult } from "@/lib/types";
import { findUserOutputLeaks, gateAskResponseUserOutput, gateExportPayload } from "@/lib/user-output-gate";

type XlsxLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

// --- run1 실출력 문자열 -------------------------------------------------------------
const PRESS_FOLLOWUP =
  "연계 교육 후보인 외국인 취업교육(대상 적합 판정)의 수강 여부와 이수 이력은 현장 확인 필요. 신규 투입자 여부를 확인한 뒤 후속 교육 대상자를 정한다.";
const PRESS_MATERIALS =
  "안전보건규칙 제104조, 안전보건규칙 제92조, 안전보건규칙 제103조, 안전보건규칙 제172조, 패킷 SIF 지게차 사례";
const EXCAVATION_MATERIALS =
  "안전보건규칙 제338조, 안전보건규칙 제339조, 안전보건규칙 제340조, 안전보건규칙 제342조, DB:construction-process-0122, SIF:sif-아카이브-건설업-00016";
const SEPTIC_MATERIALS =
  "안전보건규칙 제619조, 안전보건규칙 제619의2조, 안전보건규칙 제620조, 안전보건규칙 제621조, 안전보건규칙 제622조, 안전보건규칙 제623조, 안전보건규칙 제625조, SIF 아카이브 사례(sif-아카이브-건설업-01001)";
const EXCAVATION_EVIDENCE_REF = "SIF:sif-아카이브-건설업-00016";

// 내부 참조 키 — 사용자 칸에 0회여야 한다
const INTERNAL_KEY = /SIF:|DB:[a-z-]+-\d+|\bsif-|패킷/u;

type Fixture = { question: string; dbHarnessPacket: DbHarnessPacket; citations: SearchResult[] };
const fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, "fixtures/grounding-packets/mfg-press.json"), "utf8")
) as Fixture;
const packet = buildGroundedGenerationPacket({
  dbHarnessPacket: fixture.dbHarnessPacket,
  legalCandidates: fixture.citations.slice(0, 6),
  eligibleKoshaIds: new Set<string>()
});

function educationRecord(followupRecommendation: string) {
  return {
    educationName: "프레스 금형 교체 특별교육",
    type: "특별교육",
    dateTime: "2026-10-26 08:00",
    location: "제1공장",
    target: "금형 교체 작업자 6명",
    instructor: "관리감독자",
    confirmer: "안전관리자",
    curriculum: [
      { topic: "프레스 방호장치", lawCitation: "현장 확인 필요", keyPoints: ["현장 확인 필요"] },
      { topic: "금형 교체 순서", lawCitation: "현장 확인 필요", keyPoints: ["현장 확인 필요"] }
    ],
    understandingCheck: "질문·복창으로 확인",
    tbmLink: "TBM 에서 안전블록 설치를 다시 강조",
    followupRecommendation
  };
}

function tbmLog(materials: string) {
  return {
    meta: { dateTime: "2026-10-26 08:00", location: "제1현장", workType: "굴착작업", instructor: "관리감독자" },
    attendance: { expected: 6, actual: 6, attendees: ["작업자 6명"], absenceReason: "없음", confirmationMethod: "출석부 서명" },
    todayWork: { name: "도시가스 배관 굴착", location: "A구간", time: "09:00-17:00", equipment: ["굴착기"] },
    workerConfirmations: ["현장 확인 필요", "현장 확인 필요", "현장 확인 필요"],
    hazardsDiscussed: [
      { category: "Media", description: "굴착면 붕괴" },
      { category: "Machine", description: "굴착기 작업반경 접촉" }
    ],
    safetyEducation: { topic: "굴착면 붕괴 예방", keyPoints: ["현장 확인 필요", "현장 확인 필요"], materials },
    unaddressedItems: [
      { item: "흙막이 보강", plannedAction: "현장 확인 필요", owner: "관리감독자", dueDate: "현장 확인", evidenceRefs: [EXCAVATION_EVIDENCE_REF] }
    ],
    photoEvidence: { captureLocations: ["A구간 굴착면"], storagePath: "현장 사진함" },
    signatures: { author: "관리감독자", reviewer: "안전관리자", approver: "현장소장" }
  };
}

// --- (a) 금지어는 AI 묶음에서 거절 ----------------------------------------------------
describe("근거 게이트 — 금지어(판정·진단·상담·노무사)는 AI 생성 묶음을 거절한다", () => {
  it("프레스 run1 followupRecommendation 「대상 적합 판정」 → forbidden_term 위반으로 review_required", () => {
    const validation = validateGroundedGenerationOutput({ educationRecordStructured: educationRecord(PRESS_FOLLOWUP) }, packet);
    const forbidden = validation.violations.filter((violation) => violation.code === "forbidden_term");
    expect(forbidden.map((violation) => violation.path)).toEqual(["$.educationRecordStructured.followupRecommendation"]);
    expect(validation.status).toBe("review_required");
  });

  it("법정 용어·기관명 복합어(특수건강진단·고객상담센터·고충상담·노동위원회 판정)는 거절하지 않는다", () => {
    const allowed = educationRecord(
      "특수건강진단 결과를 확인한다. 고용노동부 고객상담센터 1350 과 고충상담 창구를 안내한다. 노동위원회 판정 사례를 교육 자료로 쓴다."
    );
    const validation = validateGroundedGenerationOutput({ educationRecordStructured: allowed }, packet);
    expect(validation.violations.filter((violation) => violation.code === "forbidden_term")).toEqual([]);
  });

  it("evidenceRefs 는 금지어 검사 대상이 아니다(출처 추적 데이터)", () => {
    const output = { tbmLogStructured: { ...tbmLog("안전보건규칙 제338조"), unaddressedItems: [{ item: "a", plannedAction: "현장 확인 필요", owner: "b", dueDate: "현장 확인", evidenceRefs: ["판정-키"] }] } };
    const validation = validateGroundedGenerationOutput(output, packet);
    expect(validation.violations.filter((violation) => violation.code === "forbidden_term")).toEqual([]);
  });
});

// --- (b) 내부 참조 키 — 생성 지시 + 사후 제거 ---------------------------------------------
describe("tbmLogStructured.safetyEducation.materials — 패킷 참조 키 제거", () => {
  const scenario = { companyName: "", siteName: "현장", workSummary: "굴착 작업", workerCount: 6, weatherNote: "현장 확인" };

  it("생성 스키마 지시가 materials 에 내부 참조 키를 금지한다", () => {
    const prompts = buildDeliverablePromptsForAudit({ scenario, question: fixture.question, groundingPacket: packet, citations: fixture.citations });
    expect(prompts.tbmLogStructured).toContain("materials");
    expect(prompts.tbmLogStructured).toMatch(/materials[^\n]*내부 참조 키[^\n]*금지/u);
  });

  it.each([
    ["excavation", EXCAVATION_MATERIALS, "안전보건규칙 제338조, 안전보건규칙 제339조, 안전보건규칙 제340조, 안전보건규칙 제342조"],
    ["septic", SEPTIC_MATERIALS, "안전보건규칙 제619조, 안전보건규칙 제619의2조, 안전보건규칙 제620조, 안전보건규칙 제621조, 안전보건규칙 제622조, 안전보건규칙 제623조, 안전보건규칙 제625조"],
    ["press", PRESS_MATERIALS, "안전보건규칙 제104조, 안전보건규칙 제92조, 안전보건규칙 제103조, 안전보건규칙 제172조"]
  ])("%s run1 materials — ID 항목만 지우고 법령 항목은 남긴다(응답 게이트)", (_name, raw, expected) => {
    const gated = gateAskResponseUserOutput({ deliverables: { tbmLogStructured: tbmLog(raw) } });
    const log = gated.deliverables.tbmLogStructured as ReturnType<typeof tbmLog>;
    expect(log.safetyEducation.materials).toBe(expected);
    expect(log.safetyEducation.materials).not.toMatch(INTERNAL_KEY);
    expect(findUserOutputLeaks(log.safetyEducation.materials)).toEqual([]);
    // 출처 추적 데이터는 그대로
    expect(log.unaddressedItems[0].evidenceRefs).toEqual([EXCAVATION_EVIDENCE_REF]);
    // 같은 입력에 두 번 돌려도 같다
    expect(gateAskResponseUserOutput(gated)).toEqual(gated);
  });

  it("내보내기 게이트(gateExportPayload)도 materials 를 같은 규칙으로 거른다", () => {
    const gated = gateExportPayload({ structured: tbmLog(EXCAVATION_MATERIALS) });
    expect(gated.structured.safetyEducation.materials).toBe("안전보건규칙 제338조, 안전보건규칙 제339조, 안전보건규칙 제340조, 안전보건규칙 제342조");
  });

  it("접두사 없는 sif-·DB: 키·「패킷」은 게이트 금지 문구 목록에도 있다(스모크와 같은 목록)", () => {
    expect(findUserOutputLeaks("SIF 아카이브 사례(sif-아카이브-건설업-01001)").map((leak) => leak.rule)).not.toEqual([]);
    expect(findUserOutputLeaks("DB:construction-process-0122").map((leak) => leak.rule)).not.toEqual([]);
    expect(findUserOutputLeaks("패킷 SIF 지게차 사례").map((leak) => leak.rule)).not.toEqual([]);
  });
});

// --- (1) 구조화 문서의 글자 칸이 응답 게이트를 지난다 ------------------------------------------
describe("gateDeliverables — *Structured 글자 칸", () => {
  it("프레스 run1 followupRecommendation 안의 SIF 괄호·DB 키가 화면(WorkpackEditor)으로 가기 전에 지워진다", () => {
    const raw = `${PRESS_FOLLOWUP} (SIF:sif-아카이브-제조업등-01048) DB:construction-process-0122`;
    const gated = gateAskResponseUserOutput({ deliverables: { educationRecordStructured: educationRecord(raw) } });
    const education = gated.deliverables.educationRecordStructured as ReturnType<typeof educationRecord>;
    expect(education.followupRecommendation).not.toMatch(INTERNAL_KEY);
    expect(findUserOutputLeaks(education.followupRecommendation)).toEqual([]);
    // enum 칸은 그대로
    expect(education.type).toBe("특별교육");
  });

  it("외국인 전송본 고정 번역표(foreignWorkerLanguages)는 건드리지 않는다", () => {
    const languages = [{ code: "vi", label: "베트남어", nativeLabel: "Tiếng Việt" }];
    const gated = gateAskResponseUserOutput({ deliverables: { foreignWorkerLanguages: languages } });
    expect(gated.deliverables.foreignWorkerLanguages).toEqual(languages);
  });
});

// --- (c) 커버리지 — 화면·엑셀이 *Structured 에서 그리는 글자 경로 전부 ---------------------------
// hwp·pdf 내보내기 경로는 *Structured 를 받지 않는다(structuredRiskRows·riskReviewItems 만, 2026-10-26 grep 확인).
// WorkpackEditor 는 세 구조화 문서의 아래 칸을 그대로 화면에 그린다(cockpit). 엑셀은 다섯 문서의 모든 글자 칸을 그린다.
const LEAK = "작업 전 확인 (SIF:sif-아카이브-건설업-00016) DB:construction-process-0122 sif-아카이브-건설업-01001 패킷 참고";
const UNGATED_KEYS = new Set(["evidenceRefs", "category", "status", "type", "permitType", "code", "id", "key", "mode", "format", "layout", "kind", "controlId", "documentKey"]);
const EDITOR_RENDERED_FIELDS: Record<string, string[]> = {
  educationRecordStructured: ["followupRecommendation", "understandingCheck", "tbmLink", "topic", "keyPoints", "lawCitation", "location"],
  workPlanStructured: ["action", "safetyMeasure", "stopCriteria"],
  permitInspectionStructured: ["requirement", "action", "name", "item", "permitType", "status", "category"]
};

function leafPaths(value: unknown, prefix: string, out: Array<[string, string]>, parentKey = ""): void {
  if (typeof value === "string") {
    out.push([prefix, value]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => leafPaths(item, `${prefix}[${index}]`, out, parentKey));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (UNGATED_KEYS.has(key)) continue;
      leafPaths(child, `${prefix}.${key}`, out, key);
    }
  }
}

function structuredBundle() {
  return {
    workPlanStructured: {
      workOverview: { workName: LEAK, description: LEAK, workerCount: 6, location: LEAK, condition: LEAK, equipment: [LEAK] },
      workSteps: [{ stepNo: 1, action: LEAK, equipment: LEAK, safetyMeasure: LEAK, owner: LEAK, evidenceRefs: [EXCAVATION_EVIDENCE_REF], verification: LEAK }],
      stopCriteria: [LEAK],
      emergencyResponse: { contacts: [{ role: LEAK, phone: "119" }], evacRoute: LEAK, firstAid: LEAK },
      approvers: { author: LEAK, reviewer: LEAK, approver: LEAK },
      applicability: [LEAK],
      statutorySections: [{ annexItem: 1, title: LEAK, basis: LEAK, part: "작업계획", items: [{ label: LEAK, entry: LEAK }] }]
    },
    permitInspectionStructured: {
      basicInfo: { permitNo: LEAK, permitType: "굴착작업", workName: LEAK, location: LEAK, workDate: LEAK, workerCount: 6, requester: LEAK, approver: LEAK },
      conditions: [{ category: "작업구역", requirement: LEAK, action: LEAK, owner: LEAK, status: "확인 전", evidenceRefs: [EXCAVATION_EVIDENCE_REF], verification: LEAK }],
      measurements: [{ item: LEAK, standard: LEAK, value: LEAK, measuredAt: LEAK, measurer: LEAK }],
      statutoryChecks: [{ basis: LEAK, item: LEAK, entry: LEAK, owner: LEAK }],
      attachments: [{ name: LEAK, required: true, status: "확인 전", note: LEAK }],
      completionChecks: [{ item: LEAK, method: LEAK, owner: LEAK, status: "확인 전" }],
      approvers: { requester: LEAK, safetyManager: LEAK, siteManager: LEAK, completionChecker: LEAK }
    },
    tbmBriefingStructured: {
      meta: { dateTime: LEAK, location: LEAK, target: LEAK, attendees: LEAK },
      todayWork: { name: LEAK, location: LEAK, time: LEAK, equipment: [LEAK] },
      hazards: [{ category: "Media", description: LEAK }, { category: "Machine", description: LEAK }],
      measures: [{ hazardRef: 1, action: LEAK, owner: LEAK, evidenceRefs: [EXCAVATION_EVIDENCE_REF] }],
      stopCriteria: [LEAK],
      confirmTopics: [LEAK],
      photoEvidenceLocation: LEAK
    },
    tbmLogStructured: {
      ...tbmLog(LEAK),
      meta: { dateTime: LEAK, location: LEAK, workType: LEAK, instructor: LEAK },
      workerConfirmations: [LEAK, LEAK, LEAK],
      hazardsDiscussed: [{ category: "Media", description: LEAK }, { category: "Machine", description: LEAK }],
      safetyEducation: { topic: LEAK, keyPoints: [LEAK, LEAK], materials: LEAK },
      unaddressedItems: [{ item: LEAK, plannedAction: LEAK, owner: LEAK, dueDate: LEAK, evidenceRefs: [EXCAVATION_EVIDENCE_REF] }],
      photoEvidence: { captureLocations: [LEAK], storagePath: LEAK },
      signatures: { author: LEAK, reviewer: LEAK, approver: LEAK }
    },
    educationRecordStructured: {
      ...educationRecord(LEAK),
      educationName: LEAK,
      dateTime: LEAK,
      location: LEAK,
      target: LEAK,
      instructor: LEAK,
      confirmer: LEAK,
      curriculum: [{ topic: LEAK, lawCitation: LEAK, keyPoints: [LEAK] }, { topic: LEAK, lawCitation: LEAK, keyPoints: [LEAK] }],
      understandingCheck: LEAK,
      tbmLink: LEAK,
      instructorQualification: LEAK,
      attendees: [LEAK]
    }
  };
}

describe("커버리지 — 구조화 문서에서 사람이 읽는 글자 칸은 전부 게이트를 지난다", () => {
  it("다섯 구조화 문서의 모든 글자 잎(evidenceRefs·enum 제외)에서 내부 참조 키 0회", () => {
    const gated = gateAskResponseUserOutput({ deliverables: structuredBundle() });
    const leaves: Array<[string, string]> = [];
    leafPaths(gated.deliverables, "deliverables", leaves);
    expect(leaves.length).toBeGreaterThan(80);
    for (const [leafPath, text] of leaves) {
      expect(text, leafPath).not.toMatch(INTERNAL_KEY);
      expect(findUserOutputLeaks(text), leafPath).toEqual([]);
    }
    // 출처 추적 데이터는 그대로(게이트 대상 밖임을 명시)
    const raw = structuredBundle();
    const gatedPlan = gated.deliverables.workPlanStructured as typeof raw.workPlanStructured;
    expect(gatedPlan.workSteps[0].evidenceRefs).toEqual([EXCAVATION_EVIDENCE_REF]);
  });

  it("WorkpackEditor 가 cockpit 에 그리는 구조화 칸은 전부 게이트 대상(또는 enum)이고, 소스에 실제로 있다", () => {
    const source = readFileSync(path.resolve(__dirname, "../components/WorkpackEditor.tsx"), "utf8");
    for (const [doc, fields] of Object.entries(EDITOR_RENDERED_FIELDS)) {
      for (const field of fields) {
        expect(source, `${doc}.${field} 가 WorkpackEditor 소스에 없다 — 목록을 갱신할 것`).toMatch(new RegExp(`[.?]${field}\\b`, "u"));
        const isEnum = UNGATED_KEYS.has(field);
        if (isEnum) continue;
        // 게이트가 거르는 칸인지 — 그 칸에 LEAK 를 넣어 통과시켜 본다
        const bundle = structuredBundle() as Record<string, unknown>;
        const gated = gateAskResponseUserOutput({ deliverables: { [doc]: bundle[doc] } });
        const leaves: Array<[string, string]> = [];
        leafPaths(gated.deliverables, "deliverables", leaves);
        const matching = leaves.filter(([leafPath]) => leafPath.endsWith(`.${field}`) || /\.\w+\[\d+\]$/u.test(leafPath) && leafPath.includes(`.${field}[`));
        expect(matching.length, `${doc}.${field} 잎 없음`).toBeGreaterThan(0);
        for (const [leafPath, text] of matching) expect(text, leafPath).not.toMatch(INTERNAL_KEY);
      }
    }
  });

  it.each(["tbmLogStructured", "educationRecordStructured", "workPlanStructured", "permitInspectionStructured", "tbmBriefingStructured"] as const)(
    "엑셀 내보내기 %s — 모든 셀에서 내부 참조 키 0회(「교육 자료」「후속 교육」 포함)",
    async (mode) => {
      const bundle = structuredBundle();
      const response = await exportXlsx(new NextRequest("http://localhost/api/export/xlsx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          scenario: { companyName: "합성건설", siteName: "제1현장", workSummary: "굴착 작업", workerCount: 6 },
          structured: bundle[mode]
        })
      }));
      expect(response.status).toBe(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as XlsxLoadBuffer);
      const texts: string[] = [];
      workbook.eachSheet((sheet) => sheet.eachRow((sheetRow) => sheetRow.eachCell({ includeEmpty: false }, (cell) => texts.push(cell.text))));
      const all = texts.join("\n");
      expect(all.length).toBeGreaterThan(0);
      expect(all).not.toMatch(INTERNAL_KEY);
      expect(findUserOutputLeaks(all)).toEqual([]);
    }
  );
});
