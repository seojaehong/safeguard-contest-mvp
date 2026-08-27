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

  it("renders electrical distribution-board hazards in Vietnamese without English fallback terms", () => {
    const input = {
      question: "세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 베트남 외국인 작업자에게 절연보호구와 검전 기준을 전달해줘.",
      scenario: {
        siteName: "부산 해운대 시설관리 현장",
        companyName: "세이프전기",
        companyType: "전기설비 점검",
        workSummary: "정전전로 인근 배전반 점검 작업",
        workerCount: 3,
        weatherNote: "정전전로 및 그 인근 전기작업 조건 확인 필요"
      },
      riskSummary: {
        title: "정전전로 인근 배전반 점검",
        riskLevel: "상" as const,
        topRisk: "정전전로 인근 배전반 점검 중 전원 차단·검전·절연보호구 확인이 미흡하면 감전 위험이 발생할 수 있음",
        immediateActions: [
          "작업 전 전원 차단·잠금표지 상태를 확인합니다.",
          "검전기로 무전압을 확인합니다.",
          "절연보호구와 접근통제선을 상호 확인합니다."
        ]
      }
    };
    const vietnamese = buildForeignWorkerLanguages(input).find((language) => language.code === "vi");
    if (!vietnamese) throw new Error("Vietnamese language template is required");
    const message = buildForeignWorkerLanguageMessage(input, vietnamese);

    expect(message).toContain("Tiếng Việt");
    expect(message).toContain("tủ điện");
    expect(message).toContain("điện");
    expect(message).toContain("bút thử điện");
    expect(message).toContain("găng tay cách điện");
    expect(message).not.toMatch(/[가-힣]/u);
    expect(message).not.toContain("electric shock");
    expect(message).not.toContain("The work described in today's briefing");
  });

  it("renders hot-work ventilation and heat hazards in Vietnamese without English fallback terms", () => {
    const input = {
      question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 베트남 작업자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 베트남어 안전교육까지 반영해줘.",
      scenario: {
        siteName: "경기 안산 공장",
        companyName: "그린메탈",
        companyType: "제조업",
        workSummary: "배관 용접·절단 화기작업",
        workerCount: 6,
        weatherNote: "실내 고온과 환기 불량 확인 필요"
      },
      riskSummary: {
        title: "고온·환기불량 화기작업",
        riskLevel: "상" as const,
        topRisk: "용접·절단 불티, 환기 불량, 고온으로 화재·질식·온열질환 위험이 발생할 수 있음",
        immediateActions: [
          "가연물을 제거하고 화재감시자를 배치합니다.",
          "작업 전 환기 상태와 산소농도를 확인합니다.",
          "물과 휴식시간을 확보하고 어지럼 증상을 즉시 보고합니다."
        ]
      }
    };
    const vietnamese = buildForeignWorkerLanguages(input).find((language) => language.code === "vi");
    if (!vietnamese) throw new Error("Vietnamese language template is required");
    const message = buildForeignWorkerLanguageMessage(input, vietnamese);

    expect(message).toContain("Tiếng Việt");
    expect(message).toContain("hàn/cắt");
    expect(message).toContain("thông gió");
    expect(message).toContain("say nóng");
    expect(message).not.toMatch(/[가-힣]/u);
    expect(message).not.toContain("confined-space hazard");
    expect(message).not.toContain("heat illness");
    expect(message).not.toContain("fire or hot-work hazard");
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

  it("does not treat chemical spray wording as a rain condition", () => {
    const chemicalInput = {
      question: "울산 도금공장 탱크 외부 화학세척 작업. SDS와 GHS 경고표지를 확인하고 비산·피부접촉을 통제한다.",
      scenario: {
        siteName: "울산 탱크 외부 화학세척 작업 현장",
        companyName: "클린온",
        companyType: "제조업",
        workSummary: "탱크 외부 화학세척 작업",
        workerCount: 5,
        weatherNote: "화학물질 식별 전 작업 보류, 국소배기·비산·피부접촉 통제 상태 확인 필요"
      },
      riskSummary: {
        title: "화학세척 작업",
        riskLevel: "중" as const,
        topRisk: "미확인 화학물질의 비산·피부접촉 위험",
        immediateActions: [
          "SDS와 GHS 경고표지를 확인합니다.",
          "국소배기를 가동합니다.",
          "보안경과 내화학장갑을 착용합니다."
        ]
      }
    };

    const transmission = buildForeignWorkerTransmission(chemicalInput);

    expect(transmission).not.toContain("우천·젖은 바닥");
    expect(transmission).not.toContain("더위·자외선 작업에서는");
    expect(transmission).toContain("국소배기·비산·피부접촉");
  });

  it("keeps the rain context for an explicit wet-floor condition", () => {
    const rainyInput = {
      ...input,
      question: `${input.question} 비 예보로 바닥 젖음이 예상됨.`,
      scenario: {
        ...input.scenario,
        weatherNote: "비 예보, 젖은 바닥 미끄럼 주의"
      }
    };

    expect(buildForeignWorkerTransmission(rainyInput)).toContain("우천·젖은 바닥");
  });

  it("keeps heat guidance only for an explicit heat condition", () => {
    const heatInput = {
      ...input,
      question: `${input.question} 폭염과 자외선 노출에 대비한다.`,
      scenario: {
        ...input.scenario,
        weatherNote: "폭염과 자외선 노출, 온열질환 예방 확인 필요"
      }
    };

    expect(buildForeignWorkerTransmission(heatInput)).toContain("더위·자외선 작업에서는");
  });
});

describe("foreign worker generic fallback relevance", () => {
  it("uses neutral stop-and-report fallbacks without adding unrelated named hazards", () => {
    const input = {
      question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자와 신규 작업자 포함, 실내 고온과 환기 불량, 가연물 인접.",
      scenario: {
        siteName: "경기 안산 공장",
        companyName: "그린메탈",
        companyType: "제조업",
        workSummary: "배관 용접·절단 화기작업",
        workerCount: 3,
        weatherNote: "실내 고온과 환기 불량 확인 필요"
      },
      riskSummary: {
        title: "고온·환기불량 화기작업",
        riskLevel: "상" as const,
        topRisk: "용접 불티와 가연물로 인한 화재 및 환기 불량에 따른 흡입 위험",
        immediateActions: [
          "가연물을 제거하고 화재감시자를 배치합니다.",
          "환기 상태를 확인합니다.",
          "보호구를 확인합니다."
        ]
      }
    };

    const messages = buildForeignWorkerLanguages(input)
      .map((language) => buildForeignWorkerLanguageMessage(input, language))
      .join("\n");

    expect(messages).not.toContain("strong wind");
    expect(messages).not.toContain("forklifts");
    expect(messages).not.toContain("发现强风");
    expect(messages).not.toContain("Kuchli shamol");
    expect(messages).not.toContain("လေပြင်း");
  });
});
