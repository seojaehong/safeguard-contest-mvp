# Task 4 implementation report: route-family consistency

Date: 2026-07-11

Base commit: `b9ec074`

Ralph story: `F4` remains `in_progress` with `passes: false` pending independent review.

## Outcome

- Discovered all 32 `app/**/page.tsx` routes and reconciled them exactly with `userVisibleRoutes`.
- Assigned every route exactly once to landing, workbench, module, knowledge/legal, authentication, or internal/demo.
- Replaced visual-only heading elements with semantic `h1`/`h2`/`h3` structure on legal detail, ask/search, V2 information/demo, knowledge, settings, ontology, and landing section surfaces.
- Kept the existing canonical render hooks for every route owner (`safeclaw-landing`, `safeclaw-module-shell`, `command-center-shell`, `safeclaw-login-page`, `v2-shell`, `knowledge-shell`, `demo-mode-shell`, or `container grid`) rather than adding tracking-only production classes.
- Moved the dry-run route's off-scale inline layout values to named hooks using the reviewed spacing tokens.
- Standardized V2 information pages at the `1200px` content measure, demo at the `1440px` wide measure, desktop gutters at `24px`, and mobile gutters at `16px`.
- Preserved text, data flow, interactions, links, redirects, API behavior, and persistence behavior. No API, backend, database, workspace-density, or generated-document CSS was changed.

## RED/GREEN record

1. Route inventory tracer
   - RED: `npm.cmd test -- tests/frontend-route-coverage.test.ts`
   - Failure: `/ops/api` was discovered and contracted but missing from the family map.
   - GREEN: added `/ops/api` to `internal/demo`; 32 discovered routes then matched 32 contracted and 32 uniquely classified routes.
2. Legal detail hierarchy
   - RED: all three cases failed because `/law/[id]`, `/precedent/[id]`, and `/interpretation/[id]` had no semantic `h1`.
   - GREEN: promoted titles to canonical page-title `h1`, section labels to `h2`, and law body section titles to `h3`.
3. Ask/search hierarchy
   - RED: visual `.h3` divs remained in both routes and `AnswerPanel`, `CitationList`, and `ResultCard`.
   - GREEN: promoted panel/section headings to `h2`, result/citation titles to `h3`, and prose containers to paragraphs.
4. V2 information and demo hierarchy
   - RED: `/why`, `/trust`, `/roadmap`, and `V2DemoExperience` lacked semantic section/card headings.
   - GREEN: promoted existing copy to `h2`/`h3` and remapped the matching CSS selectors to the reviewed component/section tuples.
5. Complete route-owner contract
   - RED: the first version exposed missing family tracking hooks.
   - GREEN/refactor: coverage now verifies the stable canonical hook owned by each of the 32 routes; tracking-only `routeFamily` production changes were removed during self-review.
6. Module hierarchy
   - RED: `/knowledge`, `/settings`, and `BriefingSettingsCard` used `strong` for section titles.
   - GREEN: added semantic module section headings and canonical body text classes; `/ontology` and `/preview` section gaps were also closed.
7. Landing/internal hierarchy and spacing
   - RED: the landing had five `h2` elements for six sections, and `/dryrun` retained `36px`/`18px` inline layout values.
   - GREEN: promoted the existing `근거 연결` label to the missing `h2`; replaced inline layout styles with `--space-10`, `--space-12`, `--space-5`, and `--space-3` hooks.
8. Legal page-title visual tuple
   - RED: semantic legal titles still used the section-title `.h2` tuple.
   - GREEN: all three use the canonical `title small-title` page-title tuple.
9. Two-axis review hardening
   - RED: review found that shared-owner checks could pass without a route rendering the owner, route geometry was not asserted, new paragraph margins were implicit, citation/law headings missed canonical tiers, module heading specificity overrode component titles, and one new color was raw.
   - GREEN: route pages now prove shared-owner rendering and module title/description props; route families assert standard/wide/mobile geometry plus card/control tokens; paragraph margins, heading tiers, selector specificity, and semantic colors are explicit. The generated static-audit snapshot was removed from the commit scope.
10. Independent review Important findings
   - RED: exact selector tests reproduced off-scale V2/demo/legacy gaps and padding plus the later 12px mobile `.container` gutter; legal tests reproduced missing 72ch/15px/1.75 measures and component-tier major headings; demo-order tests reproduced the `h1` to `h3` skip; delegated-owner coverage rejected missing auth owner mappings.
   - GREEN: V2/demo/legacy geometry now uses approved spacing tokens and effective 16px mobile gutters; legal prose and preformatted bodies use the named long-form role and 72ch measure; legal major headings use section-title tuples; demo triad cards are `h2`; exact selector/media evaluation binds each geometry assertion; both auth child owners are verified from their page sources.
