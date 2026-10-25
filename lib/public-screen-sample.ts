// 공개 화면이 예시 데이터·정적 기록을 실제처럼 보이지 않게 하는 순수 함수 모음.
// 근거: 런칭 깊이 점검(2026-10-25) 원인 L — UI-01·02·03·07·08.

import {
  buildStoredCurrentWorkpack,
  parseStoredCurrentWorkpack,
  type CurrentDispatchSnapshot,
  type CurrentWorkerSnapshot,
  type StoredCurrentWorkpack
} from "@/lib/current-workpack";
import type { AskResponse, SearchResult } from "@/lib/types";

export const PUBLIC_SAMPLE_BANNER_LABEL = "기본 예시 표시";
export const PUBLIC_SAMPLE_BANNER_TEXT =
  "아직 생성된 문서팩이 없어 기본 예시 데이터로 화면을 보여줍니다. 실제 저장·전파는 작업 입력 후 진행합니다.";

export type DisplayWorkpack = {
  data: AskResponse;
  isSample: boolean;
  savedAt: string | null;
};

/** 브라우저에 저장된 현재 작업팩이 있으면 그것을, 없으면 예시를 쓴다. 예시 여부를 함께 돌려준다. */
export function resolveDisplayWorkpack(raw: string | null, sample: AskResponse): DisplayWorkpack {
  const stored = parseStoredCurrentWorkpack(raw);
  if (stored) return { data: stored.data, isSample: false, savedAt: stored.savedAt };
  return { data: sample, isSample: true, savedAt: null };
}

export type RouteSnapshotState = {
  data: AskResponse;
  isCurrent: boolean;
  savedAt: string | null;
  generationFingerprint: string;
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

export type RouteSnapshotPatch = {
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

/**
 * 작업자 명단·전파 대상 변경(「수정 반영」·「명단에 추가」)을 화면 상태에 반영한다.
 * 저장된 작업팩이 있을 때만 localStorage 에 쓸 값을 돌려준다. 예시 화면에서 고친 내용은
 * 이 화면에만 유지하고 「생성된 작업」으로 저장하지 않는다(UI-02).
 */
export function applyRouteSnapshotUpdate<T extends RouteSnapshotState>(
  current: T,
  patch: RouteSnapshotPatch,
  nowIso: string
): { next: T; persist: StoredCurrentWorkpack | null } {
  const next: T = {
    ...current,
    ...("workerSnapshot" in patch ? { workerSnapshot: patch.workerSnapshot } : {}),
    ...("dispatchSnapshot" in patch ? { dispatchSnapshot: patch.dispatchSnapshot } : {}),
    savedAt: current.isCurrent ? nowIso : current.savedAt
  };
  if (!current.isCurrent) return { next, persist: null };
  return {
    next,
    persist: buildStoredCurrentWorkpack(next.data, {
      generationFingerprint: next.generationFingerprint,
      workerSnapshot: next.workerSnapshot,
      dispatchSnapshot: next.dispatchSnapshot
    })
  };
}

/** 법령 원천에 연결되지 않은 예시 근거(mock)인지. */
export function isExampleSource(item: Pick<SearchResult, "sourceSystem">): boolean {
  return item.sourceSystem === "mock";
}

/** 근거 출처 배지. 예시 근거에는 법제처 이름을 붙이지 않는다(UI-03). */
export function sourceBadgeLabel(item: Pick<SearchResult, "sourceSystem" | "sourceLabel">): string {
  if (isExampleSource(item)) return "예시 자료 · 실제 법령·판례 아님";
  return item.sourceLabel || "출처 확인 필요";
}

export const DRYRUN_FRESH_DAYS = 7;

/** 점검 기록이 언제 것인지, 지금 상태로 읽어도 되는지(UI-08). */
export function describeDryrunFreshness(generatedAt: string | null | undefined, now: Date): { stale: boolean; label: string } {
  const time = generatedAt ? new Date(generatedAt).getTime() : Number.NaN;
  if (Number.isNaN(time)) {
    return { stale: true, label: "점검 일시를 확인할 수 없는 기록입니다. 현재 상태가 아닙니다." };
  }
  const day = new Date(time).toISOString().slice(0, 10);
  const ageDays = Math.floor((now.getTime() - time) / 86_400_000);
  if (ageDays > DRYRUN_FRESH_DAYS) {
    return { stale: true, label: `${day} 점검 기록(${ageDays}일 전)입니다. 현재 상태가 아닙니다.` };
  }
  return { stale: false, label: `${day} 점검 기록입니다.` };
}
