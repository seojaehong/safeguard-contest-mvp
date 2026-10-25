/**
 * 동영상 위험 점검 — 장면 묶음 응답 읽기(화면 쪽).
 *
 * 분석이 실패했거나 제공자가 설정되지 않은 응답을 「위험 후보 없음」으로 합치면 안 된다.
 * HTTP 상태와 본문 ok 를 함께 보고, 둘 중 하나라도 실패면 보고서로 쓰지 않는다.
 */
import type { VideoHazardReport } from "@/lib/video-hazard-report";

export function isVideoHazardReport(value: unknown): value is VideoHazardReport {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.flowOpinion === "string" && Array.isArray(record.rows) && Array.isArray(record.fieldChecks);
}

export type VideoBatchResult =
  | { ok: true; report: VideoHazardReport }
  | { ok: false; message: string };

export function readVideoBatchResponse(httpStatus: number, body: unknown): VideoBatchResult {
  const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const message = typeof record.message === "string" && record.message
    ? record.message
    : `장면 점검 요청 실패: HTTP ${httpStatus}`;
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  if (!httpOk || record.ok !== true || !isVideoHazardReport(record.report)) {
    return { ok: false, message };
  }
  return { ok: true, report: { ...record.report, missedScenes: record.report.missedScenes || [] } };
}
