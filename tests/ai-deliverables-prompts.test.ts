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

  it("keeps hazard discovery inside the DB harness evidence packet", () => {
    expect(persona()).toContain("위험요인은 DB 하네스·근거 후보 안에서 구체화");
    expect(persona()).toContain("근거 밖 새 위험요인은 만들지 말고");
  });
});

describe("contextBlock", () => {
  it("includes the injected work date in the 현장 시나리오 block", () => {
    const block = contextBlock(baseCtx);
    expect(block).toMatch(/작업일자: 2026-07-02/);
  });

  it("includes the DB harness contract when provided", () => {
    const block = contextBlock({
      ...baseCtx,
      dbHarnessContext: "역할: LLM은 DB harness가 고정한 근거를 문장화만 한다."
    });

    expect(block).toContain("[DB 하네스 계약]");
    expect(block).toContain("문장화만 한다");
  });

  it("keeps provider retries subordinate to the DB harness evidence contract", () => {
    const block = contextBlock({
      ...baseCtx,
      dbHarnessContext: [
        "역할: LLM은 DB harness가 고정한 근거를 문장화만 한다.",
        "근거 권위: safety_reference_items, SIF 사례, 작업 개선 이력 DB 하네스가 원천이다.",
        "제공자 재시도: 모델/제공자 재시도는 문장화 실패 복구에만 허용하며 새 근거·새 위험요인을 추가할 수 없다."
      ].join("\n")
    });

    expect(block).toContain("근거 권위: safety_reference_items");
    expect(block).toContain("문장화 실패 복구에만 허용");
    expect(block).toContain("새 근거·새 위험요인을 추가할 수 없다");
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

describe("foreignWorkerPrompt length spec consistency (Finding: 헤더당 800~1500 x 3 vs 전체 4500~7000 was mathematically impossible)", () => {
  const prompt = foreignWorkerPrompt(baseCtx);

  it("does not contain the old self-contradictory per-header x total spec", () => {
    expect(prompt).not.toMatch(/4500~7000/);
    expect(prompt).not.toMatch(/7000~10000/);
  });

  it("gives a single non-contradictory overall length ceiling instead of per-header x count math", () => {
    expect(prompt).toMatch(/12,?000자 이내/);
  });

  it("still pins the Korean section to 800~1500자 and frees the other languages from a character-count requirement", () => {
    expect(prompt).toMatch(/한국어 800~1500자/);
    expect(prompt).toMatch(/글자수 무관/);
  });
});

describe("foreignWorkerPrompt forklift/pallet worker-mount prohibition (Finding: prompt suggested mounting a worker on a forklift pallet)", () => {
  it("forbids advice that allows a worker to ride or work from a forklift fork/pallet, and offers the lawful alternative", () => {
    const prompt = foreignWorkerPrompt(baseCtx);
    expect(prompt).toMatch(/지게차 포크.*팔레트.*탑승/);
    expect(prompt).toMatch(/고소작업대/);
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

  it("parseForeign gates a hallucinated article citation out of foreignWorkerBriefing and foreignWorkerTransmission (Finding 2)", () => {
    const raw = JSON.stringify({
      foreignWorkerBriefing: `${LONG} 시행규칙 제30조에 따라 외국인 근로자 특별교육을 실시한다.`,
      foreignWorkerTransmission: `${LONG} 시행규칙 제30조에 따라 통지한다.`
    });
    const out = parseForeign(raw);
    expect(out).not.toBeNull();
    expect(out!.foreignWorkerBriefing).not.toContain("제30조");
    expect(out!.foreignWorkerTransmission).not.toContain("제30조");
    expect(out!.foreignWorkerBriefing).toContain("산업안전보건법령");
  });

  it("parseForeign leaves multilingual (English/Vietnamese) briefing text unmodified — no false-positive gating", () => {
    const english =
      "In case of emergency, immediately contact the site safety manager and evacuate to the designated assembly point. " +
      "Do not operate machinery you have not been trained on. " +
      LONG;
    const vietnamese =
      "Trong trường hợp khẩn cấp, hãy liên hệ ngay với quản lý an toàn công trường và sơ tán đến điểm tập kết đã chỉ định. " +
      "Không vận hành máy móc mà bạn chưa được đào tạo. " +
      LONG;
    const raw = JSON.stringify({
      foreignWorkerBriefing: english,
      foreignWorkerTransmission: vietnamese
    });
    const out = parseForeign(raw);
    expect(out).not.toBeNull();
    expect(out!.foreignWorkerBriefing).toBe(english);
    expect(out!.foreignWorkerTransmission).toBe(vietnamese);
  });
});
