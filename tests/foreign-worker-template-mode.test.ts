import { describe, expect, it } from "vitest";
import { buildMockAskResponse } from "@/lib/mock-data";
import { FOREIGN_WORKER_BLOCK_NOTICE } from "@/lib/foreign-worker";

/**
 * PR13-RV-01 — template 모드(익명 사용자·작업 유형 보류)는 lib/search.ts 가 buildMockAskResponse 결과를
 * 그대로 돌려준다. 그 경로의 deliverables.foreignWorkerLanguages 도 전송본과 같은 차단 판정을 봐야 한다.
 * 언어 목록에 오른 언어는 전송본에 실제 언어 블록이 있어야 하고(공유 패널 드롭다운·작업자 발송 허용 언어의 근거),
 * 전송본이 전부 막힌 질문은 언어 목록이 비어야 한다.
 */

const LANGUAGE_BLOCK_HEADER = /^\[SafeClaw (?!외국인)(.+)\]$/u;

function transmissionLanguageBlocks(transmission: string): string[] {
  return transmission
    .split(/\r?\n/)
    .map((line) => line.match(LANGUAGE_BLOCK_HEADER)?.[1]?.trim())
    .filter((label): label is string => Boolean(label));
}

const BLOCKED_QUESTIONS = [
  // 프레스: 작업명 번역이 없어 베트남어가 막힌다(검수 probe 재현).
  "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.",
  // 정화조(밀폐): 외국인 언급이 없어 기본 5개 언어가 전부 막힌다.
  "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.",
  // 작업 유형 보류(taskHeld): 모드와 관계없이 template 경로로 간다.
  "충북 청주 아파트 외벽 보수 작업. 달비계 사용, 외국인 근로자 2명(베트남). 폭염 예보. 오늘 작업 전 문서팩을 만들어줘."
];

const EMITTED_QUESTIONS = [
  "세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 베트남 외국인 작업자에게 절연보호구와 검전 기준을 전달해줘.",
  "서울 성수동 외벽 도장 작업, 이동식 비계 사용, 강풍 예보. 외국인 근로자 3명(베트남·태국). 오늘 작업 전 문서팩을 만들어줘."
];

describe("template 모드 foreignWorkerLanguages 는 전송본 차단 판정과 같다 (PR13-RV-01)", () => {
  it.each(BLOCKED_QUESTIONS)("전송본에 언어 블록이 없으면 언어 목록도 비어 있다: %s", (question) => {
    const response = buildMockAskResponse(question, [], "mock", "PR13-RV-01");
    const transmission = response.deliverables.foreignWorkerTransmission;

    expect(transmissionLanguageBlocks(transmission)).toEqual([]);
    expect(response.deliverables.foreignWorkerLanguages).toEqual([]);
  });

  it("전송본에 「전송 금지」 안내가 있는데 언어 목록이 「전송 가능」으로 오르지 않는다", () => {
    const response = buildMockAskResponse(BLOCKED_QUESTIONS[0], [], "mock", "PR13-RV-01");
    const transmission = response.deliverables.foreignWorkerTransmission;

    expect(transmission).toContain(FOREIGN_WORKER_BLOCK_NOTICE);
    expect(response.deliverables.foreignWorkerLanguages.map((language) => language.code)).not.toContain("vi");
  });

  it.each(EMITTED_QUESTIONS)("언어 목록의 언어마다 전송본에 같은 언어 블록과 같은 문장이 있다: %s", (question) => {
    const response = buildMockAskResponse(question, [], "mock", "PR13-RV-01");
    const transmission = response.deliverables.foreignWorkerTransmission;
    const languages = response.deliverables.foreignWorkerLanguages;
    const blocks = transmissionLanguageBlocks(transmission);

    expect(languages.length).toBeGreaterThan(0);
    expect(languages.map((language) => language.nativeLabel)).toEqual(blocks);
    for (const language of languages) {
      expect(language.lines.length).toBeGreaterThan(0);
      for (const line of language.lines) {
        // 공유 패널(buildCanonicalForeignMessage)이 language.lines 로 작업자 발송 본문을 만든다 — 전송본 문장과 같아야 한다.
        expect(transmission).toContain(line);
      }
    }
  });
});
