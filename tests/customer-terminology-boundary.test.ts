import { describe, expect, it } from "vitest";

import {
  formatCustomerFacingLabel,
  formatCustomerFacingText
} from "@/lib/web-safe-presentation";
import { buildWorkpackLearningFile, type WorkpackLearningInput } from "@/lib/workpack-learning-export";

function withoutClosedDetails(html: string): string {
  let output = html;
  let searchFrom = 0;
  while (true) {
    const start = output.indexOf("<details", searchFrom);
    if (start === -1) return output;
    const openingEnd = output.indexOf(">", start);
    if (openingEnd === -1) return output;
    const opening = output.slice(start, openingEnd + 1);
    let depth = 1;
    let cursor = openingEnd + 1;
    while (depth > 0) {
      const nextOpen = output.indexOf("<details", cursor);
      const nextClose = output.indexOf("</details>", cursor);
      if (nextClose === -1) return output;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = output.indexOf(">", nextOpen) + 1;
      } else {
        depth -= 1;
        cursor = nextClose + "</details>".length;
      }
    }
    if (!/\sopen(?:\s|=|>)/u.test(opening)) {
      output = `${output.slice(0, start)}${output.slice(cursor)}`;
      searchFrom = start;
    } else {
      searchFrom = cursor;
    }
  }
}

function defaultVisibleText(html: string): string {
  return withoutClosedDetails(html)
    .replace(/<[^>]+>/gu, " ")
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

describe("customer terminology boundary", () => {
  it("maps operational labels and prose to plain Korean", () => {
    expect(formatCustomerFacingLabel("관리자 원본 JSON")).toBe("현재 조회 결과 데이터");
    expect(formatCustomerFacingLabel("다음 생성용 MD")).toBe("재사용 검토 문서");
    expect(formatCustomerFacingLabel("하네스 JSONL")).toBe("재사용 검토 데이터");
    expect(formatCustomerFacingLabel("Obsidian MD")).toBe("연결형 작업 메모");
    expect(formatCustomerFacingText("DB 하네스 근거와 품질 계약을 확인합니다.")).toBe(
      "검증 근거와 품질 검수를 확인합니다."
    );
  });

  it("keeps unknown customer copy unchanged", () => {
    expect(formatCustomerFacingLabel("작업 이력 문서")).toBe("작업 이력 문서");
    expect(formatCustomerFacingText("공유 준비됨")).toBe("공유 준비됨");
  });

  it("keeps machine export formats and payload fields unchanged", () => {
    const input: WorkpackLearningInput = {
      workpackId: "workpack-1",
      generatedAt: "2026-07-15T00:00:00.000Z",
      question: "비계 작업",
      taskLabel: "비계 작업",
      references: [],
      improvements: [],
      confirmations: []
    };

    const jsonl = buildWorkpackLearningFile(input, "jsonl");
    const obsidian = buildWorkpackLearningFile(input, "obsidian");

    expect(jsonl.contentType).toBe("application/x-ndjson; charset=utf-8");
    expect(jsonl.fileName).toMatch(/\.jsonl$/u);
    expect(obsidian.contentType).toBe("text/markdown; charset=utf-8");
    expect(JSON.parse(jsonl.content.split("\n")[0])).toMatchObject({ workpackId: "workpack-1" });
  });

  it("allows technical formats only inside collapsed admin details", () => {
    const html = '<section>고객용 문서<details><summary>관리자용 상세 파일</summary><button>JSON</button></details></section>';

    expect(defaultVisibleText(html)).toBe("고객용 문서");
    expect(html).toContain("관리자용 상세 파일");
    expect(html).toContain("JSON");
  });
});
