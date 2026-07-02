import { describe, expect, it } from "vitest";

import { ACCIDENT_REPORT_TEMPLATE, OFFICIAL_CONTACTS, sanitizeContacts } from "@/lib/safety-contacts";

describe("OFFICIAL_CONTACTS", () => {
  it("contains exactly the four whitelisted official numbers", () => {
    expect(OFFICIAL_CONTACTS.fireAndAmbulance).toBe("119");
    expect(OFFICIAL_CONTACTS.workersCompensationService).toBe("1588-0075");
    expect(OFFICIAL_CONTACTS.koshaSafetyAgency).toBe("1644-4544");
    expect(OFFICIAL_CONTACTS.moelCounseling).toBe("1350");
  });
});

describe("ACCIDENT_REPORT_TEMPLATE", () => {
  it("is the fixed statutory wording including the workers-comp number", () => {
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("산업안전보건법 제54조");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("시행규칙 제67조");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("법 제57조");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("시행규칙 제73조");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("근로복지공단(1588-0075)");
  });
});

describe("sanitizeContacts", () => {
  it("replaces a fabricated local-branch phone number adjacent to an institution name", () => {
    const input = "긴급 시 안전보건공단 안산지사 031-555-7788 로 연락하십시오.";
    const out = sanitizeContacts(input);
    expect(out).not.toContain("031-555-7788");
    expect(out).toContain("(관할 기관 연락처 — 현장 확인 필요)");
  });

  it("preserves all four official whitelisted numbers untouched", () => {
    const input = [
      "화재/구급: 119",
      "요양급여 신청: 근로복지공단 1588-0075",
      "안전보건공단 1644-4544",
      "고용노동부 상담 1350"
    ].join("\n");
    const out = sanitizeContacts(input);
    expect(out).toContain("119");
    expect(out).toContain("근로복지공단 1588-0075");
    expect(out).toContain("안전보건공단 1644-4544");
    expect(out).toContain("고용노동부 상담 1350");
  });

  it("leaves text with no phone numbers unchanged", () => {
    const input = "현장 확인 후 상급자에게 즉시 보고한다. 재발방지대책을 수립한다.";
    expect(sanitizeContacts(input)).toBe(input);
  });

  it("replaces multiple fabricated numbers in the same text", () => {
    const input = [
      "안전보건공단 안산지사 031-555-7788",
      "고용노동부 안산지청 감시반 031-555-8000",
      "한국산재보험공단 1644-0644"
    ].join("\n");
    const out = sanitizeContacts(input);
    expect(out).not.toContain("031-555-7788");
    expect(out).not.toContain("031-555-8000");
    expect(out).not.toContain("1644-0644");
    const placeholderCount = out.split("(관할 기관 연락처 — 현장 확인 필요)").length - 1;
    expect(placeholderCount).toBe(3);
  });

  it("leaves 010 personal-number blank placeholders untouched", () => {
    const input = "현장소장: 010-____-____ / 안전관리자: 010-1234-5678";
    expect(sanitizeContacts(input)).toBe(input);
  });
});
