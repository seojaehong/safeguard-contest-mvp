"use client";

import { useEffect, useState } from "react";
import { CitationList } from "@/components/CitationList";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { WorkpackEditor } from "@/components/WorkpackEditor";
import { CURRENT_WORKPACK_STORAGE_KEY, parseStoredCurrentWorkpack } from "@/lib/current-workpack";
import type { AskResponse } from "@/lib/types";
import {
  buildDefaultWorkers,
  buildEducationRecordDrafts,
  buildRecipientSuggestions,
  buildWorkerDispatchTargets,
  maskPhone,
  summarizeWorkers
} from "@/lib/workspace";

type CurrentWorkpackState = {
  data: AskResponse;
  isCurrent: boolean;
  savedAt: string | null;
};

function useCurrentWorkpack(sample: AskResponse): CurrentWorkpackState {
  const [state, setState] = useState<CurrentWorkpackState>({
    data: sample,
    isCurrent: false,
    savedAt: null
  });

  useEffect(() => {
    const stored = parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY));
    if (stored) {
      setState({
        data: stored.data,
        isCurrent: true,
        savedAt: stored.savedAt
      });
    }
  }, []);

  return state;
}

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) return "";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function CurrentWorkpackBanner({ isCurrent, savedAt }: { isCurrent: boolean; savedAt: string | null }) {
  return (
    <section className={`safeclaw-current-workpack ${isCurrent ? "live" : "sample"}`} aria-live="polite">
      <span>{isCurrent ? "현재 작업 연결" : "샘플 작업 표시"}</span>
      <strong>
        {isCurrent
          ? `작업공간에서 생성한 최신 문서팩을 사용합니다${formatSavedAt(savedAt) ? ` · ${formatSavedAt(savedAt)}` : ""}.`
          : "아직 생성된 문서팩이 없어 제품 예시 데이터로 화면을 보여줍니다."}
      </strong>
      <a href="/workspace">작업공간에서 새로 생성</a>
    </section>
  );
}

export function CurrentDocumentsModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <WorkpackEditor data={current.data} />
    </>
  );
}

export function CurrentEvidenceModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const koshaReferences = current.data.externalData.kosha.references.slice(0, 3);
  const accidentCases = current.data.externalData.accidentCases.cases.slice(0, 3);

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>문서 반영 근거</span>
          <h2>KOSHA·재해사례</h2>
          <div className="safeclaw-module-list">
            {koshaReferences.length ? koshaReferences.map((item) => (
              <a key={item.title} href={item.url} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </a>
            )) : (
              <a href="/knowledge">KOSHA 공식자료는 지식 DB와 작업공간 근거 패널에서 확인합니다.</a>
            )}
            {accidentCases.map((item) => (
              <a key={item.title} href={item.sourceUrl || "/knowledge"} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.preventionPoint}</small>
              </a>
            ))}
          </div>
        </article>
        <CitationList citations={current.data.citations} question={current.data.question} />
      </section>
    </>
  );
}

export function CurrentWorkersModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = buildDefaultWorkers(current.data);
  const records = buildEducationRecordDrafts(workers, current.data.scenario.workSummary);
  const summary = summarizeWorkers(workers);

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid four">
        <article><span>선택</span><strong>{summary.selectedCount}명</strong></article>
        <article><span>외국인</span><strong>{summary.foreignCount}명</strong></article>
        <article><span>신규</span><strong>{summary.newCount}명</strong></article>
        <article><span>교육 확인</span><strong>{summary.educationPendingCount ? "필요" : "완료"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>작업 투입 적합성 카드</span>
        <h2>최소정보만 표시합니다.</h2>
        <div className="safeclaw-worker-table">
          {workers.map((worker) => {
            const record = records.find((item) => item.workerId === worker.id);
            return (
              <article key={worker.id}>
                <strong>{worker.displayName}</strong>
                <p>{worker.role} · {worker.nationality} · {worker.languageLabel}</p>
                <small>{worker.phone ? `문자 가능 ${maskPhone(worker.phone)}` : "연락처 필요"} · {record?.memo || worker.trainingSummary}</small>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function CurrentDispatchModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = buildDefaultWorkers(current.data);

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid two">
        <WorkflowSharePanel
          data={current.data}
          recipientSuggestions={buildRecipientSuggestions(workers)}
          targetWorkers={buildWorkerDispatchTargets(workers)}
        />
        <article className="safeclaw-module-panel">
          <span>제출 기준 채널</span>
          <h2>메일·문자 우선.</h2>
          <p>전송 전 수신자, 채널, 언어, 메시지 미리보기를 확인한 뒤 provider 결과를 채널별로 표시합니다.</p>
          <ul>
            <li>메일: 관리자·원청 보고</li>
            <li>문자: 작업자 즉시 공지</li>
            <li>카카오·밴드: 승인 후 연결</li>
          </ul>
        </article>
      </section>
    </>
  );
}
