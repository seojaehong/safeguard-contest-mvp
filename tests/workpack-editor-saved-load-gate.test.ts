// inventory 10-4 의 4번: 교정 전에 저장된 작업팩(localStorage 현재 작업팩·서버 재열기·편집기 자동저장본)을 다시 열면
// 본문 textarea 에 「관리번호: RA-press-1」이 그대로 보인다(출력 4형식은 게이트 통과, 화면 잔존).
// 저장본 데이터 자체는 생성 근거 봉인(generationEvidence)이 덮고 있어 바꾸지 않고, 편집기가 첫 값을 만드는 자리에서 거른다.
import { describe, expect, it } from "vitest";

import { buildInitialWorkpackDocumentValues, parseStoredDraft } from "@/components/WorkpackEditor";
import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";
import { findUserOutputLeaks } from "@/lib/user-output-gate";

const QUESTION = "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.";

// 교정 전(2026-10-25 운영) 저장본 꼴 — 구조화 행 controlId 와 본문 「관리번호:」 줄이 taskId 기반 영문 코드다.
function legacySavedWorkpack(): AskResponse {
  const response = buildMockAskResponse(QUESTION, [], "mock", "test");
  const rows = (response.structured?.riskAssessmentRows ?? []).map((row, index) => ({ ...row, controlId: `RA-press-${index + 1}` }));
  const legacyDraft = serializeRiskAssessmentRowsToDraft(rows).replace(/관리번호: 위험성평가-(\d+)/gu, (_all, n: string) => `관리번호: RA-press-${Number(n)}`);
  expect(legacyDraft).toContain("관리번호: RA-press-1");
  return {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft: legacyDraft,
      workPlanDraft: `${response.deliverables.workPlanDraft}\n- 근거 패킷 기준 조치 확인 (SIF:sif-아카이브-제조업-00012)`
    },
    structured: response.structured ? { ...response.structured, riskAssessmentRows: rows } : response.structured
  };
}

describe("편집기 첫 값 — 저장본 로드 게이트", () => {
  it("교정 전 저장본을 열어도 본문 textarea 에 관리번호 영문 코드·내부 키가 0회다", () => {
    const values = buildInitialWorkpackDocumentValues(legacySavedWorkpack());
    expect(values.riskAssessmentDraft).toContain("관리번호: 위험성평가-01");
    expect(values.riskAssessmentDraft).not.toContain("RA-press-");
    expect(values.workPlanDraft).not.toContain("패킷");
    expect(values.workPlanDraft).not.toContain("sif-");
    for (const [key, value] of Object.entries(values)) {
      expect(findUserOutputLeaks(value), key).toEqual([]);
    }
  });

  it("구조화 행 직렬화와 본문이 같은 관리번호 라벨을 쓴다(행-본문 일치 판정 유지)", () => {
    const data = legacySavedWorkpack();
    const values = buildInitialWorkpackDocumentValues(data);
    const canonical = serializeRiskAssessmentRowsToDraft(data.structured!.riskAssessmentRows);
    expect(values.riskAssessmentDraft).toContain(canonical);
  });

  it("같은 입력에 두 번 돌려도 같다", () => {
    const data = legacySavedWorkpack();
    const once = buildInitialWorkpackDocumentValues(data);
    const twice = buildInitialWorkpackDocumentValues({ ...data, deliverables: { ...data.deliverables, ...once } });
    expect(twice).toEqual(once);
  });
});

describe("편집기 자동저장본(localStorage) 복원 게이트", () => {
  it("교정 전에 편집해 둔 본문·정본 글에서 관리번호 영문 코드를 거른다", () => {
    const data = legacySavedWorkpack();
    const fallback = buildInitialWorkpackDocumentValues(data);
    const rows = data.structured!.riskAssessmentRows as RiskAssessmentRow[];
    const legacyCanonical = data.deliverables.riskAssessmentDraft;
    const raw = JSON.stringify({
      version: 1,
      values: { ...fallback, riskAssessmentDraft: legacyCanonical, tbmBriefing: `${fallback.tbmBriefing}\n- 근거 패킷 확인` },
      dirtyKeys: ["riskAssessmentDraft", "tbmBriefing"],
      draftRiskRows: rows,
      canonicalRiskRows: rows,
      canonicalRiskText: legacyCanonical
    });
    const stored = parseStoredDraft(raw, fallback, rows);
    expect(stored.dirtyKeys).toEqual(["riskAssessmentDraft", "tbmBriefing"]);
    expect(stored.values.riskAssessmentDraft).toContain("관리번호: 위험성평가-01");
    expect(stored.values.riskAssessmentDraft).not.toContain("RA-press-");
    expect(stored.values.tbmBriefing).not.toContain("패킷");
    expect(stored.canonicalRiskText).toBe(stored.values.riskAssessmentDraft);
    expect(stored.canonicalRiskText).toBe(serializeRiskAssessmentRowsToDraft(rows));
  });
});
