# SafeClaw Codex: Grilling Report & North Star Alignment
**작성일:** 2026-07-09
**작성자:** Manus AI
**대상:** SafeClaw MVP (GitHub Repo: `seojaehong/safeguard-contest-mvp`, Live: `safeclaw.kr`)

---

## 1. 한 줄 판정 (Grill Verdict)
> **"백엔드 엔진은 페라리급이나, 조향 장치(UI)가 고장 났고 트렁크(DB) 정리가 안 되어 있어 심사위원이 시승하다 멀미를 느낄 수준. UI 다이어트와 DB RLS 정리가 시급함."**

현재 상태로 공모전에 출품할 경우, **장려상권(60~74점)**에 머물 위험이 큽니다. 기술적 난이도(기상청, 법령, 12종 문서 생성)는 높으나, 심사위원은 "사용자가 이걸 어떻게 쓰지?"라는 의문을 가질 수밖에 없는 산만한 UI와 미완성된 테넌트 격리 구조가 발목을 잡습니다.

---

## 2. 치명적 약점 (Red Flags) - 즉시 수정 필요

### 2.1. 인지 과부하를 유발하는 UI (UI/UX Disaster)
- **현상:** `safeclaw.kr/workspace` 접속 시, 좌측 사이드바, 중앙 입력창, 우측 상태창, 하단 12종 문서 목록이 한 화면에 쏟아집니다. 특히 생성 완료 후 스크롤이 끝없이 이어지며, 사용자가 무엇을 봐야 할지 길을 잃습니다.
- **심사위원 반론:** "현장소장님들이 바쁜데 이 복잡한 화면을 보고 문서를 만들 수 있나요? 차라리 기존 엑셀이 편하지 않을까요?"
- **해결책:** `SafeGuardCommandCenter.tsx` (1679줄) 분리. 점진적 정보 노출(Progressive Disclosure) 적용. 핵심 3종 문서(위험성평가표, TBM 브리핑, TBM 기록)만 카드형으로 노출하고 나머지는 접어두기.

### 2.2. 구멍 뚫린 테넌트 격리 (DB RLS Missing)
- **현상:** `001_init.sql`의 `query_logs`, `documents` 테이블과 `005_briefing_settings.sql`의 테이블들에 Row Level Security (RLS) 정책이 누락되어 있습니다.
- **심사위원 반론:** "B2B SaaS라면서 A회사가 B회사의 안전 문서를 볼 수 있는 구조 아닌가요? 보안은 어떻게 담보합니까?"
- **해결책:** 모든 마이그레이션 파일 점검 및 누락된 RLS 정책(`enable row level security` 및 `create policy`) 즉시 추가.

### 2.3. 하드코딩된 Mock 데이터의 잔재
- **현상:** `lib/ai.ts`, `lib/lawgo.ts` 등 핵심 로직에 `mock` 분기 처리가 여전히 남아있습니다.
- **심사위원 반론:** "이거 실제 AI가 생성하는 건가요, 아니면 미리 만들어둔 하드코딩 데이터를 보여주는 건가요?"
- **해결책:** 프로덕션 빌드 시 Mock 분기를 완전히 타지 않도록 환경변수(`LAWGO_MOCK_MODE` 등) 통제 및 코드 정리.

---

## 3. 경쟁 우위 (Green Flags) - 강조해야 할 강점

1. **명시적 온톨로지 기반 환각 통제:** 단순 RAG가 아닌 `Task -> Hazard -> Control -> Article`로 이어지는 명시적 그래프 DB(`008_safety_ontology.sql`)를 구축하여 AI의 환각을 원천 차단한 점은 압도적 강점입니다.
2. **다국어 전파 자동화:** 외국인 근로자를 위한 5개 국어 자동 번역 및 N8N 연동 전파 흐름은 현재 산업 현장의 가장 큰 Pain Point를 정확히 짚었습니다.
3. **중처법 대응 이력 증빙:** 단순 문서 생성을 넘어 `workpack_read_confirmations` 테이블을 통해 "작업자가 실제로 읽고 인지했음"을 법적 증빙으로 남기는 구조는 상업화 가능성을 극대화합니다.

---

## 4. North Star Alignment (북극성 정렬)

대표님이 구상하시는 **"Hermes Agent + LLM Wiki 기반의 자율 진화형 안전 에이전트"**는 B2B SaaS의 궁극적 지향점입니다. 현재의 산재된 문제를 해결하면서 이 북극성으로 나아가기 위한 정렬 상태를 점검합니다.

### 4.1. Agent Architecture
- **현재:** Next.js 내부의 경량 에이전트 루프(`lib/agent-loop.ts`) + 외부 API 호출.
- **북극성:** Hermes Python 코어 내재화.
- **정렬 상태:** **보류 (Deferred).** 현재 UI/DB 안정화가 시급하므로, 코어 교체는 상용화(Phase 2) 이후로 미루는 것이 타당합니다. 현재의 "MCP 소비자 + 테넌트 경계" 구조를 단단히 다지는 데 집중해야 합니다.

### 4.2. Knowledge Engine
- **현재:** 정적 JSON 시드 + DB 하네스(`008_safety_ontology.sql`).
- **북극성:** Karpathy 방식의 LLM Wiki (Markdown 기반) + JSONL 자기학습 루프.
- **정렬 상태:** **부분 채택 (Adopted with HITL).** 명시적 온톨로지 구조는 유지하되, 지식의 저장 형태를 Markdown으로 전환하는 것은 유효합니다. 단, 에이전트의 "자동 승격(Auto-promotion)"은 데이터 프라이버시 리스크가 크므로, 반드시 노무사의 승인을 거치는 **Human-in-the-loop (HITL)** 구조로 제한해야 합니다.

---

## 5. 개선 액션 플랜 (Immediate Action Plan)

| 우선순위 | 무엇을 | 어떻게 | 기한 |
|---|---|---|---|
| **P0** | **UI 다이어트** | `SafeGuardCommandCenter.tsx`에서 고급 설정 숨김, 핵심 3종 문서만 우선 노출하도록 레이아웃 개편 | 즉시 |
| **P0** | **DB RLS 보완** | `001_init.sql`, `005_briefing_settings.sql` 등 누락된 테이블에 RLS 정책 추가 | 즉시 |
| **P1** | **Mock 코드 정리** | `lib/ai.ts`, `lib/lawgo.ts`의 Mock 분기 로직 제거 또는 프로덕션 환경변수 통제 강화 | 금주 내 |
| **P2** | **공유 세션 UI 완성** | `workpack_share_sessions` 기반의 작업자 열람 화면(모바일 최적화) 및 "확인" 버튼 연동 | 차주 내 |
| **P3** | **시연 시나리오 픽스** | 3분 이내에 기상청→법령→문서생성→다국어전파 흐름을 보여주는 데모 스크립트 확정 | 제출 전 |

---
*이 리포트는 `ARCHITECTURE_DECISIONS.md` 및 `PHASE_EXECUTION_PLAN.md`와 함께 SafeClaw의 공식 기술 문서로 관리됩니다.*
