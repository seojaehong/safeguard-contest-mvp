"use client";

import { useEffect, useState } from "react";
import { CitationList } from "@/components/CitationList";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { WorkpackEditor, type DocumentKey } from "@/components/WorkpackEditor";
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

type LaunchDocument = {
  key: DocumentKey;
  title: string;
  tier: "핵심" | "제출" | "보조";
  owner: string;
  description: string;
};

const launchDocuments: LaunchDocument[] = [
  {
    key: "riskAssessmentDraft",
    title: "위험성평가표",
    tier: "핵심",
    owner: "작업 전 판단",
    description: "4M 위험요인과 감소대책을 먼저 확인합니다."
  },
  {
    key: "tbmBriefing",
    title: "TBM 브리핑",
    tier: "핵심",
    owner: "작업반장",
    description: "작업 전 읽고 확인 질문으로 전환합니다."
  },
  {
    key: "foreignWorkerTransmission",
    title: "외국인 전송본",
    tier: "핵심",
    owner: "현장 전파",
    description: "언어별 짧은 공지와 관리자 확인 문구를 씁니다."
  },
  {
    key: "workPlanDraft",
    title: "작업계획서",
    tier: "제출",
    owner: "관리감독자",
    description: "작업순서, 중지기준, 확인 근거를 묶습니다."
  },
  {
    key: "safetyEducationRecordDraft",
    title: "안전보건교육 기록",
    tier: "제출",
    owner: "교육 확인",
    description: "교육대상, 내용, 확인방법을 남깁니다."
  },
  {
    key: "tbmLogDraft",
    title: "TBM 기록",
    tier: "제출",
    owner: "기록 보관",
    description: "참석자, 보호구, 미조치 위험요인을 확인합니다."
  },
  {
    key: "workpackSummaryDraft",
    title: "점검결과 요약",
    tier: "보조",
    owner: "보고 요약",
    description: "오늘 문서팩의 핵심 판단을 한 장으로 압축합니다."
  },
  {
    key: "emergencyResponseDraft",
    title: "비상대응 절차",
    tier: "보조",
    owner: "사고 대응",
    description: "중지, 초기조치, 보고체계를 정리합니다."
  },
  {
    key: "photoEvidenceDraft",
    title: "사진·증빙",
    tier: "보조",
    owner: "증빙 보관",
    description: "촬영자, 확인자, 보관 위치를 남깁니다."
  }
];

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

function excerpt(text: string, maxLength = 190) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function countDocuments(data: AskResponse) {
  return Object.values(data.deliverables).filter((value) => typeof value === "string" && value.trim()).length;
}

function countEvidence(data: AskResponse) {
  const kosha = data.externalData.kosha.references.length;
  const accident = data.externalData.accidentCases.cases.length;
  const openApi = data.externalData.koshaOpenApi?.references.length || 0;
  const knowledge = data.externalData.safetyKnowledge?.matches.length || 0;
  return data.citations.length + kosha + accident + openApi + knowledge;
}

function DocumentCockpit({ data, onSelectDocument }: { data: AskResponse; onSelectDocument: (key: DocumentKey) => void }) {
  const primaryDocuments = launchDocuments.filter((item) => item.tier === "핵심");

  return (
    <section className="safeclaw-document-cockpit" aria-label="문서팩 운영 요약">
      <aside className="safeclaw-doc-index">
        <span>문서 인덱스</span>
        <h2>3종 핵심. 6종 제출.</h2>
        <div className="safeclaw-doc-index-list">
          {launchDocuments.map((item, index) => (
            <button key={item.key} type="button" onClick={() => onSelectDocument(item.key)}>
              <small>{String(index + 1).padStart(2, "0")} · {item.tier}</small>
              <strong>{item.title}</strong>
              <em>{item.owner}</em>
            </button>
          ))}
        </div>
      </aside>

      <article className="safeclaw-doc-primary">
        <span>오늘 먼저 볼 문서</span>
        <h2>{data.scenario.siteName}</h2>
        <p>{data.scenario.workSummary}</p>
        <div className="safeclaw-doc-primary-grid">
          {primaryDocuments.map((item) => (
            <section key={item.key}>
              <small>{item.owner}</small>
              <strong>{item.title}</strong>
              <p>{excerpt(data.deliverables[item.key])}</p>
            </section>
          ))}
        </div>
      </article>

      <aside className="safeclaw-doc-export">
        <span>제출 준비</span>
        <h2>{countDocuments(data)}종 작성.</h2>
        <dl>
          <div>
            <dt>위험도</dt>
            <dd>{data.riskSummary.riskLevel}</dd>
          </div>
          <div>
            <dt>근거 연결</dt>
            <dd>{countEvidence(data)}건</dd>
          </div>
          <div>
            <dt>정식 출력</dt>
            <dd>PDF · XLS · HWPX</dd>
          </div>
        </dl>
        <a href="/evidence">문서 반영 근거 확인</a>
        <a href="/dispatch">메일·문자 전파로 이동</a>
      </aside>
    </section>
  );
}

export function CurrentDocumentsModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const [focusToken, setFocusToken] = useState(0);
  const [requestedDocumentKey, setRequestedDocumentKey] = useState<DocumentKey | undefined>();

  function selectDocument(key: DocumentKey) {
    setRequestedDocumentKey(key);
    setFocusToken((value) => value + 1);
  }

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <DocumentCockpit data={current.data} onSelectDocument={selectDocument} />
      <WorkpackEditor data={current.data} focusToken={focusToken} requestedDocumentKey={requestedDocumentKey} />
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

export function CurrentArchiveModule({ sample }: { sample: AskResponse }) {
  const current = useCurrentWorkpack(sample);
  const workers = buildDefaultWorkers(current.data);
  const dispatchTargets = buildWorkerDispatchTargets(workers);
  const savedLabel = current.isCurrent ? formatSavedAt(current.savedAt) : "샘플";

  return (
    <>
      <CurrentWorkpackBanner isCurrent={current.isCurrent} savedAt={current.savedAt} />
      <section className="safeclaw-module-grid four">
        <article><span>문서팩</span><strong>{countDocuments(current.data)}종</strong></article>
        <article><span>근거</span><strong>{countEvidence(current.data)}건</strong></article>
        <article><span>전파 대상</span><strong>{dispatchTargets.length}명</strong></article>
        <article><span>저장 시각</span><strong>{savedLabel || "대기"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>최근 작업 스냅샷</span>
        <h2>{current.data.scenario.siteName}</h2>
        <p>{current.data.riskSummary.topRisk}</p>
        <div className="safeclaw-archive-list">
          <article>
            <strong>문서팩 열기</strong>
            <code>/documents</code>
            <p>최신 작업의 편집, 정식 출력, 보완 제안을 이어서 처리합니다.</p>
          </article>
          <article>
            <strong>근거 확인</strong>
            <code>/evidence</code>
            <p>법령, KOSHA, 재해사례, 지식 DB 근거가 문서에 어떻게 반영됐는지 확인합니다.</p>
          </article>
          <article>
            <strong>전파 로그</strong>
            <code>/dispatch</code>
            <p>메일·문자 요청 결과와 준비 중 채널을 구분해 확인합니다.</p>
          </article>
        </div>
      </section>
    </>
  );
}
