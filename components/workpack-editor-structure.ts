export type DocumentKey =
  | "workpackSummaryDraft"
  | "riskAssessmentDraft"
  | "workPlanDraft"
  | "workPermitDraft"
  | "tbmBriefing"
  | "tbmLogDraft"
  | "safetyEducationRecordDraft"
  | "emergencyResponseDraft"
  | "photoEvidenceDraft"
  | "foreignWorkerBriefing"
  | "foreignWorkerTransmission"
  | "kakaoMessage";

export type DocumentEditorKind =
  | "document-summary"
  | "risk-assessment"
  | "work-plan"
  | "work-permit"
  | "safety-briefing"
  | "meeting-record"
  | "education-record"
  | "emergency-plan"
  | "evidence-record"
  | "multilingual-briefing"
  | "multilingual-message"
  | "field-message";

export type DocumentEditorProfile = {
  kind: DocumentEditorKind;
  label: string;
  defaultBodyLabel: string;
  bodyTitlePattern: RegExp;
  fallbackSections: readonly {
    label: string;
    startPattern?: RegExp;
  }[];
};

export type StructuredDocumentSection = {
  id: string;
  label: string;
  kind: "body" | "appendix";
  value: string;
  contentStart: number;
  contentEnd: number;
  replacementPrefix?: string;
};

export type StructuredDocumentModel = {
  profile: DocumentEditorProfile;
  body: StructuredDocumentSection[];
  appendices: StructuredDocumentSection[];
};

