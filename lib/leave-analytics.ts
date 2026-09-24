/**
 * 연차 도구 이용 통계 — **입력값이 새어나갈 수 없는 구조로** 만든다.
 *
 * 왜 계측하나: 이 도구는 지금 아무것도 측정하지 않는다. 몇 명이 오는지, 엑셀을
 * 올렸는지, 결과를 가져갔는지 모른다. 그래서 「무엇을 고쳐야 하나」를 판단할
 * 근거가 없고, 지금까지의 개선안은 전부 추정이었다.
 *
 * ★ 이 도구는 「파일이 서버로 가지 않습니다」를 약속한다. 그 약속과 계측이
 *   충돌하지 않으려면 **무엇을 보내지 않는지**가 구조로 보장돼야 한다.
 *
 *   보내지 않는 것 — 이름 · 입사일 · 파일명 · 셀 내용 · 행 수 · 직원 수.
 *     (행 수·직원 수도 제외한다. 사업장 규모는 사업장 식별에 가까워진다.)
 *   보내는 것 — 아래 이벤트 이름과, 미리 정한 값만 들어가는 꼬리표 하나.
 *
 *   그래서 이 모듈은 **임의 문자열을 받지 않는다.** 호출부가 실수로 이름을
 *   넘기려 해도 타입에서 막히고, 런타임에서도 화이트리스트로 한 번 더 막는다.
 *   `tests/leave-analytics.test.mts` 가 이 성질을 소스 수준에서 고정한다.
 *
 * Vercel Web Analytics 를 쓰는 이유: 서드파티 쿠키를 쓰지 않고, 방문자를 요청에서
 * 만든 해시로만 구분하며, IP 를 저장하지 않고, 세션을 24시간 뒤 버린다.
 *   https://vercel.com/docs/analytics/privacy-policy
 */

/** 보낼 수 있는 이벤트 — 이 목록에 없는 것은 나가지 않는다. */
export const LEAVE_EVENTS = [
  /** 엑셀 파일을 고르는 것을 시도했다 */
  "leave_upload_try",
  /** 그 파일에서 읽을 수 있는 표가 나왔다 */
  "leave_upload_ok",
  /** 그 파일을 읽지 못했다 */
  "leave_upload_fail",
  /** 계산 결과가 화면에 나왔다 (한 세션에 한 번) */
  "leave_result",
  /** 결과를 가져갔다 */
  "leave_export",
  /** 차이 안내의 연락 링크를 눌렀다 */
  "leave_contact",
] as const;

export type LeaveEvent = (typeof LEAVE_EVENTS)[number];

/** 꼬리표로 붙일 수 있는 값 — 미리 정한 것만. 입력값에서 온 문자열은 불가능하다. */
export const LEAVE_EXPORT_KINDS = ["xlsx", "copy", "print", "template"] as const;
export type LeaveExportKind = (typeof LEAVE_EXPORT_KINDS)[number];

type Tag = { kind: LeaveExportKind };

/**
 * 이벤트 하나를 보낸다. 실패해도 조용히 넘긴다 — 계측이 도구를 막으면 안 된다.
 * `leave_export` 만 꼬리표를 받고, 나머지는 이름만 나간다.
 */
export function trackLeave(event: LeaveEvent, tag?: Tag): void {
  if (typeof window === "undefined") return;
  if (!LEAVE_EVENTS.includes(event)) return;

  let props: Record<string, string> | undefined;
  if (event === "leave_export" && tag) {
    // 화이트리스트에 없는 값은 버린다. 타입을 우회해 들어온 경우까지 막는다.
    if (LEAVE_EXPORT_KINDS.includes(tag.kind)) props = { kind: tag.kind };
  }

  // ★ try/catch 는 **동기 호출**만 잡는다. 동적 import 가 거부되면
  //   (스크립트 차단·해석 실패) unhandled rejection 으로 새어 첫 사용자의
  //   콘솔에 에러가 찍힌다. 체인에 .catch 를 달아야 한다.
  void import("@vercel/analytics")
    .then(({ track }) => track(event, props))
    .catch(() => {
      /* 계측 실패는 도구를 막지 않는다 */
    });
}
