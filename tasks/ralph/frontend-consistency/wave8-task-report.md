# Wave 8 AI connect design report

## Status

Wave 8 is complete at reviewed source `3e23004`. The authenticated and unauthenticated `/settings/ai-connect` surfaces now use complete semantic typography, radius, state, hover, and contrast contracts across the base and document cascades. Fresh review is SPEC PASS / CODE QUALITY PASS with no P0-P3 findings.

The implementation is split across:

- `1f116f1` — complete AI connect surface normalization and production matrix;
- `a3b3d90` — reviewed Day contrast, active-state, hover-state, HUD-family, and rendered-token fixes;
- `3e23004` — exact CSS property/value contract hardening.

Source-bound evidence is under `evaluation/frontend-ai-connect-design-wave8-2026-07-12/source-3e23004/`.

## TDD and selector inventory

The brief's 177 estimate was not used as a target. The focused audit recomputed 180 AI-owned findings: 45 typography tuples, 42 font sizes, 14 line heights, 6 tracking declarations, 41 important declarations, 27 radii, and 5 decorative gradients. The product change removes all 180 without runner, parser, allowlist, threshold, coverage, route-inventory, Reports, package, backend, or shared-contract exceptions.

Review findings were also reproduced before their fixes:

- static and font-family contracts failed for the hardcoded code tokens, missing HUD family, Day text colors, final active vector rule, and absent rendered token tuple;
- the old production bundle exposed the wrong token-label and meta font tuples, collapsed active/inactive hover surfaces, neutral vector active borders, and unreadable packet/verdict Day surfaces;
- the CSS contract's original substring matcher accepted `background-color` as `color`; an explicit RED fixture now protects exact property matching.

## Final semantic contract

- AI code foreground/background aliases resolve through global `:root` tokens `--paper-0` and `--steel-0`; the focused contract verifies token existence, exact mappings, and no hardcoded hex assignment.
- `.ai-connect-meta dd` keeps its existing HUD family while retaining the table-size tuple; `.ai-connect-sif-metrics dd` remains product-family table text.
- The rendered `.ai-connect-token-items article strong` family is manifested and uses the complete component-title tuple.
- Document packet links and verdict labels use `--workspace-ink`; the packet link has an opaque `--workspace-surface-1` background and the verdict assertion uses its opaque rendered parent surface.
- The final document `.ai-connect-sif-vector-guard.active` rule resolves to `--workspace-success` after the generic document skin.
- Generic document hover behavior remains unchanged by default. Optional hover variables are defined only on AI tabs, with distinct inactive and active border/background tokens.

## Auth and unauth matrix

The authenticated fixture uses the configured dummy Supabase URL/key, the real `sb-wave8-fixture-auth-token` storage format, typed Supabase session/user values, bearer-authenticated MCP token GET/POST interception, and typed SIF and photo Vision responses.

Authenticated Day and Night run at `1440x900`, `390x844`, and `1440x320`. The matrix checks 61 rendered role selectors, semantic normal/hover states, exact active vector color, six actual contrast surfaces, responsive columns, control geometry, radius, and horizontal overflow.

Unauthenticated Day and Night run at desktop and 390px. Every lane creates a fresh browser context and proves the real storage key is absent before navigation. The final empty state has no authenticated workspace, makes no MCP token request, preserves its login CTA and geometry, and has no horizontal overflow.

## Verification

- Focused AI plus font-family contracts: PASS, 2 files and 8 tests.
- W4-W6 typography contracts: PASS, 4 tests.
- W7 workspace input contract: PASS, 2 tests.
- W7 workspace layout regression: PASS, 18 tests and 1 opt-in skip.
- Strict typecheck: PASS.
- Normal dummy-environment production build: PASS, 27/27 generated.
- Authenticated/unauthenticated production matrix: PASS, 2/2.
- Fresh review: SPEC PASS / CODE QUALITY PASS, P0-P3 none.

The combined W4-W7 command did not return while the long workspace browser file was included. It was terminated after more than 180 seconds and rerun as split suites; every split suite passed.

## Static audit

The source-bound audit remains intentionally global RED:

- total: 2,307 to 2,127, exact delta -180;
- typography tuple: 576 to 531, delta -45;
- font size: 181 to 139, delta -42;
- line height: 232 to 218, delta -14;
- tracking: 128 to 122, delta -6;
- important: 737 to 696, delta -41;
- radius: 288 to 261, delta -27;
- decorative gradient: 53 to 48, delta -5;
- coverage issues: 0;
- AI-owned residual: 0.

No full static PASS or 108-row PASS is claimed. The remaining 2,127 findings are outside this wave's selector ownership.

## Residual concerns

- The full frontend consistency program still has global work outside AI connect.
- Production auth behavior is verified with deterministic typed fixtures, not a live Supabase account.
- The supplied `prd.json` change and untracked Wave 8 brief were preserved and excluded from all product commits.
