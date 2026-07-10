# SafeClaw Frontend Consistency Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every user-visible SafeClaw browser and generated-document surface follow one restrained, explicit system for typography, spacing, shape, hierarchy, and interaction state.

**Architecture:** Establish a typed frontend design contract and a testable static audit before changing styles. Normalize the shared token/base/component layers first, then correct route families and generated documents, and finally reconcile a complete desktop/mobile browser matrix against the static inventory. Preserve feature layouts and backend contracts while removing confirmed legacy cascade rules instead of hiding them behind another broad override.

**Tech Stack:** Next.js 15 App Router, React 19, strict TypeScript, global CSS, Vitest, Playwright, PowerShell, GitHub Draft PR.

## Global Constraints

- Work only in `.worktrees/frontend-consistency-audit` on `feat/frontend-consistency-audit`.
- Use `npm.cmd`, never `npm`, in Windows terminal commands.
- Do not change database schemas, migrations, stored data, API response contracts, or backend persistence behavior.
- Use Pretendard for Korean product UI, Geist Mono for HUD/status/source/numeric UI, Noto multilingual fallbacks for worker messages, and a print-safe Korean stack for generated documents.
- Screen type values are fixed to: display `clamp(44px, 6vw, 72px)/0.98/800/-0.045em`; page title `clamp(32px, 4vw, 40px)/1.15/800/-0.035em`; section title `clamp(24px, 3vw, 28px)/1.25/800/-0.025em`; component title `20px/1.35/700/-0.015em`; body large `17px/1.65/500/0`; body `15px/1.60/500/0`; support `14px/1.60/500/0`; control `14px/20px/700/0`; table `13px/20px/500/0`; caption `12px/18px/600/0`; HUD `11px/16px/700/0.08em`.
- Table headers use `12px/18px/700/0`; positive tracking is reserved for short HUD labels.
- Print type values are fixed to: title `20pt/24pt`; section `14pt/18pt`; body `10pt/15pt`; table `8.5pt/12pt`; note `8pt/11pt`.
- Use the spacing scale `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px`; page gutters are `24px` desktop, `20px` tablet, and `16px` mobile.
- Product cards, controls, menus, dialogs, and tooltips use `4px` radius; micro tags use `2px`; tables, document paper, progress rails, and structural regions use `0`; `50%` is only for true circles; general-purpose `999px` pills are forbidden.
- Default control height is `44px`, compact control height is `36px`, icon-only hit area is `44 × 44px`, and textarea minimum height is `120px`.
- Use steel-neutral surfaces and Hazard Yellow only for primary action or urgent/active signals.
- Avoid decorative gradients, decorative shadows, large pill cards, and arbitrary component-local type values.
- Preserve all routes and features. Do not remove a route because it is internal, legacy, demo, or difficult to render.
- Before every push, run `git pull --rebase origin master` and stage only files in this frontend audit.
- Keep Draft PR #66 updated with conflict-prone shared files and verification status.

---

### Task 1: Executable design contract and route inventory

