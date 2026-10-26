// WP-06(남은 P0, 부분): 허가서 쪽 칸 존재 게이트(#110 WP-14)는 있고 계획서 쪽은 없었다.
// 작업 분류에서 만든 별표4 양식의 섹션 제목·항목 라벨이 본문(workPlanDraft)과 구조화본(workPlanStructured)에 없으면
// 품질 계약(integrity)이 막고 「현장 확인 필요」를 표시한다(공유 잠금). 값이 빈 칸(「(현장 기재)」)은 막지 않는다.
import { describe, expect, it } from "vitest";

import { auditAskDeliverables } from "@/lib/deliverable-integrity-policy";
import { buildMockAskResponse } from "@/lib/mock-data";
import {
  attachWorkPlanLegalForm,
  auditWorkPlanStructuredForm,
  buildWorkPlanLegalForm,
  buildWorkPlanRequiredTerms
} from "@/lib/permit-workplan-forms";
import { buildQualityContract } from "@/lib/quality-contract";
import { gateAskResponseUserOutput } from "@/lib/user-output-gate";
import type { AskResponse, WorkPlanStructured } from "@/lib/types";

// 운영 4시나리오(합성 질문). tests/permit-workplan-forms.test.ts 와 같다.
const SCENARIOS = {
  excavation: "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.",
  confined: "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.",
  heat: "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘.",
  press: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘."
} as const;

// 교정 전(2026-10-25 운영 full, sc-audit ask-full-con-excavation.json) 굴착 계획서 본문 — 별표4·사전조사 0회.
const LEGACY_EXCAVATION_PLAN = [
  "작업계획서(초안)",
  "현장 서식 기준: 작업구간, 작업순서, 장비·인원, 허가·첨부, 확인자 중심",
  "",
  "공사명: 서울 열수송관 굴착공사 현장",
  "작업구간: 지하 매설물 확인, 굴착기 굴착, 이동식 크레인 양중, 토사 적치와 굴착면 통제",
  "작성자: 관리감독자 / 작업반장",
  "확인자: 현장소장 / 안전관리자",
  "작성일: 작업 시작 전",
  "",
  "[1. 작업개요]",
  "- 작업명: 열수송관 굴착공사",
  "- 작업내용: 서울 강서구 도시가스 배관 굴착공사",
  "- 작업인원: 8명",
  "- 작업 전 조건확인: 오후 강풍 예보, 작업중지 기준 공유 필요",
  "",
  "[2. 작업순서 및 안전조치]",
  "- 작업 전 작업구역 설정, 보호구 확인, 장비 상태 점검",
  "- 주요 작업 수행: 지하 매설물 확인, 굴착기 굴착, 이동식 크레인 양중, 토사 적치와 굴착면 통제",
  "- 단계별 안전조치: 매설물 도면 확인과 탐사 후 시험굴착으로 위치를 표시하고 관리 주체와 작업 허가를 확인 / 굴착 깊이와 지반 상태에 맞는 굴착면 기울기·흙막이·토사 이격거리를 확보하고 출입을 통제 / 굴착기와 이동식 크레인 작업반경을 분리하고 신호수·아웃트리거·인양 경로를 작업 전 확인",
  "- 특수 조건 안전조치: 강풍 조건 — 작업중지 기준과 대피 위치를 작업 전 공유",
  "- 작업 중 위험구역 출입통제와 작업중지 기준 수시 확인",
  "- 작업 종료 후 정리정돈, 잔여 위험요인 확인, 사진/기록 보관",
  "",
  "[3. 장비·인원·허가 확인]",
  "- 장비/도구: 작업계획서 또는 안전작업허가서 첨부자료로 확인",
  "- 작업자: 신규 투입자, 외국인 근로자, 협력업체 인원 별도 확인",
  "- 허가/첨부: 고위험 작업은 안전작업허가서, 위험성평가표, TBM 기록을 함께 보관",
  "",
  "[4. 작업중지 기준]",
  "- 매설물 도면·탐사·시험굴착 결과와 굴착 허가를 누가 최종 확인했는가?",
  "- 굴착면 붕괴 징후와 즉시 대피·작업중지 기준을 전원이 알고 있는가?",
  "- 굴착기·크레인 작업반경과 신호수 위치, 작업자 대기구역을 분리했는가?",
  "",
  "[5. 확인 근거]",
  "- 위험성평가표, TBM 기록, 안전보건교육 기록, 사진/영상 증빙을 같은 문서팩으로 묶어 확인합니다."
].join("\n");

