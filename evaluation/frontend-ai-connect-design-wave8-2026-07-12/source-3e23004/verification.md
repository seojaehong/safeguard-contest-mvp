# Wave 8 AI connect verification

## Source binding

- Reviewed source SHA: `3e2300465374e66dabffec8ae3332095c9e428e5`
- Source identity: `e38dfd9c982157b9bf814c1988d883feb5409ae387ae5b502a89f5c63d890099`
- Product commits: `1f116f1`, `a3b3d90`
- Contract hardening commit: `3e23004`
- Static audit: `frontend-consistency-audit.json` in this directory

## TDD RED evidence

The authoritative pre-change selector inventory was recomputed as 180 findings rather than the brief's 177 estimate:

| Category | RED findings |
| --- | ---: |
| typography tuple | 45 |
| font size | 42 |
| line height | 14 |
| tracking | 6 |
| important declaration | 41 |
| radius | 27 |
| decorative gradient | 5 |
| total | 180 |

The focused contract failed before the original product change and passed only after the AI-owned residual reached zero.

Fresh-review fixes also started RED:

- Focused static plus font-family run: 5 failed and 2 passed. Failures covered hardcoded AI code colors, missing Day text tokens, missing final vector active state, missing token-label tuple, and the lost `.ai-connect-meta dd` HUD family.
- Old production bundle: token label computed as `15px / 700 / 24px / -0.45px` instead of component-title `20px / 700 / 27px / -0.3px`; meta used Pretendard instead of Geist Mono.
- Old hover cascade: inactive and active tab hover surfaces both resolved to the generic accent-hover paint in Day and Night.
- Old vector active cascade: Day border was `rgb(223, 226, 231)` instead of success `rgb(24, 122, 54)`; Night was `rgb(41, 43, 48)` instead of `rgb(79, 198, 106)`.
- Old Day contrast: packet action ratio was about 1.09 and verdict label ratio was about 1.00 on their actual rendered surfaces.
- Contract-hardening RED: a fixture containing only `background-color` was incorrectly accepted as an exact `color` declaration, so the new `toThrow` assertion failed before the declaration parser was fixed.

## Production matrix

Authenticated fixture details:

- Public Supabase fixture URL: `https://wave8-fixture.supabase.co`
- Actual Supabase auth storage key: `sb-wave8-fixture-auth-token`
- Typed `Session` and `User` fixture with a future-expiring bearer token
- Intercepts for Supabase auth, bearer-authenticated MCP token GET/POST, SIF status, and photo Vision readiness
- Authenticated Day/Night coverage at `1440x900`, `390x844`, and `1440x320`
- 61 rendered authenticated typography selectors plus the unauthenticated CTA selector

Unauthenticated lanes use a fresh `BrowserContext` for every theme and viewport. `context.storageState()` proves the actual Supabase storage key is absent before navigation. The route then settles on `.ai-connect-empty`, keeps `.ai-connect-workspace` absent, and makes zero MCP token requests.

The matrix asserts:

- exact complete typography tuples for every manifested rendered selector;
- ready/hold, locked/open, ready/blocked, active/inactive, and tab hover distinctions;
- vector active border equality with computed `--workspace-success`;
- packet action and verdict label contrast on opaque self/parent surfaces, in addition to all code/textarea surfaces, at a minimum ratio of 4.5;
- responsive tab and metric columns, nonzero visible controls, canonical control radii, and zero horizontal overflow.

## Verification commands

- `npm.cmd test -- tests/ai-connect-design-contract.test.ts tests/font-family-token-contract.test.ts --maxWorkers=1` — PASS, 2 files and 8 tests.
- W4 document typography contract — PASS, 2 tests.
- W5 mixed typography contract — PASS, 1 test.
- W6 ontology typography contract — PASS, 1 test.
- W7 workspace input CSS contract — PASS, 2 tests.
- `npm.cmd test -- tests/workspace-layout-regression.test.ts --maxWorkers=1` — PASS, 18 tests and 1 opt-in skip in 81.35 seconds.
- `npm.cmd run typecheck` — PASS.
- Dummy-Supabase `npm.cmd run build` — PASS, normal production build generated 27/27 static pages.
- Opt-in AI connect production matrix — PASS, 2/2 tests in 41.21 seconds.
- `node scripts/frontend_consistency_audit.mjs` — expected global RED exit 1; source-bound JSON generated successfully.
- Fresh review after `3e23004` — CLEAN, no actionable P0-P2 findings.

One combined W4-W7 command produced no result for more than 180 seconds while the workspace browser file was included. Its exact process tree was terminated, and the same contracts were then run separately with the results above. No split test failed.

## Static audit delta

| Rule | Baseline | Reviewed source | Delta |
| --- | ---: | ---: | ---: |
| typography-tuple | 576 | 531 | -45 |
| font-size-tier | 181 | 139 | -42 |
| line-height-tier | 232 | 218 | -14 |
| tracking-tier | 128 | 122 | -6 |
| important-declaration | 737 | 696 | -41 |
| radius-tier | 288 | 261 | -27 |
| decorative-gradient | 53 | 48 | -5 |
| total violations | 2,307 | 2,127 | -180 |

Coverage issues remain zero. The focused AI-owned residual is zero. The 2,127 remaining global findings are outside Wave 8 ownership, so neither a full static PASS nor a 108-row PASS is claimed.
