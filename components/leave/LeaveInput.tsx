"use client";

import { useMemo, useState } from "react";

import { compareRow } from "@/lib/annual-leave";
import { downloadXlsx } from "@/lib/leave-xlsx";
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
  /** 대장에 적힌 일수. null = 칸이 비어 있음, NaN 대신 recordedInvalid 로 구분 */
  recordedDays: number | null;
  /** 숫자가 아닌 값이 적혀 있었다 (예: "미확인") — 0 으로 바꾸지 않는다 */
  recordedRaw?: string;
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
      // 대장값: 비어 있으면 null, 숫자면 숫자, 그 밖('미확인' 등)이면 원문을 남긴다.
      // 숫자만 뽑아내면 "미확인"이 0 이 되어 「확인 안 한 값」이 「0일」로 둔갑한다.
      const rawRecorded = cols[2];
      let recordedDays: number | null = null;
      let recordedRaw: string | undefined;
      if (rawRecorded !== undefined && rawRecorded !== "") {
        const cleaned = rawRecorded.replace(/일|days?/gi, "").trim();
        const n = Number(cleaned);
        if (cleaned !== "" && Number.isFinite(n)) {
          recordedDays = n;
        } else {
          recordedRaw = rawRecorded;
        }
      }
      return { name, hireDate, recordedDays, recordedRaw, raw: line };
    });
}

