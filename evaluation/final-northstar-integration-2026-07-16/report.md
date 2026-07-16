# SafeClaw North Star 통합 검증 보고서

검증 기준 HEAD: `42dd73fa3016431eb3d26f966fa73e8665fe1177`

## 통합 범위

- Phase A 근거 하네스: SIF 사례 -> KOSHA Guide -> 현행 법령 -> LLM 문장화
- 추락·끼임·감전의 corpus-backed SIF Accident overlay
- KOSHA D-C-7 공식 PDF와 정규화 본문의 정확 해시·복구 프로토콜
- 작업공간, 문서, 공유를 포함한 32개 제품 라우트 정적·브라우저 계약
- 기존 tenant memory, 공개 MCP, 문서 내보내기 계약 보존

DB migration, schema 변경, 대량 데이터 수정은 수행하지 않았다.

## 검증 결과

| 게이트 | 결과 |
| --- | --- |
| KOSHA 복구 Python | 73 / 73 PASS |
| SIF·KOSHA·온톨로지 통합 | 17 files / 369 tests PASS |
| 프론트 감사 계약 | 3 files / 42 tests PASS |
| strict typecheck | PASS |
| 정적 프론트 감사 | 32 pages / 23 components / coverage 0 / violations 0 / important 0 |
| normal production build | PASS, 28 / 28 static pages |
| audit production build | PASS, 28 / 28 static pages |
| normal bundle | PASS, 293 chunks, audit marker 0 |
| audit bundle | PASS, 294 chunks, required marker 1 |
| 브라우저 감사 | 32 routes / 108 screenshots / failures 0 / findings 0 / recovered 0 |

## KOSHA 정확 본문

- 대상: KOSHA Guide `D-C-7`
- 공식 PDF SHA-256: `5059f9faefe6f5e1a81fb750a3a96e842508b38c1b420bbda935b698aa864ff3`
- 정규화 본문 SHA-256: `97c58f2c39260e9e763bae54748466f0837064ddccfc8e29b77d857c9f390112`
- 분량: 71 pages / 38,781 chars
- 복구 프로토콜: `recoverable-handle-bound-pair/v4`
- receipt 검사: 23 / 23 PASS

공식 PDF 자체는 저장소에 커밋하지 않았다. 취득·검증·승격 과정은 Windows reparse-safe handle과 POSIX `O_NOFOLLOW`/`dir_fd` 경계로 경로 교체 공격과 중단 복구를 fail-closed 처리한다.

## 브라우저 계약

- source SHA: `42dd73fa3016431eb3d26f966fa73e8665fe1177`
- source identity: `aa4c9fa1233852739a5c7dd7602ab70e58a747d53029e1a1fe52afd7e662793a`
- route rows: 96
- workspace Day/Night rows: 6
- special surface rows: 4
- generated surface rows: 2
- total: 108 / 108 successful
- elapsed: 140,202 ms

## 아직 닫히지 않은 운영 게이트

- D-C-7 단일 정확 본문은 승인됐지만 KOSHA 234개 후보 전체를 production trusted corpus로 승격한 것은 아니다.
- Hermes/OpenClaw 코드 계약은 유지되지만 실제 앱 런타임은 현재 disabled/unavailable 상태다. durable worker·queue·lease·checkpoint 구현 완료를 주장하지 않는다.
- Supabase RLS 감사의 `launchReadiness=false`는 정책 보완과 사용자 승인 전까지 유지한다.
- 이 보고서는 로컬 통합 HEAD 검증이다. 원격 push 후 CI/Vercel preview와 실제 production 매핑은 별도 확인한다.

## 증거

- `../frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `../frontend-audit-runner-port-v2-2026-07-11/bundle-normal.json`
- `../frontend-audit-runner-port-v2-2026-07-11/bundle-audit.json`
- `../frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `../frontend-audit-runner-port-v2-2026-07-11/browser-report.md`
- `../phase-a-supabase-rls-audit-2026-07-13/report.md`
