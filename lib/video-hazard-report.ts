/**
 * 동영상 위험 점검 v0 — 서버 결과 정리 단계.
 *
 * 사진 위험분석(analyzeHazardPhotos)이 장면 사진마다 낸 위험 후보와 근거 하네스 결과를
 * 영상 보고 형식(영상 흐름 의견 → 위험·조치 표(시각) → 위험 장면 → 근거 조문 → 현장 확인 목록)으로 정리한다.
 *
 * 생성 규칙 4종
 *  (1) 근골격계부담작업은 고시 제3조 각 호 원문 요건을 끼워 넣고 「해당 가능성, 현장 확인 필요」로만 쓴다.
 *  (2) 조문은 지적한 요소와 이어지는 것만 붙인다(호스 걸림·좁은 통로에 조명 조문을 붙이지 않는다).
 *  (3) 현장 확인 질문(~지)과 기본 조치문(~한다)을 나누고, 위 표 조치와 겹치면 뺀다.
 *  (4) 장소·작업·걱정되는 점 세 칸은 필수다.
 */
import type { HazardPhotoVisionCandidate } from "@/lib/photo-vision-analysis";
import { formatVideoTime, parseSceneTimeFromName } from "@/lib/video-hazard-frames";

// ---------------------------------------------------------------------------
// 규칙 (4) 필수 칸
// ---------------------------------------------------------------------------

export type VideoCheckInput = { site: string; task: string; concern: string };
export type VideoCheckField = keyof VideoCheckInput;

export const VIDEO_CHECK_FIELD_LABELS: Record<VideoCheckField, string> = {
  site: "장소",
  task: "작업",
  concern: "걱정되는 점"
};

const VIDEO_CHECK_FIELD_MAX = 200;

export type VideoCheckInputValidation =
  | { ok: true; value: VideoCheckInput }
  | { ok: false; missing: VideoCheckField[]; message: string };

export function validateVideoCheckInput(raw: Partial<Record<VideoCheckField, unknown>>): VideoCheckInputValidation {
  const read = (key: VideoCheckField) => {
    const value = raw[key];
    return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, VIDEO_CHECK_FIELD_MAX) : "";
  };
  const value: VideoCheckInput = { site: read("site"), task: read("task"), concern: read("concern") };
  const missing = (Object.keys(VIDEO_CHECK_FIELD_LABELS) as VideoCheckField[])
    .filter((key) => value[key].length < 2);
  if (missing.length) {
    return {
      ok: false,
      missing,
      message: `${missing.map((key) => VIDEO_CHECK_FIELD_LABELS[key]).join("·")}을(를) 적어 주세요. 영상만으로는 무슨 작업인지 알 수 없습니다.`
    };
  }
  return { ok: true, value };
}

/** 사진 분석에 넘길 질문 문장 */
export function buildVideoCheckQuestion(input: VideoCheckInput, sceneTimes: readonly number[]): string {
  return [
    `장소: ${input.site}`,
    `작업: ${input.task}`,
    `걱정되는 점: ${input.concern}`,
    `동영상에서 뽑은 장면 사진입니다(장면 시각 ${sceneTimes.map(formatVideoTime).join(", ")}). 장면 사이에 일어난 일과 소리는 보이지 않습니다.`
  ].join("\n").slice(0, 1200);
}

// ---------------------------------------------------------------------------
// 규칙 (1) 근골격계부담작업
// ---------------------------------------------------------------------------

