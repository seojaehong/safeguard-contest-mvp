# Share UI submission gate

- Source branch: `feat/phase-a-evidence-integration`
- Scope: presentation-only Share simplification
- Database or schema change: none
- Share authority and dispatch behavior: preserved from the reviewed baseline

## Product change

- Default flow is now `오늘 대상 -> 채널 -> 언어 미리보기 -> 전송`.
- The 12-language chip wall is replaced by one language preview selector.
- Foreign-language previews no longer prepend Korean site, task, risk, or administrator labels.
- Delivery notes and storage/history details are collapsed by default.
- The default surface keeps one primary send action.
- Worker management remains owned by `/workers`; Share only links to target selection.

## Verification

- Focused tests: 2 files, 29 tests passed.
- Strict TypeScript typecheck: passed.
- Production build: passed, 27 static pages generated.
- Diff check: passed.
- Local production browser: desktop and mobile Share surfaces rendered without horizontal overflow or interactive overlap.
- Language selector: manager preview plus 10 configured foreign-language previews.

## Boundary

The rejected Share authority restoration branch was not integrated. This patch changes only the existing stable panel presentation and scoped CSS.
