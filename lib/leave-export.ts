/**
 * 연차 계산 결과 → 내보내기 행(엑셀 복사 · xlsx 공용).
 *
 * ★ 2026-10-25 (런칭 점검 LV-1) — 복사 문구와 xlsx 가 판정 칸을
 *   `verdict === "diff" ? "차이 있음" : "일치"` 로만 나눠, 계산하지 못한 줄
 *   (입사일이 기준일보다 늦은 줄 등)이 「일치」와 「NaN」으로 나갔다. 화면은
 *   「확인 불가」였다. 두 출력이 같은 함수를 쓰게 해 화면과 맞춘다.
 *   (일의 무늬 labor-law-guide `src/lib/leave/leave-export.ts` 의 leaveExportRow 와 같은 구조)
 */
import type { ComparisonRow } from "./annual-leave.ts";
import type { ParsedRow } from "./leave-sheet.ts";

export type LeaveResultRow = { row: ParsedRow; result: ComparisonRow | null };

/** 계산 실패 — 실패는 절대 「일치」로 내보내지 않는다 */
export function isLeaveCalculationError(result: ComparisonRow | null): boolean {
  return (
    !result ||
    result.verdict === "error" ||
    !Number.isFinite(result.calculatedDays) ||
    !Number.isFinite(result.diff)
  );
}

/** [이름, 입사일, 발생일수, 대장 기재, 차이, 판정, 적용 근거] */
export function leaveExportRow({ row, result }: LeaveResultRow): (string | number)[] {
  // 대장에 적힌 원문을 보존한다 — 「미확인」을 「대장값 없음」으로 바꿔 쓰면
  // 원본을 왜곡한 파일이 사무소 안을 돈다.
  const recorded =
    row.recordedDays !== null && Number.isFinite(row.recordedDays)
      ? row.recordedDays
      : row.recordedRaw ?? "";
  if (!result) {
    return [row.name || "", row.hireDate || "", "", "", "", "읽지 못함", row.error ?? ""];
  }
  if (isLeaveCalculationError(result)) {
    return [
      row.name,
      row.hireDate,
      "",
      recorded,
      "",
      "확인 불가",
      result.errorMessage || row.error || "계산 결과를 확인할 수 없습니다",
    ];
  }
  const hasRec = row.recordedDays !== null;
  return [
    row.name,
    row.hireDate,
    result.calculatedDays,
    recorded,
    hasRec ? result.diff : "",
    hasRec
      ? result.verdict === "diff"
        ? "차이 있음"
        : "일치"
      : row.recordedRaw
        ? "대조 못 함(숫자 아님)"
        : "대장값 없음",
    result.basisLabel,
  ];
}

/** 엑셀 복사 문구(쉼표 구분, 따옴표 감쌈) — 기준일 칸을 셋째에 넣는다 */
export function leaveCsv(rows: LeaveResultRow[], asOf: string): string {
  const head = ["이름", "입사일", "기준일", "발생일수", "대장기재", "차이", "판정", "적용근거"];
  const lines = rows.map((item) => {
    const cells = leaveExportRow(item);
    return [...cells.slice(0, 2), asOf, ...cells.slice(2)];
  });
  return [head, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}
