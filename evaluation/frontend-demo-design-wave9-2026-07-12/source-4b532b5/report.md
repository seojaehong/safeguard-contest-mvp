# Frontend demo design Wave 9

Source product commit: `4b532b50e8af84f958c513f6722ed55a379969e5`  
Product patch identity: `79805892b31b25935b700214e97e8af3b81aa188`

## Scope truth

The initial prefix inventory was 64 findings. Exact JSX class extraction from
`V2DemoExperience.tsx` identified 48 rendered-owned findings. Sixteen source
findings were non-rendered or shared (`.v2-hero`, `.v2-link-band`, and
`.mission-*`). Splitting the mixed progress rule preserved the shared
`.inline-progress { border-radius: 999px; }` declaration and made that debt an
explicit seventeenth final ledger finding.

The `/demo` route has no Day/Night product theme hook. It has no theme prop,
theme query, theme class, or color-scheme branch. The browser matrix therefore
tests the real light route under both light and dark media preferences and
proves the surface signature is unchanged; it does not claim Night support.

## Product result

- Rendered-owned audit findings: 48 to 0.
- Repository static audit: 2,127 to 2,080, exact delta -47.
- `!important`: 696 to 696; coverage issues: 0 to 0.
- Final inventory ledger: 17 non-rendered/shared findings.
- Progress geometry uses `--radius-control` (4px), not a circular radius.
- Compact nav/mode controls are at least 36px; scenario controls are at least
  44px (currently 112px minimum).
- Shared role families are normalized only below `.demo-mode-shell` (or its
  adjacent presenter note): brand, eyebrow, API pulse, triad, language, card,
  and presenter. Their global declarations are unchanged.
- Active scenario retains the functional 4px hazard rail. Done/live/offline
  state and keyboard interactions remain distinguishable.

## Verification

- `npm.cmd test -- tests/demo-design-contract.test.ts tests/demo-production-matrix.test.ts`: focused contract 5/5 PASS; production lane skipped unless opted in.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 27/27 static pages.
- `$env:DEMO_PROD_MATRIX='1'; npm.cmd test -- tests/demo-production-matrix.test.ts`: 1/1 PASS, six real production lanes (light/dark media preference x 1440x900, 390x844, 1440x500).
- Production matrix checks complete owned tuples, all rendered shared role metrics, canonical scoped radii, compact/full control heights, active/done/live/offline interactions, media-stable light-route colors, and zero horizontal overflow/clipped controls.
- `node scripts/frontend_consistency_audit.mjs`: expected repository RED 2,080; rendered-owned 0; coverage 0.

No backend contract, audit runner, shared component, package/lock, Reports,
workspace, ontology, KOSHA, MCP, or OpenClaw file was changed.
