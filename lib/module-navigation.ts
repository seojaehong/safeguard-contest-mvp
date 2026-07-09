export type ModuleNavChild = {
  href: string;
  label: string;
};

export type ModulePrimaryNavItem = {
  href: string;
  code: string;
  label: string;
  hint: string;
  children: ModuleNavChild[];
};

export const modulePrimaryNav = [
  {
    href: "/workspace",
    code: "01",
    label: "작업공간",
    hint: "입력 · 생성",
    children: [{ href: "/home", label: "대시보드" }]
  },
  {
    href: "/documents",
    code: "02",
    label: "문서",
    hint: "위험성평가 · TBM",
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
    children: []
  },
  {
    href: "/evidence",
    code: "04",
    label: "근거",
    hint: "DB · 온톨로지",
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
    children: [{ href: "/evidence-file", label: "책임자 방어 파일" }]
  },
  {
    href: "/settings",
    code: "06",
    label: "설정",
    hint: "AI · 현장",
    children: [{ href: "/settings/ai-connect", label: "내 AI 연결" }]
  }
] satisfies ModulePrimaryNavItem[];

export function getModuleNavModel(activeHref?: string) {
  const activeSection = modulePrimaryNav.find((item) => (
    item.href === activeHref || item.children.some((child) => child.href === activeHref)
  )) ?? modulePrimaryNav[0];

  return {
    primaryItems: modulePrimaryNav.map((item) => ({
      ...item,
      isActive: item.href === activeHref || item.children.some((child) => child.href === activeHref)
    })),
    activeSection,
    secondaryItems: activeSection.children.map((child, index) => ({
      ...child,
      code: `${index + 1}`.padStart(2, "0"),
      isActive: child.href === activeHref
    }))
  };
}
