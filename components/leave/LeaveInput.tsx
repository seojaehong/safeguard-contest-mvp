"use client";

import { useMemo, useState } from "react";

import { compareRow } from "@/lib/annual-leave";
import { StatusBadge } from "@/components/leave/LeaveUI";

/**
 * 연차 대장 직접 입력 — **브라우저에서만 계산한다.**
 *
 * 🔒 서버로 아무것도 보내지 않는다.
 *    엑셀·이미지·PDF 를 서버에 올리면 고객사 직원정보가 외부로 나간다.
 *    붙여넣은 글자는 이 페이지를 벗어나지 않으며, 새로고침하면 사라진다.
 *
 * 받는 것: 이름 · 입사일 (+ 대장에 적힌 연차일수가 있으면 대조까지)
 * 구분자: 탭 / 쉼표 / 여러 칸 공백 — 엑셀에서 복사하면 탭으로 들어온다.
 */

type ParsedRow = {
  name: string;
  hireDate: string;
  recordedDays: number | null;
  raw: string;
  error?: string;
};

const SAMPLE = `홍길동\t2019-03-02\t18
김영희\t2026-03-16\t15
박철수\t2024-01-08\t16`;

/** 2026-03-02 · 2026.3.2 · 20260302 · 2026/3/2 를 모두 받는다 */
function normalizeDate(text: string): string | null {
  const t = text.trim();
  let m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const yy = Number(y), mm = Number(mo), dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCDate() !== dd) return null;
  return iso;
}

function parseLines(text: string): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\t|,|\s{2,}/).map((c) => c.trim()).filter(Boolean);
      if (cols.length < 2) {
        return { name: cols[0] ?? "", hireDate: "", recordedDays: null, raw: line,
                 error: "이름과 입사일이 필요합니다" };
      }
      const name = cols[0];
      const hireDate = normalizeDate(cols[1]);
      if (!hireDate) {
        return { name, hireDate: "", recordedDays: null, raw: line,
                 error: `입사일을 읽을 수 없습니다: ${cols[1]}` };
      }
      const recorded = cols[2] !== undefined ? Number(cols[2].replace(/[^\d.-]/g, "")) : NaN;
      return {
        name,
        hireDate,
        recordedDays: Number.isFinite(recorded) ? recorded : null,
        raw: line,
      };
    });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(
  rows: { row: ParsedRow; result: ReturnType<typeof compareRow> | null }[],
  asOf: string
): string {
  const head = ["이름", "입사일", "기준일", "발생일수", "대장기재", "차이", "판정", "적용근거"];
  const lines = rows.map(({ row, result }) => {
    if (!result) return [row.name, row.hireDate, asOf, "", "", "", "읽지 못함", row.error ?? ""];
    const hasRec = row.recordedDays !== null;
    return [
      row.name,
      row.hireDate,
      asOf,
      String(result.calculatedDays),
      hasRec ? String(row.recordedDays) : "",
      hasRec ? String(result.diff) : "",
      hasRec ? (result.verdict === "diff" ? "차이 있음" : "일치") : "대장값 없음",
      result.basisLabel,
    ];
  });
  return [head, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function LeaveInput() {
  const [text, setText] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => parseLines(text), [text]);
  const results = useMemo(
    () =>
      rows.map((r) => {
        if (r.error || !r.hireDate) return { row: r, result: null };
        try {
          const cmp = compareRow(
            { name: r.name, hireDate: r.hireDate, recordedDays: r.recordedDays ?? 0 },
            asOf
          );
          return { row: r, result: cmp };
        } catch (e) {
          return {
            row: { ...r, error: e instanceof Error ? e.message : "계산할 수 없습니다" },
            result: null,
          };
        }
      }),
    [rows, asOf]
  );

  const usable = results.filter((x) => x.result);
  const withRecorded = usable.filter((x) => x.row.recordedDays !== null);
  const diffs = withRecorded.filter((x) => x.result!.verdict === "diff");
  const problems = results.filter((x) => !x.result);

  return (
    <section className="lv-input">
      <div className="lv-input__privacy">
        🔒 입력한 내용은 <strong>이 브라우저에서만 계산</strong>되며 서버로 전송되지 않습니다.
      </div>

      <div className="lv-input__controls">
        <label className="lv-input__field">
          <span>기준일</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value || today())}
          />
        </label>
        <button type="button" className="lv-input__btn" onClick={() => setText(SAMPLE)}>
          예시 채우기
        </button>
        {text && (
          <button type="button" className="lv-input__btn is-ghost" onClick={() => setText("")}>
            지우기
          </button>
        )}
      </div>

      <textarea
        className="lv-input__area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={"이름\t입사일\t연차일수(선택)\n홍길동\t2019-03-02\t18"}
        aria-label="이름과 입사일 붙여넣기"
      />

      {results.length > 0 && (
        <>
          <div className="lv-input__summary">
            <span>{usable.length}명 계산</span>
            {withRecorded.length > 0 && (
              <span className={diffs.length ? "is-diff" : undefined}>
                차이 {diffs.length}명
              </span>
            )}
            {problems.length > 0 && <span className="is-diff">읽지 못함 {problems.length}줄</span>}
          </div>

          <div className="lv-table">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>입사일</th>
                  <th className="num">발생일수</th>
                  <th className="num">대장</th>
                  <th>판정</th>
                  <th>적용 근거</th>
                </tr>
              </thead>
              <tbody>
                {results.map((x, i) => {
                  const r = x.row;
                  if (!x.result) {
                    return (
                      <tr key={i} data-diff="true">
                        <td data-label="이름">{r.name || "—"}</td>
                        <td data-label="입사일" colSpan={4}>
                          {r.error}
                        </td>
                        <td className="basis" data-label="원문">{r.raw}</td>
                      </tr>
                    );
                  }
                  const res = x.result;
                  const hasRecorded = r.recordedDays !== null;
                  return (
                    <tr key={i} data-diff={hasRecorded && res.verdict === "diff" ? "true" : undefined}>
                      <td data-label="이름">{r.name}</td>
                      <td data-label="입사일">{r.hireDate}</td>
                      <td className="num" data-label="발생일수">
                        <strong>{res.calculatedDays}</strong>
                      </td>
                      <td className="num" data-label="대장">
                        {hasRecorded ? r.recordedDays : "—"}
                      </td>
                      <td data-label="판정">
                        {hasRecorded ? (
                          <StatusBadge status={res.verdict === "diff" ? "diff" : "match"} />
                        ) : (
                          <span className="lv-input__muted">대장값 없음</span>
                        )}
                      </td>
                      <td className="basis" data-label="근거">{res.basisLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lv-input__export">
            <button
              type="button"
              className="lv-input__btn"
              onClick={async () => {
                const csv = toCsv(results, asOf);
                try {
                  await navigator.clipboard.writeText(csv.replace(/","/g, "\t").replace(/"/g, ""));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "복사했습니다" : "엑셀로 복사"}
            </button>
            <button
              type="button"
              className="lv-input__btn is-ghost"
              onClick={() => {
                const csv = "\uFEFF" + toCsv(results, asOf);
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv;charset=utf-8;" })
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `연차계산_${asOf}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              CSV 내려받기
            </button>
          </div>

          <p className="lv-input__note">
            입사일 기준 <strong>발생일수</strong>입니다. 이월·사용분을 뺀 잔여일수, 출근율 80%
            미만 구간, 회계연도 운영 사업장은 조건이 달라집니다.
          </p>
        </>
      )}
    </section>
  );
}
