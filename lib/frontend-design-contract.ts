export const frontendTypography = {
  fonts: {
    product: '"IBM Plex Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif',
    // 고정폭 라벨 폐기(DESIGN.md) — hud 역할도 제품 글꼴을 쓴다.
    hud: '"IBM Plex Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif',
    multilingual:
      '"Noto Sans", "Noto Sans KR", "Noto Sans Thai", "Noto Sans Khmer", "Noto Sans Myanmar", "Noto Sans Devanagari", "Malgun Gothic", sans-serif',
    document: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
  },
  screen: {
    display: { size: "clamp(44px, 6vw, 72px)", weight: 800, lineHeight: "0.98", tracking: "-0.045em" },
    pageTitle: { size: "clamp(32px, 4vw, 40px)", weight: 800, lineHeight: "1.15", tracking: "-0.035em" },
    sectionTitle: { size: "clamp(24px, 3vw, 28px)", weight: 800, lineHeight: "1.25", tracking: "-0.025em" },
    componentTitle: { size: "20px", weight: 700, lineHeight: "1.35", tracking: "-0.015em" },
    bodyLarge: { size: "17px", weight: 500, lineHeight: "1.65", tracking: "0" },
    body: { size: "15px", weight: 500, lineHeight: "1.60", tracking: "0" },
    support: { size: "14px", weight: 500, lineHeight: "1.60", tracking: "0" },
    control: { size: "14px", weight: 700, lineHeight: "20px", tracking: "0" },
    table: { size: "13px", weight: 500, lineHeight: "20px", tracking: "0" },
    caption: { size: "12px", weight: 600, lineHeight: "18px", tracking: "0" },
    hud: { size: "11px", weight: 700, lineHeight: "16px", tracking: "0" },
  },
  print: {
    title: { size: "20pt", weight: 700, lineHeight: "24pt", tracking: "-0.02em" },
    section: { size: "14pt", weight: 700, lineHeight: "18pt", tracking: "-0.01em" },
    body: { size: "10pt", weight: 400, lineHeight: "15pt", tracking: "0" },
    table: { size: "8.5pt", weight: 400, lineHeight: "12pt", tracking: "0" },
    tableHeader: { size: "8.5pt", weight: 700, lineHeight: "12pt", tracking: "0" },
    note: { size: "8pt", weight: 400, lineHeight: "11pt", tracking: "0" },
  },
  cssTokens: [
    "--font-product",
    "--font-hud",
    "--font-multilingual",
    "--font-document",
    "--text-display",
    "--text-page-title",
    "--text-section-title",
    "--text-component-title",
    "--text-body-lg",
    "--text-body",
    "--text-support",
    "--text-control",
    "--text-table",
    "--text-caption",
    "--text-hud",
    "--leading-display",
    "--leading-page-title",
    "--leading-section-title",
    "--leading-component-title",
    "--leading-body-lg",
    "--leading-body",
    "--leading-longform",
    "--leading-control",
    "--leading-table",
    "--leading-caption",
    "--leading-hud",
    "--tracking-body",
    "--tracking-component-title",
    "--tracking-section-title",
    "--tracking-page-title",
    "--tracking-display",
    "--tracking-hud",
  ] as const,
} as const;

export const frontendScopedTypography = {
  selectors: {
    workspaceInput: [
      ".command-center-shell.workspace-theme-day .workspace-input-page .command-console-input",
      ".command-center-shell.workspace-theme-night .workspace-input-page .command-console-input",
    ],
  },
  roles: {
    workspaceInputDesktop: {
      selectorRole: "workspaceInput",
      context: "@media (min-width: 901px)",
      declarations: {
        "line-height": "1.76",
      },
    },
    workspaceInputShort: {
      selectorRole: "workspaceInput",
      context: "@media (min-width: 901px) and (max-height: 560px)",
      declarations: {
        "font-size": "var(--text-body)",
        "line-height": "1.74",
      },
    },
    workspaceInputCompact: {
      selectorRole: "workspaceInput",
      context: "@media (min-width: 901px) and (max-height: 430px)",
      declarations: {
        "font-size": "var(--text-control)",
        "font-weight": "500",
        "line-height": "1.74",
        "letter-spacing": "var(--tracking-body)",
      },
    },
    workspaceInputExtraCompact: {
      selectorRole: "workspaceInput",
      context: "@media (min-width: 901px) and (max-height: 380px)",
      declarations: {
        "line-height": "1.7",
      },
    },
    workspaceInputMinimum: {
      selectorRole: "workspaceInput",
      context: "@media (min-width: 901px) and (max-height: 340px)",
      declarations: {
        "line-height": "1.7",
      },
    },
    workspaceInputMobile: {
      selectorRole: "workspaceInput",
      context: "@media (max-width: 720px)",
      declarations: {
        "font-size": "var(--text-body)",
        "font-weight": "500",
        "line-height": "1.68",
        "letter-spacing": "var(--tracking-body)",
      },
    },
  },
} as const;

export const frontendSpacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const frontendShape = {
  structuralRadius: "0",
  microRadius: "2px",
  controlRadius: "2px",
  panelRadius: "2px",
  softRadius: "2px",
  workbenchRadius: "2px",
  circleRadius: "50%",
  controlHeight: "44px",
  compactControlHeight: "36px",
  iconHitArea: "44px",
} as const;

