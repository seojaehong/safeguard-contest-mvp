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
- A generated workpack may open the Share screen even when readiness needs work; the real send action remains fail-closed.

## Verification

- Focused tests: 2 files, 29 tests passed.
- Strict TypeScript typecheck: passed.
- Production build: passed, 27 static pages generated.
- Diff check: passed.
- Local production browser: desktop and mobile Share surfaces rendered without horizontal overflow or interactive overlap.
- Language selector: manager preview plus 10 configured foreign-language previews.

## Boundary

The rejected Share authority restoration branch was not integrated. This patch changes only the existing stable panel presentation and scoped CSS.

## Live production verification

- Product source: `28dbdc2`
- Production: `https://www.safeclaw.kr/workspace?scenario=seoul-construction-windy`
- Vercel deployment: `EFif9uejqC4GzchVcgb4EhYXFnw9`
- Viewport: `390x844`
- Share heading: `문서팩 보내기`
- Selected preview: `베트남어 · Tiếng Việt`
- Korean metadata prefixes in the foreign preview: none
- Horizontal overflow: none
- Interactive overlap: none
- Visible controls below 44px: none
- Default-collapsed secondary details: 3
