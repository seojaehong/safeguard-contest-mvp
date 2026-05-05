# SafeClaw Playwright Live Smoke Report

- Date: 2026-05-05 22:15 KST
- Target: https://www.safeclaw.kr
- Tool: Codex Playwright skill wrapper / Chromium
- Verdict: `pass_with_notice`

## Passed

- Landing and workspace opened through the production domain.
- Representative workpack generation completed from the workspace flow.
- Generated document count reached `11/11`.
- API status panel showed weather reflected, legal matches `6`, API combination `7`.
- Field brief reflected site, industry, worker count, and current weather values.
- Risk assessment card edit action opened the risk assessment editor and matching template preview.
- Risk assessment XLS and HWPX downloads were generated and inspected for core Korean markers.
- Main product routes opened with SafeClaw shell and without prototype/A-B wording exposure in route smoke.

## Notices

- `favicon.ico` returns 404 on production. This is cosmetic but should be fixed before a polished launch.
- The Vietnamese language message button is present in the DOM, but Playwright ref-click reported it outside the viewport. Improve scroll/keyboard accessibility for the language selector.
- Actual email/SMS send was not clicked in this run to avoid duplicate live dispatch. Dispatch UI state was inspected instead.
- PDF remains browser print/export flow; this run verified XLS/HWPX file downloads.

## Evidence Files

- `output/playwright/safeclaw-live-20260505-221556/01-workspace-ready.png`
- `output/playwright/safeclaw-live-20260505-221556/02-risk-edit-panel.png`
- `output/playwright/safeclaw-live-20260505-221556/03-documents-route.png`
- `output/playwright/safeclaw-live-20260505-221556/04-evidence-route.png`
- `output/playwright/safeclaw-live-20260505-221556/download-risk-assessment.xls`
- `output/playwright/safeclaw-live-20260505-221556/download-risk-assessment.hwpx`
- `evaluation/playwright-route-smoke-raw.json`
- `evaluation/playwright-safeclaw-live-smoke-2026-05-05.json`
