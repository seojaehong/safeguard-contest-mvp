import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { groupSubmissionPreviewRows } from "@/components/workpack-editor-structure";

describe("workpack submission preview completeness", () => {
  it("preserves every section and row passed to the preview", () => {
    const rows = Array.from({ length: 4 }, (_, sectionIndex) => (
      Array.from({ length: 5 }, (_, rowIndex) => ({
        document: "작업계획서",
        section: `검토 섹션 ${sectionIndex + 1}`,
        item: `검토 항목 ${sectionIndex + 1}-${rowIndex + 1}`,
        content: `PREVIEW_SENTINEL_${sectionIndex + 1}_${rowIndex + 1}`,
      }))
    )).flat();
    const groups = groupSubmissionPreviewRows(rows);

    expect(groups).toHaveLength(4);
    expect(groups.flatMap((group) => group.rows)).toEqual(rows);
    expect(groups[3]?.rows[4]?.content).toBe("PREVIEW_SENTINEL_4_5");
  });

  it("mounts the complete preview only after the disclosure is opened", async () => {
    const source = await readFile("components/WorkpackEditor.tsx", "utf8");
    expect(source).toContain("submissionPreviewOpen ? (");
    expect(source).toContain("onToggle={(event) => setSubmissionPreviewOpen(event.currentTarget.open)}");
  });

  it("escapes every TBM daily-risk cell before composing HTML", async () => {
    const source = await readFile("components/WorkpackEditor.tsx", "utf8");
    expect(source).toMatch(
      /agendaRows\s*\.slice\(0, 3\)\s*\.map\(\(row\) => escapeHtml\(compactContent\(row, "금일 위험요인"\)\)\)\s*\.join\("<br \/>"\)/u
    );
    expect(source).not.toContain(
      'agendaRows.slice(0, 3).map((row) => compactContent(row, "금일 위험요인")).join("<br />")'
    );
  });
});
