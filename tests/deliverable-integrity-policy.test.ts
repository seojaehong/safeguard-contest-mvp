import { describe, expect, it } from "vitest";

import {
  auditAskDeliverables,
  auditTextDocument,
  summarizeIntegrityItems
} from "@/lib/deliverable-integrity-policy";

describe("auditTextDocument", () => {
  it("blocks empty and placeholder-only documents", () => {
    const result = auditTextDocument({
      key: "riskAssessmentDraft",
      title: "위험성평가표",
      text: "위험성평가표\n회사명: ____\n작업장소: 현장 확인 필요\nTODO",
      requiredTerms: ["위험성평가", "TBM"],
      scenarioTerms: ["그린메탈", "용접"]
    });

    expect(result.verdict).toBe("blocked");
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["too_short", "placeholder_heavy", "missing_required_term", "missing_scenario_term"])
    );
  });

  it("passes a populated field-ready safety document", () => {
    const result = auditTextDocument({
      key: "tbmBriefing",
      title: "TBM",
      text: [
        "[기본정보]",
        "회사: 그린메탈",
        "현장: 안산 제조공장",
        "작업: 배관 용접 및 절단",
        "[TBM 포인트]",
        "1. 화재감시자는 용접 불티 비산 구역과 가연물 제거 상태를 확인한다.",
        "2. 우천 후 젖은 바닥 미끄럼 위험을 작업 전 점검하고 통로를 분리한다.",
        "3. 외국인 근로자는 한국어와 모국어로 보호구 착용, 작업중지 기준, 비상연락을 확인한다.",
        "[확인/서명]",
        "관리감독자: ______ / 근로자 확인: ______ / 확인일시: ______"
      ].join("\n"),
      requiredTerms: ["TBM", "확인", "서명"],
      scenarioTerms: ["그린메탈", "안산", "용접", "화재감시자"]
    });

    expect(result.verdict).toBe("pass");
    expect(result.issues).toEqual([]);
  });
});

describe("auditAskDeliverables", () => {
  it("blocks missing required deliverable keys and summarizes the failed set", () => {
    const items = auditAskDeliverables({
      deliverables: {
        riskAssessmentDraft: "위험성평가: 그린메탈 안산 용접 화재감시자 확인 서명. 젖은 바닥과 불티 비산 위험을 통제한다. 작업 전 관리감독자가 교육하고 확인한다."
      },
      scenarioTerms: ["그린메탈", "안산", "용접"],
      requiredTermsByKey: {
        riskAssessmentDraft: ["위험성평가", "확인"],
        tbmBriefing: ["TBM", "확인"]
      }
    });
    const summary = summarizeIntegrityItems(items);

    expect(summary.verdict).toBe("blocked");
    expect(summary.blockedCount).toBeGreaterThan(0);
    expect(items.find((item) => item.key === "tbmBriefing")?.issues[0]?.code).toBe("missing_document");
  });
});