/** 「근골격계부담작업의 범위 및 유해요인조사 방법에 관한 고시」 제3조 각 호 원문(고용노동부고시 제2020-12호, 2020. 1. 16. 시행). 법제처 원문 대조 2026-10-25. */
export const MSD_NOTICE_TITLE = "근골격계부담작업의 범위 및 유해요인조사 방법에 관한 고시";
export const MSD_NOTICE_ITEMS: Readonly<Record<number, string>> = {
  1: "하루에 4시간 이상 집중적으로 자료입력 등을 위해 키보드 또는 마우스를 조작하는 작업",
  2: "하루에 총 2시간 이상 목, 어깨, 팔꿈치, 손목 또는 손을 사용하여 같은 동작을 반복하는 작업",
  3: "하루에 총 2시간 이상 머리 위에 손이 있거나, 팔꿈치가 어깨위에 있거나, 팔꿈치를 몸통으로부터 들거나, 팔꿈치를 몸통뒤쪽에 위치하도록 하는 상태에서 이루어지는 작업",
  4: "지지되지 않은 상태이거나 임의로 자세를 바꿀 수 없는 조건에서, 하루에 총 2시간 이상 목이나 허리를 구부리거나 트는 상태에서 이루어지는 작업",
  5: "하루에 총 2시간 이상 쪼그리고 앉거나 무릎을 굽힌 자세에서 이루어지는 작업",
  6: "하루에 총 2시간 이상 지지되지 않은 상태에서 1kg 이상의 물건을 한손의 손가락으로 집어 옮기거나, 2kg 이상에 상응하는 힘을 가하여 한손의 손가락으로 물건을 쥐는 작업",
  7: "하루에 총 2시간 이상 지지되지 않은 상태에서 4.5kg 이상의 물건을 한 손으로 들거나 동일한 힘으로 쥐는 작업",
  8: "하루에 10회 이상 25kg 이상의 물체를 드는 작업",
  9: "하루에 25회 이상 10kg 이상의 물체를 무릎 아래에서 들거나, 어깨 위에서 들거나, 팔을 뻗은 상태에서 드는 작업",
  10: "하루에 총 2시간 이상, 분당 2회 이상 4.5kg 이상의 물체를 드는 작업",
  11: "하루에 총 2시간 이상 시간당 10회 이상 손 또는 무릎을 사용하여 반복적으로 충격을 가하는 작업"
};

export const MSD_POSSIBILITY_PHRASE = "해당 가능성, 현장 확인 필요";

const MSD_POSTURE_PATTERNS: ReadonlyArray<{ ho: number; pattern: RegExp }> = [
  { ho: 1, pattern: /키보드|마우스|자료\s*입력/u },
  { ho: 2, pattern: /반복\s*(동작|작업)|같은\s*동작|반복적으로\s*(손|팔|손목)/u },
  { ho: 3, pattern: /머리\s*위|팔(을|꿈치를)?\s*(어깨\s*위로?\s*)?들(어|고)|어깨\s*위|팔을\s*뻗/u },
  { ho: 4, pattern: /허리(를)?\s*(굽|구부|숙|비틀|틀)|목(을)?\s*(굽|구부|숙|비틀|틀)|몸(을)?\s*(숙|굽|구부)|숙인\s*자세|구부린\s*자세|허리\s*굽힘/u },
  { ho: 5, pattern: /쪼그|무릎(을)?\s*(굽|꿇)/u },
  { ho: 8, pattern: /중량물|무거운\s*(물체|자재|짐|물건)|인력\s*(으로\s*)?(운반|들)|들어\s*올리/u },
  { ho: 11, pattern: /망치|두드리|내리치|충격을\s*가/u }
];

export function detectMsdItems(text: string): number[] {
  const found = new Set<number>();
  for (const { ho, pattern } of MSD_POSTURE_PATTERNS) {
    if (pattern.test(text)) found.add(ho);
  }
  if (found.has(8)) found.add(9);
  return [...found].sort((a, b) => a - b);
}

export function buildMsdNote(items: readonly number[]): string {
  if (!items.length) return "";
  const clauses = items.map((ho) => `제3조 제${ho}호 「${MSD_NOTICE_ITEMS[ho]}」`).join(", ");
  return `근골격계부담작업 ${MSD_POSSIBILITY_PHRASE} — 「${MSD_NOTICE_TITLE}」 ${clauses}. 짧은 영상으로는 하루 작업시간·반복 횟수·물체 무게를 확인할 수 없습니다.`;
}

/**
 * 모델이나 근거 문장이 근골격계부담작업을 단정하면 표준 표현으로 바꾼다.
 * 「근골격계부담작업」이 나오는 문장은 반드시 「해당 가능성, 현장 확인 필요」를 담는다.
 */
export function enforceMsdPhrasing(text: string): string {
  if (!text.includes("근골격계부담작업")) return text;
  return text
    .split(/(?<=[.。])\s*/u)
    .map((sentence) => {
      if (!sentence.includes("근골격계부담작업") || sentence.includes(MSD_POSSIBILITY_PHRASE)) return sentence;
      return `근골격계부담작업 ${MSD_POSSIBILITY_PHRASE}.`;
    })
    .join(" ")
    .trim();
}

