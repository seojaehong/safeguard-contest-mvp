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

// 원문 확인(법제처, 2026-10-25): 산업안전보건법 제54조②·제57조③(2026-08-01 시행),
// 같은 법 시행규칙 제3조·제67조·제73조①(2026-08-01 시행).
export const ACCIDENT_REPORT_TEMPLATE =
  "중대재해가 발생한 사실을 알게 되면 지체 없이 사업장 소재지를 관할하는 지방고용노동관서의 장에게 전화·팩스 등으로 발생 개요 및 피해 상황, 조치 및 전망을 보고(산업안전보건법 제54조제2항, 시행규칙 제67조). " +
  "사망자가 발생하거나 3일 이상의 휴업이 필요한 부상·질병자가 발생하면 그 산업재해가 발생한 날부터 1개월 이내에 산업재해조사표를 관할 지방고용노동관서의 장에게 제출(법 제57조제3항, 시행규칙 제73조제1항). " +
  "요양급여 신청은 근로복지공단(1588-0075).";

const CONTACT_PLACEHOLDER = "(관할 기관 연락처 — 현장 확인 필요)";

// Matches landline / institution-hotline formats: 0XX-XXX(X)-XXXX or 15XX-XXXX / 16XX-XXXX.
// Also covers "(0XX) XXX(X)-XXXX" (parenthesized area code + space) and "0XX.XXX(X).XXXX"
// (dot separators), since both leaked through sanitizeContacts undetected (2026-07-02
// prod smoke fast-follow).
// 010 personal numbers are explicitly excluded (negative lookahead) — those follow the
// existing blank-placeholder convention ("010-____-____") and must not be touched here.
const PHONE_ALTERNATION =
  "\\(0(?!10)\\d{1,2}\\)[ \\t]\\d{3,4}-\\d{4}" +
  "|0(?!10)\\d{1,2}[.-]\\d{3,4}[.-]\\d{4}" +
  "|1[0-9]{3}-\\d{4}";

// An institution-name run (Korean/English letters, dots, middle-dot, parens — no digits)
// of 1-5 space-separated words, directly followed by a phone number in one of the formats
// above (optionally wrapped in parentheses). Only "기관명 인접 + 전화번호" matches are
// touched, per spec — a bare phone number with no adjacent institution text is left alone.
// Note: "." is deliberately excluded from the word-char class so a sentence-final
// period acts as a boundary — otherwise the institution-name run can reach backward
// across a completed sentence and swallow unrelated safety instructions into the
// placeholder (e.g. "즉시 작업을 중지한다. 안전보건공단 안산지사 031-555-7788").
const CONTACT_PATTERN = new RegExp(
  `[가-힣A-Za-z()·]+(?:[ \\t]+[가-힣A-Za-z()·]+){0,4}[ \\t]*\\(?(?:${PHONE_ALTERNATION})\\)?`,
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
