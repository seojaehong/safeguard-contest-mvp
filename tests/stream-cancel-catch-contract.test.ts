import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { findUncaughtStreamCancels, formatHit, scanRepo } from "../scripts/check_stream_cancel.mjs";

type Hit = { file?: string; line: number; text: string };
const find = (source: string): Hit[] => findUncaughtStreamCancels(source, "sample.ts");

describe("기다리지 않는 스트림 cancel 은 .catch 로 끝난다 (/correct 261027, #124)", () => {
  it("#124 의 과거 실수 모양을 잡고, 고칠 모양을 오류 문구에 적는다", () => {
    const hits = find("const abortRead = () => {\n  void reader.cancel(signal.reason);\n};");
    expect(hits).toEqual([{ line: 2, text: "void reader.cancel(signal.reason)" }]);
    expect(formatHit({ file: "lib/x.ts", ...hits[0] })).toContain(".catch(() => undefined)");
  });

  it("void 없이 버려지는 모양도 잡는다(여러 줄·화살표 본문·맨 문장·타입 단언)", () => {
    expect(find("void reader\n  .cancel(signal.reason);")).toHaveLength(1);
    expect(find("signal.addEventListener('abort', () => reader.cancel(signal.reason));")).toHaveLength(1);
    expect(find("const onAbort = () => { reader.cancel(signal.reason); };")).toHaveLength(1);
    expect(find("void reader!.cancel(r);")).toHaveLength(1);
    expect(find("void (reader as ReadableStreamDefaultReader).cancel(r);")).toHaveLength(1);
    expect(find("void reader.cancel(errs.catch(x));")).toHaveLength(1);
    expect(find("{ void reader.cancel(r) }\nfetch(u).catch(() => undefined);")).toHaveLength(1);
  });

  it("처리된 것·기다린 것·주석·문자열은 넘긴다", () => {
    const fine = [
      "void reader.cancel(signal.reason).catch(() => undefined);",
      "void reader\n  .cancel(controller.signal.reason)\n  .catch(() => undefined);",
      "void reader.cancel(new Error('a; b')).catch(() => undefined);",
      "void reader.cancel(r).then(() => { log(); }).catch(() => undefined);",
      "void reader.cancel(r).then(undefined, () => undefined);",
      "await reader.cancel('limit');",
      "return response.body?.cancel();",
      "await Promise.all([reader.cancel()]);",
      "// 절대 void reader.cancel(x); 처럼 쓰지 않는다",
      "const text = 'void reader.cancel(x);';",
      "debounced.cancel();",
    ].join("\n");
    expect(find(fine)).toEqual([]);
  });

  it("저장소 전체에 하나도 없다(그리고 실제로 훑었다)", () => {
    const { scannedFiles, hits } = scanRepo(path.resolve(__dirname, ".."));
    expect(scannedFiles.length).toBeGreaterThan(500);
    expect(scannedFiles).toEqual(expect.arrayContaining([
      "lib/mcp-work-budget.ts",
      "lib/remote-hermes-runtime.ts",
      "lib/safety-reference-catalog.ts",
    ]));
    expect(hits.map(formatHit)).toEqual([]);
  });
});