function msdFieldChecks(items: readonly number[]): string[] {
  const checks: string[] = [];
  if (items.some((ho) => [2, 3, 4, 5, 11].includes(ho))) {
    checks.push("영상에 보인 자세가 하루 총 2시간 이상 이어지는지");
  }
  if (items.includes(4)) {
    checks.push("허리·목을 굽힐 때 몸을 받칠 데가 있는지, 작업자가 자세를 바꿀 수 있는지");
  }
  if (items.includes(8) || items.includes(9)) {
    checks.push("손으로 드는 물체의 무게와 하루에 드는 횟수가 얼마인지");
  }
  if (items.includes(1)) {
    checks.push("키보드·마우스 작업이 하루 4시간 이상인지");
  }
  return checks;
}

// ---------------------------------------------------------------------------
// 규칙 (2) 조문 매칭 필터
// ---------------------------------------------------------------------------

/** 위험 주제(조문 제목의 핵심 대상). 조문이 이 주제를 갖고 있으면 후보도 같은 주제를 가져야 붙인다. */
const HAZARD_TOPICS: Readonly<Record<string, RegExp>> = {
  조명: /조명|조도|채광|어두|밝기/u,
  추락: /추락|떨어짐|고소|개구부|안전난간|단부|작업발판|비계|사다리/u,
  전도: /걸림|넘어짐|전도|미끄러|미끄럼|발\s*걸|걸려/u,
  감전: /감전|충전부|누전|전선|전기\s*기계|분전반/u,
  끼임: /끼임|협착|말림|회전체|방호\s*덮개|롤러|벨트/u,
  낙하: /낙하|비래|맞음|떨어지는\s*물체/u,
  화재: /화재|폭발|인화|불티|불꽃|용접/u,
  중량물: /중량물|인력\s*운반|들어\s*올리|무거운/u,
  근골격: /근골격|자세|반복\s*동작|허리|쪼그/u,
  차량: /지게차|차량|하역운반|후진|운반기계/u,
  보호구: /보호구|안전모|안전대|보안경|안전화|방진\s*마스크/u,
  밀폐: /밀폐|질식|산소\s*결핍|유해가스/u,
  화학: /화학|유해물질|물질안전보건|MSDS/u,
  정리정돈: /정리|정돈|적치|방치|호스|케이블|자재가?\s*놓/u
};

/** 장소 주제. 조문이 위험 주제 없이 장소 주제만 가지면 장소가 겹칠 때 붙인다. */
const CONTEXT_TOPICS: Readonly<Record<string, RegExp>> = {
  통로: /통로|보행|동선/u,
  계단: /계단/u,
  작업장: /작업장|바닥/u
};

function topicsOf(text: string, table: Readonly<Record<string, RegExp>>): Set<string> {
  const topics = new Set<string>();
  for (const [topic, pattern] of Object.entries(table)) {
    if (pattern.test(text)) topics.add(topic);
  }
  return topics;
}

function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const item of a) if (b.has(item)) return true;
  return false;
}

export type ArticleMention = {
  /** 예: 산업안전보건기준에 관한 규칙 제21조 */
  citation: string;
  /** 괄호 제목. 예: 통로의 조명 */
  heading: string;
  /** 제목이 없을 때 주제를 읽은 주변 문장 */
  context: string;
};

const LAW_NAME = "(산업안전보건기준에\\s*관한\\s*규칙|안전보건규칙|산업안전보건법\\s*시행규칙|산업안전보건법\\s*시행령|산업안전보건법)";
const ARTICLE_PATTERN = new RegExp(`(?:${LAW_NAME}\\s*)?(제\\d+조(?:의\\d+)?)(?:\\s*\\(([^)]{1,40})\\))?`, "gu");

function normalizeLawName(name: string | undefined): string {
  if (!name) return "";
  const compact = name.replace(/\s+/gu, " ");
  if (compact === "안전보건규칙") return "산업안전보건기준에 관한 규칙";
  return compact;
}

export function extractArticleMentions(text: string): ArticleMention[] {
  const mentions: ArticleMention[] = [];
  const lawInText = new RegExp(LAW_NAME, "u").exec(text)?.[1];
  for (const match of text.matchAll(ARTICLE_PATTERN)) {
    const lawName = normalizeLawName(match[1] || lawInText);
    const article = match[2];
    // 지식 DB 법령 항목 제목은 「제619조 밀폐공간 작업 프로그램의 수립ㆍ시행」처럼 괄호 없이 조 뒤에 제목이 온다.
    const trailingTitle = !match[3] && (match.index ?? 0) === 0
      ? text.slice(match[0].length).split(/[\n.。]/u)[0].trim().slice(0, 40)
      : "";
    const heading = (match[3] || trailingTitle).trim();
    const start = Math.max(0, (match.index ?? 0) - 60);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 60);
    mentions.push({
      citation: lawName ? `${lawName} ${article}` : article,
      heading,
      context: heading ? heading : text.slice(start, end)
    });
  }
  return mentions;
}

