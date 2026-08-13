import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AskStreamHttpError,
  fetchAskStream,
  shouldRetryAskViaLegacy,
} from "@/lib/ask-stream-client";

describe("ask stream client admission behavior", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not retry explicit HTTP admission failures through the legacy endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      error: "요청 보호 서비스를 확인하는 동안 요청을 잠시 처리할 수 없습니다.",
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    }, { status: 503 })));

    const pending = fetchAskStream({
      question: "성수동 외벽 도장 작업",
      aiMode: "enhanced",
    }, () => undefined);

    await expect(pending).rejects.toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      status: 503,
    });
    await pending.catch((error: unknown) => {
      expect(error).toBeInstanceOf(AskStreamHttpError);
      expect(shouldRetryAskViaLegacy(error)).toBe(false);
    });
  });

  it("retains legacy retry for transport failures without an HTTP response", () => {
    expect(shouldRetryAskViaLegacy(new TypeError("network failed"))).toBe(true);
  });
});
