import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatCustomerFacingLabel,
  formatCustomerFacingText
} from "@/lib/web-safe-presentation";
import { buildWorkpackLearningFile, type WorkpackLearningInput } from "@/lib/workpack-learning-export";

const root = process.cwd();
const forbiddenDefaultTerms = [
  "DB 하네스",
  "품질 계약",
  "관리자 원본 JSON",
  "다음 생성용 MD",
  "하네스 JSONL",
  "Obsidian MD"
] as const;

describe("customer terminology boundary", () => {
  it("maps operational labels and prose to plain Korean", () => {
    expect(formatCustomerFacingLabel("관리자 원본 JSON")).toBe("전체 기록 파일");
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

  it("removes raw operational terms from default customer surface source", () => {
    const defaultSurfaceSources = [
      "components/FieldOperationsWorkspace.tsx",
      "components/OperationMemoryPreview.tsx",
      "components/WorkpackEditor.tsx",
      "lib/workpack-readiness.ts"
    ].map((file) => readFileSync(join(root, file), "utf8"));

    for (const source of defaultSurfaceSources) {
      for (const term of forbiddenDefaultTerms) {
        expect(source).not.toContain(term);
      }
    }
  });

  it("keeps technical report downloads behind collapsed admin details with plain labels", () => {
    const reports = readFileSync(join(root, "components", "ReportsDownloadCenter.tsx"), "utf8");
    const dryrun = readFileSync(join(root, "app", "dryrun", "page.tsx"), "utf8");

    expect(reports).toContain("<details");
    expect(reports).toContain("관리자용 상세 파일");
    expect(reports).toContain("전체 기록 파일");
    expect(reports).toContain("재사용 검토 문서");
    expect(reports).toContain("재사용 검토 데이터");
    expect(reports).not.toContain("관리자 원본 JSON");
    expect(reports).not.toContain("다음 생성용 MD");
    expect(reports).not.toContain("하네스 JSONL");

    expect(dryrun).toContain("<details");
    expect(dryrun).toContain("상세 점검 기록");
    expect(dryrun).not.toContain("API 상태");
    expect(dryrun).not.toContain("원문 리포트");
  });
});
