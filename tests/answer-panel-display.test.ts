import { describe, expect, it } from "vitest";

import {
  buildAnswerPanelStatusNotes,
  groundingFieldLabel,
  groundingGroupLabel,
  sanitizeAnswerForDisplay,
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
});
