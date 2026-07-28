# Full Repository Security Remediation Plan

- Verdict: `PATCH_READY_REMEDIATION_PLAN_USER_CONFIRMATION_REQUIRED`
- Source / production: `fb6fdd98d51e083f189addea875bacbb0971f6b6`
- Source scan: `evaluation/full-repository-security-scan-2026-07-28/report.json`
- Findings still open: 18 (`medium=5`, `low=13`)
- Product patches performed: `false`
- Security-complete claim allowed: `false`

## Purpose

This packet turns the completed full-repository scan into four bounded implementation waves. It does not suppress, reclassify, or close a finding. Product patches remain held until the user confirms the remediation wave.

## Recommended Order

| Priority | Wave | Findings | Main boundary |
| --- | --- | ---: | --- |
| 1 | Tenant authorization boundaries | 2 | Bind scheduled workpack ownership to authenticated tenant identity and constrain archive site enrichment by organization. |
| 2 | Spreadsheet formula neutralization | 4 | Reuse the existing tested report-CSV rule across all WorkpackEditor CSV/TSV modes. |
| 3 | Public provider and upstream work budgets | 4 | Reject over-budget work before DB search, public API fan-out, or model invocation. |
| 4 | Document export work budgets | 8 | Apply deterministic request, collection, cell, and output limits to XLSX/HWP modes. |

## Wave 1: Tenant Authorization Boundaries

Highest priority finding: scheduled briefing currently treats `briefing_email` as a workpack-owner lookup key. The patch must persist and reuse authenticated owner or organization identity; the email remains a delivery address only.

Archive enrichment must query site metadata using both `site_id` and the already authorized organization IDs. A database invariant can be proposed separately, but no migration is created or applied in this wave.

Acceptance:

- A foreign briefing email cannot redirect workpack creation into another tenant.
- A foreign site UUID cannot disclose site metadata through archive enrichment.
- Tests use mocks and fixtures only; no cross-tenant live mutation is executed.

## Wave 2: Spreadsheet Formula Neutralization

`lib/reporting-downloads.ts` already has a tested formula-neutralization rule. Extract that behavior into one shared helper and route whole-workpack CSV, single-document CSV, downloaded TSV, and clipboard TSV through it.

Acceptance:

- `=`, `+`, `-`, `@`, tab, and carriage-return prefixes become inert spreadsheet text.
- Existing CSV quoting, TSV whitespace handling, Korean text, and non-spreadsheet content remain stable.
- Findings are closed only after all four independently reachable modes have focused regressions.

## Wave 3: Public Work Budgets

Apply explicit request and downstream-work budgets to knowledge regeneration, workpack remediation, weather fan-out, and Ask. Authentication is required for paid or tenant-mutating generation modes; bounded read-only inspection can remain public only where the product contract requires it.

The existing in-memory limiter remains defense in depth and is not treated as proof of a durable distributed quota.

## Wave 4: Export Work Budgets

Use the PDF route's bounded request pattern where the semantics match, with mode-specific limits for request bytes, document count, rows, nested entries, field characters, rendered cells, and output bytes. Oversized requests must return a stable `413` or `422` before workbook or HWP allocation.

## Verification

Each wave requires focused security regressions, adjacent product contracts, strict typecheck, production build, and a fresh security diff scan. After all four waves, rerun the full repository scan. Finding totals must not be reduced through suppression without explicit counterevidence.

## Boundaries

- No product patch was made by this packet.
- No DB mutation or migration was performed.
- No Share session was created.
- No provider dispatch or paid load was run.
- No embedding, vector upload, wiki publication, or exact KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