**Files:**
- Create: `lib/frontend-design-contract.ts`
- Create: `tests/frontend-design-contract.test.ts`
- Create: `scripts/frontend_consistency_audit.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `frontendTypography`, `frontendSpacing`, `frontendShape`, `userVisibleRoutes`, and `generatedSurfaceFiles` as readonly exported contracts.
- Produces: `npm.cmd run audit:frontend-consistency`, which writes a JSON result to `OUTPUT_PATH` and exits non-zero for contract violations.
- Consumes later: Tasks 2-7 use these contracts as their exact static and browser coverage inventory.

- [ ] **Step 1: Write the failing contract test**

Create `tests/frontend-design-contract.test.ts` with assertions that require four font roles, semantic type and spacing tiers, all 32 page routes, special framework states, and the generated document source files. The test must also read `app/globals.css` and fail until every contract token is declared.

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  frontendShape,
  frontendSpacing,
  frontendTypography,
  generatedSurfaceFiles,
  specialSurfaceFiles,
  userVisibleRoutes
} from "@/lib/frontend-design-contract";

const root = process.cwd();

describe("frontend design contract", () => {
  it("defines the four deliberate typography roles", () => {
    expect(Object.keys(frontendTypography.fonts)).toEqual(["product", "hud", "multilingual", "document"]);
    expect(frontendTypography.tracking.body).toBe("0");
    expect(frontendTypography.tracking.hud).toBe("0.08em");
  });

  it("uses a 4px spacing rhythm and the approved product radius", () => {
    expect(Object.values(frontendSpacing).every((value) => Number.parseInt(value, 10) % 4 === 0)).toBe(true);
    expect(frontendShape.controlRadius).toBe("4px");
  });

  it("inventories every browser and generated-document surface", () => {
    expect(userVisibleRoutes).toHaveLength(32);
    expect(new Set(userVisibleRoutes).size).toBe(userVisibleRoutes.length);
    for (const relativePath of [...specialSurfaceFiles, ...generatedSurfaceFiles]) {
      expect(fs.existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("declares every semantic CSS token", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    for (const token of frontendTypography.cssTokens) expect(css).toContain(`${token}:`);
    for (const token of Object.keys(frontendSpacing)) expect(css).toContain(`--space-${token}:`);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- tests/frontend-design-contract.test.ts`

Expected: FAIL because `@/lib/frontend-design-contract` does not exist.

- [ ] **Step 3: Implement the strict typed contract**

Create `lib/frontend-design-contract.ts` with readonly tuples and records. Route values must exactly match the 32 `app/**/page.tsx` surfaces, including dynamic route patterns. Font stacks and token names must be values used by CSS, not descriptions.

```ts
export const frontendTypography = {
  fonts: {
    product: '"Pretendard", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif',
    hud: '"Geist Mono", "Cascadia Mono", Consolas, monospace',
    multilingual: '"Noto Sans", "Noto Sans KR", "Noto Sans Thai", "Noto Sans Khmer", "Noto Sans Myanmar", "Noto Sans Devanagari", "Malgun Gothic", sans-serif',
    document: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  },
  screen: {
    display: { size: "clamp(44px, 6vw, 72px)", weight: 800, lineHeight: "0.98", tracking: "-0.045em" },
    pageTitle: { size: "clamp(32px, 4vw, 40px)", weight: 800, lineHeight: "1.15", tracking: "-0.035em" },
    sectionTitle: { size: "clamp(24px, 3vw, 28px)", weight: 800, lineHeight: "1.25", tracking: "-0.025em" },
    componentTitle: { size: "20px", weight: 700, lineHeight: "1.35", tracking: "-0.015em" },
    bodyLarge: { size: "17px", weight: 500, lineHeight: "1.65", tracking: "0" },
    body: { size: "15px", weight: 500, lineHeight: "1.60", tracking: "0" },
    support: { size: "14px", weight: 500, lineHeight: "1.60", tracking: "0" },
    control: { size: "14px", weight: 700, lineHeight: "20px", tracking: "0" },
    table: { size: "13px", weight: 500, lineHeight: "20px", tracking: "0" },
    caption: { size: "12px", weight: 600, lineHeight: "18px", tracking: "0" },
    hud: { size: "11px", weight: 700, lineHeight: "16px", tracking: "0.08em" }
  },
  tracking: { body: "0", heading: "-0.025em", display: "-0.045em", hud: "0.08em" },
  cssTokens: [
    "--font-product", "--font-hud", "--font-multilingual", "--font-document",
    "--text-display", "--text-page-title", "--text-section-title", "--text-component-title",
    "--text-body-lg", "--text-body", "--text-support", "--text-caption", "--text-micro",
    "--leading-display", "--leading-title", "--leading-ui", "--leading-body", "--leading-longform",
    "--tracking-body", "--tracking-heading", "--tracking-display", "--tracking-hud"
  ] as const
} as const;

export const frontendSpacing = {
  1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px", 6: "24px",
  8: "32px", 10: "40px", 12: "48px", 16: "64px", 20: "80px", 24: "96px"
} as const;

export const frontendShape = {
  structuralRadius: "0",
  microRadius: "2px",
  controlRadius: "4px",
  panelRadius: "4px",
  circleRadius: "50%",
  controlHeight: "44px",
  compactControlHeight: "36px",
  iconHitArea: "44px"
} as const;
```

