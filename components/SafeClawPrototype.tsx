"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScreenGroup = "진입" | "제품" | "필드" | "시스템";

type ScreenId =
  | "landing-a"
  | "landing-b"
  | "login"
  | "home"
  | "workspace-a"
  | "workspace-b"
  | "docs"
  | "evidence"
  | "workers"
  | "dispatch"
  | "mobile"
  | "tbm"
  | "archive"
  | "knowledge"
  | "api"
  | "settings";

type PrototypeScreen = {
  group: ScreenGroup;
  id: ScreenId;
  label: string;
  num: string;
  title: string;
  subtitle: string;
  primary: string;
  metrics: Array<[string, string]>;
};

type RouteHint = "/" | "/demo" | "/workspace" | "/knowledge" | "/dryrun";

const screens: PrototypeScreen[] = [
  { group: "진입", id: "landing-a", label: "랜딩 - 보수안", num: "01", title: "오늘 작업을 안전 문서팩으로.", subtitle: "공식 근거와 현장 전파까지 한 흐름으로 보여주는 대표 랜딩입니다.", primary: "제품 설명 중심", metrics: [["CTA", "작업 시작"], ["톤", "안정"]]},
  { group: "진입", id: "landing-b", label: "랜딩 - 과감안", num: "02", title: "한 줄 입력에서 문서와 전파까지.", subtitle: "IR/시연용으로 더 강한 메시지와 큰 타이포를 쓰는 랜딩 변형입니다.", primary: "시연 임팩트", metrics: [["CTA", "30초 데모"], ["톤", "강함"]]},
  { group: "진입", id: "login", label: "로그인", num: "03", title: "관리자 계정으로 이력을 저장합니다.", subtitle: "비회원 임시 저장과 관리자 이력 저장을 명확히 구분합니다.", primary: "이메일 OTP", metrics: [["저장", "Supabase"], ["모드", "관리자"]]},
  { group: "제품", id: "home", label: "홈 대시보드", num: "04", title: "오늘 처리할 현장을 먼저 보여줍니다.", subtitle: "다현장 상태, API 연결, 미완료 교육, 전파 실패를 한 화면에서 확인합니다.", primary: "현장 현황", metrics: [["현장", "3곳"], ["알림", "5건"]]},
  { group: "제품", id: "workspace-a", label: "워크스페이스 A", num: "05", title: "좌측 브리프와 중앙 작업공간을 함께 봅니다.", subtitle: "현재 구현된 문서팩 생성 흐름을 SafeClaw 셸로 감싸는 1차 목표 화면입니다.", primary: "듀얼 패널", metrics: [["문서", "11종"], ["API", "조합"]]},
  { group: "제품", id: "workspace-b", label: "워크스페이스 B", num: "06", title: "입력과 결과를 단일 컬럼으로 압축합니다.", subtitle: "태블릿과 좁은 화면에서 쓰기 쉬운 작업공간 변형입니다.", primary: "단일 패널", metrics: [["초점", "입력"], ["화면", "태블릿"]]},
  { group: "제품", id: "docs", label: "문서 편집", num: "07", title: "문서별 편집과 보완 제안을 나란히 둡니다.", subtitle: "위험성평가, 작업계획서, TBM, 안전교육 기록을 제출 서식 기준으로 편집합니다.", primary: "3-pane", metrics: [["정식", "XLS/HWPX/PDF"], ["보완", "삽입"]]},
  { group: "제품", id: "evidence", label: "근거 라이브러리", num: "08", title: "법령, KOSHA, 재해사례를 문서 문장에 연결합니다.", subtitle: "인용할 근거와 현재 문서 반영 위치를 함께 보여주는 화면입니다.", primary: "근거 매핑", metrics: [["법령", "조문"], ["자료", "KOSHA"]]},
  { group: "제품", id: "workers", label: "작업자 · 교육", num: "09", title: "작업자, 언어, 교육 상태를 한곳에서 봅니다.", subtitle: "연락처, 국적, 주 사용 언어, 신규 여부, 교육 확인 상태를 최소 정보로 관리합니다.", primary: "교육 확인", metrics: [["작업자", "명단"], ["언어", "자동"]]},
  { group: "제품", id: "dispatch", label: "현장 전파", num: "10", title: "메일과 문자 전송 결과를 기록합니다.", subtitle: "카카오와 밴드는 준비 중으로 잠그고, 제출 기준은 메일과 문자로 고정합니다.", primary: "실발송 로그", metrics: [["메일", "연결"], ["문자", "연결"]]},
  { group: "필드", id: "mobile", label: "작업자 모바일", num: "11", title: "작업자는 핵심 공지만 확인합니다.", subtitle: "작업자용 화면은 길게 설명하지 않고 위험, 조치, 확인만 보여줍니다.", primary: "모바일 확인", metrics: [["문장", "짧게"], ["언어", "선택"]]},
  { group: "필드", id: "tbm", label: "TBM 풀스크린", num: "12", title: "현장 조회용 TBM 화면입니다.", subtitle: "작업 전 회의에서 크게 띄워 읽는 위험요인, 질문, 확인 항목 중심 화면입니다.", primary: "회의 모드", metrics: [["질문", "3개"], ["확인", "서명"]]},
  { group: "시스템", id: "archive", label: "이력 · 아카이브", num: "13", title: "과거 문서팩과 전파 이력을 검색합니다.", subtitle: "현장, 날짜, 공정, 작업자, 위험유형 기준으로 이전 기록을 찾습니다.", primary: "검색 이력", metrics: [["문서팩", "저장"], ["로그", "전파"]]},
  { group: "시스템", id: "knowledge", label: "지식 DB", num: "14", title: "법령과 공식자료를 지식층으로 관리합니다.", subtitle: "기초 DB와 API 스냅샷을 분리해 최신성과 재현성을 함께 확보합니다.", primary: "지식층", metrics: [["법령", "전문"], ["자료", "증분"]]},
  { group: "시스템", id: "api", label: "API 연결", num: "15", title: "공공 API 연결 상태를 운영자가 확인합니다.", subtitle: "기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결 상태를 점검합니다.", primary: "연결 점검", metrics: [["상태", "채널별"], ["로그", "저장"]]},
  { group: "시스템", id: "settings", label: "설정", num: "16", title: "조직, 현장, 전파 채널을 설정합니다.", subtitle: "제출 전에는 필수 설정만 노출하고, 결제와 고급 권한은 후속 범위로 둡니다.", primary: "운영 설정", metrics: [["조직", "현장"], ["채널", "메일/SMS"]]}
];

