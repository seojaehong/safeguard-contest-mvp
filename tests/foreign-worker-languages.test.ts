import { describe, expect, it } from "vitest";
import { buildForeignWorkerLanguageMessage, buildForeignWorkerLanguages, reconcileLanguages } from "@/lib/foreign-worker";
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