/**
 * 오늘 날짜 — **현지 시각 기준**.
 * toISOString() 은 UTC 라서 KST 오전 9시 이전에는 하루 전 날짜가 나온다.
 * 연차 발생일 당일에는 결과가 달라지므로 반드시 현지 날짜를 쓴다.
 */
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  /**
   * 엑셀 업로드 — **브라우저에서만 읽는다.** 파일을 서버로 보내지 않는다.
   * exceljs 를 동적 import 해서 첫 화면 용량에 영향을 주지 않는다.
   */
  async function handleFile(file: File) {
    setReading(true);
    setFileNote(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) {
        setFileNote("시트를 찾지 못했습니다.");
        return;
      }
      // ★ 빈 셀을 건너뛰면 **열 위치가 당겨진다**(B열이 비면 C열 값이 B로 올라온다).
      //   includeEmpty:true 로 자리를 지키고, 셀 값이 없으면 빈 문자열을 넣는다.
      const cellText = (v: unknown): string => {
        if (v == null) return "";
        if (v instanceof Date) {
          // 엑셀 날짜는 현지 기준으로 보이므로 현지 날짜로 뽑는다
          const y = v.getFullYear();
          const m = String(v.getMonth() + 1).padStart(2, "0");
          const d = String(v.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        if (typeof v === "object") {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          if (o.result !== undefined) return String(o.result ?? "");
          if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("");
          if (o.text !== undefined) return String(o.text ?? "");
        }
        return String(v);
      };

      const lines: string[] = [];
      ws.eachRow((row) => {
        const cells: string[] = [];
        const last = row.cellCount;
        for (let c = 1; c <= last; c += 1) {
          cells.push(cellText(row.getCell(c).value).trim());
        }
        // 줄 전체가 비었으면 건너뛴다. 중간 빈칸은 살린다.
        if (cells.some((c) => c !== "")) lines.push(cells.join("\t"));
      });

      if (!lines.length) {
        setFileNote("읽을 수 있는 행이 없습니다. 이름과 입사일 열이 있는지 확인해주세요.");
        return;
      }

      // 헤더 판정 — 첫 줄의 둘째 칸이 날짜가 아니고, **둘째 줄은 날짜일 때만** 헤더로 본다.
      //   첫 직원의 날짜 오타 때문에 그 사람이 통째로 사라지는 일을 막는다.
      const secondCol = (l: string) => (l.split("\t")[1] ?? "").trim();
      const looksHeader =
        lines.length > 1 &&
        !normalizeDate(secondCol(lines[0])) &&
        Boolean(normalizeDate(secondCol(lines[1])));
      const body = looksHeader ? lines.slice(1) : lines;

      setText(body.join("\n"));
      setFileNote(
        `${file.name} — ${body.length}행을 읽었습니다${looksHeader ? " (첫 줄은 제목으로 보고 제외)" : ""}. ` +
          "아래에서 확인하고 고치실 수 있습니다."
      );
    } catch {
      setFileNote("이 파일은 읽지 못했습니다. xlsx 형식인지 확인하시거나 내용을 붙여넣어 주세요.");
    } finally {
      setReading(false);
    }
  }

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

  // ★ compareRow 는 계산 실패 시 verdict "error" 를 돌려준다.
  //   그것을 "diff 가 아니면 일치" 로 처리하면 **틀린 답을 맞다고 표시**한다.
  //   (기준일보다 미래 입사 등) → 반드시 따로 센다.
  const ok = results.filter((x) => x.result && x.result.verdict !== "error");
  const usable = ok;
  const withRecorded = ok.filter((x) => x.row.recordedDays !== null);
  const diffs = withRecorded.filter((x) => x.result!.verdict === "diff");
  const problems = results.filter((x) => !x.result || x.result.verdict === "error");

  return (
    <section className="lv-input">
      <div className="lv-input__privacy">
        🔒 붙여넣은 내용도, 여신 엑셀 파일도 <strong>이 브라우저에서만</strong> 처리됩니다.
        서버로 전송하지 않고 저장하지도 않습니다.
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
        <label className="lv-input__btn lv-input__file">
          {reading ? "읽는 중…" : "엑셀 파일 열기"}
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="lv-input__btn is-ghost" onClick={() => setText(SAMPLE)}>
          예시 채우기
        </button>
        {text && (
          <button type="button" className="lv-input__btn is-ghost" onClick={() => setText("")}>
            지우기
          </button>
        )}
      </div>

      {fileNote && <p className="lv-input__filenote">{fileNote}</p>}

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
            {problems.length > 0 && (
              <span className="is-diff">계산 불가 {problems.length}줄</span>
            )}
          </div>

          <div className="lv-table">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>입사일</th>
                  <th className="num">부여일수</th>
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
                  if (res.verdict === "error") {
                    return (
                      <tr key={i} data-diff="true">
                        <td data-label="이름">{r.name}</td>
                        <td data-label="입사일">{r.hireDate}</td>
                        <td className="num" data-label="부여일수">—</td>
                        <td className="num" data-label="대장">
                          {r.recordedDays ?? r.recordedRaw ?? "—"}
                        </td>
                        <td data-label="판정">
                          <StatusBadge status="unknown" />
                        </td>
                        <td className="basis" data-label="근거">
                          {res.errorMessage ?? "계산할 수 없습니다"}
                        </td>
                      </tr>
                    );
                  }
                  const hasRecorded = r.recordedDays !== null;
                  return (
                    <tr key={i} data-diff={hasRecorded && res.verdict === "diff" ? "true" : undefined}>
                      <td data-label="이름">{r.name}</td>
                      <td data-label="입사일">{r.hireDate}</td>
                      <td className="num" data-label="부여일수">
                        <strong>{res.calculatedDays}</strong>
                      </td>
                      <td className="num" data-label="대장">
                        {hasRecorded ? r.recordedDays : (r.recordedRaw ?? "—")}
                      </td>
                      <td data-label="판정">
                        {hasRecorded ? (
                          <StatusBadge status={res.verdict === "diff" ? "diff" : "match"} />
                        ) : r.recordedRaw ? (
                          <StatusBadge status="unknown" />
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
              className="lv-input__btn"
              onClick={() => {
                void downloadXlsx(`연차계산_${asOf}`, [
                  {
                    name: "연차 계산",
                    title: "연차 발생일수 계산 결과",
                    subtitle: `기준일 ${asOf} · 입사일 기준 · 근로기준법 제60조`,
                    header: ["이름", "입사일", "발생일수", "대장 기재", "차이", "판정", "적용 근거"],
                    widths: [14, 13, 10, 10, 8, 13, 46],
                    rows: results.map(({ row, result }) =>
                      !result
                        ? [row.name || "", row.hireDate || "", "", "", "", "읽지 못함", row.error ?? ""]
                        : [
                            row.name,
                            row.hireDate,
                            result.calculatedDays,
                            row.recordedDays ?? "",
                            row.recordedDays !== null ? result.diff : "",
                            row.recordedDays === null
                              ? "대장값 없음"
                              : result.verdict === "diff"
                                ? "차이 있음"
                                : "일치",
                            result.basisLabel,
                          ]
                    ),
                    emphasizeRows: results
                      .map((x, i) =>
                        x.result && x.row.recordedDays !== null && x.result.verdict === "diff"
                          ? i
                          : -1
                      )
                      .filter((i) => i >= 0),
                    notes: [
                      "· 상시 5인 이상 사업장, 1주 소정근로시간 15시간 이상 근로자를 전제로 한 참고 계산입니다.",
                      "· 입사일 기준 「발생일수」입니다. 이월·사용분을 뺀 잔여일수와는 다릅니다.",
                      "· 출근율 80% 미만 구간, 육아휴직 등 특수 출결은 조건이 달라집니다.",
                      "· 회계연도로 운영하는 사업장의 퇴직 정산은 별도 화면에서 계산합니다.",
                      "· 개별 사안의 최종 판단은 담당 공인노무사의 검토를 거치시기 바랍니다.",
                    ],
                  },
                ]);
              }}
            >
              엑셀 내려받기
            </button>
          </div>

          <p className="lv-input__note">
            표시되는 값은 <strong>기준일이 속한 연차년도에 부여되는 일수</strong>입니다(입사일
            기준). 입사 이후 <strong>누적 발생량이 아닙니다</strong> — 대장과 비교하실 때는 같은
            기간·같은 기준인지 확인해 주세요.
            <br />
            1년 미만은 <strong>1개월 개근 시 1일</strong>, 1년 이상 15일은{" "}
            <strong>직전 1년 출근율 80% 이상</strong>을 전제로 합니다. 상시 5인 이상 사업장,
            1주 소정근로시간 15시간 이상 근로자가 대상입니다.
            <br />
            이월·사용분을 뺀 잔여일수, 출근율 80% 미만 구간, 회계연도 운영 사업장은 조건이
            달라집니다. 육아휴직 기간은 법정 출근 간주기간이므로 단순 결근과 다릅니다.
          </p>
        </>
      )}
    </section>
  );
}
