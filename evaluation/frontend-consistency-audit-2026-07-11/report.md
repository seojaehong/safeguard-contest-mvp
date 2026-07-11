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
- Current authoritative backend head `cab4a19` integrates `3900892` current-workpack/worker snapshot and module shell `99a42d2`. Post-integration module browser 4/4 and typecheck pass; `evaluation/module-shell-unify-2026-07-11/report.md` records focused 4, typecheck, build 27, and diff evidence.
- Integrated module metrics: Documents mobile 446 to 331, Reports 446 to 285, Workspace 281 unchanged, horizontal overflow 0.
- Current authoritative backend head is `cab4a19`. The exact 22-file intersection remains comparison evidence from frontend `d2ef1df` versus backend base `2d0ff44`, recorded verbatim in `report.json` (`mergeMatrix.sharedFiles`). Never merge any shared file wholesale: preserve backend behavior/contracts first, then selectively port frontend visual/audit hunks with per-file review.
- PDF worker must port `b61929f` PDF/font changes onto `3900892` and regenerate the tracked lockfile; do not copy `package.json` or `package-lock.json` wholesale. Module-shell and reports-candidate independent reviews remain pending.
- Reports `a935fdb` independent review REJECT: P1 server 401/404/corruption can silently fall to unrelated local state with exports enabled; P2 uses a shallow `AskResponse` guard and `server_saved` cast. Fail-closed, explicit-local-switch-only remediation is active; it is not integrated.
- PDF selective port is active on `3900892`: missing-font controlled 500, literal NFT paths, dynamic subsets, and regenerated tracked lockfile, excluding `WorkpackEditor` and `globals.css`. Full desktop/390px checks, full tests/build, direct PDF, and all 108 browser rows remain intentionally pending.
- A new isolated backend-owned documents-mobile-priority patch is active and not integrated: core-three launcher, reducing editor y from approximately 3424 while preserving the desktop cockpit.
- The document-module shell blocker is integrated at `cab4a19`; reports, PDF, and the isolated documents-mobile-priority patch remain external integration work.
- Backend-owned P1 followup: persist report provenance beyond the banner (`source.mode`, scope, and `workpackSavedAt`).
- Backend-owned P2 followups: separate empty/readiness/data/download states; reduce the `/documents` mobile editor height by showing the core three items first, collapsing the remainder, and removing the duplicate CTA. Current evidence has no horizontal overflow or overlap.
- Mandatory post-integration rerun: full tests, typecheck, build, static audit, all 108 rows, and /documents-/reports-vs-/workspace y-position/identity comparison.
- `package-lock.json` is now tracked for reproducible installs and is a possible integration conflict.

## Findings

None.