/**
 * 지적 요소와 이어진 조문인가.
 * - 조문 제목(없으면 주변 문장)에서 위험 주제를 읽는다. 위험 주제가 있으면 후보와 하나 이상 겹쳐야 한다.
 *   예) 제21조(통로의 조명) → 위험 주제 {조명}. 후보 「호스 걸림·좁은 통로」 → {전도, 정리정돈} → 붙이지 않는다.
 * - 위험 주제 없이 장소 주제만 있으면 장소가 겹칠 때 붙인다. 예) 제22조(통로의 설치) ↔ 좁은 통로.
 * - 아무 주제도 읽히지 않으면 이어짐을 확인할 수 없으므로 붙이지 않는다.
 */
export function isArticleRelevantToCandidate(mention: ArticleMention, candidateText: string): boolean {
  const subject = mention.heading || mention.context;
  const articleHazards = topicsOf(subject, HAZARD_TOPICS);
  const candidateHazards = topicsOf(candidateText, HAZARD_TOPICS);
  if (articleHazards.size) return intersects(articleHazards, candidateHazards);
  const articleContexts = topicsOf(subject, CONTEXT_TOPICS);
  if (articleContexts.size) return intersects(articleContexts, topicsOf(candidateText, CONTEXT_TOPICS));
  return false;
}

// ---------------------------------------------------------------------------
// 규칙 (3) 확인 질문과 기본 조치문
// ---------------------------------------------------------------------------

