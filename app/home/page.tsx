"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import {
  CURRENT_WORKPACK_STORAGE_KEY,
  parseStoredCurrentWorkpack,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";

function formatSavedAt(value: string | undefined) {
  if (!value) return "아직 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 필요";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function readDocumentCount(workpack: StoredCurrentWorkpack | null) {
  if (!workpack) return "대기";
  return `${Object.keys(workpack.data.deliverables).length}종`;
}

function readWorkerStatus(workpack: StoredCurrentWorkpack | null) {
  const workers = workpack?.workerSnapshot?.workers || [];
  if (!workers.length) return "명단 대기";
  const selectedCount = workpack?.workerSnapshot?.selectedWorkerIds.length || 0;
  return `${workers.length}명 · 선택 ${selectedCount}명`;
}

function readDispatchStatus(workpack: StoredCurrentWorkpack | null) {
  const dispatch = workpack?.dispatchSnapshot;
  if (!dispatch) return "전파 대기";
  return `${dispatch.recipientSuggestions.length}개 수신자 · ${dispatch.targetWorkers.length}명`;
}

export default function ProductHomePage() {
  const [workpack, setWorkpack] = useState<StoredCurrentWorkpack | null>(null);

  useEffect(() => {
    setWorkpack(parseStoredCurrentWorkpack(window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY)));
  }, []);

  const siteName = workpack?.data.scenario.siteName || "첫 작업을 생성하세요";
  const topRisk = workpack?.data.riskSummary.topRisk || "작업 입력 후 위험요인, 기상 신호, 문서팩 상태가 홈에 표시됩니다.";
  const weather = workpack?.data.externalData.weather?.summary || "작업 생성 후 현재 기상 신호를 반영합니다.";

  return (
    <SafeClawModuleShell
      eyebrow="대시보드"
      title="오늘 작업 현황."
      description="최근 문서팩, 교육 확인, 전파 준비, API 근거 상태를 현장 단위로 다시 열 수 있는 운영 홈입니다."
      status={workpack ? "live" : "partial"}
      mappedTo="오늘 작업 · 문서팩 · 교육 확인 · 전파 결과"
      activeHref="/home"
      actions={<Link href="/workspace">오늘 작업 생성</Link>}
    >
      <section className="safeclaw-current-workpack live" aria-live="polite">
        <span>{workpack ? "최근 작업 연결" : "작업 대기"}</span>
        <strong>{siteName}</strong>
        <Link href={workpack ? "/documents" : "/workspace"}>{workpack ? "문서팩 다시 열기" : "첫 작업 생성"}</Link>
      </section>

      <section className="safeclaw-module-grid four">
        <article>
          <span>마지막 작성</span>
          <strong>{formatSavedAt(workpack?.savedAt)}</strong>
          <p>브라우저 최근 작업 기준입니다. 로그인 후에는 서버 이력과 함께 표시됩니다.</p>
        </article>
        <article>
          <span>문서팩</span>
          <strong>{readDocumentCount(workpack)}</strong>
          <p>위험성평가표, 작업계획서, TBM, 교육기록을 문서팩에서 이어서 편집합니다.</p>
        </article>
        <article>
          <span>작업자·교육</span>
          <strong>{readWorkerStatus(workpack)}</strong>
          <p>작업자 명단과 교육 상태는 전파 언어와 안전교육 기록에 연결됩니다.</p>
        </article>
        <article>
          <span>현장 전파</span>
          <strong>{readDispatchStatus(workpack)}</strong>
          <p>메일·문자 전파 준비 상태와 최근 전파 로그를 확인합니다.</p>
        </article>
      </section>

      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>핵심 위험</span>
          <h2>{topRisk}</h2>
          <p>{weather}</p>
          <div className="safeclaw-module-actions">
            <Link href="/evidence">근거 확인</Link>
            <Link href="/documents">문서 편집</Link>
          </div>
        </article>
        <article className="safeclaw-module-panel">
          <span>다음 작업</span>
          <h2>{workpack ? "저장·전파·이력까지 이어서 닫습니다." : "한 줄 작업 입력으로 문서팩을 시작합니다."}</h2>
          <p>
            홈은 빈 대시보드가 아니라 최근 작업을 다시 여는 입구입니다.
            저장된 이력은 아카이브에서, 현장 전파는 전파 화면에서 이어갑니다.
          </p>
          <div className="safeclaw-module-actions">
            <Link href="/archive">이력 보기</Link>
            <Link href="/dispatch">전파 준비</Link>
          </div>
        </article>
      </section>
    </SafeClawModuleShell>
  );
}
