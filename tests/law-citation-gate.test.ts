import { describe, expect, it } from "vitest";

import { gateCitations, VERIFIED_ARTICLES } from "@/lib/law-citation-gate";
import { ACCIDENT_REPORT_TEMPLATE } from "@/lib/safety-contacts";
import { parseEducationRecordStructured } from "@/lib/ai-deliverables";

describe("VERIFIED_ARTICLES", () => {
  it("contains the whitelisted 산업안전보건법 article numbers", () => {
    for (const n of ["29", "36", "37", "38", "39", "41", "51", "52", "54", "57", "110", "114"]) {
      expect(VERIFIED_ARTICLES["법"].has(n)).toBe(true);
    }
  });

  it("contains the whitelisted 시행규칙 article numbers", () => {
    expect(VERIFIED_ARTICLES["시행규칙"].has("67")).toBe(true);
    expect(VERIFIED_ARTICLES["시행규칙"].has("73")).toBe(true);
  });

  it("contains the whitelisted 기준규칙 article numbers including ranges and 241의2", () => {
    for (const n of ["32", "38", "39", "40", "86", "562", "566", "567", "241", "241의2"]) {
      expect(VERIFIED_ARTICLES["기준규칙"].has(n)).toBe(true);
    }
    for (let n = 171; n <= 179; n++) expect(VERIFIED_ARTICLES["기준규칙"].has(String(n))).toBe(true);
    for (let n = 180; n <= 183; n++) expect(VERIFIED_ARTICLES["기준규칙"].has(String(n))).toBe(true);
  });
});

describe("gateCitations — hallucinated combinations removed", () => {
  const cases = [
    ["시행규칙 제35조(위험성평가)에 따라 실시한다.", "35"],
    ["시행규칙 제100조 차량계 하역운반기계를 점검한다.", "100"],
    ["시행규칙 제9조 외국인 특수교육을 실시한다.", "9"],
    ["시행규칙 제121조에 따른 조치를 취한다.", "121"],
    ["시행규칙 제133조를 준수한다.", "133"],
    ["시행규칙 제134조를 확인한다.", "134"]
  ] as const;

  for (const [input, num] of cases) {
    it(`strips the unverified 시행규칙 제${num}조 citation`, () => {
      const out = gateCitations(input);
      expect(out).not.toContain(`제${num}조`);
      expect(out).toContain("산업안전보건법령");
    });
  }
});

describe("gateCitations — nested/list article citations (Finding 1)", () => {
  it("expands and strips all three unverified 시행규칙 slash-listed articles (제121/133/134조)", () => {
    const input = "시행규칙 제121/133/134조를 확인한다.";
    const out = gateCitations(input);
    expect(out).not.toContain("121");
    expect(out).not.toContain("133");
    expect(out).not.toContain("134");
    expect(out).not.toContain("121/133/134");
    expect(out).toContain("산업안전보건법령");
  });

  it("strips all three unverified 시행규칙 comma-listed articles (제121조, 제133조, 제134조)", () => {
    const input = "시행규칙 제121조, 제133조, 제134조를 확인한다.";
    const out = gateCitations(input);
    expect(out).not.toContain("제121조");
    expect(out).not.toContain("제133조");
    expect(out).not.toContain("제134조");
    expect(out).toContain("산업안전보건법령");
  });

  it("preserves a verified comma-listed combination (기준규칙 제171조, 제172조)", () => {
    const input = "기준규칙 제171조, 제172조를 준수한다.";
    expect(gateCitations(input)).toBe(input);
  });
});

describe("gateCitations — verified combinations preserved", () => {
  it("preserves 법 제38조", () => {
    const input = "법 제38조에 따라 위험성평가를 실시한다.";
    expect(gateCitations(input)).toBe(input);
  });

  it("preserves 기준규칙 제171조", () => {
    const input = "산업안전보건기준에 관한 규칙 제171조를 준수한다.";
    expect(gateCitations(input)).toBe(input);
  });

  it("preserves 시행규칙 제73조", () => {
    const input = "시행규칙 제73조에 따라 산업재해조사표를 제출한다.";
    expect(gateCitations(input)).toBe(input);
  });

  it("preserves 기준규칙 제241조의2 (제N조의M form)", () => {
    const input = "안전보건규칙 제241조의2에 따라 화재감시자를 배치한다.";
    expect(gateCitations(input)).toBe(input);
  });
});

describe("gateCitations — indeterminate law name preserved conservatively", () => {
  it("preserves a citation when the law name cannot be classified", () => {
    const input = "관련 법령 제200조를 참고하여 조치한다.";
    expect(gateCitations(input)).toBe(input);
  });
});

describe("gateCitations — 별표 references", () => {
  it("truncates an unverifiable 별표N 제M호 reference to 별표N", () => {
    const input = "안전보건규칙 별표3 제2호에 따라 조치한다.";
    const out = gateCitations(input);
    expect(out).toContain("별표3");
    expect(out).not.toContain("제2호");
  });
});

describe("gateCitations — regression: ACCIDENT_REPORT_TEMPLATE passes through unchanged", () => {
  it("does not alter the fixed accident-report template's whitelisted citations", () => {
    expect(gateCitations(ACCIDENT_REPORT_TEMPLATE)).toBe(ACCIDENT_REPORT_TEMPLATE);
  });
});

describe("parseEducationRecordStructured — gates curriculum[].lawCitation", () => {
  const raw = JSON.stringify({
    educationRecordStructured: {
      educationName: "정기 안전보건교육",
      type: "정기교육",
      dateTime: "2026-07-02 09:00",
      location: "현장 사무실",
      target: "전 근로자",
      instructor: "안전관리자",
      confirmer: "현장소장",
      curriculum: [
        { topic: "위험성평가", lawCitation: "시행규칙 제35조", keyPoints: ["a", "b", "c"] },
        { topic: "안전보건교육", lawCitation: "산업안전보건법 제29조", keyPoints: ["a", "b", "c"] }
      ],
      understandingCheck: "질의응답으로 확인한다.",
      tbmLink: "TBM에서 재강조",
      followupRecommendation: "다음 달 재교육"
    }
  });

  it("strips an unverified lawCitation and preserves a verified one", () => {
    const out = parseEducationRecordStructured(raw);
    const curriculum = out?.educationRecordStructured?.curriculum;
    expect(curriculum?.[0]?.lawCitation).toBe("산업안전보건법령");
    expect(curriculum?.[1]?.lawCitation).toBe("산업안전보건법 제29조");
  });
});
