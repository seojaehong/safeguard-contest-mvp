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
  status: "live" | "partial" | "planned";
  mappedTo: string;
  scope: string[];
  metrics: Array<[string, string]>;
};

type RouteHint =
  | "/"
  | "/demo"
  | "/workspace"
  | "/workspace#command"
  | "/workspace#workpack"
  | "/workspace#risk"
  | "/workspace#dispatch-overview"
  | "/knowledge"
  | "/dryrun";

const statusLabel: Record<PrototypeScreen["status"], string> = {
  live: "연결됨",
  partial: "부분 연결",
  planned: "이식 예정"
};

const screens: PrototypeScreen[] = [
  { group: "진입", id: "landing-a", label: "랜딩 - 보수안", num: "01", title: "오늘 작업을 안전 문서팩으로.", subtitle: "공식 근거와 현장 전파까지 한 흐름으로 보여주는 대표 랜딩입니다.", primary: "제품 설명 중심", status: "live", mappedTo: "/ · SafeClawLanding", scope: ["브랜드 첫 진입", "작업공간 CTA", "30초 데모 진입"], metrics: [["CTA", "작업 시작"], ["톤", "안정"]]},
  { group: "진입", id: "landing-b", label: "랜딩 - 과감안", num: "02", title: "한 줄 입력에서 문서와 전파까지.", subtitle: "IR/시연용으로 더 강한 메시지와 큰 타이포를 쓰는 랜딩 변형입니다.", primary: "시연 임팩트", status: "partial", mappedTo: "/demo · V2 demo routes", scope: ["5개 시나리오", "자동 시연", "IR 딥링크"], metrics: [["CTA", "30초 데모"], ["톤", "강함"]]},
  { group: "진입", id: "login", label: "로그인", num: "03", title: "관리자 계정으로 이력을 저장합니다.", subtitle: "비회원 임시 저장과 관리자 이력 저장을 명확히 구분합니다.", primary: "이메일 OTP", status: "partial", mappedTo: "/workspace · 저장 상태 패널", scope: ["관리자 저장 안내", "workpacks 저장 API", "Auth UI 후속"], metrics: [["저장", "Supabase"], ["모드", "관리자"]]},
  { group: "제품", id: "home", label: "홈 대시보드", num: "04", title: "오늘 처리할 현장을 먼저 보여줍니다.", subtitle: "다현장 상태, API 연결, 미완료 교육, 전파 실패를 한 화면에서 확인합니다.", primary: "현장 현황", status: "planned", mappedTo: "신규 /home 또는 /workspace 대시보드", scope: ["다현장 카드", "미완료 교육", "전파 실패 요약"], metrics: [["현장", "다현장"], ["알림", "운영"]]},
  { group: "제품", id: "workspace-a", label: "워크스페이스 A", num: "05", title: "좌측 브리프와 중앙 작업공간을 함께 봅니다.", subtitle: "현재 구현된 문서팩 생성 흐름을 SafeClaw 셸로 감싸는 1차 목표 화면입니다.", primary: "듀얼 패널", status: "live", mappedTo: "/workspace#command · SafeGuardCommandCenter", scope: ["기상 선조회", "API 조합", "문서팩 생성"], metrics: [["문서", "11종"], ["API", "조합"]]},
  { group: "제품", id: "workspace-b", label: "워크스페이스 B", num: "06", title: "입력과 결과를 단일 컬럼으로 압축합니다.", subtitle: "태블릿과 좁은 화면에서 쓰기 쉬운 작업공간 변형입니다.", primary: "단일 패널", status: "planned", mappedTo: "워크스페이스 반응형 리패스", scope: ["태블릿 레이아웃", "입력 우선", "결과 접힘"], metrics: [["초점", "입력"], ["화면", "태블릿"]]},
  { group: "제품", id: "docs", label: "문서 편집", num: "07", title: "문서별 편집과 보완 제안을 나란히 둡니다.", subtitle: "위험성평가, 작업계획서, TBM, 안전교육 기록을 제출 서식 기준으로 편집합니다.", primary: "3-pane", status: "live", mappedTo: "/workspace#workpack · WorkpackEditor", scope: ["문서별 탭", "보완 문구 생성", "XLS/HWPX/PDF 출력"], metrics: [["정식", "XLS/HWPX/PDF"], ["보완", "삽입"]]},
  { group: "제품", id: "evidence", label: "근거 라이브러리", num: "08", title: "법령, KOSHA, 재해사례를 문서 문장에 연결합니다.", subtitle: "인용할 근거와 현재 문서 반영 위치를 함께 보여주는 화면입니다.", primary: "근거 매핑", status: "partial", mappedTo: "/workspace#risk · Citation/Evidence panels", scope: ["법령/해석례/판례", "KOSHA 자료", "문서 반영 근거"], metrics: [["법령", "조문"], ["자료", "KOSHA"]]},
  { group: "제품", id: "workers", label: "작업자 · 교육", num: "09", title: "작업자, 언어, 교육 상태를 한곳에서 봅니다.", subtitle: "연락처, 국적, 주 사용 언어, 신규 여부, 교육 확인 상태를 최소 정보로 관리합니다.", primary: "교육 확인", status: "partial", mappedTo: "/workspace#workpack · FieldOperationsWorkspace", scope: ["작업자 대상", "교육 상태", "언어별 안내"], metrics: [["작업자", "명단"], ["언어", "자동"]]},
  { group: "제품", id: "dispatch", label: "현장 전파", num: "10", title: "메일과 문자 전송 결과를 기록합니다.", subtitle: "카카오와 밴드는 준비 중으로 잠그고, 제출 기준은 메일과 문자로 고정합니다.", primary: "실발송 로그", status: "live", mappedTo: "/workspace#dispatch-overview · WorkflowSharePanel", scope: ["n8n dispatch", "메일/SMS", "전파 로그"], metrics: [["메일", "연결"], ["문자", "연결"]]},
  { group: "필드", id: "mobile", label: "작업자 모바일", num: "11", title: "작업자는 핵심 공지만 확인합니다.", subtitle: "작업자용 화면은 길게 설명하지 않고 위험, 조치, 확인만 보여줍니다.", primary: "모바일 확인", status: "planned", mappedTo: "신규 /worker", scope: ["쉬운 한국어", "외국어 전송본", "확인 버튼"], metrics: [["문장", "짧게"], ["언어", "선택"]]},
  { group: "필드", id: "tbm", label: "TBM 풀스크린", num: "12", title: "현장 조회용 TBM 화면입니다.", subtitle: "작업 전 회의에서 크게 띄워 읽는 위험요인, 질문, 확인 항목 중심 화면입니다.", primary: "회의 모드", status: "planned", mappedTo: "신규 /tbm", scope: ["TBM 브리핑", "확인 질문", "출석/서명"], metrics: [["질문", "3개"], ["확인", "서명"]]},
  { group: "시스템", id: "archive", label: "이력 · 아카이브", num: "13", title: "과거 문서팩과 전파 이력을 검색합니다.", subtitle: "현장, 날짜, 공정, 작업자, 위험유형 기준으로 이전 기록을 찾습니다.", primary: "검색 이력", status: "partial", mappedTo: "workpacks / dispatch_logs 저장 API", scope: ["문서팩 저장", "전파 이력", "검색 UI 후속"], metrics: [["문서팩", "저장"], ["로그", "전파"]]},
  { group: "시스템", id: "knowledge", label: "지식 DB", num: "14", title: "법령과 공식자료를 지식층으로 관리합니다.", subtitle: "기초 DB와 API 스냅샷을 분리해 최신성과 재현성을 함께 확보합니다.", primary: "지식층", status: "live", mappedTo: "/knowledge · Knowledge DB", scope: ["법령 전문", "KOSHA 자료", "AI 보강"], metrics: [["법령", "전문"], ["자료", "증분"]]},
  { group: "시스템", id: "api", label: "API 연결", num: "15", title: "공공 API 연결 상태를 운영자가 확인합니다.", subtitle: "기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결 상태를 점검합니다.", primary: "연결 점검", status: "live", mappedTo: "/dryrun · API smoke reports", scope: ["dryrun 리포트", "API smoke", "제출 준비 점검"], metrics: [["상태", "채널별"], ["로그", "저장"]]},
  { group: "시스템", id: "settings", label: "설정", num: "16", title: "조직, 현장, 전파 채널을 설정합니다.", subtitle: "제출 전에는 필수 설정만 노출하고, 결제와 고급 권한은 후속 범위로 둡니다.", primary: "운영 설정", status: "planned", mappedTo: "신규 /settings", scope: ["조직/현장", "채널 env 점검", "권한 후속"], metrics: [["조직", "현장"], ["채널", "메일/SMS"]]}
];