export function normalizeChecklistText(text: string): string {
  return text.replace(/[\s.,·?!「」"'()]/gu, "");
}

export function classifyChecklistSentence(text: string): "question" | "action" {
  const raw = text.trim();
  if (/\?\s*$/u.test(raw)) return "question";
  const trimmed = raw.replace(/[.\s]+$/u, "");
  // 「유지·방지·금지」처럼 「지」로 끝나는 명사는 조치문이다. 의문형 어미만 질문으로 본다.
  return /(는지|은지|인지|던지|한지|된지|떤지|런지|건지|운지|른지|난지|된지)$/u.test(trimmed) ? "question" : "action";
}

export function splitChecklist(input: {
  questions: readonly string[];
  actions: readonly string[];
  tableControls: readonly string[];
}): { fieldChecks: string[]; baseActions: string[] } {
  const tableKeys = new Set(input.tableControls.map(normalizeChecklistText).filter(Boolean));
  const seen = new Set<string>();
  const fieldChecks: string[] = [];
  const baseActions: string[] = [];
  for (const raw of [...input.questions, ...input.actions]) {
    const text = raw.trim().replace(/\s+/gu, " ");
    const key = normalizeChecklistText(text);
    if (!key || seen.has(key) || tableKeys.has(key)) continue;
    seen.add(key);
    if (classifyChecklistSentence(text) === "question") fieldChecks.push(text.replace(/[.?]+$/u, ""));
    else baseActions.push(text);
  }
  return { fieldChecks, baseActions };
}

// ---------------------------------------------------------------------------
// 보고 형식
// ---------------------------------------------------------------------------

export type VideoSceneMeta = { name: string; time: number };

export type VideoHazardRow = {
  time: number;
  timeLabel: string;
  sceneName: string;
  hazard: string;
  observation: string;
  /** 표 조치. 근거 하네스가 확정한 조치 1건, 없으면 「현장 확인 후 정함」 */
  control: string;
  controlStatus: "confirmed" | "check";
  msdNote: string;
  articles: string[];
};

export type VideoHazardArticle = {
  citation: string;
  heading: string;
  timeLabels: string[];
};

export type VideoRiskScene = {
  time: number;
  timeLabel: string;
  sceneName: string;
  hazards: string[];
};

export type VideoHazardReport = {
  flowOpinion: string;
  rows: VideoHazardRow[];
  riskScenes: VideoRiskScene[];
  articles: VideoHazardArticle[];
  fieldChecks: string[];
  baseActions: string[];
  limits: string[];
  disclaimer: string;
  sceneCount: number;
  durationSec: number;
};

export const VIDEO_REPORT_DISCLAIMER = "장면 추출 기반 1차 점검입니다. 음성은 반영하지 않았고, 사업주가 하는 위험성평가를 대신하지 않습니다.";

export const VIDEO_REPORT_LIMITS: readonly string[] = [
  "고른 장면 사이에 순간적으로 일어난 일은 빠질 수 있습니다.",
  "반복 횟수와 하루 노출 시간은 영상으로 잴 수 없습니다.",
  "화면에 보이지 않는 설비 상태(방호장치·전원 차단·점검 이력 등)는 「확인 안 됨」입니다.",
  "음성(경보음·대화·지시)은 반영하지 않았습니다."
];

const UNSEEN_EQUIPMENT_CHECK = "영상에 보이지 않는 설비 상태(방호장치·전원 차단·점검 이력)가 어떤지";
const UNCONFIRMED_CONTROL = "현장 확인 후 정함";

function candidateText(candidate: HazardPhotoVisionCandidate): string {
  return [candidate.label, candidate.detail, candidate.observation, candidate.inference].filter(Boolean).join(" ");
}

function sceneTimeFor(candidate: HazardPhotoVisionCandidate, scenes: readonly VideoSceneMeta[]): { time: number; name: string } {
  const name = candidate.sourcePhotoNames[0] || "";
  const meta = scenes.find((scene) => scene.name === name);
  if (meta) return { time: meta.time, name };
  const parsed = parseSceneTimeFromName(name);
  return { time: parsed ?? 0, name };
}

export function buildVideoFlowOpinion(input: {
  rows: readonly VideoHazardRow[];
  sceneCount: number;
  durationSec: number;
}): string {
  const lead = `${formatVideoTime(input.durationSec)} 길이 영상에서 장면 ${input.sceneCount}개를 골라 점검했습니다.`;
  if (!input.rows.length) {
    return `${lead} 고른 장면에서 위험 후보를 찾지 못했습니다. 영상에 안 보이는 부분은 현장에서 확인해야 합니다.`;
  }
  const times = [...new Set(input.rows.map((row) => row.timeLabel))];
  const frequency = new Map<string, number>();
  input.rows.forEach((row) => frequency.set(row.hazard, (frequency.get(row.hazard) || 0) + 1));
  const [topHazard, topCount] = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0];
  const confirmed = input.rows.filter((row) => row.controlStatus === "confirmed").length;
  const check = input.rows.length - confirmed;
  const repeated = topCount > 1 ? ` 「${topHazard}」이(가) 여러 장면에서 되풀이해 보입니다.` : "";
  const msd = input.rows.some((row) => row.msdNote) ? ` 작업 자세는 근골격계부담작업 ${MSD_POSSIBILITY_PHRASE}입니다.` : "";
  return `${lead} 위험 후보는 ${times.join(", ")} 장면에서 나왔습니다.${repeated}${msd} 근거와 조치를 확인한 후보 ${confirmed}건, 현장 확인이 더 필요한 후보 ${check}건입니다.`;
}

function riskScenesOf(rows: readonly VideoHazardRow[]): VideoRiskScene[] {
  const byScene = new Map<string, VideoRiskScene>();
  for (const row of rows) {
    const key = `${row.time}|${row.sceneName}`;
    const scene = byScene.get(key) || { time: row.time, timeLabel: row.timeLabel, sceneName: row.sceneName, hazards: [] };
    if (!scene.hazards.includes(row.hazard)) scene.hazards.push(row.hazard);
    byScene.set(key, scene);
  }
  return [...byScene.values()].sort((a, b) => a.time - b.time);
}

function articlesOf(rows: readonly VideoHazardRow[], headings: ReadonlyMap<string, string>): VideoHazardArticle[] {
  const byCitation = new Map<string, VideoHazardArticle>();
  for (const row of rows) {
    for (const citation of row.articles) {
      const article = byCitation.get(citation) || { citation, heading: headings.get(citation) || "", timeLabels: [] };
      if (!article.timeLabels.includes(row.timeLabel)) article.timeLabels.push(row.timeLabel);
      byCitation.set(citation, article);
    }
  }
  return [...byCitation.values()];
}

/** 한 묶음(장면 최대 4장)의 사진 분석 결과를 영상 보고 형식으로 정리한다. */
export function buildVideoHazardReport(input: {
  candidates: readonly HazardPhotoVisionCandidate[];
  scenes: readonly VideoSceneMeta[];
  durationSec: number;
  sceneCount?: number;
}): VideoHazardReport {
  const headings = new Map<string, string>();
  const extraActions: string[] = [];
  const questions: string[] = [];

  const rows: VideoHazardRow[] = input.candidates.map((candidate) => {
    const text = candidateText(candidate);
    const { time, name } = sceneTimeFor(candidate, input.scenes);
    const timeLabel = formatVideoTime(time);
    const confirmed = candidate.harness.status === "confirmed" && candidate.harness.confirmedControls.length > 0;
    const controls = confirmed ? candidate.harness.confirmedControls.map((control) => enforceMsdPhrasing(control.text.trim())) : [];
    const control = controls[0] || UNCONFIRMED_CONTROL;
    extraActions.push(...controls.slice(1));

    const mentionSources = [
      ...candidate.harness.evidence.flatMap((evidence) => [evidence.title, evidence.excerpt]),
      ...candidate.harness.confirmedControls.map((item) => item.text)
    ];
    const articles: string[] = [];
    for (const source of mentionSources) {
      for (const mention of extractArticleMentions(source || "")) {
        if (!isArticleRelevantToCandidate(mention, text)) continue;
        if (!articles.includes(mention.citation)) articles.push(mention.citation);
        if (mention.heading && !headings.has(mention.citation)) headings.set(mention.citation, mention.heading);
      }
    }

    const msdItems = detectMsdItems(text);
    questions.push(...msdFieldChecks(msdItems));
    if (!confirmed) questions.push(`${timeLabel} 장면의 「${candidate.label}」이(가) 실제 작업 중에도 그대로인지`);

    return {
      time,
      timeLabel,
      sceneName: name,
      hazard: enforceMsdPhrasing(candidate.label),
      observation: enforceMsdPhrasing(candidate.observation || candidate.detail),
      control,
      controlStatus: confirmed ? "confirmed" as const : "check" as const,
      msdNote: buildMsdNote(msdItems),
      articles
    };
  }).sort((a, b) => a.time - b.time);

  questions.push(UNSEEN_EQUIPMENT_CHECK);
  const { fieldChecks, baseActions } = splitChecklist({
    questions,
    actions: extraActions,
    tableControls: rows.map((row) => row.control)
  });
  const sceneCount = input.sceneCount ?? input.scenes.length;

  return {
    flowOpinion: buildVideoFlowOpinion({ rows, sceneCount, durationSec: input.durationSec }),
    rows,
    riskScenes: riskScenesOf(rows),
    articles: articlesOf(rows, headings),
    fieldChecks,
    baseActions,
    limits: [...VIDEO_REPORT_LIMITS],
    disclaimer: VIDEO_REPORT_DISCLAIMER,
    sceneCount,
    durationSec: input.durationSec
  };
}

/** 여러 묶음 결과를 하나로 합친다. 표 조치와 겹치는 목록 항목은 합친 뒤 다시 뺀다(규칙 3). */
export function mergeVideoHazardReports(reports: readonly VideoHazardReport[], meta: { sceneCount: number; durationSec: number }): VideoHazardReport {
  const rows = reports.flatMap((report) => report.rows).sort((a, b) => a.time - b.time);
  const headings = new Map<string, string>();
  reports.forEach((report) => report.articles.forEach((article) => {
    if (article.heading && !headings.has(article.citation)) headings.set(article.citation, article.heading);
  }));
  const { fieldChecks, baseActions } = splitChecklist({
    questions: reports.flatMap((report) => report.fieldChecks),
    actions: reports.flatMap((report) => report.baseActions),
    tableControls: rows.map((row) => row.control)
  });
  return {
    flowOpinion: buildVideoFlowOpinion({ rows, sceneCount: meta.sceneCount, durationSec: meta.durationSec }),
    rows,
    riskScenes: riskScenesOf(rows),
    articles: articlesOf(rows, headings),
    fieldChecks,
    baseActions,
    limits: [...VIDEO_REPORT_LIMITS],
    disclaimer: VIDEO_REPORT_DISCLAIMER,
    sceneCount: meta.sceneCount,
    durationSec: meta.durationSec
  };
}
