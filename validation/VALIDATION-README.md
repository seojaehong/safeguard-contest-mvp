# SafeGuard 검증 체계

## 목적
- 제출용 문서와 별개로, 실제로 무엇이 검증되었는지 누적 기록한다.
- dry-run / live / fallback 결과를 계속 쌓아서 데모 신뢰도를 높인다.

## 운영 원칙
1. 대표 시나리오(골든패스)를 먼저 잠근다.
2. dry-run으로 흐름 완주 여부를 확인한다.
3. live로 실제 API 연결 성공/실패를 기록한다.
4. 실패는 숨기지 않고 retry/backoff/fallback 필요 항목으로 남긴다.

## 대표 시나리오
- `scenarios/scenario-01-seoul-outdoor-wind.json`

## 결과물
- `runs/*.json` : 실행 산출물 원본
- `VALIDATION-LOG.md` : 실행 요약 누적
- `LATEST.md` : 가장 최근 판정 요약
- `CONTEST-TEST-MATRIX-2026-03-31.md` : 공모전 기준 테스트 표
- `DEFENSIVE-UPGRADE-ROADMAP-2026-03-31.md` : 감점 방지/방어 기능 업그레이드 방향