export const userVisibleRoutes = [
  "/",
  "/archive",
  "/ask",
  "/auth/callback",
  "/demo",
  "/dispatch",
  "/documents",
  "/dryrun",
  "/evidence",
  "/evidence-file",
  "/home",
  "/interpretation/[id]",
  "/knowledge",
  "/knowledge/[section]/[slug]",
  "/law/[id]",
  "/login",
  "/ontology",
  "/ops/api",
  "/precedent/[id]",
  "/preview",
  "/prototype",
  "/reports",
  "/roadmap",
  "/search",
  "/settings",
  "/settings/ai-connect",
  "/share/[sessionId]",
  "/tbm",
  "/trust",
  "/why",
  "/worker",
  "/workers",
  "/workspace",
] as const;

/**
 * SafeClaw 화면 계약의 **명시적 예외** — 독립 도구 라우트.
 *
 * 연차 도구(2026-09-23~)는 SafeClaw 작업 화면이 아니라 자체 골격·자체 스타일
 * (app/tools/leave/layout.tsx · app/tools/leave/leave.css)을 쓰는 별도 도구다.
 * 그래서 userVisibleRoutes(라우트 가족 분류·브라우저 증빙 111행·의미 역할별
 * 글자 튜플)에 넣지 않고 여기에 따로 등록한다. 라우트 발견 검사는
 * 「userVisibleRoutes ∪ standaloneToolRoutes = app/ 의 page.tsx 전부」를 요구하므로
 * 새 page.tsx 는 어느 쪽에든 반드시 등록돼야 한다(조용히 빠지는 경로는 없다).
 * 이 도구의 계산·가드레일 검증은 `npm run leave:test` 가 맡는다.
 */
export const standaloneToolRoutes = [
  // 개인정보 처리방침(2026-10-25 PR-19). SafeClawModuleShell 을 쓰지만 브라우저 증빙(111행)을
  // 다시 찍기 전까지 명시적 예외로 둔다. 다음 브라우저 감사 갱신 때 userVisibleRoutes(landing)로 옮긴다.
  "/privacy",
  "/tools/leave",
  "/tools/leave/advanced",
  "/tools/leave/settlement",
  // 동영상 위험 점검 v0(2026-10-25 TASK-824). 관리자 로그인 전용 시험 화면이라 브라우저 증빙(111행)을
  // 찍기 전까지 명시적 예외로 둔다. 운영 화면 진입점을 붙일 때 userVisibleRoutes 로 옮긴다.
  "/tools/video-check",
] as const;

export const specialSurfaceFiles = [
  "app/not-found.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
  "app/workspace/loading.tsx",
] as const;

export const generatedSurfaceFiles = [
  "components/WorkpackEditor.tsx",
  "app/api/export/pdf/route.ts",
] as const;

// 타이포 역할 분류의 단일 정본(/correct 261027).
// 판정은 감사 스크립트(scripts/frontend_consistency_audit.mjs)가 이 두 표와
// scripts/frontend_typography_classifier.mjs 로만 한다. vitest 계약
// (tests/frontend-design-contract.test.ts)은 같은 판정을 따로 구현하지 않고 감사를 돌린다.
// 예전에는 표와 분류 함수가 두 벌이라 #121 에서 같은 textarea 가
// 한쪽은 longform, 한쪽은 body 로 갈렸다.
export const frontendTypographyRoles = {
  display: { size: "var(--text-display)", weight: "800", lineHeight: "var(--leading-display)", tracking: "var(--tracking-display)" },
  pageTitle: { size: "var(--text-page-title)", weight: "800", lineHeight: "var(--leading-page-title)", tracking: "var(--tracking-page-title)" },
  sectionTitle: { size: "var(--text-section-title)", weight: "800", lineHeight: "var(--leading-section-title)", tracking: "var(--tracking-section-title)" },
  componentTitle: { size: "var(--text-component-title)", weight: "700", lineHeight: "var(--leading-component-title)", tracking: "var(--tracking-component-title)" },
  bodyLarge: { size: "var(--text-body-lg)", weight: "500", lineHeight: "var(--leading-body-lg)", tracking: "var(--tracking-body)" },
  body: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  longform: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-longform)", tracking: "var(--tracking-body)" },
  support: { size: "var(--text-support)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  control: { size: "var(--text-control)", weight: "700", lineHeight: "var(--leading-control)", tracking: "var(--tracking-body)" },
  table: { size: "var(--text-table)", weight: "500", lineHeight: "var(--leading-table)", tracking: "var(--tracking-body)" },
  caption: { size: "var(--text-caption)", weight: "600", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  tableHeader: { size: "var(--text-caption)", weight: "700", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  hud: { size: "var(--text-hud)", weight: "700", lineHeight: "var(--leading-hud)", tracking: "var(--tracking-hud)", fontFamily: "var(--font-hud)" },
} as const;

export const frontendSemanticRoleOverrides = {
  ".safeclaw-login": "control",
  ".safeclaw-contact": "control",
  ".law-section-lines p": "longform",
  ".legal-reading-body": "longform",
  ".knowledge-detail-card p": "longform",
  ".knowledge-detail-card li": "longform",
  ".command-center-shell .command-primary": "control",
  ".safeclaw-os-cta button": "control",
  ".safeclaw-os-cta a": "control",
  ".safeclaw-module-primary": "control",
  ".safeclaw-module-actions a": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-primary": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-actions a": "control",
  ".command-center-shell .brand-lockup small": "caption",
  ".command-center-shell .topbar-status span": "hud",
  ".command-center-shell .step-copy small": "hud",
} as const satisfies Readonly<Record<string, keyof typeof frontendTypographyRoles>>;
