# SafeClaw Architecture Decisions & North Star Plan
**작성일:** 2026-07-09
**상태:** 확정 (Active)

이 문서는 SafeClaw의 장기 비전(North Star)과 에이전트/지식 엔진 아키텍처에 대한 핵심 의사결정(채택/보류/기각)을 기록합니다. 공모전 MVP 단계를 넘어 실제 상용화 및 투자 유치를 위한 기술 로드맵의 기준점이 됩니다.

---

## 1. North Star Plan (장기 북극성 비전)

SafeClaw의 궁극적인 목표는 단순한 "AI 문서 생성기"가 아니라, **"Agent Orchestration + Harness Engineering 기반의 산업안전 자동화 플랫폼"**입니다.

1. **명시적 지식 기반 (Explicit Knowledge):** AI의 환각을 배제하기 위해, 모든 안전 지식은 노무사가 검증한 명시적 온톨로지(Task → Hazard → Control → Article)를 기반으로 합니다.
2. **테넌트 격리 및 이력 증빙 (Tenant Isolation & Audit):** 각 기업(테넌트)의 현장 데이터와 문서 생성 이력은 철저히 격리되며, 중대재해처벌법 대응을 위한 법적 증빙(Audit Trail)으로 영구 보존됩니다.
3. **점진적 자동화 (Progressive Automation):** 초기에는 Human-in-the-loop(HITL) 방식으로 지식을 관리하고 문서를 검수하지만, 장기적으로는 에이전트가 현장 데이터를 학습하여 스스로 지식을 진화시키는(Self-improving) 구조로 나아갑니다.

---

## 2. Architecture Decision Matrix

최근 오픈소스 에이전트 프레임워크(OpenClaw, Hermes Agent) 및 LLM Wiki 개념 도입에 대한 심층 검토 결과입니다.

### 2.1. Agent Architecture

| 검토 항목 | 결정 | 사유 및 향후 계획 |
|-----------|------|-------------------|
| **MCP 소비자 (MCP Consumer)** | **채택** | 현재의 Next.js 백엔드에서 외부 MCP 도구(기상청, 법령 등)를 호출하는 구조는 안정적이며 즉시 상용화 가능함. |
| **테넌트 경계 (Tenant Boundary)** | **채택** | B2B SaaS의 핵심. 기업 간 데이터 유출을 막고, 각 기업의 고유한 현장 이력을 안전하게 보존하기 위해 필수적임. |
| **장기 비동기 확장 (Async Expansion)** | **채택** | N8N 등을 활용한 메시지 전파, 백그라운드 문서 생성 등 비동기 워크플로우 확장은 서비스 사용성을 크게 높임. |
| **Hermes 코어 교체** | **기각** | 현재 Hermes Agent 코어는 프로덕션 환경에 도입하기에 개발 안정성이 부족함. Next.js 기반의 경량 에이전트 루프 유지. |
| **자동 학습 / 자동 승격** | **기각** | 테넌트 데이터 프라이버시 리스크가 크며, 환각 발생 시 법적 책임 문제가 있음. 현재 단계에서는 도입 불가. |

### 2.2. Knowledge Engine

| 검토 항목 | 결정 | 사유 및 향후 계획 |
|-----------|------|-------------------|
| **명시적 온톨로지 (Explicit Ontology)** | **채택** | 현재 `schema.ts`의 7종 노드/엣지 구조는 안전 도메인에 완벽히 부합함. RAG 대신 이 구조를 지식의 근간으로 삼음. |
| **DB 하네스 (DB Harness)** | **채택** | 온톨로지 데이터를 Supabase DB에 저장하고, `published` 상태만 읽도록 통제하는 현재의 하네스 구조 유지. |
| **테넌트 이력 Export** | **채택** | 각 현장의 문서 생성 및 전파 이력을 JSONL 등으로 추출하여 중처법 증빙 자료로 제공하는 기능 구현. |
| **위키 / Diff 큐 / Worker PoC** | **보류** | 마크다운 기반 LLM Wiki 구조는 방향성이 맞으나, 당장 MVP에 구현하기보다 PoC(Proof of Concept) 단계로 남겨둠. |
| **자동 자기수정 (Self-correction)** | **기각** | 에이전트가 스스로 지식을 수정하는 것은 법적 리스크가 큼. 반드시 도메인 전문가(Human)의 개입이 필요함. |
| **학습 표현 (Learned Representation)** | **기각** | 명시적 온톨로지 대신 신경망 내부에 지식을 숨기는 방식은 설명 가능성(Explainability)이 떨어져 안전 도메인에 부적합함. |

---

## 3. 순차적 도입 로드맵 (Phased Rollout)

### Phase 1: MVP 및 공모전 제출 (현재 ~ 2026.08)
- **목표:** "근거 있는 문서팩 생성 + 현장 전파 증빙"의 핵심 가치 증명
- **실행:**
  - 현재의 Next.js + 경량 에이전트 루프 아키텍처 유지
  - 정적 시드(`core-triples.json`) 기반의 명시적 온톨로지 활용
  - N8N을 통한 다국어 전파 및 열람 이력(Read Confirmation) DB 저장 구현

### Phase 2: B2B SaaS 상용화 및 테넌트 격리 (2026.Q4 ~ 2027.Q1)
- **목표:** 수백 개 기업이 안전하게 사용할 수 있는 B2B 플랫폼 구축
- **실행:**
  - Supabase RLS(Row Level Security)를 활용한 완벽한 테넌트 데이터 격리
  - 기업별 커스텀 서식 및 현장 데이터(JSONL) Export 기능 제공
  - Human-in-the-loop 기반의 온톨로지 지식 업데이트 파이프라인(관리자 도구) 구축

### Phase 3: 지식 엔진 고도화 (PoC) (2027.Q2 ~)
- **목표:** LLM Wiki 개념의 제한적 도입 및 지식 관리 효율화
- **실행:**
  - 온톨로지 노드를 마크다운 파일로 관리하는 LLM Wiki 구조 PoC 진행
  - 에이전트가 테넌트 이력을 익명화하여 분석하고, 새로운 위험/대책 초안(Draft)을 제안하는 Diff 큐 시스템 도입 (최종 승인은 노무사가 수행)