Add the complete route and generated-file tuples below these declarations.

- [ ] **Step 4: Add the static audit CLI**

Create `scripts/frontend_consistency_audit.mjs`. It must discover page files rather than trust a hardcoded count, scan CSS declarations, detect route coverage drift, report undeclared font stacks and values outside approved typography tiers, and always write structured JSON before exiting.

The output shape is:

```js
{
  generatedAt,
  status: "pass" | "fail",
  counts: { pageFiles, componentFiles, cssLines, importantDeclarations },
  coverage: { expectedRoutes, discoveredRoutes, missingRoutes, unexpectedRoutes },
  violations: [{ rule, file, line, value }]
}
```

Add to `package.json`:

```json
"audit:frontend-consistency": "node ./scripts/frontend_consistency_audit.mjs"
```

- [ ] **Step 5: Run focused tests and audit**

Run:

```powershell
npm.cmd test -- tests/frontend-design-contract.test.ts
$env:OUTPUT_PATH='evaluation/frontend-consistency-audit-2026-07-11/static-audit-baseline.json'
npm.cmd run audit:frontend-consistency
```

Expected: contract test PASS; audit writes its report and may exit non-zero only for the pre-existing CSS violations Tasks 2-6 will remove.

- [ ] **Step 6: Commit the executable contract**

```powershell
git add package.json lib/frontend-design-contract.ts tests/frontend-design-contract.test.ts scripts/frontend_consistency_audit.mjs evaluation/frontend-consistency-audit-2026-07-11/static-audit-baseline.json
git commit -m "test: define frontend design contract"
```

---

### Task 2: Canonical global typography, spacing, and shape foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tests/frontend-design-contract.test.ts`

**Interfaces:**
- Consumes: token names from `frontendTypography.cssTokens` and `frontendSpacing`.
- Produces: canonical CSS custom properties and base element behavior inherited by all later route tasks.

- [ ] **Step 1: Add failing CSS behavior assertions**

Extend the contract test to require `body` to use `var(--font-product)`, body tracking to use `var(--tracking-body)`, headings to use semantic tracking/leading, form controls to inherit product typography, focus-visible treatment to exist, and reduced-motion handling to exist.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/frontend-design-contract.test.ts`

Expected: FAIL on missing canonical base declarations.

- [ ] **Step 3: Normalize root and base styles**

Modify the existing opening token section of `app/globals.css`; do not append a new catch-all override. Declare the contract tokens once and alias legacy names to them during migration. Use `font-synthesis: none`, `text-rendering: optimizeLegibility`, `font-variant-numeric: tabular-nums` only for numeric roles, and `text-wrap: balance` only for headings.

Remove duplicate root font declarations and global `body { letter-spacing: 0.012em; }`. Product body copy must resolve to `letter-spacing: var(--tracking-body)`.

- [ ] **Step 4: Rationalize font loading**

Keep Pretendard and Geist Mono loading explicit in `app/layout.tsx`, retain the multilingual Noto families, and remove unused Inter/Noto Sans base requests if repository usage confirms they are only accidental fallbacks. Do not introduce a new font dependency.

- [ ] **Step 5: Verify foundation**

Run:

```powershell
npm.cmd test -- tests/frontend-design-contract.test.ts
npm.cmd run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit foundation**

```powershell
git add app/globals.css app/layout.tsx tests/frontend-design-contract.test.ts
git commit -m "fix: normalize frontend design tokens"
```

---

### Task 3: Shared shells, controls, and framework states

**Files:**
- Modify: `components/SafeClawModuleShell.tsx`
- Modify: `components/SafeClawLanding.tsx`
- Modify: `app/not-found.tsx`
- Modify: `app/error.tsx`
- Modify: `app/global-error.tsx`
- Modify: `app/workspace/loading.tsx`
- Modify: `app/globals.css`
- Create: `tests/frontend-shared-surfaces.test.ts`