function respond(question: string): AskResponse {
  return buildMockAskResponse(question, [], "mock", "test");
}

function formInputOf(response: AskResponse) {
  return {
    taskId: response.scenario.taskClassification?.taskId ?? null,
    question: response.question,
    workerCount: response.scenario.workerCount
  };
}

function integrityOf(response: AskResponse) {
  return buildQualityContract(response).items.find((item) => item.key === "integrity");
}

function aiWorkPlanStructured(): WorkPlanStructured {
  return {
    workOverview: { workName: "굴착", description: "배관 굴착", workerCount: 8, location: "현장", condition: "강풍", equipment: ["굴착기"] },
    workSteps: [{ stepNo: 1, action: "굴착", equipment: "굴착기", safetyMeasure: "출입통제", owner: "작업반장" }],
    stopCriteria: ["붕괴 징후"],
    emergencyResponse: { contacts: [], evacRoute: "출입구", firstAid: "현장 확인 필요" },
    approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" }
  };
}

describe("작업계획서 필수 칸 목록 (WP-06)", () => {
  it("굴착 2.5m: 6호·3호 섹션 제목과 항목 라벨, 제38조① 대상 여부 줄이 필수어다", () => {
    const terms = buildWorkPlanRequiredTerms(formInputOf(respond(SCENARIOS.excavation)));
    expect(terms).toEqual(expect.arrayContaining([
      "제38조① 대상 여부",
      "가. 굴착방법 및 순서, 토사등 반출 방법",
      "바. 작업지휘자의 배치계획",
      "가. 사용하는 차량계 건설기계의 종류 및 성능",
      "라. 지반의 지하수위 상태"
    ]));
    expect(terms.some((term) => term.includes("별표4 제6호"))).toBe(true);
  });

  it("해당 호가 없는 작업은 기본 필수어만 본다(멀쩡한 계획서를 막지 않는다)", () => {
    const form = buildWorkPlanLegalForm({ taskId: "press", question: "프레스 금형 교체 작업. 작업자 6명." });
    const terms = buildWorkPlanRequiredTerms({ taskId: "press", question: "프레스 금형 교체 작업. 작업자 6명." }, form);
    expect(form.sections.map((section) => section.title)).toEqual([]);
    expect(terms).toEqual(form.applicability.length ? ["작업계획", "작업", "안전조치", "제38조① 대상 여부"] : ["작업계획", "작업", "안전조치"]);
  });
});

