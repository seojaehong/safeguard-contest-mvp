# Workspace 입력 가독성 계약 검증

## 판정

최신 backend `693ec41bc330baa2933d25bff824885356bd8bcb` 위로 재베이스한 소스 HEAD `4a700c233d0c742970330e6f666b71582e3211c6`에서 PASS했다.

- 변경 파일: `app/globals.css`, `tests/workspace-input-css-contract.test.ts`
- DB, 환경변수, migration 변경: 0
- final production build: 27/27, BUILD_ID `WIEPy5P-dm17UtXVMpY2i`
- static contract: 3/3
- production layout regression: 21/21
- strict typecheck: PASS
- `git diff --check`: PASS

## 복구한 계약

| 구간 | 입력창 계약 |
|---|---|
| 기본 데스크톱 | padding `22px 24px`, font `17px`, line-height `1.76` |
| 높이 560px 이하 | padding `18px`, font `15px`, line-height `1.74`, min-height `124px` |
| 높이 430px 이하 | font `14px`, line-height `1.74` |
| 높이 380px 이하 | padding `14px 15px`, line-height `1.70`, min-height `116px` |
| 높이 340px 이하 | padding `14px 12px`, line-height `1.70`, min-height `108px` |
| 모바일 | padding `16px`, font `15px`, line-height `1.68`, min-height `142px` |

## TDD와 원인

초기 정적 테스트는 2 failed / 1 passed로 시작했다. 이후 production matrix에서 다음 후단 cascade 소유자가 순차적으로 확인됐다.

1. `1638x510`: 후단 compact 규칙이 W7의 `124px / 15px`를 `118px / 13px`로 덮었다.
2. `1440x410`: `--text-body`와 `--leading-body`가 기대한 `14px / 1.74`가 아니었다.
3. `390x844`: 후단 모바일 규칙이 `142px`를 `150px`로 다시 덮었다.
4. 모바일 line-height 토큰은 `1.65`여서 요구한 `1.68`과 달랐다.

중간 production run 두 번은 수정 전 `.next`를 사용했다. production harness가 빌드를 만들지 않고 현재 `.next`를 `next start`로 실행한다는 원인을 확인한 뒤, 각 소스 커밋 다음에 새 build를 만든 결과만 판정에 사용했다. `build-superseded-*`와 `pre-rebase-*` 로그는 이 구분을 보존한다.

## 최종 증거

- `static-contract-final.log`: 1 file, 3 tests PASS
- `typecheck-final.log`: strict TypeScript PASS
- `build-final.log`, `build-id-final.txt`: 27 pages, final BUILD_ID
- `prod-layout-matrix-final.log`: Day/Night 7개 viewport를 포함한 21 tests PASS
- RED 로그: `red-static-contract.log`, `red-cascade-owner.log`, `red-430-readability.log`, `red-mobile-owner.log`, `red-mobile-line-height.log`

## 남은 범위

이 판정은 padding 브랜치 단독 증거다. KOSHA, MCP, Reports 통합 HEAD에 선택 병합한 후 전체 serial test, PDF/NFT/direct POST, frontend static audit, 108-row browser audit를 다시 실행해야 한다.
