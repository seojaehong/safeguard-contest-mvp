# SafeClaw frontend consistency browser audit

- Generated: 2026-07-11T07:56:00.639Z
- Routes: 32/32
- Route matrix: 96/96
- Workspace Day/Night: 6/6
- Special surfaces: 4/4
- Generated surfaces: 2/2
- Screenshots: 108
- Successful rows: 108
- Failed rows: 0
- Recovered transient rows: 1
- Findings: 0
- Elapsed: 119129 ms

## Verification results

- `npm.cmd test`: pass, exit 0, 56 files/523 tests
- `npm.cmd run typecheck`: pass, exit 0
- `npm.cmd run build`: pass, exit 0, build 8IixDdNLZuFYWzyFxAboJ
- `npm.cmd run audit:frontend-consistency`: pass, exit 0, 32 pages/22 components, coverage 0, violations 0
- `npm.cmd run audit:frontend-browser`: pass, exit 0, 108 rows, failed 0, findings 0

## Visual review

The browser contract validates computed product/document font availability, exact body and heading tuples derived from the numerical design specification, generated-document roles, visible control geometry, key surface padding/radius values, and identical Workspace Day/Night geometry fingerprints.

Reviewed: `route-root-desktop-1440.jpg`, `workspace-day-desktop-1440.jpg`, `workspace-night-desktop-1440.jpg`, `route-reports-desktop-1440.jpg`, `route-knowledge-section-slug-desktop-1440.jpg`, `route-law-id-desktop-1440.jpg`, `route-settings-mobile-390.jpg`, `route-demo-mobile-390.jpg`, `generated-document-preview.jpg`, `generated-pdf-export.jpg`

## Deterministic fallbacks

Login and auth callback are labelled expected deterministic fallbacks. Audit-only boundaries require `SAFECLAW_FRONTEND_AUDIT=1`; the same query is inert without the server-provided audit signal.

## Cross-session merge matrix

- Frontend owns typography, PDF/font assets, browser audit, and evidence through this branch.
- Backend head `2d0ff44` owns harness/history/grounded-vision changes; preserve them while porting frontend design/PDF/audit changes.
- Current authoritative backend head `178f53a` integrates `3900892` current-workpack/worker snapshot, module shell `99a42d2`, and reviewed reports provenance/state lineage `95d8b8c`/`5a16ebe`/`178f53a`. Module browser 4/4 passed; reports passed its single empty-state test and the 49-test combined run after the explicit render wait.
- Integrated module metrics: Documents mobile 446 to 331, Reports 446 to 285, Workspace 281 unchanged, horizontal overflow 0.
- Current authoritative backend head is `178f53a`. The exact 22-file intersection remains comparison evidence from frontend `d2ef1df` versus backend base `2d0ff44`, recorded verbatim in `report.json` (`mergeMatrix.sharedFiles`). Never merge any shared file wholesale: preserve backend behavior/contracts first, then selectively port frontend visual/audit hunks with per-file review.
- Reports remediation is integrated as backend lineage `95d8b8c`/`5a16ebe`/`178f53a` (source `a935fdb`/`b42bc0d`/`846afb2`). Independent review found no P0-P3 product findings; the explicit empty-state render wait removed the reproduced early assertion, and both the single test and 49-test combined run pass.
- PDF selective port `66a05fe` plus remediation `76bc266` narrows `PDF_FONT_ASSET_UNAVAILABLE` to typed file/read/embed failures and adds a deterministic non-font create-failure regression. Fresh independent review PASS found no P0-P3 issues. Eleven focused tests, Korean extraction, nonblank render, representative output below 1 MiB, font-failure 500, literal NFT assets, typecheck, and build pass; backend integration remains pending.
- Full desktop/390px checks, combined frontend/backend tests, direct integrated PDF, and all 108 browser rows remain intentionally pending.
- A new isolated backend-owned documents-mobile-priority patch is active and not integrated: core-three launcher, reducing editor y from approximately 3424 while preserving the desktop cockpit.
- The document-module shell and reports provenance/state work are integrated at `178f53a`; PDF and the isolated documents-mobile-priority patch remain external integration work.
- Backend-owned P1 followup: persist report provenance beyond the banner (`source.mode`, scope, and `workpackSavedAt`).
- Backend-owned P2 followups: separate empty/readiness/data/download states; reduce the `/documents` mobile editor height by showing the core three items first, collapsing the remainder, and removing the duplicate CTA. Current evidence has no horizontal overflow or overlap.
- Mandatory post-integration rerun: full tests, typecheck, build, static audit, all 108 rows, and /documents-/reports-vs-/workspace y-position/identity comparison.
- `package-lock.json` is now tracked for reproducible installs and is a possible integration conflict.

## Findings

None.
