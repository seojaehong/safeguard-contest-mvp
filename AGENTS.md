# 에이전트 규칙표

이 저장소에서 에이전트가 되풀이한 실수와, 그것을 **막는 장치**를 짝지어 둔다.
지적을 받으면 실수를 고치고 여기 한 줄을 더한다. 규칙이 이미 있는데 막는 장치가 없으면
그것은 반복이다 — 같은 변경에서 장치를 만든다(pstack `/correct`).

| 규칙 | 막는 장치 | 근거 |
|---|---|---|
| 기다리지 않는 `void x.cancel(...)` 은 `.catch(() => undefined)` 로 끝낸다 | `tests/stream-cancel-catch-contract.test.ts` · `node scripts/check_stream_cancel.mjs` | #124 — abort 리스너 2곳이 unhandledRejection |
| 코드 파일은 작업본에서도 LF | `.gitattributes`(`*.ts`·`*.mjs` 등 `eol=lf`) | 261026·261027 CRLF 셔뱅 SyntaxError |
| 타이포 역할 분류는 한 곳에서 | 표 = `lib/frontend-design-contract.ts`(`frontendTypographyRoles`·`frontendSemanticRoleOverrides`), 함수 = `scripts/frontend_typography_classifier.mjs`. 시험과 감사 스크립트가 같이 쓴다 | #121 — 같은 textarea 를 한쪽은 longform, 한쪽은 body |
| PR 전에 돌릴 시험은 `node scripts/affected_tests.mjs` 로 고른다(바뀐 모듈 import grep 만으로 고르지 않는다) | `tests/affected-tests-selection.test.ts` | #121 — CSS 계약·`/` 브라우저 시험을 놓쳐 CI 18분 |
| 화면 지문 identity 파일(`app/globals.css`·`lib/frontend-design-contract.ts`·`scripts/frontend_*.mjs`·`package.json`)을 바꾸면 `npm.cmd run -s audit:frontend-consistency` 로 `static-audit.json` 을 다시 만들어 같은 PR 에 넣는다 | `affected_tests.mjs` 가 명령을 출력 · CI 의 지문 시험 | #121·#123 |
| 병합 뒤 운영 확인은 `.claude/skills/verify-safeclaw/` 로 | `verify.mts doctor` / `drive` | #123 |

## 판단으로 남긴 것(장치 없음)

- 운영에서 로그인 full(AI 생성) 실행 금지. 합성 입력만.
- 서비스 문구에 「노무사」·확률·적중률 금지(사용자 출력 게이트가 일부를 막는다).
- 프로세스 종료는 PID 지정. `taskkill /IM node.exe` 금지.

## 알고도 아직 안 고친 것

- `scopedTypographyRole` 도 두 벌이다(감사 스크립트는 중복 일치 시 오류, vitest 는 첫 일치). 사고 기록이 없어 이번엔 두었다.
