# SafeClaw Knowledge Live P2 Recheck

Date: 2026-07-19

Authoritative HEAD at check: `8669756ab4ffa95b4b1b961ab5c9e9e32577fc8a`

Live build-info: `https://www.safeclaw.kr/api/build-info` returned `commitSha=8669756ab4ffa95b4b1b961ab5c9e9e32577fc8a`, `branch=master`, `environment=production`.

## Verdict

The older live P2 findings for `/knowledge` are not reproduced on current live.

Current live keeps machine enum terms out of visible body text and satisfies the mobile touch-target gate for the checked 390px viewport.

## Local Regression

```powershell
npm.cmd test -- tests\knowledge-page-layout.test.ts tests\knowledge-governance-ui-contract.test.ts tests\knowledge-mobile-ia-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: 3 files / 18 tests PASS.

## Live Browser Probe

URL: `https://www.safeclaw.kr/knowledge?theme=night`

Viewport: 390x844

Visible body text counts:

- `Published ontology`: 0
- `published_ontology`: 0
- `human_review`: 0
- `Hermes / LLM`: 0
- `SafeClaw system of record`: 0

Layout metrics:

- `clientWidth`: 390
- `scrollWidth`: 390
- `horizontal overflow`: 0
- `bodyHeight`: 1152
- `minimum visible control height`: 44px
- `visible controls below 44px`: 0

## Interpretation

Raw HTML still contains some internal keys as JavaScript object keys or data attributes. That is not user-facing body text. The presentation boundary currently renders Korean customer labels such as `게시된 안전지식`, `AI 문서화 도구`, and `사람 검토` in the relevant panels when visible.

This report closes the stale `/knowledge` raw enum and sub-44 mobile finding for the current live surface. It does not claim the full knowledge product roadmap is complete.
