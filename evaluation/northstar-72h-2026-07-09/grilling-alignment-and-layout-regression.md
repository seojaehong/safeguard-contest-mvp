# SafeClaw Grilling Alignment + Workspace Layout Regression

Date: 2026-07-09
Scope: `SafeClaw Codex_ Grilling Report & North Star Alignment.md`, `/workspace` first-screen layout, N4 photo harness visibility.

## Verdict

The report is useful as an internal stress-test, but it should not be promoted verbatim as an official technical document. Its core direction is valid: SafeClaw must prove DB harness, SIF/KOSHA evidence, Vision/OCR improvements, and workpack history in the product surface, not just in backend code.

## Adoption Matrix

| Item | Decision | Reason | Next Action |
| --- | --- | --- | --- |
| UI overload / first-screen instability | Adopt | The current submission risk is visible layout instability and too much simultaneous information. | Keep `/workspace` as the design source, add browser regression tests for Day/Night overlap. |
| RLS review | Adopt, approval-gated | Legacy DB tables still need a security review, but schema/policy changes require explicit approval. | Prepare separate RLS approval packet; do not mutate DB in this slice. |
| Mock/fallback concern | Defer / refine | Fallbacks are useful for resilience; the defect is unclear labeling or production control, not fallback existence. | Keep quality-contract labels and avoid presenting fallback as final verified evidence. |
| Hermes as core runtime | Defer | Current source of truth remains SafeClaw MCP/DB harness. Core runtime replacement would split authority before the product is stable. | Keep Hermes/OpenClaw as long-term consumer/PoC path only. |
| LLM Wiki / self-learning | Adopt with HITL only | Markdown/JSONL export is useful for review; automatic corpus mutation is unsafe. | Keep exports as review candidates; only approved improvements can become published knowledge. |
| Vision/OCR before/after photos | Adopt | This is a direct commercial differentiator: visual hazard candidates must affect risk rows/TBM, not only append prose. | N4 now creates deterministic risk rows and TBM links from accepted photo candidates. |

## Layout Regression Fixed

Observed issue: the Day workspace first screen could appear as if the composer text, menu, and shell layers were visually colliding. Root cause was not a single component bug; the CSS cascade has multiple visual passes for extreme-simple, Linear dark, Day, and middle-path themes.

Implemented guard:

- Keep `.command-topbar` relative and above the viewport without pinning over content.
- Keep `.workspace-side-nav` and `.command-main` as separate grid surfaces.
- Force `.workspace-input-page` to `align-content: start` with explicit gaps and no inherited full-screen centering.
- Increase Korean headline line-height from `1.08` to `1.12`.
- Add a Playwright regression test for Day mode physical separation:
  - topbar below/above viewport separation
  - side nav / main horizontal separation
  - headline / textarea vertical separation
  - textarea border/background/scroll state

## Verification

- Red: `npm.cmd test -- tests\workspace-layout-regression.test.ts`
  - failed before the CSS fix because the first-screen headline line-height ratio was `1.08`, below the existing readability gate.
- Green: `npm.cmd test -- tests\workspace-layout-regression.test.ts`
  - 3 tests passed after the CSS guard and line-height fix.

## Remaining Risks

- `/demo` and some detail/loading/error surfaces still need a separate workspace-design harmonization pass.
- RLS and SIF vector migration remain approval-gated.
- Live deployment must still be browser-checked after push; this file only records local regression evidence.
