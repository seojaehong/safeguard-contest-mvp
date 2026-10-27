import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// 응답 머리만 보내고 본문을 끝내지 않는 서버. 실제 fetch(undici)가 abort 될 때
// 본문 스트림을 먼저 errored 로 만들고, 그 뒤 abort 리스너의 reader.cancel(reason)
// 이 거부된다. 모의 Response 로는 재현되지 않는다(cancel 이 그냥 resolve 된다).
let server: http.Server;
let baseUrl = "";
const responded: Array<() => void> = [];

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.write("[");
    responded.splice(0).forEach((notify) => notify());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

function nextResponse(): Promise<void> {
  return new Promise((resolve) => responded.push(resolve));
}

async function collectUnhandled(run: () => Promise<unknown>): Promise<unknown[]> {
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown) => seen.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    await run().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  return seen;
}

describe("abort 중 스트림 읽기 취소가 미처리 거부를 남기지 않는다", () => {
  it("safety-reference-catalog REST 조회(readBoundedJson)", async () => {
    vi.stubEnv("SUPABASE_URL", baseUrl);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
    const { searchSafetyReferences } = await import("@/lib/safety-reference-catalog");
    const controller = new AbortController();
    const reason = new Error("caller disconnected");
    const unhandled = await collectUnhandled(async () => {
      const arrived = nextResponse();
      const pending = searchSafetyReferences({ query: "지게차", riskTag: "충돌", signal: controller.signal });
      await arrived;
      await new Promise((resolve) => setTimeout(resolve, 100));
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
    });
    expect(unhandled).toEqual([]);
  });

  it("remote-hermes-runtime 응답 본문(readRemoteHermesResponseBody)", async () => {
    const { readRemoteHermesResponseBody } = await import("@/lib/remote-hermes-runtime");
    const controller = new AbortController();
    const reason = new Error("deadline");
    const unhandled = await collectUnhandled(async () => {
      const response = await fetch(baseUrl, { signal: controller.signal });
      const pending = readRemoteHermesResponseBody(response, controller.signal);
      await new Promise((resolve) => setTimeout(resolve, 100));
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
    });
    expect(unhandled).toEqual([]);
  });
});
