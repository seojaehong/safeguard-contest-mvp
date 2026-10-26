// inventory 10-4 의 3번: buildPublicRecipientMessage 가 kakaoMessage 를 gateUserOutputText 없이 돌려준다(문서 3종만 게이트).
// 옛 저장본의 kakaoMessage 에는 생성 시점 뒤에 추가된 규칙(위험성평가 관리번호 영문 코드·패킷 호칭)이 남아 있을 수 있다.
import { describe, expect, it } from "vitest";

import { buildPublicRecipientMessage, buildPublicShareDocuments } from "@/lib/workpack-commercial-store";
import { findUserOutputLeaks } from "@/lib/user-output-gate";

const LEGACY_KAKAO = [
  "[오늘 작업 안전 안내]",
  "작업: 프레스 금형 교체",
  "관리번호: RA-press-1 — 끼임 위험, 안전블록 설치 후 작업",
  "근거 패킷 기준 조치: 운전정지·잠금 확인",
  "TBM 및 당일 안전교육 내용 확인 후 작업 시작 바랍니다."
].join("\n");

describe("공유본 한국어 전송본(kakaoMessage) 출력 게이트", () => {
  it("한국어 전송본 본문에 내부 코드가 0회다 (문서 3종과 같은 게이트)", () => {
    const message = buildPublicRecipientMessage({ kakaoMessage: LEGACY_KAKAO }, "ko");
    expect(message).not.toBeNull();
    expect(findUserOutputLeaks(message!.body)).toEqual([]);
    expect(message!.body).toContain("위험성평가-01");
    expect(message!.body).not.toContain("RA-press-1");
    expect(message!.body).not.toContain("패킷");
  });

  it("같은 입력에 두 번 돌려도 같다", () => {
    const once = buildPublicRecipientMessage({ kakaoMessage: LEGACY_KAKAO }, "ko")!.body;
    const twice = buildPublicRecipientMessage({ kakaoMessage: once }, "ko")!.body;
    expect(twice).toBe(once);
  });

  it("비어 있으면 null, 문서 3종 게이트는 그대로", () => {
    expect(buildPublicRecipientMessage({ kakaoMessage: "   " }, "ko")).toBeNull();
    const [doc] = buildPublicShareDocuments({ riskAssessmentDraft: LEGACY_KAKAO });
    expect(findUserOutputLeaks(doc.body)).toEqual([]);
  });
});
