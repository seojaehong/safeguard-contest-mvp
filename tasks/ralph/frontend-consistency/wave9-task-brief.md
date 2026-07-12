# Wave 9 task brief

Base: authoritative frontend/backend integration `31a44c0`.

## Goal

Normalize the complete user-visible `/demo` surface rendered by
`components/V2DemoExperience.tsx`. The original selector-prefix inventory is
exactly 64 findings, but an exact JSX class manifest proves that only 47 are
rendered by the owned selector alternatives:

- rendered typography 28: tuple 11, font-size 4, line-height 9, tracking 4
- rendered geometry and decoration 19: radius 15, decorative box-shadow 3,
  decorative gradient 1
- non-rendered/shared ledger 17: `.v2-hero` 11, `.mission-*` 4, and two
  shared comma-group findings (`.v2-link-band` radius and `.inline-progress`
  radius), plus the non-rendered `.v2-hero` gradient. These are not
  rendered-owned design-completion claims.

The rendered family is limited to the `.v2-*`, `.demo-*`, and
`.scenario-strip` alternatives whose root classes occur in
`V2DemoExperience.tsx`. The `.mission-*` and `.v2-hero` prefixes remain in the
inventory-only dead-CSS ledger. The baseline deliberately
excludes `body:has(...)` landing guards, `.command-center-shell` rules, global
roles, and shared module/document/workspace selectors.

## Required process

1. Write the focused selector-family contract first and observe the exact
   inventory 64 = rendered 47 + non-rendered/shared 17 split, followed by a
   rendered 47-to-0
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
   browser matrix, and static audit. Record the rendered 47-to-0 delta, retain
   all 17 non-rendered/shared findings in the inventory ledger, and record the
   honest repository-wide residual RED. Splitting `.demo-progress-track` from
   `.inline-progress` leaves the shared source/computed style unchanged, so the
   expected repository-wide delta is 46 rather than 47 (`2,127` to `2,081`).

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
