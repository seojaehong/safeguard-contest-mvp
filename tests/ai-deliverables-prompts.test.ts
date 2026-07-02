import { describe, expect, it } from "vitest";

import { contextBlock, foreignWorkerPrompt, freeFormPrompt, parseForeign, parseFree, persona } from "@/lib/ai-deliverables";
import { ACCIDENT_REPORT_TEMPLATE } from "@/lib/safety-contacts";

const baseCtx = {
  question: "질문",
  scenario: {
    companyName: "테스트회사",
    siteName: "테스트현장",
    workSummary: "테스트 작업",
    workerCount: 5,
    weatherNote: "맑음"
  },
  citationLines: [],
  trainingLines: [],
  koshaLines: [],
  accidentLines: [],
  workDate: "2026-07-02"
};

describe("persona", () => {
  it("forbids inventing dates outside the scenario work date", () => {
    expect(persona()).toMatch(/작업일자/);
    expect(persona()).toMatch(/다른 날짜를 만들지 마라/);
  });

  it("forbids inventing example names/companies/addresses", () => {
    expect(persona()).toMatch(/현장 확인 필요/);
    expect(persona()).toMatch(/김철수/);
  });
});

describe("contextBlock", () => {
  it("includes the injected work date in the 현장 시나리오 block", () => {
    const block = contextBlock(baseCtx);
    expect(block).toMatch(/작업일자: 2026-07-02/);
  });
});

describe("emergency contact whitelist injection", () => {
  it("freeFormPrompt instructs the model to use only the official contact numbers", () => {
    const prompt = freeFormPrompt(baseCtx);
    expect(prompt).toContain("119");
    expect(prompt).toContain("1588-0075");
    expect(prompt).toContain("1644-4544");
    expect(prompt).toContain("1350");
    expect(prompt).toMatch(/지어내지 마라/);
    expect(prompt).toContain(ACCIDENT_REPORT_TEMPLATE);
  });

  it("foreignWorkerPrompt instructs the model to use only the official contact numbers", () => {
    const prompt = foreignWorkerPrompt(baseCtx);
    expect(prompt).toContain("119");
    expect(prompt).toContain("1588-0075");
    expect(prompt).toContain("1644-4544");
    expect(prompt).toContain("1350");
    expect(prompt).toMatch(/지어내지 마라/);
    expect(prompt).toContain(ACCIDENT_REPORT_TEMPLATE);
  });
});

describe("post-processing: contact sanitization on parsed output", () => {
  const LONG = "가".repeat(300);

  it("parseFree strips a fabricated phone number out of emergencyResponseDraft", () => {
    const raw = JSON.stringify({
      workpackSummaryDraft: LONG,
      emergencyResponseDraft: `${LONG} 한국산재보험공단 1644-0644 로 연락.`,
      photoEvidenceDraft: LONG,
      kakaoMessage: LONG
    });
    const out = parseFree(raw);
    expect(out).not.toBeNull();
    expect(out!.emergencyResponseDraft).not.toContain("1644-0644");
  });

  it("parseForeign strips fabricated phone numbers out of foreignWorkerBriefing and foreignWorkerTransmission", () => {
    const raw = JSON.stringify({
      foreignWorkerBriefing: `${LONG} 안전보건공단 안산지사 031-555-7788`,
      foreignWorkerTransmission: `${LONG} 고용노동부 안산지청 감시반 031-555-8000`
    });
    const out = parseForeign(raw);
    expect(out).not.toBeNull();
    expect(out!.foreignWorkerBriefing).not.toContain("031-555-7788");
    expect(out!.foreignWorkerTransmission).not.toContain("031-555-8000");
  });
});
