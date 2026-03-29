# Patch Notes — 2026-03-29

## 대상
- 외부 E2E 검증 스크립트: `/home/ubuntu/telegram-codex-workspace/mvp_e2e.py`

## 반영 내용
- 기본 공공 API 호출 방식을 `curl` 중심에서 `requests` 기반으로 정리
- 기본 timeout을 `12초`에서 `20초`로 상향
- timeout / `429` 발생 시 1회 재시도(backoff 포함) 추가
- 우선 보강 대상:
  - `weather_current`
  - `warning_list`
  - `legal_search`

## 확인 결과
- 문법 체크 통과 (`py_compile`)
- dry-run 재실행 성공
- 산출물 파일:
  - `/home/ubuntu/telegram-codex-workspace/artifacts/dry_run_output_after_patch.json`

## 메모
- `telegram-codex-workspace`는 현재 git 저장소가 아니어서 그 위치 자체에는 커밋하지 못했다.
- 변경 이력은 이 문서로 워크스페이스에 남긴다.