**Interfaces:**
- Consumes: canonical base tokens from Task 2.
- Produces: consistent shell, heading, action, card, loading, empty, and error primitives used by the route families.

- [ ] **Step 1: Write failing shared-surface tests**

Read the TSX source and assert that special states use semantic headings (`h1` or `h2`), loading uses a named class rather than a numeric inline style, icon-only controls have accessible names, and the module shell exposes stable class hooks for header, navigation, title, description, and content.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/frontend-shared-surfaces.test.ts`

Expected: FAIL because the loading spinner uses inline style and special-state titles are `div` elements.

- [ ] **Step 3: Correct semantic markup and shared classes**

Replace special-state title divs with headings, add a `.special-state` and `.loading-spinner` class, keep the existing Korean copy, and preserve error reset behavior. Align shell navigation, page title, descriptions, cards, and actions to shared semantic classes without changing destinations or event handlers.

- [ ] **Step 4: Consolidate component rules in place**

Move the live `.button`, `.card`, `.topbar`, `.module-*`, `.special-state`, form-control, focus, disabled, status, and loading rules to one authoritative section of `app/globals.css`. Delete older duplicate declarations only after verifying their selectors are covered by the authoritative section.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm.cmd test -- tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts
npm.cmd run typecheck
```

Then commit:

```powershell
git add components/SafeClawModuleShell.tsx components/SafeClawLanding.tsx app/not-found.tsx app/error.tsx app/global-error.tsx app/workspace/loading.tsx app/globals.css tests/frontend-shared-surfaces.test.ts
git commit -m "fix: align shared frontend surfaces"
```

---

### Task 4: Route-family consistency pass

**Files:**
- Modify: browser page files under `app/` only when semantic hooks are missing
- Modify: shared route components under `components/`
- Modify: `app/globals.css`
- Create: `tests/frontend-route-coverage.test.ts`

**Interfaces:**
- Consumes: `userVisibleRoutes` and shared component hooks.
- Produces: a route-by-route classification with no silent omissions and consistent page/title/content/action hierarchy.

- [ ] **Step 1: Write failing route coverage tests**

The test must discover all `app/**/page.tsx` files, convert them to route patterns, compare them with `userVisibleRoutes`, and require every route to be assigned to exactly one family: landing, workbench, module, knowledge/legal, authentication, or internal/demo.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/frontend-route-coverage.test.ts`

Expected: FAIL until every discovered page is represented in the route-family map.

- [ ] **Step 3: Correct landing and informational routes**

Audit `/`, `/home`, `/why`, `/trust`, and `/roadmap`. Standardize hero/display typography, section gaps, card geometry, CTA hierarchy, content width, and mobile wrapping. Preserve the approved SafeClaw field-instrument identity; remove accidental marketing gradients, shadows, pills, and arbitrary tracking.

- [ ] **Step 4: Correct module, knowledge, legal, and search routes**

Audit `/archive`, `/documents`, `/dispatch`, `/evidence`, `/evidence-file`, `/knowledge`, `/knowledge/[section]/[slug]`, `/search`, `/ontology`, `/tbm`, `/law/[id]`, `/interpretation/[id]`, and `/precedent/[id]`. Keep long-form reading line-height distinct from compact operational UI while using the same product font and spacing tiers.

- [ ] **Step 5: Correct authentication, settings, worker, and internal routes**

Audit `/login`, `/auth/callback`, `/settings`, `/settings/ai-connect`, `/worker`, `/workers`, `/demo`, `/preview`, `/prototype`, `/dryrun`, and `/ops/api`. Ensure internal/debug content still has intentional hierarchy and readable monospace use rather than inherited accidental styles.

- [ ] **Step 6: Verify route coverage and commit**

Run:

```powershell
npm.cmd test -- tests/frontend-route-coverage.test.ts tests/frontend-shared-surfaces.test.ts tests/frontend-design-contract.test.ts
npm.cmd run typecheck
```

Commit the exact modified route/component/CSS files with:

```powershell
git add app components tests/frontend-route-coverage.test.ts
git commit -m "fix: unify supporting route design"
```

---

### Task 5: Workspace and reports interaction-density pass

**Files:**
- Modify: `components/SafeGuardCommandCenter.tsx`
- Modify: `components/FieldOperationsWorkspace.tsx`
- Modify: `components/ReportsDownloadCenter.tsx`
- Modify: `components/WorkflowSharePanel.tsx`
- Modify: `components/AgentConsole.tsx`
- Modify: `app/globals.css`
- Create: `tests/frontend-workbench-visual-contract.test.ts`

**Interfaces:**
- Consumes: shared tokens and component states.
- Produces: coherent Day/Night workbench density with stable typography and geometry across input, document, share, evidence, agent, and reporting states.

- [ ] **Step 1: Write failing workbench contract tests**

Assert stable class hooks for the three workspace pages, Day/Night theme root, theme toggle, primary action, document rail, evidence rail, share confirmation, report filters, empty results, and loading/disabled states. Assert no inline font or spacing styles in these components.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/frontend-workbench-visual-contract.test.ts`

