import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

const sampleQuestion = [
  "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
  "이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
  "추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
].join(" ");

export function buildSampleWorkpack() {
  return buildMockAskResponse(
    sampleQuestion,
    mockSearchResults,
    "live",
    "SafeClaw 제품 화면 연결용 샘플 문서팩입니다. 실제 작업공간에서는 /api/ask 결과가 같은 구조로 연결됩니다."
  );
}