const documentEditorProfiles: Record<DocumentKey, DocumentEditorProfile> = {
  workpackSummaryDraft: {
    kind: "document-summary",
    label: "점검 요약",
    defaultBodyLabel: "요약 본문",
    bodyTitlePattern: /점검결과|문서팩 요약/u,
    fallbackSections: [
      { label: "현장·작업 개요" },
      { label: "핵심 위험", startPattern: /^핵심\s*위험/u },
      { label: "즉시 조치", startPattern: /^(?:즉시\s*조치|필수조치)/u },
      { label: "근거 연결", startPattern: /^(?:연결\s*상태|근거)/u }
    ]
  },
  riskAssessmentDraft: {
    kind: "risk-assessment",
    label: "위험성평가",
    defaultBodyLabel: "기본 정보",
    bodyTitlePattern: /위험성평가/u,
    fallbackSections: [
      { label: "평가 기본 정보" },
      { label: "유해·위험요인", startPattern: /^(?:유해[·ㆍ]?위험요인|위험요인)/u },
      { label: "감소대책", startPattern: /^(?:감소대책|안전조치)/u },
      { label: "조치 확인", startPattern: /^(?:조치 확인|확인 결과)/u }
    ]
  },
  workPlanDraft: {
    kind: "work-plan",
    label: "작업계획",
    defaultBodyLabel: "작업 개요",
    bodyTitlePattern: /작업계획/u,
    fallbackSections: [
      { label: "작업 개요" },
      { label: "작업 순서", startPattern: /^(?:작업 순서|작업단계)/u },
      { label: "안전 조치", startPattern: /^(?:안전 조치|안전조치)/u },
      { label: "작업중지·비상대응", startPattern: /^(?:작업중지|비상대응)/u }
    ]
  },
  workPermitDraft: {
    kind: "work-permit",
    label: "작업허가",
    defaultBodyLabel: "허가 기본 정보",
    bodyTitlePattern: /작업허가|허가서/u,
    fallbackSections: [
      { label: "허가 기본 정보" },
      { label: "작업 전 허가조건", startPattern: /^작업 전 허가조건/u },
      { label: "격리·보호구 확인", startPattern: /^(?:격리|보호구)/u },
      { label: "작업 종료 확인", startPattern: /^작업 종료 확인/u }
    ]
  },
  tbmBriefing: {
    kind: "safety-briefing",
    label: "TBM 브리핑",
    defaultBodyLabel: "회의 기본 정보",
    bodyTitlePattern: /안전점검회의|TBM.*브리핑/u,
    fallbackSections: [
      { label: "회의 기본 정보" },
      { label: "오늘 작업", startPattern: /^(?:오늘 작업|작업내용)/u },
      { label: "위험요인·안전대책", startPattern: /^(?:위험요인|잠재위험)/u },
      { label: "확인 질문", startPattern: /^(?:확인 질문|근로자 확인)/u }
    ]
  },
  tbmLogDraft: {
    kind: "meeting-record",
    label: "TBM 기록",
    defaultBodyLabel: "회의 기록 정보",
    bodyTitlePattern: /안전점검회의.*기록|TBM.*기록/u,
    fallbackSections: [
      { label: "회의 기록 정보" },
      { label: "중점 위험·대책", startPattern: /^(?:잠재위험|중점위험|위험요인)/u },
      { label: "참석자 확인", startPattern: /^참석자 확인/u },
      { label: "미조치·후속조치", startPattern: /^(?:미조치|후속조치)/u }
    ]
  },
  safetyEducationRecordDraft: {
    kind: "education-record",
    label: "교육 기록",
    defaultBodyLabel: "교육 기본 정보",
    bodyTitlePattern: /안전보건교육.*기록/u,
    fallbackSections: [
      { label: "교육 기본 정보" },
      { label: "교육 대상", startPattern: /^교육대상/u },
      { label: "교육 내용", startPattern: /^교육내용/u },
      { label: "이해도·서명 확인", startPattern: /^(?:이해도|서명|교육 확인)/u }
    ]
  },
  emergencyResponseDraft: {
    kind: "emergency-plan",
    label: "비상대응",
    defaultBodyLabel: "대응 기본 정보",
    bodyTitlePattern: /비상대응/u,
    fallbackSections: [
      { label: "대응 기본 정보" },
      { label: "사고 징후·초기조치", startPattern: /^(?:사고 징후|초기조치)/u },
      { label: "보고·연락체계", startPattern: /^(?:보고체계|비상연락)/u },
      { label: "현장보존·재발방지", startPattern: /^(?:현장보존|재발방지)/u }
    ]
  },
  photoEvidenceDraft: {
    kind: "evidence-record",
    label: "사진 증빙",
    defaultBodyLabel: "증빙 기본 정보",
    bodyTitlePattern: /사진.*증빙/u,
    fallbackSections: [
      { label: "증빙 기본 정보" },
      { label: "작업 전 사진", startPattern: /^작업 전 사진/u },
      { label: "조치 전·후 사진", startPattern: /^조치 전[·ㆍ]?후 사진/u },
      { label: "TBM·교육 증빙", startPattern: /^(?:TBM|교육)\s*(?:및|·)?\s*교육?\s*증빙/u }
    ]
  },
  foreignWorkerBriefing: {
    kind: "multilingual-briefing",
    label: "다국어 브리핑",
    defaultBodyLabel: "안내 기본 정보",
    bodyTitlePattern: /외국인.*안내|외국인.*출력|안전.*브리핑/u,
    fallbackSections: [
      { label: "쉬운 한국어 안내" },
      { label: "다국어 기본팩", startPattern: /^\[다국어 기본팩\]$/u },
      { label: "언어별 안전수칙", startPattern: /^\[[^\]]+\s\/\s[^\]]+\]$/u },
      { label: "사용 전 확인", startPattern: /^\[사용 전 확인\]$/u }
    ]
  },
  foreignWorkerTransmission: {
    kind: "multilingual-message",
    label: "다국어 전송",
    defaultBodyLabel: "전송 기본 정보",
    bodyTitlePattern: /외국인.*전송|다국어.*전송/u,
    fallbackSections: [
      { label: "공지 기본 정보" },
      { label: "쉬운 한국어", startPattern: /^쉬운 한국어:/u },
      { label: "다국어 안내", startPattern: /^\[SafeClaw (?!외국인 근로자).*안전공지\]/u },
      { label: "관리자 확인", startPattern: /^관리자 확인:/u }
    ]
  },
  kakaoMessage: {
    kind: "field-message",
    label: "현장 메시지",
    defaultBodyLabel: "전송 본문",
    bodyTitlePattern: /현장.*공유|현장.*전파|안전.*메시지/u,
    fallbackSections: [
      { label: "현장·작업" },
      { label: "핵심 위험", startPattern: /^핵심위험:/u },
      { label: "필수 조치", startPattern: /^필수조치:/u },
      { label: "시작 전 확인", startPattern: /^TBM 및 당일 안전교육/u }
    ]
  }
};

