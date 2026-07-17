# Knowledge Review Inbox 독립 리뷰 Remediation 보고서

## 최종 판정

- SPEC self verdict: `PASS`
- CODE self verdict: `PASS`
- DB migration: 없음
- publish/ontology migration 실행: 없음
- commit/push: 수행하지 않음

## Finding Remediation

### P1 GET 관계 검증

- GET은 더 이상 runs/events 독립 배열을 반환하지 않는다.
- `queue[{ run, events }]`는 모든 `raw_event_ids`가 존재하고 `pending_review`이며 run과 같은 organization/site인 경우만 포함한다.
- 비객체 `generated_output`, 빈/중복/missing raw event, tenant 불일치, shared event run은 fail-closed로 제외한다.
- 제외 결과는 `dropped.runCount`, `dropped.eventCount`, `dropped.reasons[{runId,reason}]`으로 반환한다.
- 제외된 run의 `generated_output`과 event raw `payload`/`url`은 응답에 포함하지 않는다.

### P1 Event-level scope 보존

- run의 `generated_output` receipt와 별도로 각 event의 기존 `proposed_wiki_update` JSON을 보존 병합한다.
- event receipt에는 `scope`, `reviewer`, `reviewedAt`, `publicationState=unpublished`, `ontologyPublished=false`를 기록한다.
- `approve_candidate` scope는 `promotion_candidate`, `keep_site_only`는 `site_private`, `reject`는 `rejected`다.
- event raw `payload`는 update 대상에서 제외하고 보존한다.

### P2 경쟁 및 부분 실패

- 테스트 fake는 `eq`, `in`, `is`, `overlaps`를 실제 행 필터로 적용하고 update 결과를 인메모리 행에 반영한다.
- cross-organization, cross-site, stale run, 두 번째 event update 실패, shared-event 중간 race를 재현한다.
- 기존 shared-event run은 모든 write 전에 `409 review_shared_event_conflict`로 차단한다.
- run update 후 event 일부만 확인되면 `500`, `atomic=false`, `compensationRequired=true`, event 진행 개수를 반환한다.

### P1 GET/POST shared-event 범위 일치

- shared-event 충돌은 GET과 POST 모두 `organization_id + site_id` 범위 안에서 계산한다.
- 다른 현장의 잘못된 run이 정상 현장 후보를 GET queue에서 숨기지 않는다.
- 교차 현장 회귀 테스트는 정상 후보를 유지하고 잘못된 참조만 `tenant_mismatch`로 제외한다.

### P3 Untracked 파일 검사

- tracked 파일 전용 `git diff --check` 결과를 증거로 사용하지 않는다.
- 6개 untracked 파일 각각에 `git -c core.autocrlf=false diff --no-index --check -- NUL <file>`을 실행한다.
- 새 파일이므로 expected diff exit는 `1`이며, whitespace error 출력은 6개 모두 0건이다.

## TDD RED -> GREEN

1. GET queue/invalid relation 테스트 2개가 기존 독립 배열 응답으로 RED, 관계 검증 queue 구현 후 GREEN.
2. event receipt 테스트가 기존 bulk status update와 receipt 부재로 RED, event별 JSON 병합 update 후 GREEN.
3. 두 번째 event 실패 및 shared-event 중간 race 테스트가 false success로 RED, confirmed subset 검사 후 GREEN.
4. 기존 shared-event run direct POST 테스트가 write 성공으로 RED, pre-write overlap validation 후 GREEN.
5. 다른 현장의 run이 정상 후보를 숨기는 테스트가 빈 queue로 RED, tenant scope별 충돌 계산 후 GREEN.

## 검증 결과

- focused command: `npm.cmd test -- tests/knowledge-review-actions.test.ts tests/knowledge-review-route.test.ts`
- focused result: test files 2 passed, tests 26 passed, 0 failed
- strict typecheck: `npm.cmd run typecheck` GREEN
- dependency repair: `npm.cmd install` 완료
- dependency manifest integrity: `git diff --exit-code -- package.json package-lock.json` exit 0
- untracked no-index check: 6 files checked, whitespace errors 0
