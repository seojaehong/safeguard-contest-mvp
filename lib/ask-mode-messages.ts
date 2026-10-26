// /api/ask 모드 강등 안내 문구. 서버(ask-mode-admission)와 클라이언트(작업공간 입력 단계)가 같은 문장을 쓴다.
// 이 파일은 의존성이 없어야 한다 — 클라이언트 컴포넌트가 import 하므로 supabase-admin 등 서버 모듈을 끌어오지 않는다.

export const ANONYMOUS_MESSAGE =
  "로그인하지 않은 체험에서는 기본 문서(템플릿)만 만듭니다. AI 보강 문서는 관리자 로그인 뒤 쓸 수 있습니다.";
export const DAILY_CAP_MESSAGE =
  "오늘 사이트 전체 AI 생성 한도를 다 써서 기본 문서(템플릿)로 만들었습니다. 자정(KST)이 지나면 다시 AI 보강을 쓸 수 있습니다.";
