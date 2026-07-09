# SafeClaw Phase 1~3 상세 실행 계획서
**작성일:** 2026-07-09
**기준 문서:** `ARCHITECTURE_DECISIONS.md`

이 문서는 SafeClaw의 북극성 플랜을 달성하기 위한 Phase 1~3의 구체적인 실행 태스크, 기술 스펙, 그리고 완료 기준(Definition of Done)을 정의합니다. 현재 코드베이스(`010_commercial_operations.sql` 등)의 구현 상태를 바탕으로 작성되었습니다.

---

## Phase 1: MVP 및 공모전 제출 (현재 ~ 2026.08)
**목표:** "근거 있는 문서팩 생성 + 현장 전파 증빙"의 핵심 가치 증명 및 공모전 수상

### 1.1. UI/UX 다이어트 및 사용성 개선
- **태스크:** `SafeGuardCommandCenter.tsx` 등 비대한 컴포넌트 분리 및 "점진적 정보 노출(Progressive Disclosure)" 적용.
- **기술 스펙:**
  - 기본 생성 모드를 "강화(기본)"으로 고정하고 세부 옵션 숨김 처리.
  - 문서 생성 완료 후 12종 문서를 한 번에 나열하지 않고, 핵심 3종(위험성평가표, TBM 브리핑, TBM 기록)만 카드형으로 우선 노출.
- **완료 기준:** 모바일 화면에서 스크롤 없이 핵심 문서 확인 및 공유 버튼 클릭이 가능해야 함.

### 1.2. 공유 세션(Share Session) 및 열람 이력(Read Confirmation) 연동
- **태스크:** 단순 파일 다운로드가 아닌, 작업자 공유 링크 전송 및 열람 이력 DB 저장 기능 활성화.
- **기술 스펙:**
  - `010_commercial_operations.sql`에 정의된 `workpack_share_sessions` 및 `workpack_read_confirmations` 테이블 활용.
  - 공유 링크 접속 시 작업자 식별(이름 입력 또는 사번) 후, 설정된 언어(`language_code`)로 문서 렌더링.
  - "확인했습니다" 버튼 클릭 시 `read_confirmations` 테이블에 타임스탬프 기록.
- **완료 기준:** N8N을 통해 카카오톡/문자로 공유 링크가 발송되고, 작업자가 모바일에서 확인 버튼을 누르면 관리자 대시보드에 실시간으로 열람 이력이 표시되어야 함.

### 1.3. 공모전 심사용 데모 시나리오 확정
- **태스크:** 기상청 API 연동, 법령 매칭, 다국어 전파 흐름을 3분 이내에 보여주는 시연 영상 제작.
- **완료 기준:** `SafeClaw_시연영상_촬영흐름.md`에 정의된 시나리오대로 끊김 없이 시연 가능해야 함.

---

## Phase 2: B2B SaaS 상용화 및 테넌트 격리 (2026.Q4 ~ 2027.Q1)
**목표:** 수백 개 기업이 안전하게 사용할 수 있는 B2B 플랫폼 구축 및 유료화

### 2.1. 완벽한 테넌트 격리 (Tenant Isolation)
- **태스크:** 모든 데이터 접근에 Row Level Security (RLS) 적용.
- **기술 스펙:**
  - `001_init.sql` 및 `002_workspace_productization.sql`의 `organizations`, `sites`, `workers`, `workpacks` 테이블에 대한 RLS 정책 강화.
  - 모든 API 라우트(`app/api/*`)에서 인증된 사용자의 `organization_id`를 검증하는 미들웨어 적용.
- **완료 기준:** A 기업의 관리자가 B 기업의 현장 데이터나 문서팩에 접근하려 할 때 403 Forbidden 에러가 발생해야 함.

### 2.2. 현장 개선 메모리 (Improvement Memory) 활성화
- **태스크:** 현장에서 발견된 위험 요인과 개선 조치를 DB에 축적하여 다음 문서 생성 시 반영.
- **기술 스펙:**
  - `010_commercial_operations.sql`의 `workpack_improvements` 및 `workpack_improvement_photos` 테이블 활용.
  - 작업 전/후 사진 업로드 및 AI 비전 분석(`photo_analysis`) 파이프라인 연동.
- **완료 기준:** 현장소장이 업로드한 개선 조치 사진과 텍스트가 다음 날 동일 작업의 TBM 브리핑 자료에 자동으로 포함되어야 함.

### 2.3. 중처법 대응 이력 Export 기능
- **태스크:** 기업의 안전보건관리체계 구축 증빙을 위한 데이터 추출 기능.
- **기술 스펙:**
  - 특정 기간, 특정 현장의 `workpacks`, `read_confirmations`, `education_records` 데이터를 JSONL 및 엑셀(CSV) 형태로 일괄 다운로드하는 API 구현.
- **완료 기준:** 노동부 근로감독관 방문 시, 클릭 한 번으로 해당 현장의 모든 안전 조치 및 작업자 인지 이력을 증빙 자료로 제출할 수 있어야 함.

---

## Phase 3: 지식 엔진 고도화 (PoC) (2027.Q2 ~)
**목표:** Human-in-the-loop 기반의 LLM Wiki 구조 도입 및 지식 관리 효율화

### 3.1. LLM Wiki (Graph-as-Markdown) 구조 전환
- **태스크:** 정적 JSON 시드(`core-triples.json`)를 마크다운 파일 기반의 위키 구조로 마이그레이션.
- **기술 스펙:**
  - `Task`, `Hazard`, `Control`, `Article` 노드를 각각의 `.md` 파일로 분리하고 Frontmatter로 메타데이터 관리.
  - Git 기반의 버전 관리 및 변경 이력 추적.
- **완료 기준:** 기존 DB 하네스 구조를 유지하면서, 마크다운 파일의 변경사항이 CI/CD 파이프라인(`seed-load.mjs`)을 통해 Supabase DB에 자동 동기화되어야 함.

### 3.2. Diff 큐 시스템 (AI 초안 제안) PoC
- **태스크:** 에이전트가 테넌트 이력을 분석하여 새로운 지식 초안을 제안하는 시스템 구축.
- **기술 스펙:**
  - 백그라운드 워커가 `workpack_improvements` 데이터를 익명화하여 분석.
  - 새로운 위험-대책 엣지가 발견되면 `review_state: draft` 상태의 마크다운 파일 초안 생성.
  - 노무사(관리자) 대시보드에 검토 대기열(Diff Queue)로 표시.
- **완료 기준:** AI가 제안한 초안을 노무사가 승인(`published`로 변경)하면, 즉시 전체 테넌트의 문서 생성 로직에 해당 지식이 반영되어야 함. (자동 승격은 절대 불가, 반드시 Human-in-the-loop 유지)