Expected: FAIL on missing state hooks or inline visual declarations found in the current components.

- [ ] **Step 3: Normalize information hierarchy**

Use product typography for commands and descriptions, HUD typography only for compact state/source/meta labels, consistent control heights, and 4/8px spacing rhythm. Preserve the three-state workflow and all event behavior. Day and Night may differ in color tokens but must share type, spacing, and shape tokens.

- [ ] **Step 4: Normalize document, evidence, sharing, and reporting panels**

Ensure equivalent cards, tabs, rows, empty states, error states, filters, and actions use one hierarchy. Remove redundant labels or decorative boxes only when they duplicate information and do not carry behavior.

- [ ] **Step 5: Verify focused behavior and commit**

Run:

```powershell
npm.cmd test -- tests/frontend-workbench-visual-contract.test.ts tests/workspace-pages.test.ts tests/operation-improvements.test.ts tests/agent-console-copy.test.ts tests/workpack-ontology-qa.test.ts tests/quality-contract.test.ts
npm.cmd run typecheck
```

Commit:

```powershell
git add components/SafeGuardCommandCenter.tsx components/FieldOperationsWorkspace.tsx components/ReportsDownloadCenter.tsx components/WorkflowSharePanel.tsx components/AgentConsole.tsx app/globals.css tests/frontend-workbench-visual-contract.test.ts
git commit -m "fix: refine workbench visual hierarchy"
```

---

### Task 6: Generated-document typography system

**Files:**
- Modify: `components/WorkpackEditor.tsx`
- Modify: `app/api/export/pdf/route.ts`
- Modify: `app/globals.css`
- Create: `tests/generated-document-typography.test.ts`

**Interfaces:**
- Consumes: `frontendTypography.fonts.document` and `generatedSurfaceFiles`.
- Produces: explicit document title/body/table/note tiers for preview, printable HTML, and PDF HTML.

- [ ] **Step 1: Write failing generated-document tests**