11. Independent re-review Important findings
   - RED: effective mobile assertions reproduced 24px card padding on demo/informational routes; exact typography assertions reproduced display/component/table role drift; global utility assertions reproduced `.list`/`.row` changes leaking into `WorkpackEditor`.
   - GREEN: the four mobile card selectors now resolve to 16px padding; informational/login titles, card headings, and login controls use canonical page/component/control tuples; global `.list`/`.row` values are restored and Task 4 spacing is isolated behind `route-supporting-page`, which `WorkpackEditor` does not consume.
12. Third independent re-review Important findings
   - RED: the exact 767px boundary retained desktop gutters/card padding, while V2 navigation, login navigation, and demo mode controls failed the canonical Control tuple.
   - GREEN: the V2/demo breakpoint now covers every viewport below 768px and exact 767px assertions prove 16px gutters/card padding; all three audited controls use 14px/700/20px/zero tracking with a 44px minimum height.
13. Final independent re-review Important findings
   - RED: representative 1024px assertions showed `.container`, `.v2-shell`, and `.demo-mode-shell` retaining 24px desktop gutters instead of the tablet 20px tier.
   - GREEN: ordered `max-width: 1279px` and `max-width: 767px` overrides now produce exact 24px/20px/16px gutters at 1280px/1024px/767px for all three shell selectors.
14. Supporting-route completion review
   - RED: supporting cards had no desktop/mobile padding contract, route introductions inherited Component-title typography, and authentication navigation plus the ask result grid retained off-scale 14px/18px gaps.
   - GREEN: route-scoped cards resolve to 24px desktop and 16px mobile padding; scoped subtitles use the 17px/500/1.65/zero-tracking Body-large tuple without changing other subtitle consumers; both residual gaps use the 16px spacing token.
15. Module geometry completion review
   - RED: supporting heroes retained 24px mobile padding, while base and document-variant module heroes, wrappers, grid articles, and panels used off-scale or single-width geometry.
   - GREEN: supporting heroes resolve to 24px/16px desktop/mobile padding; base and document module heroes, grid/panel wrappers, general and nine-grid articles, and panels use allowed 1280px/1024px/767px spacing and gutter tiers without typography changes.

## Final verification evidence

| Gate | Result |
| --- | --- |
| `npm.cmd test -- tests/frontend-route-coverage.test.ts` | PASS, 16/16 |
| `npm.cmd test -- tests/frontend-route-coverage.test.ts tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts` | PASS, 48/48 |
| `npm.cmd run audit:frontend-consistency` | PASS, 32 pages, 22 components, 0 coverage issues, 0 violations, 0 `!important` |
| `npm.cmd test` | PASS, 54 files, 492/492 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS, Next.js 15.5.15 production compile and type validation |
| `git diff --check` | PASS |

## Files intentionally changed

- Test/contract: `tests/frontend-route-coverage.test.ts`, `tests/frontend-design-contract.test.ts`, `scripts/frontend_consistency_audit.mjs`
- Route semantics: `app/ask/page.tsx`, `app/dryrun/page.tsx`, `app/interpretation/[id]/page.tsx`, `app/knowledge/page.tsx`, `app/law/[id]/page.tsx`, `app/ontology/page.tsx`, `app/precedent/[id]/page.tsx`, `app/preview/page.tsx`, `app/roadmap/page.tsx`, `app/search/page.tsx`, `app/settings/page.tsx`, `app/trust/page.tsx`, `app/why/page.tsx`
- Shared route surfaces: `components/AnswerPanel.tsx`, `components/BriefingSettingsCard.tsx`, `components/CitationList.tsx`, `components/ResultCard.tsx`, `components/SafeClawLanding.tsx`, `components/V2DemoExperience.tsx`
- Canonical selector mapping: `app/globals.css`
- Task state/evidence: `tasks/ralph/frontend-consistency/prd.json`, `.superpowers/sdd/task-4-report.md`

## Review handoff

- `F4.passes` deliberately remains `false` until review.
- Browser screenshots and route-state capture remain Task 7 scope.
- Workspace interaction-density components and generated-document embedded CSS remain Tasks 5 and 6 scope.
