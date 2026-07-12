# Wave 9 task brief

Base: authoritative frontend/backend integration `31a44c0`.

## Goal

Normalize the complete user-visible `/demo` surface rendered by
`components/V2DemoExperience.tsx`. The original selector-prefix inventory is
exactly 64 findings, but source inspection proves that only 60 are rendered:

- rendered typography 37: tuple 14, font-size 7, line-height 10, tracking 6
- rendered geometry and decoration 23: radius 18, decorative box-shadow 3,
  decorative gradient 2
- dead CSS ledger 4: `.mission-rail` / `.mission-step` radius 2 and tuple 2;
  these classes occur in no `app` or `components` TSX and are not a rendered
  design-completion claim

The rendered family is limited to `.v2-*`, `.demo-*`, and `.scenario-strip`.
The `.mission-*` prefix remains in the inventory-only dead-CSS ledger. The baseline deliberately
excludes `body:has(...)` landing guards, `.command-center-shell` rules, global
roles, and shared module/document/workspace selectors.

## Required process

1. Write the focused selector-family contract first and observe the exact
   inventory 64 = rendered 60 + dead 4 split, followed by a rendered 60-to-0
   RED, without changing production CSS or the audit runner.
2. Prove `V2DemoExperience.tsx` renders the three owned selector families and
   `/demo` mounts that component. Redirected/dead prototype CSS is out of scope.
3. Normalize every owned text role to a complete existing semantic tuple:
   font family where applicable, size, weight, line height, and tracking.
4. Normalize every owned card, control, progress, badge, and stage surface to
   the existing radius tiers and color/design tokens. Remove owned decorative
   gradients and shadows; do not replace them with new arbitrary values.
5. Split mixed selector lists when necessary so shared selectors are not
   changed as a side effect of the demo remediation.
6. Preserve scenario selection, live/offline mode, speed, progress, generated
   document/evidence states, keyboard behavior, and semantic active/done state
   distinctions.
7. Add production browser coverage for Day/Night at 1440x900, 390x844, and a
   short 1440px viewport. Verify complete computed typography, geometry,
   controls, state contrast, and zero horizontal/vertical clipping.
8. Run focused tests, strict typecheck, normal 27-route build, production
   browser matrix, and static audit. Record the rendered 60-to-0 delta, retain
   the four dead mission findings in the inventory ledger, and record the
   honest repository-wide residual RED.

## Hard exclusions

- No audit runner/parser/allowlist/threshold/coverage/route changes.
- No `body:has(...)`, global foundation, module shell, Reports, workspace,
  ontology, AI Connect, MCP, KOSHA, or OpenClaw selector changes.
- No `SafeGuardCommandCenter.tsx`, `WorkpackEditor.tsx`, `lib/types.ts`,
  `lib/current-workpack.ts`, `lib/db-harness.ts`, package, or lock changes.
- No wholesale `app/globals.css` replacement; only bounded demo selectors.
- Preserve the 16 unrelated screenshot files and do not claim full static or
  108-row PASS.

## Deliverable

Commit tests and the task brief with the observed RED log first. Product CSS
may be changed only in the subsequent GREEN commit. Later source-bound
evidence belongs under
`evaluation/frontend-demo-design-wave9-2026-07-12/source-<sha>/`.