describe("작업계획서 칸 존재 게이트 — 본문", () => {
  it("교정 전 운영 굴착 계획서(별표4·사전조사 0회)는 필수 칸이 없어 FAIL 한다", () => {
    const response = respond(SCENARIOS.excavation);
    const terms = buildWorkPlanRequiredTerms(formInputOf(response));
    const [audit] = auditAskDeliverables({
      deliverables: { workPlanDraft: LEGACY_EXCAVATION_PLAN },
      requiredKeys: ["workPlanDraft"],
      requiredTermsByKey: { workPlanDraft: terms }
    });
    expect(audit.verdict).toBe("blocked");
    expect(audit.missingRequiredTerms).toEqual(expect.arrayContaining(["제38조① 대상 여부", "바. 작업지휘자의 배치계획"]));
  });

  it("교정 전 계획서를 넣은 응답은 품질 계약이 막고 「현장 확인 필요」를 표시한다", () => {
    const response = respond(SCENARIOS.excavation);
    const tampered = { ...response, deliverables: { ...response.deliverables, workPlanDraft: LEGACY_EXCAVATION_PLAN } };
    const integrity = integrityOf(tampered);
    expect(integrity?.status).toBe("blocked");
    expect(integrity?.detail).toContain("workPlanDraft");
    expect(integrity?.detail).toContain("현장 확인 필요");
    const contract = buildQualityContract(tampered);
    expect(contract.overall).not.toBe("ready");
  });

  it.each(Object.entries(SCENARIOS))("%s: 새 계획서는 칸 존재 게이트를 통과한다", (_key, question) => {
    const integrity = integrityOf(respond(question));
    expect(integrity?.status).toBe("ready");
    expect(integrity?.detail ?? "").not.toContain("workPlanDraft");
  });

  it.each(Object.entries(SCENARIOS))("%s: 사용자 출력 게이트를 지난 응답도 통과한다(제목·라벨이 치환되지 않는다)", (_key, question) => {
    const integrity = integrityOf(gateAskResponseUserOutput(respond(question)));
    expect(integrity?.status).toBe("ready");
  });

  it("칸은 있고 값만 「현장 확인 필요」로 여러 번 남은 계획서(운영 부록 체인)는 막지 않는다 — 칸 존재만 본다", () => {
    const response = respond(SCENARIOS.excavation);
    const appended = `${response.deliverables.workPlanDraft}\n\n[추가 안전조치 확인]\n- 반영 위치: 현장 확인 필요\n- 반영 위치: 현장 확인 필요\n- 반영 위치: 현장 확인 필요`;
    const tampered = { ...response, deliverables: { ...response.deliverables, workPlanDraft: appended } };
    expect(integrityOf(tampered)?.status).toBe("ready");
  });

  it("작업 유형 보류 응답은 계획서 게이트를 돌리지 않는다", () => {
    const response = respond(SCENARIOS.excavation);
    const pending: AskResponse = {
      ...response,
      scenario: {
        ...response.scenario,
        taskClassification: { status: "review_required", taskId: null, taskLabel: null, layers: [], reason: "시험" }
      },
      deliverables: { ...response.deliverables, workPlanDraft: LEGACY_EXCAVATION_PLAN }
    };
    expect(integrityOf(pending)?.detail ?? "").not.toContain("workPlanDraft");
  });
});

describe("작업계획서 칸 존재 게이트 — 구조화본(full 모드)", () => {
  it("별표4 칸이 없는 AI 구조화 계획서는 막힌다", () => {
    const response = respond(SCENARIOS.excavation);
    const form = buildWorkPlanLegalForm(formInputOf(response));
    const audit = auditWorkPlanStructuredForm(aiWorkPlanStructured(), form);
    expect(audit.verdict).toBe("blocked");
    expect(audit.missing).toEqual(expect.arrayContaining(["제38조① 대상 여부"]));
    expect(audit.missing.some((item) => item.includes("별표4 제6호"))).toBe(true);

    const tampered = { ...response, deliverables: { ...response.deliverables, workPlanStructured: aiWorkPlanStructured() } };
    const integrity = integrityOf(tampered);
    expect(integrity?.status).toBe("blocked");
    expect(integrity?.detail).toContain("workPlanStructured");
    expect(integrity?.detail).toContain("현장 확인 필요");
  });

  it("서버가 별표4 칸을 붙인(attachWorkPlanLegalForm) 구조화 계획서는 통과한다 — 값이 빈 칸은 막지 않는다", () => {
    const response = respond(SCENARIOS.excavation);
    const input = formInputOf(response);
    const attached = attachWorkPlanLegalForm(aiWorkPlanStructured(), input);
    expect(auditWorkPlanStructuredForm(attached, buildWorkPlanLegalForm(input)).verdict).toBe("pass");
    expect((attached?.statutorySections ?? []).flatMap((section) => section.items).some((item) => item.entry === "(현장 기재)")).toBe(true);

    const withStructured = { ...response, deliverables: { ...response.deliverables, workPlanStructured: attached } };
    expect(integrityOf(withStructured)?.status).toBe("ready");
  });

  it("구조화본이 없는 응답(template 모드)은 구조화 게이트를 보지 않는다", () => {
    const form = buildWorkPlanLegalForm({ taskId: "excavation", question: SCENARIOS.excavation, workerCount: 8 });
    expect(auditWorkPlanStructuredForm(undefined, form).verdict).toBe("pass");
  });
});
