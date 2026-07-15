export type ModuleNavChild = {
  href: string;
  label: string;
};

export type ModulePrimaryNavItem = {
  href: string;
  code: string;
  label: string;
  hint: string;
  command: ModuleNavChild;
  aliases?: string[];
  children: ModuleNavChild[];
};

export const modulePrimaryNav = [
  {
    href: "/workspace",
    code: "01",
    label: "작업공간",
    hint: "입력 · 생성",
    command: { href: "/workspace", label: "새 작업 시작" },
    aliases: ["/why", "/preview", "/trust", "/roadmap"],
    children: [{ href: "/home", label: "대시보드" }]
  },
  {
    href: "/documents",
    code: "02",
    label: "문서",
    hint: "위험성평가 · TBM",
    command: { href: "/workspace", label: "새 문서팩 만들기" },
    children: [
      { href: "/tbm", label: "TBM 모드" },
      { href: "/workers", label: "작업자 · 교육" },
      { href: "/dispatch", label: "현장 전파" },
      { href: "/worker", label: "작업자 열람" }
    ]
  },
  {
    href: "/reports",
    code: "03",
    label: "리포트",
    hint: "주간 · 월간",
    command: { href: "/workspace", label: "개선 작업 열기" },
    children: []
  },
  {
    href: "/evidence",
    code: "04",
    label: "근거",
    hint: "DB · 온톨로지",
    command: { href: "/search", label: "근거 검색" },
    aliases: ["/ask", "/search"],
    children: [
      { href: "/knowledge", label: "지식 DB" },
      { href: "/ontology", label: "온톨로지" },
      { href: "/ops/api", label: "API 연결" }
    ]
  },
  {
    href: "/archive",
    code: "05",
    label: "이력",
    hint: "증빙 · 파일",
    command: { href: "/workspace", label: "새 작업 시작" },
    children: [{ href: "/evidence-file", label: "책임자 방어 파일" }]
  },
  {
    href: "/settings",
    code: "06",
    label: "설정",
    hint: "AI · 현장",
    command: { href: "/settings/ai-connect", label: "AI 연결 설정" },
    aliases: ["/dryrun"],
    children: [{ href: "/settings/ai-connect", label: "내 AI 연결" }]
  }
] satisfies ModulePrimaryNavItem[];

function isActiveModuleRoute(item: ModulePrimaryNavItem, activeHref?: string) {
  if (!activeHref) return false;
  return item.href === activeHref
    || item.aliases?.includes(activeHref)
    || item.children.some((child) => child.href === activeHref);
}

export function getModuleNavModel(activeHref?: string) {
  const activeSection = modulePrimaryNav.find((item) => isActiveModuleRoute(item, activeHref)) ?? modulePrimaryNav[0];

  return {
    primaryItems: modulePrimaryNav.map((item) => ({
      ...item,
      isActive: isActiveModuleRoute(item, activeHref)
    })),
    activeSection,
    principalCommand: activeSection.command,
    secondaryItems: activeSection.children.map((child, index) => ({
      ...child,
      code: `${index + 1}`.padStart(2, "0"),
      isActive: child.href === activeHref
    }))
  };
}
