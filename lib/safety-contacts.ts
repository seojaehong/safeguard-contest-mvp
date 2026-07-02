// Whitelist of real emergency/reporting phone numbers, plus the fixed accident-report
// procedure wording. Both exist to stop the model from hallucinating institutions and
// phone numbers into generated safety documents (2026-07-02 prod smoke — see brief).
//
// Prior failures caught in prod:
//   - "한국산재보험공단(1644-0644)" — the institution and number are both invented;
//     the real body is 근로복지공단 (Korea Workers' Compensation & Welfare Service) 1588-0075.
//   - "법무부 출입국 관리소 재해자 신고(KOICA 협력)" — no such reporting scheme exists.
//   - "법 제39조에 따른 24시간 이내 사고보고" — not a real statutory requirement.
//   - "안전보건공단 안산지사 031-555-7788" / "고용노동부 안산지청 감시반 031-555-8000" —
//     fabricated regional branch numbers using the fake "555" exchange.

export const OFFICIAL_CONTACTS = {
  fireAndAmbulance: "119",
  workersCompensationService: "1588-0075",
  koshaSafetyAgency: "1644-4544",
  moelCounseling: "1350"
} as const;

const WHITELISTED_NUMBERS: ReadonlySet<string> = new Set(Object.values(OFFICIAL_CONTACTS));

export const ACCIDENT_REPORT_TEMPLATE =
  "중대재해 발생 시 지체 없이 관할 지방고용노동관서에 보고(산업안전보건법 제54조, 시행규칙 제67조). " +
  "산업재해조사표는 발생일로부터 1개월 이내 제출(법 제57조, 시행규칙 제73조). " +
  "요양급여 신청은 근로복지공단(1588-0075).";

const CONTACT_PLACEHOLDER = "(관할 기관 연락처 — 현장 확인 필요)";

// Matches landline / institution-hotline formats: 0XX-XXX(X)-XXXX or 15XX-XXXX / 16XX-XXXX.
// 010 personal numbers are explicitly excluded (negative lookahead) — those follow the
// existing blank-placeholder convention ("010-____-____") and must not be touched here.
const PHONE_ALTERNATION = "0(?!10)\\d{1,2}-\\d{3,4}-\\d{4}|1[0-9]{3}-\\d{4}";

// An institution-name run (Korean/English letters, dots, middle-dot, parens — no digits)
// of 1-5 space-separated words, directly followed by a phone number in one of the formats
// above (optionally wrapped in parentheses). Only "기관명 인접 + 전화번호" matches are
// touched, per spec — a bare phone number with no adjacent institution text is left alone.
const CONTACT_PATTERN = new RegExp(
  `[가-힣A-Za-z()·.]+(?:[ \\t]+[가-힣A-Za-z()·.]+){0,4}[ \\t]*\\(?(?:${PHONE_ALTERNATION})\\)?`,
  "g"
);

const PHONE_ONLY_PATTERN = new RegExp(`(?:${PHONE_ALTERNATION})`);

/**
 * Replaces any "institution name adjacent to a phone number" span with a neutral
 * placeholder, unless the number is one of the four official whitelisted numbers
 * (119, 근로복지공단 1588-0075, 안전보건공단 1644-4544, 고용노동부 1350).
 */
export function sanitizeContacts(text: string): string {
  return text.replace(CONTACT_PATTERN, (whole) => {
    const phoneMatch = whole.match(PHONE_ONLY_PATTERN);
    const phone = phoneMatch?.[0];
    if (phone && WHITELISTED_NUMBERS.has(phone)) return whole;
    return CONTACT_PLACEHOLDER;
  });
}