// Decoration, connection-status, and RAG metadata are retained in source but
// kept out of the default submission-body editing surface.
export const META_SECTION_PATTERNS = [
  /^연결 상태/,
  /^KOSHA 기술지침\/기술지원규정 직접 인용/,
  /^내부 안전지식 DB 반영/,
  /^근거 요약/,
  /^문서 반영$/,
  /^문서 반영:/,
  /^법령 근거 요약/,
  /^KOSHA 보강/,
  /^추천 후속 교육/,
  /^KOSHA 교육포털 연계/,
  /^교육 적합성 확인/,
  /^옥외 (폭염|위험|작업)/,
  /^위험성평가·기상/,
  /^TBM 필수 반영 체크/,
  /^외국인 근로자 (공지|안내)/,
  /^유사 재해사례/,
  /^기상 신호/,
  /^서식 구조/,
  /^서식 상태/,
  /^서식상태$/,
  /^안전 기초 지식/,
  /^라이브 보강/,
  /^공식 서식 기준 보강/,
  /^반영 근거(:|: )/,
  /^반영 근거$/,
  /^중대재해 예방 관리체계 점검/,
  /^필수 확인 항목$/,
  /^섹션 요약$/,
  /^본문 표$/,
  /^제출상태/,
  /^원본 재현 한계/,
  /^안전보건진단 가이드/,
  /^위험성평가 이행·점검/,
  /^TBM 메인 가이드/
];

export function isMetaSection(section: string) {
  return META_SECTION_PATTERNS.some((pattern) => pattern.test(section));
}

export function getDocumentEditorProfile(key: DocumentKey) {
  return documentEditorProfiles[key];
}

function trimSectionBoundary(source: string, contentStart: number, blockEnd: number) {
  const block = source.slice(contentStart, blockEnd);
  const trailingWhitespace = block.match(/(?:\r?\n[\t ]*)+$/u)?.[0] ?? "";
  return blockEnd - trailingWhitespace.length;
}

function findEmbeddedBodyStart(content: string, profile: DocumentEditorProfile) {
  const lines = Array.from(content.matchAll(/([^\r\n]*)(\r?\n|$)/gu));
  let lastBlankBoundary: number | null = null;

  for (const lineMatch of lines) {
    const line = lineMatch[1];
    const trimmed = line.trim();
    const lineStart = lineMatch.index ?? 0;
    if (!trimmed) {
      lastBlankBoundary = lineStart + lineMatch[0].length;
      continue;
    }
    const looksLikeBodyTitle = trimmed.length <= 120
      && profile.bodyTitlePattern.test(trimmed)
      && (
        trimmed.includes("초안")
        || (
          !trimmed.includes(":")
          && !/^[-*•\d]/u.test(trimmed)
          && !/안내|가이드|규정|법령|공식자료|근거/u.test(trimmed)
        )
      );
    if (looksLikeBodyTitle) {
      return lastBlankBoundary ?? lineStart;
    }
  }

  return null;
}

function normalizeBodyLabel(profile: DocumentEditorProfile, heading: string | null) {
  if (!heading) return profile.defaultBodyLabel;
  if (/^(?:제출 )?본문$/u.test(heading)) return profile.defaultBodyLabel;
  if (profile.kind === "field-message" && /공유|공지|메시지|전파/u.test(heading)) {
    return profile.defaultBodyLabel;
  }
  return heading;
}

