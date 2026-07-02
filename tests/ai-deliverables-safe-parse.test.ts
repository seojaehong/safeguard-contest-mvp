import { describe, expect, test } from "vitest";
import { safeParseJson } from "@/lib/ai-deliverables";

describe("safeParseJson code-fence hardening", () => {
  test("(a) parses JSON wrapped in a ```json fence only", () => {
    const raw = "```json\n" + JSON.stringify({ foo: "bar" }) + "\n```";
    expect(safeParseJson(raw)).toEqual({ foo: "bar" });
  });

  test("(b) parses JSON fenced with ```json followed by trailing Korean chatter", () => {
    const raw =
      "```json\n" +
      JSON.stringify({ tbmLogStructured: { meta: { dateTime: "2026-07-02" } } }) +
      "\n```\n\n위 내용으로 TBM 일지를 작성했습니다. 추가로 필요한 사항이 있으면 알려주세요.";
    expect(safeParseJson(raw)).toEqual({
      tbmLogStructured: { meta: { dateTime: "2026-07-02" } }
    });
  });

  test("(c) parses JSON embedded in prose without fences", () => {
    const raw =
      "물론입니다, 요청하신 내용은 다음과 같습니다:\n" +
      JSON.stringify({ hello: "world" }) +
      "\n이상입니다.";
    expect(safeParseJson(raw)).toEqual({ hello: "world" });
  });

  test("(d) parses plain unwrapped JSON", () => {
    const raw = JSON.stringify({ a: 1, b: [1, 2, 3] });
    expect(safeParseJson(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  test("(e) returns null for non-JSON content", () => {
    expect(safeParseJson("죄송하지만 요청을 처리할 수 없습니다.")).toBeNull();
  });
});
