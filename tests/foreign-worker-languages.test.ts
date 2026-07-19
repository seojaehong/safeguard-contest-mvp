import { describe, expect, it } from "vitest";
import {
  buildForeignWorkerLanguageMessage,
  buildForeignWorkerLanguages,
  buildForeignWorkerTransmission,
  ensureForeignWorkerTransmissionContext,
  reconcileLanguages
} from "@/lib/foreign-worker";
import type { ForeignWorkerLanguage } from "@/lib/types";

function lang(code: string, label: string, nativeLabel: string): ForeignWorkerLanguage {
  return { code, label, nativeLabel, rationale: `${label} 근거`, lines: [`${label} line 1`, `${label} line 2`, `${label} line 3`] };
}

const en = lang("en", "영어", "English");
const vi = lang("vi", "베트남어", "Tiếng Việt");
const th = lang("th", "태국어", "ภาษาไทย");
const uz = lang("uz", "우즈베크어", "O'zbekcha");
const zh = lang("zh", "중국어", "中文");

describe("reconcileLanguages", () => {
  it("filters claimed languages down to the ones whose native label actually appears in the body text", () => {
    const briefing = "[한국어] ... [English] ... [Tiếng Việt] ...";
    const transmission = "[한국어] ... [English] ... [Tiếng Việt] ...";
    const claimed = [en, vi, th, uz, zh];

    const result = reconcileLanguages(briefing, transmission, claimed);

    expect(result.map((l) => l.code)).toEqual(["en", "vi"]);
  });

  it("preserves the original claimed order among the languages that match", () => {
    const briefing = "[Tiếng Việt] hello [English] hello";
    const claimed = [en, vi];

    const result = reconcileLanguages(briefing, "", claimed);

    expect(result.map((l) => l.code)).toEqual(["en", "vi"]);
  });

  it("falls back to the original claimed array when no language can be detected in the text (defensive, avoids over-stripping on unexpected header formats)", () => {
    const briefing = "no recognizable language headers here";
    const claimed = [en, vi, th];

    const result = reconcileLanguages(briefing, "", claimed);

    expect(result).toEqual(claimed);
  });

  it("also matches on the Korean language name label, not just the native label", () => {
    const transmission = "베트남어(Tiếng Việt) 공지문 ...";
    const claimed = [en, vi];

    const result = reconcileLanguages("", transmission, claimed);

    expect(result.map((l) => l.code)).toEqual(["vi"]);
  });

  it("matches case-insensitively for Latin-script native labels", () => {
    const briefing = "... ENGLISH SECTION ...";
    const claimed = [en, vi];

    const result = reconcileLanguages(briefing, "", claimed);

    expect(result.map((l) => l.code)).toEqual(["en"]);
  });

  it("scans both briefing and transmission text together", () => {
    const briefing = "[English] only here";
    const transmission = "[Tiếng Việt] only here";
    const claimed = [en, vi, th];

    const result = reconcileLanguages(briefing, transmission, claimed);

    expect(result.map((l) => l.code)).toEqual(["en", "vi"]);
  });
});

describe("buildForeignWorkerLanguageMessage", () => {
  it("keeps a worker-specific Vietnamese dispatch block free of Korean UI labels", () => {
    const input = {
      question: "foreign worker scaffold painting with strong wind",
      scenario: {
        siteName: "Seongsu exterior wall",
        companyName: "SafeClaw Demo",
        companyType: "construction",
        workSummary: "Exterior painting with a mobile scaffold",
        workerCount: 5,
        weatherNote: "Strong wind expected"
      },
      riskSummary: {
        title: "Strong wind scaffold work",
        riskLevel: "상" as const,
        topRisk: "mobile scaffold fall hazard",
        immediateActions: [
          "Lock scaffold wheels before work.",
          "Stop outdoor work when the scaffold shakes.",
          "Confirm fall-arrest anchor points."
        ]
      }
    };
    const vietnamese = buildForeignWorkerLanguages(input).find((language) => language.code === "vi");
    if (!vietnamese) throw new Error("Vietnamese language template is required");
    const message = buildForeignWorkerLanguageMessage(input, vietnamese);

    expect(message).toContain("Tiếng Việt");
    expect(message).not.toMatch(/[가-힣]/u);
    expect(message).not.toContain("현장:");
    expect(message).not.toContain("작업:");
    expect(message).not.toContain("핵심 위험:");
  });
});

describe("foreign worker transmission context", () => {
  const input = {
    question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
    scenario: {
      siteName: "서울 성수동 근린생활시설 현장",
      companyName: "세이프건설",
      companyType: "건설업",
      workSummary: "외벽 도장 작업",
      workerCount: 5,
      weatherNote: "오후 강풍 예보"
    },
    riskSummary: {
      title: "외벽 도장 강풍 비계 작업",
      riskLevel: "상" as const,
      topRisk: "강풍 상황에서 이동식 비계가 흔들리며 작업자가 추락할 위험",
      immediateActions: [
        "작업 전 비계 바퀴와 아웃트리거를 고정합니다.",
        "비계가 흔들리면 즉시 작업을 멈춥니다.",
        "안전대와 추락방지 설비를 확인합니다."
      ]
    }
  };

  it("keeps the Korean work summary in the default dispatch body", () => {
    const transmission = buildForeignWorkerTransmission(input);

    expect(transmission).toContain("오늘 작업: 외벽 도장 작업");
    expect(transmission).toContain("도장");
  });

  it("injects the work summary into AI-authored dispatch bodies before scenario terms can be lost", () => {
    const aiBody = [
      "[SafeClaw 외국인 근로자 안전공지] 세이프건설",
      "현장: 서울 성수동 근린생활시설 현장",
      "작업조건: 오후 강풍 예보",
      "쉬운 한국어:",
      "위험하면 작업을 멈추고 관리자에게 말하세요."
    ].join("\n");

    const transmission = ensureForeignWorkerTransmissionContext(aiBody, input);

    expect(transmission).toContain("현장: 서울 성수동 근린생활시설 현장\n오늘 작업: 외벽 도장 작업");
    expect(transmission).toContain("도장");
  });
});
