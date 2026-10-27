# 에이전트 규칙표

이 저장소에서 에이전트가 되풀이한 실수와, 그것을 **막는 장치**를 짝지어 둔다.
지적을 받으면 실수를 고치고 여기 한 줄을 더한다. 규칙이 이미 있는데 막는 장치가 없으면
그것은 반복이다. 같은 변경에서 장치를 만든다(pstack `/correct`).

## 막는 장치(CI 에서 실패한다)

| 규칙 | 막는 장치 | 근거 |
|---|---|---|
| 기다리지 않는 스트림 cancel(`void reader.cancel()`·맨 문장·화살표 본문)은 `.catch(() => undefined)` 로 끝낸다 | `tests/stream-cancel-catch-contract.test.ts`(TypeScript AST 검사, `node scripts/check_stream_cancel.mjs`) | #124 — abort 리스너 2곳이 unhandledRejection |
| 코드 파일은 작업본에서도 LF | `.gitattributes`(`*.ts`·`*.mjs` 등 `eol=lf`) + `tests/shebang-lf-worktree.test.ts`(셔뱅 첫 줄 CR 검사, `node scripts/check_shebang_lf.mjs`) | 261026·261027 CRLF 셔뱅 SyntaxError |
| 타이포 역할 판정은 감사 스크립트 하나만 한다 | 표 = `lib/frontend-design-contract.ts`(`frontendTypographyRoles`·`frontendSemanticRoleOverrides`), 함수 = `scripts/frontend_typography_classifier.mjs`. vitest 계약은 판정을 따로 구현하지 않고 감사를 돌린다 | #121 — 같은 textarea 를 한쪽은 longform, 한쪽은 body |
| 화면 지문 identity(`canonicalFrontendIdentityFiles()` 가 돌려주는 파일 — app·components 의 모든 TSX 포함)를 바꾸면 `static-audit.json` 을 다시 만들어 같은 PR 에 넣는다 | `tests/frontend-route-coverage.test.ts`(identity 불일치면 실패) | #121·#123 |

## 고르는 도구(막지는 않는다)

| 언제 | 도구 |
|---|---|
| PR 올리기 전 | `node scripts/affected_tests.mjs` — 바뀐 파일로 돌릴 시험과 명령(지문 재생성·`leave:test`)을 고른다. 바뀐 모듈 import grep 만으로 고르지 않는다(#121 CI 18분). 선택 규칙은 `tests/affected-tests-selection.test.ts` 가 고정한다 |
| 병합 뒤 운영 확인 | `.claude/skills/verify-safeclaw/`(`verify.mts doctor` / `drive`) |

## 한 번만 할 일

- `.gitattributes` 는 **새로 꺼낸 파일에만** 걸린다. 이 변경 전에 만든 작업본은 `node scripts/check_shebang_lf.mjs` 가 FAIL 이면 그 파일들을 지우고 `git checkout -- <파일>` 로 다시 꺼낸다(커밋 안 한 변경이 없을 때).

## 판단으로 남긴 것(장치 없음)

- 운영에서 로그인 full(AI 생성) 실행 금지. 합성 입력만.
- 서비스 문구에 「노무사」·확률·적중률 금지(사용자 출력 게이트가 일부를 막는다).
- 프로세스 종료는 PID 지정. `taskkill /IM node.exe` 금지.
