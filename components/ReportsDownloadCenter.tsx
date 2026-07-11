"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildStoredCurrentWorkpack,
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  parseOperationImprovements,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import {
  buildReportCsv,
  buildReportJson,
  buildReportMarkdown,
  buildReportSnapshot,
  type ReportGroup,
  type ReportPeriod,
  type ReportSnapshot
} from "@/lib/reporting-downloads";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

const periodOptions: Array<{ value: ReportPeriod; label: string; detail: string }> = [
  { value: "daily", label: "오늘", detail: "당일" },
  { value: "weekly", label: "주간", detail: "이번 주" },
  { value: "monthly", label: "월간", detail: "이번 달" }
];

const evidenceLabelMap: Record<string, string> = {
  workpackSummaryDraft: "요약",
  riskAssessmentDraft: "위험성평가",
  workPlanDraft: "작업계획",
  tbmBriefing: "TBM",
  tbmLogDraft: "TBM 기록",
  safetyEducationRecordDraft: "교육기록",
  emergencyResponseDraft: "비상대응",
  photoEvidenceDraft: "사진증빙",
  foreignWorkerBriefing: "외국인 안내",
  foreignWorkerTransmission: "외국인 전송",
  kakaoMessage: "전파 메시지"
};

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function compactText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function shortPeriodLabel(period: ReportPeriod) {
  if (period === "daily") return "오늘";
  if (period === "weekly") return "주간";
  return "월간";
}

function shortReportTitle(snapshot: ReportSnapshot) {
  return `${compactText(snapshot.scenario.siteName, 14)} · ${shortPeriodLabel(snapshot.period)}`;
}

function shortEvidenceRef(ref: string) {
  return evidenceLabelMap[ref] || compactText(ref.replace(/Draft$/u, ""), 12);
}

function formatGroupMeta(group: ReportGroup) {
  return `위험 ${group.count} · 개선 ${group.improvementCount}`;
}

function readCurrentWorkpack(): { workpack: StoredCurrentWorkpack; sample: boolean } {
  const stored = parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
  if (stored) return { workpack: stored, sample: false };
  return { workpack: buildStoredCurrentWorkpack(buildSampleWorkpack()), sample: true };
}

function GroupList({ title, groups }: { title: string; groups: ReportGroup[] }) {
  return (
    <article className="safeclaw-report-group">
      <span>{title}</span>
      <div>
        {groups.length ? groups.slice(0, 5).map((group) => (
          <p key={group.label}>
            <strong>{compactText(group.label, 16)}</strong>
            <em>{formatGroupMeta(group)}</em>
          </p>
        )) : (
          <p>
            <strong>해당 항목 없음</strong>
            <em>연결 항목 없음</em>
          </p>
        )}
      </div>
    </article>
  );
}

function DownloadActions({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <div className="safeclaw-download-actions" aria-label="리포트 다운로드">
      <button
        type="button"
        className="button"
        onClick={() => downloadTextFile(
          `${snapshot.fileBaseName}.md`,
          buildReportMarkdown(snapshot),
          "text/markdown;charset=utf-8"
        )}
      >
        개선 리포트 MD
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => downloadTextFile(
          `${snapshot.fileBaseName}.csv`,
          buildReportCsv(snapshot),
          "text/csv;charset=utf-8"
        )}
      >
        분류 CSV
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => downloadTextFile(
          `${snapshot.fileBaseName}.json`,
          buildReportJson(snapshot),
          "application/json;charset=utf-8"
        )}
      >
        원본 JSON
      </button>
    </div>
  );
}

function EvidenceList({ refs }: { refs: string[] }) {
  return (
    <div className="safeclaw-workdoc-evidence">
      {refs.length ? refs.map((ref) => <code key={ref}>{shortEvidenceRef(ref)}</code>) : <code>현장 확인</code>}
    </div>
  );
}

