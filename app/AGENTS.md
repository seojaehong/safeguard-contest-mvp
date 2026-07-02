# app/ 관례

- 특수 파일(not-found.tsx, error.tsx, global-error.tsx, loading.tsx)의 표준 마크업 패턴:
  `<main className="container grid"><section className="card list">` + `.h2`(제목) + `.muted`(설명) + `.button`(액션). 새 특수 파일도 이 톤을 따를 것.
- globals.css에 `spin` 키프레임이 전역 정의돼 있음(.button-spinner용) — 스피너는 inline style로 `animation: "spin 0.8s linear infinite"` 재사용 가능. 새 키프레임 추가 금지.
- 안내 문구는 한국어 합니다체. 색상은 CSS 변수(--accent, --line-strong 등)만 사용, 하드코딩 hex 금지.
- 'use client' 페이지는 app/home, app/archive뿐 — 나머지 page.tsx는 서버 컴포넌트라 `export const metadata` 직접 가능.
- 공개 페이지 기준 목록(sitemap·metadata 일관성): /, /workspace, /why, /trust, /roadmap, /ask, /knowledge, /login. /ops·/dryrun은 robots Disallow.
