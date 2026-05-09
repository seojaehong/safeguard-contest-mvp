# SafeClaw final-90-gate decision

- Generated at: 2026-05-09 03:08 KST
- Current commit: `b2c1c4e`
- Scope: local deterministic evidence only
- Overall: `pass_with_notice`

## Why the older final-99 gate is stale

The previous `evaluation/final-99-gate/report.json` was generated on 2026-05-07 at commit `6b8ce93` and remained `blocked`.
That result is no longer the right submission evidence bundle because it predates the structured output/export contract work that is now present on the current branch.

The old blocked items were mainly:

- `document-downloads`: blocked before the latest structured XLSX/HWP/PDF route-level smoke.
- `auth-history-reuse`: token-dependent live storage verification was not run.
- `screenshots`: not part of this deterministic document/export gate.

For submission packaging, keep the old gate as historical debugging evidence only. Do not use it as the current readiness decision.

## Commands executed

| Command | Result | Evidence |
|---|---:|---|
| `npm.cmd run typecheck` | pass | TypeScript strict check completed. |
| `npm.cmd run build` | pass | Next.js production build completed. |
| `npm.cmd run smoke:form-schema-gate` | pass_with_notice | `caseCount=3`, `expectationPass=3`, `goldenPass=2`, `goldenCount=2`. |
| `node ./scripts/safeclaw_d6_structured_export_smoke.mjs` | pass | Output written to `evaluation/final-90-gate/structured-export/smoke-report.json`. |

## Latest deterministic evidence

The structured export smoke ran against a local dev server on `http://127.0.0.1:32994`.
No auth token, production secret, DB mutation, or provider delivery was required.

Key outputs:

- `evaluation/final-90-gate/structured-export/files/riskAssessment-kosha-headers.xlsx`
  - XLSX route returned spreadsheet content.
  - KOSHA-style risk assessment headers were present.
  - Missing headers: none.
- `evaluation/final-90-gate/structured-export/files/workPlanStructured.xlsx`
  - Structured work plan export passed.
  - Missing expected text: none.
- `evaluation/final-90-gate/structured-export/files/tbmBriefingStructured.xlsx`
  - Structured TBM briefing export passed.
  - Missing expected text: none.
- `evaluation/final-90-gate/structured-export/files/educationRecordStructured.xlsx`
  - Structured education record export passed.
  - Missing expected text: none.
- `evaluation/final-90-gate/structured-export/files/riskAssessment-signature.hwp`
  - HWP route returned Hangul Word Processor signature `D0CF11E0A1B11AE1`.
- `evaluation/final-90-gate/structured-export/files/riskAssessment-honest.pdf`
  - PDF route returned `application/pdf`.
  - Magic header was `%PDF-`.
  - It was not HTML disguised as PDF.

## Decision

`pass_with_notice`

This gate is strong enough to defend the current structured document/export readiness target.
It should replace the older `final-99-gate` blocked decision for deterministic local evidence.

The notice remains because this gate intentionally does not cover:

- live administrator login and Supabase archive reuse,
- production n8n provider delivery,
- HWPX original cell-level reproduction,
- full browser visual regression.

Those should remain separate live smoke or presentation-readiness gates, not blockers for this deterministic export evidence bundle.
