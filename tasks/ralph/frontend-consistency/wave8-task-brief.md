# Wave 8 task brief

Base: authoritative frontend/backend integration `447c267`.

## Goal

Normalize the complete user-visible `/settings/ai-connect` design surface across its base and `module-variant-document` cascades. The current selector-owned inventory is 177 findings:

- typography 107: tuple 45, font-size 42, line-height 14, tracking 6
- other design 70: important 41, radius 27, decorative-gradient 2
- ownership split: base 129, later document overrides 48

Recompute from current evidence during TDD; these counts are a baseline, not a target to game.

## Required process

1. Write a focused audit contract first, selector-family based, and observe RED. It must reject any remaining AI-owned typography/radius/important/gradient findings without changing the runner.
2. Inspect `AiConnectPanel.tsx` actual auth and unauth branches. Do not treat the transient `sessionChecked=false` full UI as authenticated evidence.
3. Normalize each actual role to existing semantic tokens: Product, HUD, component title, support, table, caption, and control. Preserve semantic ready/hold/locked/open/active distinctions.
4. Fix both base selectors and higher-specificity document/responsive selectors. Day and Night code/textarea surfaces must have readable foreground/background contrast; do not leave dark `--workspace-ink` on `#090a0b`.
5. Remove selector-owned `!important`, radius, and decorative-gradient findings with actual CSS changes. Use the existing product radius contract and no audit exceptions.
6. Add an opt-in production matrix with deterministic states:
   - configured dummy public Supabase URL/key
   - authenticated storage fixture using the repository's Supabase auth storage format
   - typed network fixtures/intercepts for MCP tokens, SIF status, and vision readiness as necessary
   - stable unauth lane with configured environment and no storage, waiting for `.ai-connect-empty` and proving the full workspace does not persist
7. Authenticated matrix must cover Day/Night at 1440x900, 390x844, and 1440x320. Verify every actually rendered scoped role family with complete computed tuples, semantic state distinction, code/textarea contrast, responsive columns, nonzero/visible controls, and overflow zero.
8. Unauthenticated lane must cover Day/Night desktop and 390px, stable empty-state geometry, controls/links, and overflow zero.
9. Run focused tests, strict typecheck, normal build 27/27, production matrix, and static audit. Record exact category deltas and all residual RED.
10. Commit product/tests first, then source-bound evidence under `evaluation/frontend-ai-connect-design-wave8-2026-07-12/source-<sha>/`.

## Hard exclusions

- No audit runner, parser, allowlist, threshold, coverage, route inventory, or 108-row changes.
- No Reports behavior/CSS assumptions, package/lock, backend contracts, `SafeGuardCommandCenter.tsx`, `WorkpackEditor.tsx`, or lib shared contracts.
- Preserve W4-W7 final typography/ontology/workspace rules and the 16 unrelated screenshots.
- Do not claim full static or 108-row PASS.

## Deliverable

Write `tasks/ralph/frontend-consistency/wave8-task-report.md` with RED proof, selector inventory, auth fixture details, exact static deltas, contrast evidence, verification results, commits, and residual concerns. Return status, commits, one-line verification, concerns only.
