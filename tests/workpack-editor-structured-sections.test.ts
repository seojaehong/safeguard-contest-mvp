import { describe, expect, it } from "vitest";
import {
  buildStructuredDocumentSections,
  getDocumentEditorProfile,
  replaceStructuredDocumentSection,
  type DocumentKey
} from "@/components/workpack-editor-structure";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

const documentKeys: DocumentKey[] = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

describe("workpack editor structured sections", () => {
  it("assigns every launch document to a document-specific editing profile", () => {
    const profiles = documentKeys.map((key) => getDocumentEditorProfile(key));

    expect(profiles).toHaveLength(12);
    expect(new Set(profiles.map((profile) => profile.kind)).size).toBeGreaterThanOrEqual(7);
    expect(profiles.every((profile) => profile.label.trim().length > 0)).toBe(true);
    expect(getDocumentEditorProfile("riskAssessmentDraft").kind).toBe("risk-assessment");
    expect(getDocumentEditorProfile("tbmLogDraft").kind).toBe("meeting-record");
    expect(getDocumentEditorProfile("kakaoMessage").kind).toBe("field-message");
  });

  it("provides a document-specific fallback section schema for all 12 documents", () => {
    const schemas = documentKeys.map((key) => {
      const model = buildStructuredDocumentSections(key, "");
      return {
        key,
        labels: model.body.map((section) => section.label)
      };
    });

    expect(schemas.every(({ labels }) => labels.length >= 3)).toBe(true);
    expect(schemas.every(({ labels }) => new Set(labels).size === labels.length)).toBe(true);
    expect(new Set(schemas.map(({ labels }) => labels.join("|"))).size).toBe(12);
  });

  it("separates editable submission sections from provenance appendices without changing source text", () => {
    const source = [
      "[제출상태]",
      "서식상태: 준제출형",
      "",
      "[필수 확인 항목]",
      "근거 반영: KOSHA 위험성평가 안내",
      "",
      "위험성평가표(초안)",
      "현장명: 성수동 현장",
      "",
      "[1. 유해·위험요인]",
      "- 이동식 비계 추락",
      "",
      "[2. 감소대책]",
      "- 바퀴 잠금과 안전대 체결",
      "",
      "[근거 요약: 공식자료]",
      "- KOSHA 위험성평가 사업안내"
    ].join("\n");

    const model = buildStructuredDocumentSections("riskAssessmentDraft", source);

    expect(model.body.map((section) => section.label)).toEqual([
      "기본 정보",
      "1. 유해·위험요인",
      "2. 감소대책"
    ]);
    expect(model.appendices.map((section) => section.label)).toEqual([
      "제출상태",
      "필수 확인 항목",
      "근거 요약: 공식자료"
    ]);
    expect(model.body.map((section) => section.value).join("\n")).toContain("위험성평가표(초안)");

    const hazardSection = model.body[1];
    const edited = replaceStructuredDocumentSection(source, hazardSection, "- 이동식 비계 전도 및 추락");

    expect(edited).toContain("[1. 유해·위험요인]\n- 이동식 비계 전도 및 추락");
    expect(edited).toContain("[근거 요약: 공식자료]\n- KOSHA 위험성평가 사업안내");
    expect(edited).not.toContain("- 이동식 비계 추락\n");
  });

  it("parses actual transmission and field-message samples into meaningful fallback sections", () => {
    const sample = buildSampleWorkpack();
    const transmission = buildStructuredDocumentSections(
      "foreignWorkerTransmission",
      sample.deliverables.foreignWorkerTransmission
    );
    const message = buildStructuredDocumentSections("kakaoMessage", sample.deliverables.kakaoMessage);

    expect(transmission.body.map((section) => section.label)).toEqual([
      "공지 기본 정보",
      "쉬운 한국어",
      "다국어 안내",
      "관리자 확인"
    ]);
    expect(transmission.body.map((section) => section.value).join("\n")).toContain("위험하면 작업을 멈추고");
    expect(message.body.map((section) => section.label)).toEqual([
      "현장·작업",
      "핵심 위험",
      "필수 조치",
      "시작 전 확인"
    ]);
    expect(message.body.map((section) => section.value).join("\n")).toContain("TBM 및 당일 안전교육");
  });

  it("keeps an empty work permit as a multi-section schema instead of one blank body", () => {
    const model = buildStructuredDocumentSections("workPermitDraft", "");

    expect(model.body.map((section) => section.label)).toEqual([
      "허가 기본 정보",
      "작업 전 허가조건",
      "격리·보호구 확인",
      "작업 종료 확인"
    ]);
    expect(model.body.every((section) => section.value === "")).toBe(true);
  });

  it("keeps an embedded submission body addressable after text is prepended", () => {
    const source = [
      "[필수 확인 항목]",
      "근거 반영: KOSHA TBM OPS",
      "",
      "작업 전 안전점검회의(TBM) 브리핑(초안)",
      "일시: 작업 시작 전",
      "",
      "[1. 작업내용]",
      "- 외벽 도장"
    ].join("\n");
    const initial = buildStructuredDocumentSections("tbmBriefing", source);
    const prepended = replaceStructuredDocumentSection(
      source,
      initial.body[0],
      `사용자 확인 문구\n${initial.body[0].value}`
    );
    const reparsed = buildStructuredDocumentSections("tbmBriefing", prepended);

    expect(reparsed.body[0].label).toBe("회의 기본 정보");
    expect(reparsed.body[0].value).toContain("사용자 확인 문구");
    expect(reparsed.body[0].value).toContain("작업 전 안전점검회의(TBM) 브리핑(초안)");
    expect(reparsed.appendices[0].value).toBe("근거 반영: KOSHA TBM OPS");
  });
});