const routeHints: Partial<Record<ScreenId, RouteHint>> = {
  "landing-a": "/",
  "landing-b": "/demo",
  login: "/workspace",
  "workspace-a": "/workspace#command",
  docs: "/workspace#workpack",
  evidence: "/workspace#risk",
  workers: "/workspace#workpack",
  dispatch: "/workspace#dispatch-overview",
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
              <div className="safeclaw-prototype-card-kicker">
                <span>{activeScreen.primary}</span>
                <em className={`safeclaw-prototype-status ${activeScreen.status}`}>
                  {statusLabel[activeScreen.status]}
                </em>
              </div>
              <h2>{activeScreen.label}</h2>
              <p>디자이너 프로토타입을 현재 SafeClaw 기능과 다시 연결한 화면입니다. 쇼룸이 아니라 실제 이식 기준으로 씁니다.</p>
              <p className="safeclaw-prototype-map-target">{activeScreen.mappedTo}</p>
              {routeHints[activeScreen.id] ? (
                <Link href={routeHints[activeScreen.id] || "/workspace"}>현재 기능 열기 →</Link>
              ) : (
                <button type="button">이식 예정</button>
              )}
            </article>

            <article className="safeclaw-prototype-card">
              <span>기능 범위</span>
              <h2>이 화면이 담당하는 일</h2>
              <ul className="safeclaw-prototype-scope">
                {activeScreen.scope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
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
