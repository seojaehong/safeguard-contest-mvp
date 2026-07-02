import { describe, expect, it } from "vitest";

import { splitDocumentMeta } from "@/lib/doc-meta-split";

describe("splitDocumentMeta", () => {
  it("returns the whole text as body when no meta header is present", () => {
    const text = "작업계획서 본문입니다.\n작업순서: 1단계, 2단계.\n안전조치: 보호구 착용.";
    const result = splitDocumentMeta(text);
    expect(result.body).toBe(text);
    expect(result.meta).toBe("");
  });

  it("splits off a [반영 근거: ...] block and everything after it", () => {
    const text = [
      "작업계획서 본문입니다.",
      "작업순서: 1단계, 2단계.",
      "",
      "[반영 근거: 작업계획서]",
      "- 법령·해석례: 산업안전보건법 기준을 작업순서에 연결합니다."
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("작업계획서 본문입니다.\n작업순서: 1단계, 2단계.");
    expect(result.meta).toContain("[반영 근거: 작업계획서]");
    expect(result.body).not.toContain("반영 근거");
  });

  it("splits off a [문서 반영: ...] block", () => {
    const text = [
      "TBM 브리핑 본문",
      "",
      "[문서 반영: 위험성평가표]",
      "- 감소대책과 잔여위험 확인란에 넣습니다."
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("TBM 브리핑 본문");
    expect(result.meta.startsWith("[문서 반영: 위험성평가표]")).toBe(true);
  });

  it("splits off a [KOSHA ... 직접 인용] block", () => {
    const text = [
      "안전교육 기록 본문",
      "",
      "[KOSHA 기술지침/기술지원규정 직접 인용]",
      "- KOSHA 기술지침: 밀폐공간 작업 지침 / 반영 위치: 안전교육일지"
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("안전교육 기록 본문");
    expect(result.meta).toContain("[KOSHA 기술지침/기술지원규정 직접 인용]");
  });

  it("splits off a [공식 서식 기준 보강] block", () => {
    const text = [
      "위험성평가표 본문",
      "",
      "[공식 서식 기준 보강]",
      "- KOSHA 위험성평가 흐름에 맞춰 사전준비, 유해·위험요인 파악 순서로 기록합니다."
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("위험성평가표 본문");
    expect(result.meta).toContain("[공식 서식 기준 보강]");
  });

  it("cuts everything from the FIRST meta header onward, even mixed with later substantive-looking blocks", () => {
    const text = [
      "본문 1문단",
      "",
      "[반영 근거: TBM 기록]",
      "- 법령·해석례: ...",
      "",
      "[한여름 옥외작업 TBM 추가질문]",
      "- 오늘 그늘 휴게공간, 시원한 물, 휴식 주기를 확인했는가?"
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("본문 1문단");
    expect(result.meta).toContain("[반영 근거: TBM 기록]");
    expect(result.meta).toContain("[한여름 옥외작업 TBM 추가질문]");
  });

  it("does not false-positive on a bracketed line that is not a recognized meta header", () => {
    const text = [
      "본문입니다.",
      "[주의사항] 작업 전 반드시 보호구를 착용하십시오.",
      "[참고] 현장 관리자에게 문의하세요."
    ].join("\n");
    const result = splitDocumentMeta(text);
    expect(result.body).toBe(text);
    expect(result.meta).toBe("");
  });

  it("treats a meta header appearing as the very first line — body is empty, meta is everything", () => {
    const text = "[근거 요약: 유사 재해사례]\n- 사례1: ...";
    const result = splitDocumentMeta(text);
    expect(result.body).toBe("");
    expect(result.meta).toBe(text);
  });

  it("handles an empty string input without throwing", () => {
    const result = splitDocumentMeta("");
    expect(result.body).toBe("");
    expect(result.meta).toBe("");
  });

  it("is a no-op (byte-identical body) for AI-authored prose that never contains a meta header", () => {
    const text = "1. 작업 개요\n작업명: 배관 점검\n작업인원: 8명\n\n2. 작업 순서\n- 1단계: 안전점검\n- 2단계: 작업 착수";
    const result = splitDocumentMeta(text);
    expect(result.body).toBe(text);
    expect(result.meta).toBe("");
  });

  // The next three cases mirror the exact appendix chains lib/search.ts builds for
  // workPlanDraft / tbmBriefing / safetyEducationRecordDraft (prod 2026-07-02 evidence:
  // these fields have no free-text AI producer, so the template + appendix-chain
  // path always runs — see stripPipelineMeta's doc comment in lib/search.ts).
  it("strips a workPlanDraft-shaped appendix chain down to the template body", () => {
    const baseWorkPlanDraft = "작업계획서\n작업순서: 1단계 - 안전점검, 2단계 - 작업 착수.";
    const workPlanLegalAppendix = "\n\n[반영 근거: 작업계획서]\n- 법령·해석례: 산업안전보건법 기준을 작업순서, 작업허가, 통제구역, 작업중지 기준에 연결합니다.";
    const workPlanKoshaAppendix = "\n\n[반영 근거: 작업계획 공식자료]\n- KOSHA 자료: 작업순서, 통제구역, 작업중지 기준에 반영합니다.";
    const composed = `${baseWorkPlanDraft}${workPlanLegalAppendix}${workPlanKoshaAppendix}`;

    const result = splitDocumentMeta(composed);

    expect(result.body).toBe(baseWorkPlanDraft);
    expect(result.body).not.toContain("반영 근거");
  });

  it("strips a safetyEducationRecordDraft-shaped appendix chain, keeping the [교육 적합성 확인] block that precedes the meta appendices (real lib/search.ts order)", () => {
    const base = "안전교육 기록\n교육명: 밀폐공간 작업 안전교육\n교육대상: 전 작업자";
    // lib/search.ts intentionally orders substantive appendices before the
    // evidence-citation ones for this exact reason — cut-to-end must not eat
    // the KOSHA-교육포털 recommendation list or the fit-check block.
    const koshaEducationAppendix = "\n\n[KOSHA 교육포털 연계]\n1. 밀폐공간 안전보건교육 / KOSHA / 전 작업자 / 적합";
    const educationFitBlock = "\n\n[교육 적합성 확인]\n- 신규 투입자 확인 필요";
    const educationLegalAppendix = "\n\n[반영 근거: 안전교육 기록]\n- 법령·해석례: 산업안전보건법 기준을 교육내용, 이해도 확인, 반복 교육 문구에 연결합니다.";
    const composed = `${base}${koshaEducationAppendix}${educationFitBlock}${educationLegalAppendix}`;

    const result = splitDocumentMeta(composed);

    expect(result.body).toContain(base);
    expect(result.body).toContain("[KOSHA 교육포털 연계]");
    expect(result.body).toContain("[교육 적합성 확인]");
    expect(result.body).not.toContain("반영 근거");
  });

  it("does not treat a substantive '[KOSHA 교육포털 연계]' course-list header as meta (false-positive guard)", () => {
    const text = "안전교육 기록 본문\n\n[KOSHA 교육포털 연계]\n1. 밀폐공간 안전보건교육 / KOSHA / 전 작업자 / 적합";
    const result = splitDocumentMeta(text);
    expect(result.body).toBe(text);
    expect(result.meta).toBe("");
  });

  it("leaves a document unchanged when the appendix chain contributes nothing (no KOSHA/legal matches)", () => {
    const base = "TBM 브리핑\n오늘 작업: 배관 점검\n참석자: 8명";
    const composed = `${base}`;

    const result = splitDocumentMeta(composed);

    expect(result.body).toBe(base);
  });
});
