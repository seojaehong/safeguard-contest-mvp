// inventory 11-3 의 14번: validateGroundedGenerationOutput 의 forbidden_term 거절이 패킷 모드에서만 돈다
// (rejectForGrounding 의 「if (!opts.groundingPacket) return false」가 앞선다). 비패킷 AI 묶음에도 금지어 4종
// (판정·진단·상담·노무사, 허용 복합어 목록 공유) 거절이 돌아야 한다. 결정론 틀은 손대지 않는다.
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateWithAnthropic: vi.fn()
}));

// providerDecision 은 모듈 상단에서 굳으므로 import 전에 anthropic 으로 고정한다.
vi.mock("@/lib/ai-provider-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai-provider-policy")>();
  return {
    ...original,
    resolveDeliverablesProvider: () => ({ provider: "anthropic", model: "claude-test" })
  };
});

vi.mock("@/lib/anthropic-client", () => ({
  generateWithAnthropic: mocks.generateWithAnthropic
}));

import { generateAllDeliverablesWithDiagnostics } from "@/lib/ai-deliverables";
import { findForbiddenUserTerms } from "@/lib/grounded-generation-contract";

const SUMMARY = "프레스 금형 교체 작업 요약. 끼임 위험은 안전블록 설치와 운전정지·잠금 확인으로 줄인다. 지게차 운반 구간은 신호수를 두고 보행자 동선을 분리한다. 작업 전 TBM 에서 전원이 확인한다.";
const KAKAO_WITH_FORBIDDEN =
  "[오늘 작업 안전 안내] 프레스 금형 교체. 안전블록 설치 확인, 운전정지·잠금 확인 후 작업. 외국인 근로자 교육 대상 적합 판정 여부는 현장에서 확인. TBM 및 당일 안전교육 내용 확인 후 작업 시작 바랍니다.";
const KAKAO_CLEAN =
  "[오늘 작업 안전 안내] 프레스 금형 교체. 안전블록 설치 확인, 운전정지·잠금 확인 후 작업. 외국인 근로자 교육 이수 여부는 현장에서 확인. TBM 및 당일 안전교육 내용 확인 후 작업 시작 바랍니다.";

function freeGroupReply(kakaoMessage: string) {
  return async (_model: string, prompt: string) => {
    // free 묶음 프롬프트만 유효한 JSON 을 돌려주고, 나머지 묶음은 해석 실패로 떨어뜨린다.
    if (prompt.includes('"kakaoMessage": "string"')) {
      return JSON.stringify({ workpackSummaryDraft: SUMMARY, kakaoMessage });
    }
    return "{}";
  };
}

const opts = {
  scenario: {
    companyName: "테스트회사",
    siteName: "테스트현장",
    workSummary: "프레스 금형 교체",
    workerCount: 6,
    weatherNote: "맑음"
  },
  question: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명.",
  scope: "full" as const
};

describe("비패킷 AI 묶음 금지어 거절 (11-3 의 14번)", () => {
  it("findForbiddenUserTerms 는 허용 복합어를 빼고 금지어 칸을 찾는다", () => {
    expect(findForbiddenUserTerms({ a: "대상 적합 판정", b: "안전보건진단 실시", c: ["고객상담센터 1350", "노무사 자문"] }).map((v) => v.path))
      .toEqual(["$.a", "$.c[1]"]);
    expect(findForbiddenUserTerms({ kakaoMessage: KAKAO_CLEAN })).toEqual([]);
  });

  it("groundingPacket 없이도 금지어가 든 free 묶음은 거절돼 결정론 틀로 떨어진다", async () => {
    mocks.generateWithAnthropic.mockImplementation(freeGroupReply(KAKAO_WITH_FORBIDDEN));
    const result = await generateAllDeliverablesWithDiagnostics(opts);
    const free = result.diagnostics.groupResults.find((group) => group.group === "free");
    expect(free?.status).toBe("rejected");
    expect(free?.reason).toContain("금지어");
    expect(result.deliverables.kakaoMessage).toBeUndefined();
    expect(result.deliverables.workpackSummaryDraft).toBeUndefined();
    expect(result.diagnostics.trace.modelPerDocument.kakaoMessage?.source).not.toBe("provider");
  });

  it("금지어가 없는 free 묶음은 비패킷에서 종전처럼 채택된다", async () => {
    mocks.generateWithAnthropic.mockImplementation(freeGroupReply(KAKAO_CLEAN));
    const result = await generateAllDeliverablesWithDiagnostics(opts);
    const free = result.diagnostics.groupResults.find((group) => group.group === "free");
    expect(free?.status).toBe("fulfilled");
    expect(result.deliverables.kakaoMessage).toBe(KAKAO_CLEAN);
  });
});
