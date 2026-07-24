# Grounded Document Field Quality Remediation

Checked at: `2026-07-24T13:07:24.930Z`

Product and production commit: `5a91a1f5659c748143cb8c52ef670c5949b22401`

Verdict: `PASS_LIVE_PRODUCTION_GROUNDED_DOCUMENT_FIELD_QUALITY`

## Product Change

- Repeated leading KOSHA stable identities are collapsed in display titles without changing the stored source title.
- A one-control evidence row no longer copies the current control into the additional-control field. It uses a distinct, reviewable field action: verify site implementation before work and hold work when the control is not implemented.
- The DB-harness authority, KOSHA/SIF classification, and public answer-panel sanitization remain unchanged.

## Before And After

| Surface | Result | Evidence |
| --- | --- | --- |
| Live before, production `94aad39a` | RED | `evidence_labels_clean` failed. `D-C-13-2026` and `A-R-1-2026` were repeated in supporting labels and the candidate answer line. |
| Local production after | Target contracts PASS, overall local FAIL | Evidence labels and risk-control fields passed. The local runtime lacked production generation-evidence signing configuration, so it is not claimed as a production PASS. |
| Live after, production `5a91a1f5` | PASS | HTTP 200, quality `ready`, failed contracts 0, evidence labels clean, current/additional controls distinct. |
| Short exterior-paint scenario, live | PASS | Five risk rows, duplicate current/additional controls 0, repeated evidence identities 0. |

The live short-scenario candidate line is:

`D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정 / D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정`

## Verification

- Focused regression: 6 files, 169 passed, 0 failed.
- Northstar aggregate generators: 3 files, 25 passed, 0 failed.
- `npm.cmd run build`: PASS.
- `npm.cmd run typecheck`: PASS after the build completed. The initial parallel run hit a transient `.next/types` regeneration race and is not treated as a product failure.

## Safety Boundary

- DB mutation: `false`
- Provider dispatch: `false`
- Share-session creation: `false`
- Evidence authority changed: `false`
- Raw API harness diagnostics removed: `false`
- Public display sanitization preserved: `true`

## Artifacts

- Before live: `evaluation/live-harness-quality-probe-2026-07-24-before-wording-fix/report.json`
- After local: `evaluation/live-harness-quality-probe-2026-07-24-after-wording-fix-local/report.json`
- After live: `evaluation/live-harness-quality-probe-2026-07-24-after-wording-fix-live/report.json`