export function ReportsDownloadCenter() {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [workpack, setWorkpack] = useState<StoredCurrentWorkpack | null>(null);
  const [improvements, setImprovements] = useState<OperationImprovement[]>([]);
  const [usingSample, setUsingSample] = useState(false);

  function loadLocalState() {
    const current = readCurrentWorkpack();
    setWorkpack(current.workpack);
    setUsingSample(current.sample);
    setImprovements(parseOperationImprovements(window.localStorage.getItem(OPERATION_IMPROVEMENTS_STORAGE_KEY)));
  }

  useEffect(() => {
    loadLocalState();
  }, []);

  const snapshot = useMemo(() => {
    if (!workpack) return null;
    return buildReportSnapshot({ workpack, improvements, period });
  }, [improvements, period, workpack]);
  const evidenceRefs = useMemo(
    () => snapshot ? Array.from(new Set(snapshot.riskRows.flatMap((row) => row.evidenceRefs))).filter(Boolean) : [],
    [snapshot]
  );

  if (!snapshot || !workpack) {
    return (
      <section className="safeclaw-module-panel workbench-empty-state">
        <span>리포트 준비</span>
        <h2>최근 작업팩을 확인하고 있습니다.</h2>
        <p>작업공간에서 문서팩을 만든 뒤 이 화면으로 돌아오면 개선사항과 위험성평가를 묶어 내려받을 수 있습니다.</p>
      </section>
    );
  }

  return (
    <>
      <section className={`safeclaw-current-workpack ${usingSample ? "sample" : "live"}`} aria-live="polite">
        <span>{usingSample ? "샘플 리포트" : "현재 작업 연결"}</span>
        <strong>
          {usingSample
            ? "샘플 데이터로 다운로드 흐름을 보여줍니다."
            : `${compactText(snapshot.scenario.siteName, 18)} · 개선 후보 ${snapshot.summary.improvements}건`}
        </strong>
        <button type="button" className="button secondary" onClick={loadLocalState}>다시 불러오기</button>
      </section>

      <section className="safeclaw-workdoc-shell">
        <article className="safeclaw-workdoc" aria-label="작업문서형 리포트">
          <header className="safeclaw-workdoc-header">
            <span>리포트</span>
            <h2>{shortReportTitle(snapshot)}</h2>
            <p>위험성평가와 개선사항을 한 문서에서 검토합니다. 외부 제출은 하지 않습니다.</p>
            <div className="safeclaw-workdoc-meta">
              <p><strong>현장</strong><span>{compactText(snapshot.scenario.siteName, 16)}</span></p>
              <p><strong>작업</strong><span>{compactText(snapshot.scenario.workSummary, 16)}</span></p>
              <p><strong>기간</strong><span>{shortPeriodLabel(snapshot.period)}</span></p>
              <p><strong>생성</strong><span>{formatDate(snapshot.generatedAt)}</span></p>
            </div>
          </header>

          <section className="safeclaw-workdoc-section">
            <div className="safeclaw-workdoc-section-head">
              <span>01</span>
              <h3>작업 기준</h3>
            </div>
            <div className="safeclaw-report-facts">
              <p><strong>회사</strong><span>{snapshot.scenario.companyName || "확인 필요"}</span></p>
              <p><strong>현장</strong><span>{snapshot.scenario.siteName}</span></p>
              <p><strong>작업</strong><span>{snapshot.scenario.workSummary}</span></p>
              <p><strong>인원</strong><span>{snapshot.scenario.workerCount}명</span></p>
              <p><strong>기상/조건</strong><span>{snapshot.scenario.weatherNote || "확인 필요"}</span></p>
            </div>
          </section>

          <section className="safeclaw-workdoc-section">
            <div className="safeclaw-workdoc-section-head">
              <span>02</span>
              <h3>위험 As-Is/To-Be</h3>
            </div>
            <div className="safeclaw-report-table" role="table" aria-label="위험성평가 리포트">
              <div role="row">
                <strong role="columnheader">작업</strong>
                <strong role="columnheader">위험</strong>
                <strong role="columnheader">현재</strong>
                <strong role="columnheader">개선</strong>
                <strong role="columnheader">근거</strong>
              </div>
              {snapshot.riskRows.map((row) => (
                <div key={`${row.index}-${row.hazard}`} role="row">
                  <span role="cell" data-label="작업">
                    {compactText(row.task, 18)}<em>{compactText(row.process, 12)} · {row.riskLevelLabel}</em>
                  </span>
                  <span role="cell" data-label="위험">{compactText(row.hazard, 24)}</span>
                  <span role="cell" data-label="현재">{compactText(row.currentControls, 34)}</span>
                  <span role="cell" data-label="개선">{compactText(row.additionalControls, 42)}</span>
                  <span role="cell" data-label="근거">{row.evidenceRefs.map(shortEvidenceRef).join(" · ")}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="safeclaw-workdoc-section">
            <div className="safeclaw-workdoc-section-head">
              <span>03</span>
              <h3>개선사항 후보</h3>
            </div>
            <div className="safeclaw-workdoc-list">
              {snapshot.improvements.length ? snapshot.improvements.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.hazardLabel}</strong>
                    <code>{item.sourceLabel} · {formatDate(item.createdAt)}</code>
                  </div>
                  <p><b>현재</b>{compactText(item.asIs, 44)}</p>
                  <p><b>개선</b>{compactText(item.toBe, 62)}</p>
                  <span>{item.reflectedDocuments.join(" · ") || "반영 문서 확인"}</span>
                </article>
              )) : (
                <article>
                  <div>
                    <strong>개선사항 후보 없음</strong>
                    <code>{snapshot.periodLabel}</code>
                  </div>
                  <p><b>다음</b>작업공간에서 사진이나 메모를 저장하면 표시됩니다.</p>
                  <Link href="/workspace">개선사항 저장하기</Link>
                </article>
              )}
            </div>
          </section>

          <section className="safeclaw-workdoc-section">
            <div className="safeclaw-workdoc-section-head">
              <span>04</span>
              <h3>리포트 메모</h3>
            </div>
            <div className="safeclaw-report-notes">
              {snapshot.notes.map((note) => <p key={note}>{note}</p>)}
            </div>
          </section>
        </article>

        <aside className="safeclaw-workdoc-rail" aria-label="작업문서 도구">
          <section>
            <span>기간</span>
            <div className="safeclaw-report-controls workbench-report-filters" aria-label="리포트 기간 선택">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={period === option.value ? "active" : ""}
                  onClick={() => setPeriod(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <span>다운로드</span>
            <DownloadActions snapshot={snapshot} />
          </section>

          <section>
            <span>요약</span>
            <div className="safeclaw-workdoc-stats">
              <p><strong>{snapshot.summary.riskRows}</strong><span>평가 행</span></p>
              <p><strong>{snapshot.summary.highRiskRows}</strong><span>고위험</span></p>
              <p><strong>{snapshot.summary.improvements}</strong><span>개선사항</span></p>
              <p><strong>{snapshot.summary.photoImprovements}</strong><span>사진 개선</span></p>
            </div>
          </section>

          <section>
            <span>근거</span>
            <EvidenceList refs={evidenceRefs} />
          </section>

          <section>
            <span>분류</span>
            <div className="safeclaw-report-groups">
              <GroupList title="공정별" groups={snapshot.groups.byProcess} />
              <GroupList title="작업별" groups={snapshot.groups.byTask} />
              <GroupList title="위험등급별" groups={snapshot.groups.byRiskLevel} />
              <GroupList title="문서반영별" groups={snapshot.groups.byDocument} />
            </div>
          </section>

          <section>
            <span>다음</span>
            <div className="safeclaw-workdoc-links">
              <Link href="/documents">문서팩 편집</Link>
              <Link href="/workspace">개선사항 추가</Link>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}
