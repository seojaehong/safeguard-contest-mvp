# SafeClaw Agent Work Split 2026-05-03

## Goal

제출 전 마지막 품질 보강을 `실제 DB 변경 없이` 에이전트별로 분리했다. 기준은 안전서류 생성 품질, TBM 반영 품질, HWPX/PDF 제출 서식, Supabase 적재 준비 상태를 각각 독립적으로 확인하는 것이다.

## Agent Split

| Agent | Scope | Output | DB mutation |
| --- | --- | --- | --- |
| Russell | Supabase 적재 후보 생성, 중복/실패/분류 검증 | `evaluation/supabase-safety-ingestion-ready-2026-05-03/*` | No |
| Hilbert | HWPX/서식 렌더링 경로 분석, 문서별 구조 차별화 | HWPX 렌더링 분석 리포트, WorkpackEditor 개선 후보 | No |
| Helmholtz | 고용노동부 TBM 가이드와 TBM 일지 매핑 | `evaluation/tbm-reference-ingestion/*`, TBM 품질 보강 후보 | No |
| Confucius | PDF 바이너리 렌더러 가능성, Playwright PDF route 검토 | PDF renderer readiness 후보 | No |
| Codex main | 제출 브랜치 통합, 안전한 범위만 반영, build/typecheck 검증 | 문서 종류별 PDF print route 보강 | No |

## Current Integrated Work

- `app/api/export/pdf/route.ts`에서 PDF print HTML을 문서명 기준으로 분기한다.
- 위험성평가표는 `사전준비 -> 유해·위험요인 파악 및 위험성 결정 -> 감소대책 -> 공유·교육 및 재평가` 구조로 렌더링한다.
- 작업계획서는 `작업개요 -> 세부 작업순서 -> 장비·인원·첨부서류 -> 작업중지 및 재개 기준` 구조로 렌더링한다.
- 허가서는 `허가 기본정보 -> 작업 전 허가조건 -> 첨부서류 및 종료 확인` 구조로 렌더링한다.
- TBM은 `회의 정보 -> 위험성평가 기반 전달사항 -> 참석자 확인 -> 미조치 위험 및 증빙` 구조로 렌더링한다.
- 안전보건교육 기록은 `교육 개요 -> 교육 내용 및 이해 확인 -> 교육 실시 및 보관` 구조로 렌더링한다.

## Verification

| Check | Result | Note |
| --- | --- | --- |
| `npm.cmd run typecheck` | Pass | TypeScript compile check passed |
| `npm.cmd run build` | Pass | `.next` build artifact was removed first because OneDrive readlink failed |
| DB mutation | Not run | Supabase payload and SQL are candidate artifacts only |
| PDF output level | Improved | Browser/print HTML is document-specific; true binary PDF renderer remains separate gate |
| HWPX pixel-perfect clone | Not closed | 원본 셀 단위 복제는 별도 템플릿 렌더러가 필요 |

## Closing Decision

이번 패스는 `제출 브랜치에 안전하게 들어갈 수 있는 문서별 PDF 구조화`와 `에이전트별 후보 산출물 정리`까지 닫았다. 실제 Supabase 대량 적재, 원본 HWPX 셀 복제, 서버 바이너리 PDF 렌더러는 별도 승인과 인프라 선택 후 진행해야 한다.
