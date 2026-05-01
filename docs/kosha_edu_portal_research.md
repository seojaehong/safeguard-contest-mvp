# KOSHA Education Portal Research

## Goal
SafeGuard는 후속 교육 추천을 고용24 사업주훈련만으로 설명하지 않고, KOSHA 안전보건교육포털까지 함께 연결한다. 공모전 가점·공식성 관점에서는 `고용24 live 교육 추천`과 `KOSHA 공식 교육포털 확인`을 병렬로 보여주는 구성이 가장 안전하다.

## Findings
- Public site: `https://edu.kosha.or.kr/`
- The site is a Vue SPA.
- Public OpenAPI documentation was not found.
- The SPA uses browser-callable JSON endpoints under `/api/portal24/bizG`.
- Confirmed unauthenticated endpoints:
  - `POST /api/portal24/bizG/p/GETEA02001/selectEduWayCd`
  - `POST /api/portal24/bizG/p/GETEA02001/selectEduTrgt`
  - `POST /api/portal24/bizG/p/GETEA02001/selectEduInst`
  - `POST /api/portal24/bizG/p/GETEA02001/selectEduCrsList`
- Live metadata confirmed:
  - education methods
  - education targets, including `외국인근로자`
  - education institutions

## Implementation
- `lib/kosha-education.ts` calls KOSHA education metadata endpoints with a 20s timeout.
- Course list lookup is attempted, but empty results or server-side errors are treated as non-blocking.
- The UI shows KOSHA education portal recommendations separately from Work24 recommendations.
- Safety education drafts append a `[KOSHA 교육포털 연계]` section.

## goscrapy Plan
- Repository: `https://github.com/tech-engine/goscrapy`
- Recommended use: offline or scheduled evidence snapshot, not runtime dependency inside Vercel.
- Reason:
  - goscrapy is Go-based and better suited for CLI crawls.
  - Vercel serverless should keep the lightweight JSON adapter path.
  - KOSHA page structure may change, so snapshots should be stored as evaluation evidence, not used as the only live dependency.

## Proposed goscrapy Job
- Start URL: `https://edu.kosha.or.kr/`
- Allowed paths:
  - `/static/js/`
  - `/api/portal24/bizG/p/GETEA02001/`
- Extract:
  - education methods
  - education targets
  - education institutions
  - selected course list responses for `안전`, `외국인`, `위험성평가`, `지게차`
- Output:
  - `evaluation/kosha-edu-snapshot/courses.json`
  - `evaluation/kosha-edu-snapshot/report.md`

## Product Copy
KOSHA 안전보건교육포털 live 메타데이터를 확인해 외국인근로자, 근로자, 관리감독자 등 교육대상과 공식 포털 과정을 후속 교육 후보로 연결합니다.
