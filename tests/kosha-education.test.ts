import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchKoshaEducationRecommendations } from "../lib/kosha-education";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchKoshaEducationRecommendations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a transient KOSHA education metadata fetch before falling back", async () => {
    const requestedEndpoints: string[] = [];
    let targetAttempts = 0;

    const fetchStub: typeof fetch = async (input) => {
      const url = input.toString();
      requestedEndpoints.push(url);

      if (url.includes("selectEduTrgt")) {
        targetAttempts += 1;
        if (targetAttempts === 1) {
          throw new TypeError("fetch failed");
        }
        return jsonResponse({
          result: "success",
          payload: {
            eduTrgtList: [
              { eduTrgtCd: "00", comCdNm: "전체" },
              { eduTrgtCd: "34", comCdNm: "근로자" },
              { eduTrgtCd: "48", comCdNm: "외국인근로자" },
            ],
          },
        });
      }

      if (url.includes("selectEduInst")) {
        return jsonResponse({
          result: "success",
          payload: { eduInstList: [] },
        });
      }

      return jsonResponse({
        result: "success",
        payload: { eduSrchList: [], eduCrsList: [] },
      });
    };

    vi.stubGlobal("fetch", fetchStub);

    const result = await fetchKoshaEducationRecommendations("외국인 근로자가 포함된 굴착공사 TBM 교육");

    expect(result.mode).toBe("live");
    expect(result.detail).toContain("메타데이터 확인 성공");
    expect(result.recommendations.some((item) => item.target === "외국인근로자")).toBe(true);
    expect(targetAttempts).toBe(2);
    expect(requestedEndpoints.filter((url) => url.includes("selectEduTrgt"))).toHaveLength(2);
  });
});
