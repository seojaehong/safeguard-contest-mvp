// inventory 10-4 의 5번: full 경로 Phase A control id(fall-work-platform 등)는 「RA-…-N」 패턴 밖이라
// 「관리번호:」 줄·구조화 행·편집기 입력칸에 영문 id 그대로 나갈 수 있다. #114 의 「위험성평가-NN」 규칙과 같은 자리에서 거른다.
import { describe, expect, it } from "vitest";

import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import { riskManagementNumberLabel } from "@/lib/document-display-labels";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";
import { findUserOutputLeaks, gateAskResponseUserOutput, gateUserOutputText } from "@/lib/user-output-gate";

const PHASE_A_IDS = [
  "fall-work-platform",
  "fall-anchor",
  "fall-opening-guard",
  "electrical-deenergized-isolation",
  "electrical-grounding",
  "vehicle-contact-prevention"
];

function row(controlId: string, index: number): RiskAssessmentRow {
  return {
    controlId,
    location: "제1공장",
    process: "프레스 금형 교체",
    task: `세부작업 ${index + 1}`,
    equipment: "",
    hazard: "끼임",
    fourM: "Machine",
    accidentType: "caughtIn",
    currentControls: "안전블록 설치",
    likelihood: 3,
    severity: 4,
    riskLevel: "high",
    additionalControls: "운전정지·잠금 확인",
    owner: "관리감독자",
    due: "작업 전",
    verification: "현장 확인",
    verificationStatus: "planned",
    verificationDate: "",
    verificationChecker: "",
    whyLikelihood: "",
    whySeverity: "",
    evidenceRefs: ["ONT:fall-work-platform"]
  } as RiskAssessmentRow;
}

describe("관리번호 표시 — Phase A control id", () => {
  it.each(PHASE_A_IDS)("%s 는 행 순번으로 「위험성평가-NN」이 된다", (id) => {
    expect(riskManagementNumberLabel(id, 0)).toBe("위험성평가-01");
    expect(riskManagementNumberLabel(id, 11)).toBe("위험성평가-12");
  });

  it("기본 틀 영문 코드·빈칸·사람이 적은 값은 종전과 같다", () => {
    expect(riskManagementNumberLabel("RA-press-1", 2)).toBe("위험성평가-03");
    expect(riskManagementNumberLabel("", 0)).toBe("");
    expect(riskManagementNumberLabel(undefined, 0)).toBe("");
    expect(riskManagementNumberLabel("위험성평가-07", 0)).toBe("위험성평가-07");
    expect(riskManagementNumberLabel("A-1", 0)).toBe("A-1");
    expect(riskManagementNumberLabel("WP-01", 0)).toBe("WP-01");
    expect(riskManagementNumberLabel("프레스 1", 0)).toBe("프레스 1");
  });

  it("직렬화 본문의 「관리번호:」 줄에 영문 id 가 0회다", () => {
    const text = serializeRiskAssessmentRowsToDraft([row("fall-work-platform", 0), row("electrical-grounding", 1)]);
    expect(text).toContain("관리번호: 위험성평가-01");
    expect(text).toContain("관리번호: 위험성평가-02");
    expect(text).not.toMatch(/관리번호:\s*[a-z]+(?:-[a-z]+)+/u);
    expect(findUserOutputLeaks(text)).toEqual([]);
  });
});

describe("본문 게이트 — 「관리번호: <영문 id>」 줄", () => {
  const LEGACY = [
    "위험성평가표(구조화 편집본)",
    "",
    "[1. 금형 반입]",
    "관리번호: fall-work-platform",
    "작업장소: 제1공장",
    "",
    "[2. 금형 고정]",
    "관리번호: RA-press-2",
    "작업장소: 제1공장",
    "",
    "[3. 시운전]",
    "관리번호: vehicle-contact-prevention",
    "근거: ONT:vehicle-contact-prevention | 안전보건규칙 제103조"
  ].join("\n");

  it("교정 전 본문을 누출로 잡는다", () => {
    expect(findUserOutputLeaks(LEGACY).map((leak) => leak.rule)).toContain("위험성평가 관리번호 영문 id");
  });

  it("머리줄 번호로 「위험성평가-NN」을 만들고 근거 줄은 손대지 않는다", () => {
    const gated = gateUserOutputText(LEGACY);
    expect(gated).toContain("관리번호: 위험성평가-01");
    expect(gated).toContain("관리번호: 위험성평가-02");
    expect(gated).toContain("관리번호: 위험성평가-03");
    expect(gated).toContain("근거: ONT:vehicle-contact-prevention | 안전보건규칙 제103조");
    expect(findUserOutputLeaks(gated)).toEqual([]);
    expect(gateUserOutputText(gated)).toBe(gated);
  });

  it("머리줄이 없으면 「관리번호:」 줄의 등장 순서로 번호를 매긴다", () => {
    const text = "관리번호: fall-anchor\n작업장소: A\n\n관리번호: fall-opening-guard\n작업장소: B";
    const gated = gateUserOutputText(text);
    expect(gated).toBe("관리번호: 위험성평가-01\n작업장소: A\n\n관리번호: 위험성평가-02\n작업장소: B");
  });
});

describe("응답 게이트 — 구조화 행 controlId", () => {
  it("Phase A id 행은 「위험성평가-NN」으로, evidenceRefs 는 그대로", () => {
    const response = {
      deliverables: { riskAssessmentDraft: "[1. 금형 반입]\n관리번호: fall-work-platform" },
      structured: {
        riskAssessmentRows: [row("fall-work-platform", 0), row("RA-press-2", 1), row("위험성평가-03", 2)],
        riskAssessmentValidation: { ok: true, issues: [] }
      }
    } as unknown as AskResponse;
    const gated = gateAskResponseUserOutput(response);
    const rows = gated.structured!.riskAssessmentRows;
    expect(rows.map((item) => item.controlId)).toEqual(["위험성평가-01", "위험성평가-02", "위험성평가-03"]);
    expect(rows[0].evidenceRefs).toEqual(["ONT:fall-work-platform"]);
    expect(gated.deliverables.riskAssessmentDraft).toContain("관리번호: 위험성평가-01");
    // 본문과 행이 같은 라벨을 쓰므로 편집기의 「행이 본문에 있는가」 판정이 유지된다.
    expect(serializeRiskAssessmentRowsToDraft(rows)).toContain("관리번호: 위험성평가-01");
  });
});
