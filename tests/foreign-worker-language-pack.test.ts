// PR-13 외국인 전송본 언어팩 + 외국어 검증 (EF-02·03·04·05·06, H7, TBM-11, COPY-14).
// 운영 ask-full 4건의 question·scenario·riskSummary 를 그대로 입력으로 쓴다
// (evaluation/launch-depth-audit-2026-10-25/ask·ask-after). taskClassification 은 #104 이후
// 운영이 붙이는 값을 명시한다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOREIGN_WORKER_BLOCK_NOTICE,
  LIFE_SAFETY_KEYS,
  buildForeignWorkerBriefing,
  buildForeignWorkerKakaoDigest,
  buildForeignWorkerLanguages,
  buildForeignWorkerTransmission,
  buildForeignWorkerTransmissionPlan,
  getForeignWorkerTranslationTable,
  verifyForeignWorkerText
} from "@/lib/foreign-worker";
import { gateUserOutputText, findUserOutputLeaks } from "@/lib/user-output-gate";

type Classified = { status: "classified"; taskId: string; taskLabel: string; layers: string[]; reason: string };

function classified(taskId: string, taskLabel: string): Classified {
  return { status: "classified", taskId, taskLabel, layers: [], reason: "시험 고정값" };
}

const press = {
  question: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.",
  scenario: {
    companyName: "그린메탈",
    companyType: "제조업",
    siteName: "경기 안산 제조공장",
    workSummary: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업",
    workerCount: 6,
    weatherNote: "실내 공정, 용접 흄과 비산불꽃 집중 관리 필요",
    taskClassification: classified("press", "프레스 작업")
  },
  riskSummary: {
    title: "제조업 용접·절단 화기작업",
    riskLevel: "상" as const,
    topRisk: "용접 비산불꽃과 가연물이 맞물리며 화재가 발생하거나 작업자가 화상·흡입 위험에 노출될 수 있음",
    immediateActions: [
      "화기작업 전 가연물 제거와 소화기 배치, 화재감시자 지정",
      "용접면·방염장갑·보안경 등 보호구 착용 상태 확인",
      "국소배기와 환기설비를 가동하고 밀폐구역 작업을 제한"
    ]
  }
};

const confined = {
  question: "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.",
  scenario: {
    companyName: "이지시설관리",
    companyType: "시설관리업",
    siteName: "부산 해운대 시설관리 현장",
    workSummary: "부산 해운대 상가건물 지하 정화조 청소 작업",
    workerCount: 3,
    weatherNote: "지하 협소공간, 미끄럼 및 감전 위험 동시 관리",
    taskClassification: classified("confined-space", "밀폐공간 작업")
  },
  riskSummary: {
    title: "시설관리업 지하 기계실 점검 및 정비 작업",
    riskLevel: "중" as const,
    topRisk: "누수와 습기로 인해 미끄러짐과 감전 위험이 동시에 발생할 수 있음",
    immediateActions: [
      "누수 구간 즉시 표시 후 미끄럼 방지조치와 배수 확인",
      "전기판넬 접근 전 차단·잠금표시와 절연 보호구 확인",
      "지하 기계실 출입 시 2인 1조와 연락체계를 유지"
    ]
  }
};

const excavation = {
  question: "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.",
  scenario: {
    companyName: "현장 업체",
    companyType: "건설업",
    siteName: "서울 열수송관 굴착공사 현장",
    workSummary: "서울 강서구 도시가스 배관 굴착공사",
    workerCount: 8,
    weatherNote: "오후 강풍 예보, 작업중지 기준 공유 필요",
    taskClassification: classified("excavation", "굴착작업")
  },
  riskSummary: {
    title: "건설업 열수송관 굴착공사",
    riskLevel: "상" as const,
    topRisk: "굴착면 붕괴로 작업자가 매몰되거나 굴착기·이동식 크레인이 지하 매설물과 작업자를 접촉할 위험",
    immediateActions: [
      "매설물 도면 확인과 탐사 후 시험굴착으로 위치를 표시하고 관리 주체와 작업 허가를 확인",
      "굴착 깊이와 지반 상태에 맞는 굴착면 기울기·흙막이·토사 이격거리를 확보하고 출입을 통제",
      "굴착기와 이동식 크레인 작업반경을 분리하고 신호수·아웃트리거·인양 경로를 작업 전 확인"
    ]
  }
};

