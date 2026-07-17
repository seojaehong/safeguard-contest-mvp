# SafeClaw production promotion verification

검증 시각: 2026-07-17 KST  
병합 커밋: `880db7af65cae369a897264ba7b66e7566d80540`  
대상: `https://www.safeclaw.kr`

## Promotion

- PR #77은 `master` 최신 커밋을 포함했고 mergeable `CLEAN` 상태였다.
- PR CI와 Vercel preview가 성공한 뒤 Draft를 해제하고 `master`에 병합했다.
- Vercel production deployment `JA6xh6QQivDWpjzwzpGE7QYkK7up`은 성공했다.
- DB migration, provider activation, ontology publication mutation은 수행하지 않았다.

## Before / after evidence

배포 전 동일 `tests/ontology-ui-browser.test.ts`를 production에 실행했을 때 node text contrast가 약 `1.01:1`로 실패했다. 이는 로컬 통합 HEAD가 아니라 이전 production UI가 제공되고 있음을 증명했다.

배포 후 동일 테스트는 1 file / 1 test PASS였다. 테스트는 Day/Night의 1440px, 1024px, 390px 변형을 묶어 다음을 검증한다.

- horizontal overflow 0
- 선택 neighborhood overlap pair 0
- desktop/tablet visible nodes 15 이하
- mobile default relation cards, expanded graph 15 nodes
- minimum control height 44px
- node and node-text contrast 4.5:1 이상
- dialog focus trap, Escape close, trigger focus restore

추가 production probe:

- `/why` 390px: overflow 0, viewport outside element 0, comparison rows 5
- `/workspace` blank submit: `현장 상황을 입력해 주세요.` alert 노출, `#field-command-input` focus 이동, overflow 0
- `/knowledge` 390px: overflow 0, enhanced task navigation enabled, tabs 6, body scroll height 1,148px

## Remaining gates

- GitHub master CI run `29545201500`은 성공했다: strict typecheck PASS, 177 files / 2,151 tests PASS, production build 28/28 PASS.
- 후속 통합 HEAD는 `dfc4efaa`다. 사이트 귀속 지식 수집과 온톨로지 승격 명령 계약을 독립 검수 GO 후 선택 통합했다.
- 결합 검증은 focused 4 files / 70 tests PASS, strict typecheck PASS, production build 28/28 PASS다.
- 지식 수집은 인증된 조직이 소유한 `siteId`를 필수로 하며, 타 현장 혼입과 동시 재수집 충돌을 fail-closed 처리한다.
- 승격 명령은 요청자가 보낸 receipt/provenance를 신뢰하지 않고 저장된 tenant, run, event, source snapshot을 다시 대조한다.
- 승인된 후보는 `approved_pending_persistence`로만 반환되며 published ontology에 직접 기록되지 않는다.
- Remote Hermes production execution은 trusted transport와 durable attempt ledger가 없어 계속 fail-closed 상태다.
- 실제 provider dispatch는 DB-backed persistent idempotency migration 승인 전까지 잠겨 있다.

이번 후속 통합에서도 DB schema/data 변경, provider activation, ontology publication mutation은 수행하지 않았다.
