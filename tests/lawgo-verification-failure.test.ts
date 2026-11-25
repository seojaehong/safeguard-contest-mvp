import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Law.go DRF answers HTTP 200 with this body when the caller's IP/domain is not registered for the OC.
const VERIFICATION_FAILURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <result>사용자 정보 검증에 실패하였습니다.</result>
        <msg>OPEN API 호출 시 사용자 검증을 위하여 정확한 서버장비의 IP주소 및 도메인주소를 등록해 주세요.</msg>
    </Response>`;

function stubVerificationFailure() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(VERIFICATION_FAILURE_XML, { status: 200, headers: { "content-type": "text/xml" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Law.go user verification failure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LAWGO_OC", "test-oc");
    vi.stubEnv("LAWGO_MOCK_MODE", "");
    vi.stubEnv("KOREAN_LAW_MCP_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a registered-domain Referer on search requests", async () => {
    vi.stubEnv("LAWGO_REFERER", "https://www.safeclaw.kr/");
    const fetchMock = stubVerificationFailure();
    const { searchAll } = await import("@/lib/lawgo");

    await searchAll("비계").catch(() => undefined);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(init?.headers);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("lawSearch.do");
    expect(headers.get("Referer")).toBe("https://www.safeclaw.kr/");
  });

  it("raises instead of reporting zero hits when Law.go rejects the caller", async () => {
    stubVerificationFailure();
    const { searchAll, LawGoVerificationError } = await import("@/lib/lawgo");

    await expect(searchAll("비계")).rejects.toBeInstanceOf(LawGoVerificationError);
  });

  it("falls back to labeled mock evidence instead of an empty list", async () => {
    stubVerificationFailure();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { searchLegalSources } = await import("@/lib/legal-sources");

    const results = await searchLegalSources("중대재해");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.sourceSystem === "mock")).toBe(true);
  });
});