Read the embedded HTML/CSS sources and require the same print-safe font ordering, title/body/table/note line-height tiers, tabular numeric treatment where appropriate, and no product HUD font inside document body/table content.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/generated-document-typography.test.ts`

Expected: FAIL because current embedded templates use multiple different font orderings and arbitrary sizes.

- [ ] **Step 3: Normalize document CSS without changing data**

Align embedded printable and PDF HTML to a shared documented scale. Keep dense legal/safety tables readable, preserve page sizing and signatures, and do not change document fields, values, ordering, or export contracts.

- [ ] **Step 4: Verify document behavior and commit**

Run:

```powershell
npm.cmd test -- tests/generated-document-typography.test.ts tests/output-contract-smoke.test.ts
npm.cmd run typecheck
```

If `tests/output-contract-smoke.test.ts` is not present, run the repository's existing `npm.cmd run smoke:output-contract` after starting the required local server and record that dependency in the audit report.

Commit:

```powershell
git add components/WorkpackEditor.tsx app/api/export/pdf/route.ts app/globals.css tests/generated-document-typography.test.ts
git commit -m "fix: standardize generated document typography"
```

---

### Task 7: Complete static and browser audit, artifacts, and PR handoff

**Files:**
- Create: `scripts/frontend_consistency_browser_audit.mjs`
- Create: `evaluation/frontend-consistency-audit-2026-07-11/report.json`
- Create: `evaluation/frontend-consistency-audit-2026-07-11/report.md`
- Create: screenshots under `evaluation/frontend-consistency-audit-2026-07-11/screenshots/`
- Modify: `package.json`

**Interfaces:**
- Consumes: `userVisibleRoutes`, generated surface inventory, and static audit output.
- Produces: authoritative per-route/per-viewport evidence and the final cross-session handoff.

- [ ] **Step 1: Write a failing coverage reconciliation test**

Extend `tests/frontend-route-coverage.test.ts` to require browser result rows for every route at desktop and mobile widths, plus Day/Night rows for `/workspace`. It must fail while `report.json` is absent or incomplete.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/frontend-route-coverage.test.ts`

Expected: FAIL because the final browser report does not yet exist.

- [ ] **Step 3: Implement the browser audit runner**

Create `scripts/frontend_consistency_browser_audit.mjs` using the installed `playwright` package. For each route/viewport row it must capture status, console errors, page errors, horizontal overflow, computed body font, heading font/line-height/tracking, visible primary content, screenshot path, and any required fixture limitation. Use representative repository-backed IDs for dynamic routes; record fallback/error states rather than skipping unavailable external data.

Add to `package.json`:

```json
"audit:frontend-browser": "node ./scripts/frontend_consistency_browser_audit.mjs"
```

- [ ] **Step 4: Run the local production surface**

Run sequentially to avoid `.next/types` races:

```powershell
npm.cmd run build
npm.cmd run start -- -p 3011
```

Keep the server in its own process/session and record the log path as `evaluation/frontend-consistency-audit-2026-07-11/server.log`.

- [ ] **Step 5: Capture every route and reconcile coverage**

Run:

```powershell
$env:BASE_URL='http://127.0.0.1:3011'
$env:OUTPUT_DIR='evaluation/frontend-consistency-audit-2026-07-11'
npm.cmd run audit:frontend-browser
npm.cmd run audit:frontend-consistency
npm.cmd test -- tests/frontend-route-coverage.test.ts
```

Expected: every required matrix row exists; no silent omissions; any external-state limitation is explicit.

- [ ] **Step 6: Inspect representative screenshots**

Visually inspect at minimum landing, workspace Day, workspace Night, reports, knowledge long-form, legal detail, settings, demo/prototype, special error state, document preview, and one mobile capture from every route family. Correct observed hierarchy, wrapping, clipping, spacing, or contrast problems through a new RED-GREEN cycle before continuing.

- [ ] **Step 7: Run full verification**

Run sequentially:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
$env:OUTPUT_PATH='evaluation/frontend-consistency-audit-2026-07-11/static-audit-final.json'
npm.cmd run audit:frontend-consistency
```

Expected: all commands exit 0. Record exact test file/test counts and route matrix counts in both report files.

- [ ] **Step 8: Write final evidence reports**

`report.json` must contain counts, success/failure totals, elapsed time, route rows, generated-surface rows, static violations, and verification command results. `report.md` must explain changes, remaining external-state limitations, screenshots reviewed, and merge-conflict notes for the backend session.

- [ ] **Step 9: Commit, sync, push, and update Draft PR #66**

```powershell
git add package.json scripts/frontend_consistency_browser_audit.mjs evaluation/frontend-consistency-audit-2026-07-11 tests/frontend-route-coverage.test.ts
git commit -m "chore: verify frontend consistency audit"
git pull --rebase origin master
git push
```

Update PR #66 with final route totals, verification commands, artifact links, and exact conflict-prone files. Keep it Draft until the parallel backend session has reviewed the shared-file conflict list.
