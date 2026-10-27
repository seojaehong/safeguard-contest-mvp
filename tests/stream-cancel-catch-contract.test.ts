import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- 타입 선언 없는 저장소 스크립트(.mjs)
import { findUncaughtVoidCancels, formatHit, scanRepo } from "../scripts/check_stream_cancel.mjs";

type Hit = { file?: string; line: number; text: string };

describe("기다리지 않는 cancel 은 .catch 로 끝난다 (/correct 261027, #124)", () => {
  it("과거 실수 모양을 잡는다", () => {
    const before = [
      "  const abortRead = () => {",
      "    void reader.cancel(signal.reason);",
      "  };",
    ].join("\n");
    const hits: Hit[] = findUncaughtVoidCancels(before);
    expect(hits).toEqual([{ line: 2, text: "void reader.cancel(signal.reason)" }]);
    expect(formatHit({ file: "lib/x.ts", ...hits[0] })).toContain(".catch(() => undefined)");
  });

  it("catch 로 끝난 것과 await 된 것은 통과시킨다", () => {
    const after = [
      "void reader.cancel(signal.reason).catch(() => undefined);",
      "void reader\n  .cancel(controller.signal.reason)\n  .catch(() => undefined);",
      "await reader.cancel(\"limit\");",
    ].join("\n");
    expect(findUncaughtVoidCancels(after)).toEqual([]);
  });

  it("저장소 app·components·lib·scripts·cli 에 하나도 없다", () => {
    const hits: Hit[] = scanRepo(path.resolve(__dirname, ".."));
    expect(hits.map(formatHit)).toEqual([]);
  });
});
