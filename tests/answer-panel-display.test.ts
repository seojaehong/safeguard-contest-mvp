import { describe, expect, it } from "vitest";

import {
  buildAnswerPanelStatusNotes,
  groundingFieldLabel,
  groundingGroupLabel,
  sanitizeAnswerForDisplay,
  sanitizePracticalPointsForDisplay,
  type AnswerPanelPublicStatusInput
} from "@/lib/answer-panel-display";

describe("answer panel display copy", () => {
  it.each([
    ["workPlanStructured", "작업계획서"],
    ["tbmBriefingStructured", "TBM 브리핑"],
    ["tbmLogStructured", "TBM 기록"],
    ["educationRecordStructured", "안전보건교육 기록"]
  ])("labels the rejected group %s on the AnswerPanel display path", (group, expectedLabel) => {
    expect(groundingGroupLabel(group)).toBe(expectedLabel);
  });

  it.each([
    ["$.workPlanStructured.stopCriteria[0]", "작업계획서"],
    ["$.tbmBriefingStructured.stopCriteria[0]", "TBM 브리핑"],
    ["$.tbmLogStructured.workerConfirmations[0]", "TBM 기록"],
    ["$.educationRecordStructured.curriculum[0].keyPoints[0]", "안전보건교육 기록"]
  ])("labels the structured grounding path %s", (path, expectedLabel) => {
    expect(groundingFieldLabel(path)).toBe(expectedLabel);
  });

  it("removes internal provider and fallback diagnostics from visible answer text", () => {
    const answer = [
      "Law.go와 OpenAI 응답을 결합했습니다. OPENAI_API_KEY가 없어 fallback 정책을 따릅니다.",
      "",
      "1) 핵심 판단",
      "하청 작업 전 원청과 하청의 안전보건 조치 이행 자료를 확인합니다.",
      "",
      "OpenAI 응답은 timeout 20000ms, retry 없음, 실패 시 graceful fallback 정책을 따릅니다."
    ].join("\n");

    const sanitized = sanitizeAnswerForDisplay(answer);

    expect(sanitized).toContain("핵심 판단");
    expect(sanitized).not.toMatch(/OpenAI|OPENAI_API_KEY|fallback|timeout|retry|graceful/i);
  });

  it("removes DB harness and raw SIF diagnostics from visible answer text", () => {
    const answer = [
      "1) 하네스 판단",
      "- 직접 근거: D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
      "- SIF 유사사례: ○○현장에서 작업자가 로프와 함께 추락한 사례",
      "",
      "2) 오늘 문서에 먼저 반영할 조치",
      "- SIF 사고개요와 원문 감소대책을 현장 작업조건에 대조해 직접 원인 확인",
      "- 관리감독자 검토 완료 전 원시 태그·관리대책을 현장 통제대책으로 확정하지 않음",
      "- 작업발판·안전난간·개구부 방호 상태를 작업 전 점검합니다.",
      "- 오후 강풍 예보 시 작업중지 기준과 대피 기준을 TBM에서 공유합니다."
    ].join("\n");

    const sanitized = sanitizeAnswerForDisplay(answer);

    expect(sanitized).toContain("작업발판");
    expect(sanitized).toContain("강풍");
    expect(sanitized).not.toMatch(/하네스|DB 하네스|SIF 사고개요|원시 태그|관리감독자 검토 완료 전|D-C-13|○○현장/u);
  });

  it("builds public status notes without exposing raw status detail text", () => {
    const input: AnswerPanelPublicStatusInput = {
      status: {
        lawgo: "live",
        weather: "fallback",
        kosha: "live",
        work24: "mock"
      },
      externalData: {
        safetyReference: {
          mode: "live",
          count: 42
        }
      },
      dbHarness: {
        summary: {
          directEvidence: 3,
          sifCases: 2
        }
      },
      qualityContract: {
        summary: "근거와 문서 반영 위치를 확인했습니다."
      }
    };

    const notes = buildAnswerPanelStatusNotes(input).join(" / ");

    expect(notes).toContain("법령 근거: 연결됨");
    expect(notes).toContain("기상 신호: 보조 근거로 표시");
    expect(notes).toContain("검증 근거: 직접 근거 3건 · SIF 사례 2건");
    expect(notes).not.toMatch(/fallback|OPENAI_API_KEY|timeout|AI_MODE/i);
  });

  it("removes raw SIF diagnostics from practical checkpoints while keeping field actions", () => {
    const points = sanitizePracticalPointsForDisplay([
      "문서 반영 전 확인: SIF 사고개요와 원문 감소대책을 현장 작업조건에 대조해 직접 원인 확인",
      "문서 반영 전 확인: 관리감독자 검토 완료 전 원시 태그·관리대책을 현장 통제대책으로 확정하지 않음",
      "문서 반영 전 확인: 작업발판·안전난간·개구부 상태 확인",
      "문서 반영 전 확인: 안전대 체결 및 작업반경 출입통제"
    ]);

    expect(points).toEqual([
      "작업발판·안전난간·개구부 상태 확인",
      "안전대 체결 및 작업반경 출입통제"
    ]);
    expect(points.join(" ")).not.toMatch(/SIF 사고개요|원시 태그|관리감독자 검토 완료 전/u);
  });
});