function buildFallbackSections(profile: DocumentEditorProfile, source: string): StructuredDocumentSection[] {
  const lines = Array.from(source.matchAll(/[^\r\n]*(?:\r?\n|$)/gu))
    .filter((match) => match[0].length > 0);
  const starts = profile.fallbackSections.map((section, index) => {
    if (index === 0) return 0;
    if (!section.startPattern) return source.length;
    const match = lines.find((line) => section.startPattern?.test(line[0].trim()));
    return match?.index ?? source.length;
  });

  return profile.fallbackSections.map((section, index) => {
    const contentStart = starts[index];
    const laterStarts = starts.slice(index + 1).filter((start) => start > contentStart);
    const blockEnd = laterStarts.length ? Math.min(...laterStarts) : source.length;
    const contentEnd = trimSectionBoundary(source, contentStart, blockEnd);
    const value = source.slice(contentStart, contentEnd);
    return {
      id: `body-fallback-${index}-${section.label}`,
      label: section.label,
      kind: "body" as const,
      value,
      contentStart,
      contentEnd,
      replacementPrefix: value.length === 0 ? `${section.label}:\n` : undefined
    };
  });
}

export function buildStructuredDocumentSections(key: DocumentKey, source: string): StructuredDocumentModel {
  const profile = getDocumentEditorProfile(key);
  const matches = Array.from(source.matchAll(/^\s*\[([^\]\r\n]+)\]\s*(?:\r?\n|$)/gmu));
  if (matches.length === 0) {
    return {
      profile,
      body: buildFallbackSections(profile, source),
      appendices: []
    };
  }
  const sections: StructuredDocumentSection[] = [];

  function pushSection(
    kind: StructuredDocumentSection["kind"],
    label: string,
    contentStart: number,
    blockEnd: number,
    replacementPrefix?: string
  ) {
    const contentEnd = trimSectionBoundary(source, contentStart, blockEnd);
    sections.push({
      id: `${kind}-${sections.length}-${label}`,
      label,
      kind,
      value: source.slice(contentStart, contentEnd),
      contentStart,
      contentEnd,
      replacementPrefix
    });
  }

  const firstHeadingStart = matches[0]?.index ?? source.length;
  if (firstHeadingStart > 0 || matches.length === 0) {
    pushSection("body", profile.defaultBodyLabel, 0, firstHeadingStart);
  }

  matches.forEach((match, index) => {
    const heading = match[1].trim();
    const contentStart = (match.index ?? 0) + match[0].length;
    const blockEnd = matches[index + 1]?.index ?? source.length;
    if (!isMetaSection(heading)) {
      if (/^(?:제출 )?본문$/u.test(heading) && !source.slice(contentStart, blockEnd).trim()) {
        return;
      }
      pushSection("body", normalizeBodyLabel(profile, heading), contentStart, blockEnd);
      return;
    }

    const content = source.slice(contentStart, blockEnd);
    const embeddedBodyOffset = findEmbeddedBodyStart(content, profile);
    if (embeddedBodyOffset === null) {
      pushSection("appendix", heading, contentStart, blockEnd);
      return;
    }

    const embeddedBodyStart = contentStart + embeddedBodyOffset;
    pushSection("appendix", heading, contentStart, embeddedBodyStart);
    pushSection("body", profile.defaultBodyLabel, embeddedBodyStart, blockEnd, "[제출 본문]\n");
  });

  const body = sections.filter((section) => section.kind === "body");
  if (body.length === 0) {
    sections.push({
      id: `body-${sections.length}-${profile.defaultBodyLabel}`,
      label: profile.defaultBodyLabel,
      kind: "body",
      value: "",
      contentStart: source.length,
      contentEnd: source.length
    });
  }

  return {
    profile,
    body: sections.filter((section) => section.kind === "body"),
    appendices: sections.filter((section) => section.kind === "appendix")
  };
}

export function replaceStructuredDocumentSection(
  source: string,
  section: StructuredDocumentSection,
  nextValue: string
) {
  if (section.contentStart < 0 || section.contentEnd < section.contentStart || section.contentEnd > source.length) {
    throw new Error("Structured document section range is invalid");
  }
  if (source.slice(section.contentStart, section.contentEnd) !== section.value) {
    throw new Error("Structured document section is stale");
  }
  const replacement = `${section.replacementPrefix ?? ""}${nextValue}`;
  return `${source.slice(0, section.contentStart)}${replacement}${source.slice(section.contentEnd)}`;
}
