# Wave 6 task brief

Base is authoritative backend `6a5d57c`. Work only in this worktree and branch.

## Goal

Normalize all user-visible `.ontology-*` and `.operation-memory-*` typography in `app/globals.css` to the existing semantic roles from `:root`: Product, HUD, component title, support, table, caption. This is a real visual consistency change, not a parser exception.

## Required process

1. TDD: add a focused contract test first and observe RED from the current CSS.
2. Derive selector families from current CSS and rendered TSX, not stale line numbers.
3. Use selector-scoped final-cascade rules or carefully split existing rules; do not edit the audit runner, semantic allowlists, route coverage, or product components.
4. Add an opt-in production browser matrix for `/ontology` Day/Night at 1440x900, 390x844, and 1440x320. Verify computed font family where role-specific, size, weight, line-height, tracking, and horizontal overflow on actually rendered elements. Exercise hover/popover interactions where needed.
5. Because OperationMemoryPreview is shared, include `/workspace?theme=day` and Night regression checks without editing `SafeGuardCommandCenter.tsx`.
6. Run static audit to a temp path during iteration. Record exact before/after category deltas; no expected-count gaming.
7. Run focused tests, strict typecheck, normal build 27/27, production matrix.
8. Commit product/tests first. Regenerate source-bound standard static artifact and evidence under `evaluation/frontend-ontology-typography-wave6-2026-07-12/source-<sha>/`, then commit evidence separately.

## Hard exclusions

- No Reports CSS/behavior assumption or integration.
- No package.json/package-lock changes.
- No `SafeGuardCommandCenter.tsx`, `WorkpackEditor.tsx`, `lib/types.ts`, `lib/current-workpack.ts`, or `lib/db-harness.ts` edits.
- No parser, allowlist, threshold, coverage, route inventory, or 108-row weakening.
- Preserve 16 unrelated screenshot modifications; do not stage them.
- Do not claim static PASS or 108-row PASS; current full static is RED 2,354.

## Deliverable

Write a report to `tasks/ralph/frontend-consistency/wave6-task-report.md` with changed files, RED proof, exact static delta, all commands/results, commits, known residual RED, and concerns. Return only status, commits, one-line verification summary, concerns.