const routeHints: Partial<Record<ScreenId, RouteHint>> = {
  "landing-a": "/",
  "landing-b": "/demo",
  login: "/workspace",
  "workspace-a": "/workspace",
  "workspace-b": "/workspace",
  knowledge: "/knowledge",
  api: "/dryrun"
};

function getInitialScreen(): ScreenId {
  if (typeof window === "undefined") return "landing-a";
  const hash = window.location.hash.replace("#", "");
  return screens.some((screen) => screen.id === hash) ? (hash as ScreenId) : "landing-a";
}

export function SafeClawPrototype() {
  const [activeId, setActiveId] = useState<ScreenId>(getInitialScreen);
  const activeScreen = useMemo(
    () => screens.find((screen) => screen.id === activeId) || screens[0],
    [activeId]
  );

  useEffect(() => {
    const onHashChange = () => setActiveId(getInitialScreen());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const groupedScreens = useMemo(() => {
    return screens.reduce<Record<ScreenGroup, PrototypeScreen[]>>(
      (acc, screen) => {
        acc[screen.group].push(screen);
        return acc;
      },
      { 진입: [], 제품: [], 필드: [], 시스템: [] }
    );
  }, []);

  function selectScreen(id: ScreenId) {
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <main className="safeclaw-prototype-shell" aria-label="SafeClaw 16 화면 프로토타입">
      <aside className="safeclaw-prototype-rail">
        <Link href="/" className="safeclaw-prototype-logo" aria-label="SafeClaw 홈으로 이동">safeclaw</Link>
        <p>PRODUCT MAP · 16 SCREENS</p>
        {Object.entries(groupedScreens).map(([group, groupScreens]) => (
          <section key={group}>
            <h2>{group}</h2>
            {groupScreens.map((screen) => (
              <button
                key={screen.id}
                type="button"
                className={screen.id === activeId ? "active" : ""}
                onClick={() => selectScreen(screen.id)}
              >
                <span>{screen.num}</span>
                <strong>{screen.label}</strong>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <section className="safeclaw-prototype-main">
        <header className="safeclaw-prototype-topbar">
          <span><i /> SITE 강남현장 B동</span>
          <span>API <b>Law.go</b> · <b>KOSHA</b> · 기상청</span>
          <span>SCREEN {activeScreen.num} / 16</span>
          <Link href="/workspace">실제 작업공간</Link>
        </header>

        <section className="safeclaw-prototype-stage">
          <div className="safeclaw-prototype-title">
            <span>{activeScreen.group} · {activeScreen.num}</span>
            <h1>{activeScreen.title}</h1>
            <p>{activeScreen.subtitle}</p>
          </div>

          <div className="safeclaw-prototype-grid">
            <article className="safeclaw-prototype-card primary">
              <span>{activeScreen.primary}</span>
              <h2>{activeScreen.label}</h2>
              <p>이 화면은 디자인 프로토타입의 구조를 실제 앱 안에서 탐색 가능하게 옮긴 1차 골격입니다.</p>
              {routeHints[activeScreen.id] ? (
                <Link href={routeHints[activeScreen.id] || "/workspace"}>연결된 기능 열기 →</Link>
              ) : (
                <button type="button">후속 구현 대상</button>
              )}
            </article>

            <article className="safeclaw-prototype-card">
              <span>운영 기준</span>
              <h2>기능 매핑</h2>
              <ul>
                <li>기존 API 호출과 문서 생성 엔진은 유지합니다.</li>
                <li>화면 구조와 이동 체계를 먼저 제품형으로 고정합니다.</li>
                <li>각 화면은 후속 패스에서 기존 기능과 단계적으로 연결합니다.</li>
              </ul>
            </article>

            <article className="safeclaw-prototype-card">
              <span>상태</span>
              <h2>반영 수준</h2>
              <div className="safeclaw-prototype-metrics">
                {activeScreen.metrics.map(([label, value]) => (
                  <p key={label}><b>{label}</b><strong>{value}</strong></p>
                ))}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