const heat = {
  question: "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘.",
  scenario: {
    companyName: "대성창고",
    companyType: "창고업",
    siteName: "대구 달서구 창고 현장",
    workSummary: "대구 달서구 물류창고 상하차 작업",
    workerCount: 10,
    weatherNote: "고온 작업조건, 온열질환 예방과 휴식 기준 공유 필요",
    taskClassification: classified("manual-loading-heat", "폭염 중 상하차·수작업 운반")
  },
  riskSummary: {
    title: "창고업 상하차 작업",
    riskLevel: "중" as const,
    topRisk: "폭염 환경에서 고중량 박스 운반이 반복되어 온열질환과 근골격계 부담이 커질 수 있음",
    immediateActions: [
      "작업 전 물·그늘·휴식 기준과 이상 증상 보고 절차 공유",
      "2인 1조 운반과 이동대차 사용, 허리 비틀림 작업 금지",
      "이해하지 못하면 즉시 작업중지"
    ]
  }
};

const scaffold = {
  question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 외국인 근로자(베트남어) 1명, 오후 강풍 예보.",
  scenario: {
    siteName: "서울 성수동 근린생활시설 현장",
    companyName: "세이프건설",
    companyType: "건설업",
    workSummary: "외벽 도장 작업",
    workerCount: 5,
    weatherNote: "오후 강풍 예보",
    taskClassification: classified("exterior-painting", "외벽 도장(이동식 비계)")
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

const ALL_INPUTS = { press, confined, excavation, heat, scaffold };

/** 전송본에서 [SafeClaw <원어 표기>] 블록만 잘라 낸다(한국어 머리 구간 제외). */
function foreignBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of text.split("\n")) {
    if (/^\[SafeClaw (?!외국인)/u.test(line)) {
      if (current) blocks.push(current.join("\n"));
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current.join("\n"));
  return blocks;
}

function koreanHead(text: string): string {
  const idx = text.search(/^\[SafeClaw (?!외국인)/mu);
  return idx >= 0 ? text.slice(0, idx) : text;
}

describe("EF-02 외국어 작업명은 주 작업(taskClassification)에서 받는다", () => {
  it("프레스 금형 교체 전송본에 지게차 상하차 작업명이 없다", () => {
    const text = buildForeignWorkerTransmission(press);
    expect(text).not.toContain("Bốc dỡ và lấy hàng bằng xe nâng");
    expect(text).not.toContain("叉车装卸和拣货作业");
    expect(text).not.toContain("Forklift loading/unloading");
  });

  it("정화조 청소 전송본에 지하 기계실 점검 작업명이 없다", () => {
    const text = buildForeignWorkerTransmission(confined);
    expect(text).not.toContain("Kiểm tra phòng máy ngầm");
    expect(text).not.toContain("地下机房检查");
    expect(text).not.toContain("Underground machine-room inspection");
  });

  it("한국어 머리 구간에 대조용 작업명 기준 줄을 병기한다(언어 블록 안에는 한글 0)", () => {
    const text = buildForeignWorkerTransmission(press);
    expect(koreanHead(text)).toContain("외국어 안내 작업명 기준: 프레스 작업");
    for (const block of foreignBlocks(text)) {
      expect(block).not.toMatch(/[가-힣]/u);
    }
  });

  it("분류된 작업에 검수된 작업명이 없는 언어는 전송하지 않고 통역 확인 안내로 막는다", () => {
    const table = getForeignWorkerTranslationTable();
    const plan = buildForeignWorkerTransmissionPlan(press);
    const text = buildForeignWorkerTransmission(press);
    // 전송된 언어는 전부 프레스 작업명이 검수된 언어여야 하고, 막힌 언어는 사유와 함께 블록 없이 안내만 남는다.
    for (const language of plan.emitted) {
      expect(table.packs[language.code].workLabels.pressDieChange, language.code).toBeTruthy();
      expect(language.lines[0]).toContain(table.packs[language.code].workLabels.pressDieChange);
    }
    for (const blocked of plan.blocked) {
      expect(blocked.reasons.length, blocked.language.code).toBeGreaterThan(0);
      expect(text).not.toContain(`[SafeClaw ${blocked.language.nativeLabel}]`);
      expect(text).toContain(blocked.language.label);
    }
    if (plan.blocked.length) expect(text).toContain(FOREIGN_WORKER_BLOCK_NOTICE);
    // 운영 결함 그대로: 프레스에서 베트남어 지게차 작업명은 어떤 경로로도 나오지 않는다.
    expect(text).not.toContain("xe nâng");
  });

  it("작업 유형이 분류되지 않았으면 중립 작업명(오늘 설명한 작업)으로 전송한다", () => {
    const unclassified = {
      ...scaffold,
      question: "성수동 현장 작업. 베트남 작업자 포함.",
      scenario: { ...scaffold.scenario, workSummary: "현장 작업", taskClassification: undefined },
      riskSummary: { ...scaffold.riskSummary, topRisk: "추락 위험", immediateActions: ["안전대를 착용합니다."] }
    };
    const vi = buildForeignWorkerLanguages(unclassified).find((language) => language.code === "vi");
    expect(vi).toBeDefined();
    expect(vi!.lines[0]).toContain("Công việc được quản lý hướng dẫn hôm nay");
  });
});

describe("EF-03 밀폐공간 생명 위험 6키", () => {
  it("6키가 정의돼 있고 모든 언어 팩에 채워져 있다", () => {
    expect(LIFE_SAFETY_KEYS).toEqual(["gasTest", "attendant", "airMask", "noEntry", "emergencyCall", "rescue"]);
    const table = getForeignWorkerTranslationTable();
    for (const [code, pack] of Object.entries(table.packs)) {
      for (const key of LIFE_SAFETY_KEYS) {
        expect(pack.lifeSafety[key]?.text, `${code}.${key}`).toBeTruthy();
        expect(["verified", "review_required"]).toContain(pack.lifeSafety[key]?.status);
      }
    }
  });

  it("밀폐 입력 시 전송되는 모든 언어 블록에 그 언어의 산소·유해가스 측정 문구가 있고, 생명 위험 줄이 다른 조치보다 앞에 온다", () => {
    const table = getForeignWorkerTranslationTable();
    const text = buildForeignWorkerTransmission(confined);
    const plan = buildForeignWorkerTransmissionPlan(confined);
    for (const language of plan.emitted) {
      const block = foreignBlocks(text).find((item) => item.startsWith(`[SafeClaw ${language.nativeLabel}]`));
      expect(block, language.code).toBeDefined();
      const pack = table.packs[language.code];
      const gasLine = pack.lifeSafety.gasTest.text;
      expect(block!).toContain(gasLine);
      const lines = block!.split("\n");
      const gasIndex = lines.findIndex((line) => line.includes(gasLine));
      const electricIndex = lines.findIndex((line) => pack.actionLabels.electric && line.includes(pack.actionLabels.electric));
      if (electricIndex >= 0) expect(gasIndex).toBeLessThan(electricIndex);
    }
  });

  it("6키 중 검수되지 않은 문장이 있는 언어는 밀폐 입력에서 전송 금지 안내로 막힌다", () => {
    const table = getForeignWorkerTranslationTable();
    const plan = buildForeignWorkerTransmissionPlan(confined);
    const text = buildForeignWorkerTransmission(confined);
    for (const blocked of plan.blocked) {
      const pack = table.packs[blocked.language.code];
      const unverified = LIFE_SAFETY_KEYS.filter((key) => pack.lifeSafety[key].status !== "verified");
      if (unverified.length) {
        expect(text).not.toContain(`[SafeClaw ${blocked.language.nativeLabel}]`);
        expect(text).toContain(blocked.language.label);
      }
    }
    expect(text).toContain(FOREIGN_WORKER_BLOCK_NOTICE);
  });

  it("생명 위험 키(밀폐·감전·추락·화재)가 다른 위험보다 앞에 정렬된다", () => {
    const vi = buildForeignWorkerLanguages({
      ...scaffold,
      question: "외벽 도장 작업, 미끄럼 주의, 베트남 작업자",
      riskSummary: { ...scaffold.riskSummary, topRisk: "젖은 바닥 미끄럼과 비계 추락 위험" }
    }).find((language) => language.code === "vi");
    expect(vi).toBeDefined();
    const riskLine = vi!.lines.find((line) => line.startsWith("Nguy cơ chính"));
    expect(riskLine).toBeDefined();
    expect(riskLine!.indexOf("nguy cơ rơi ngã")).toBeLessThan(riskLine!.indexOf("nguy cơ trượt ngã"));
  });
});

describe("EF-04 비영어 팩에 영어 대체 문구가 섞이지 않는다", () => {
  it("비영어 팩의 hazardLabels 는 영어 fallback 과 같은 값을 갖지 않는다", () => {
    const table = getForeignWorkerTranslationTable();
    for (const [code, pack] of Object.entries(table.packs)) {
      if (code === "en") continue;
      for (const [key, label] of Object.entries(pack.hazardLabels)) {
        expect(label, `${code}.${key}`).not.toBe(table.fallbackHazardsEn[key as keyof typeof table.fallbackHazardsEn]);
      }
    }
  });

  it("운영 4건 + 비계 입력의 비영어 블록에 「heavy-load handling」「confined-space hazard」 등 영문 위험명이 0회", () => {
    for (const [name, input] of Object.entries(ALL_INPUTS)) {
      const text = buildForeignWorkerTransmission({
        ...input,
        question: `${input.question} 외국인 근로자 다국어 안내.`
      });
      for (const block of foreignBlocks(text)) {
        if (block.startsWith("[SafeClaw English]")) continue;
        expect(block, name).not.toContain("heavy-load handling");
        expect(block, name).not.toContain("confined-space hazard");
        expect(block, name).not.toMatch(/\b[a-z-]+ hazard\b/u);
      }
    }
  });
});

describe("EF-05 굴착 전송본에 비계 문구가 없다", () => {
  it("비계가 감지되지 않으면 강풍 조치의 비계 문장을 쓰지 않는다", () => {
    const text = buildForeignWorkerTransmission({ ...excavation, question: `${excavation.question} 외국인 근로자 다국어 안내.` });
    expect(text).not.toContain("giàn giáo");
    expect(text).not.toContain("脚手架");
    expect(text).not.toContain("scaffold");
    expect(text).not.toContain("นั่งร้าน");
  });

  it("비계 작업에서는 강풍 조치의 비계 문장이 그대로 남는다", () => {
    const vi = buildForeignWorkerLanguages(scaffold).find((language) => language.code === "vi");
    expect(vi).toBeDefined();
    expect(vi!.lines.join("\n")).toContain("giàn giáo rung");
  });
});

describe("EF-06 카톡 외국인 공지 요약이 제목 줄로 끝나지 않는다", () => {
  it("요약은 한국어 머리 구간 전체를 담고 마지막 줄이 쌍점으로 끝나지 않는다", () => {
    for (const [name, input] of Object.entries(ALL_INPUTS)) {
      const transmission = buildForeignWorkerTransmission(input);
      const digest = buildForeignWorkerKakaoDigest(transmission);
      const lines = digest.split("\n").filter((line) => line.trim());
      const last = lines[lines.length - 1];
      expect(last, name).not.toMatch(/:\s*$/u);
      expect(last, name).not.toBe("쉬운 한국어:");
      expect(digest, name).toContain("✋ 위험하면 작업을 멈추고 바로 관리자에게 말하세요.");
      expect(digest, name).toContain("⚠️ 이해하지 못하면 작업을 시작하지 말고");
      expect(digest, name).not.toMatch(/^\[SafeClaw (?!외국인)/mu);
    }
  });

  it("막힌 언어가 있으면 요약에도 전송 금지 안내가 들어간다", () => {
    const digest = buildForeignWorkerKakaoDigest(buildForeignWorkerTransmission(confined));
    expect(digest).toContain(FOREIGN_WORKER_BLOCK_NOTICE);
  });
});

describe("H7 외국어 문장 검증", () => {
  it("가스 측정 없이 진입하라는 영어 문장은 review_required", () => {
    expect(verifyForeignWorkerText("Enter without gas test. Work alone is fine.").status).toBe("review_required");
    expect(verifyForeignWorkerText("No need to measure oxygen before entry.").status).toBe("review_required");
    expect(verifyForeignWorkerText("进入前不需要测量氧气。").status).toBe("review_required");
    expect(verifyForeignWorkerText("Không cần đo khí trước khi vào.").status).toBe("review_required");
  });

  it("고정 번역표로 만든 전송본·안내문은 ok", () => {
    for (const input of Object.values(ALL_INPUTS)) {
      expect(verifyForeignWorkerText(buildForeignWorkerTransmission(input)).status).toBe("ok");
      expect(verifyForeignWorkerText(buildForeignWorkerBriefing(input)).status).toBe("ok");
    }
  });

  it("번역표 자체(검수·미검수 전부)에 금지 부정문이 없다", () => {
    const table = getForeignWorkerTranslationTable();
    for (const pack of Object.values(table.packs)) {
      const all = [
        ...Object.values(pack.workLabels),
        ...Object.values(pack.hazardLabels),
        ...Object.values(pack.actionLabels),
        ...Object.values(pack.lifeSafety).map((entry) => entry.text)
      ].join("\n");
      expect(verifyForeignWorkerText(all).status).toBe("ok");
    }
  });
});

describe("TBM-11 언어 목록은 실제로 전송된 언어만", () => {
  it("buildForeignWorkerLanguages 는 전송본에 블록이 있는 언어만 돌려준다", () => {
    for (const input of Object.values(ALL_INPUTS)) {
      const languages = buildForeignWorkerLanguages(input);
      const text = buildForeignWorkerTransmission(input);
      for (const language of languages) {
        expect(text).toContain(`[SafeClaw ${language.nativeLabel}]`);
      }
      expect(foreignBlocks(text)).toHaveLength(languages.length);
    }
  });
});

describe("사용자 출력 게이트와의 정합", () => {
  it("전송본·안내문·카톡 요약에 금지 문구와 영문 내부 코드(언어 코드·상태값)가 없다", () => {
    for (const input of Object.values(ALL_INPUTS)) {
      const transmission = buildForeignWorkerTransmission(input);
      const briefing = buildForeignWorkerBriefing(input);
      const digest = buildForeignWorkerKakaoDigest(transmission);
      for (const text of [transmission, briefing, digest]) {
        expect(findUserOutputLeaks(text)).toEqual([]);
        expect(gateUserOutputText(text)).toBe(text);
        expect(text).not.toMatch(/review_required|verified|taskId|taskLabel|pressDieChange|confinedSpaceWork/u);
      }
    }
  });
});

describe("COPY-14 외국인 안내문 인쇄 코드", () => {
  it("foreignWorkerBriefing 은 교육기록 코드 SC-EDU-01 을 빌려 쓰지 않는다", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components", "WorkpackEditor.tsx"), "utf8");
    expect(source).not.toMatch(/key === "safetyEducationRecordDraft" \|\| key === "foreignWorkerBriefing"\)\s*\{\s*return \{\s*code: "SC-EDU-01"/u);
    expect(source).toMatch(/key === "foreignWorkerBriefing"\)\s*\{\s*return \{\s*code: "SC-FW-01"/u);
  });
});
