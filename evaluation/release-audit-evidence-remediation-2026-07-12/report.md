# Release browser-audit evidence integrity remediation

- Branch: `fix/release-audit-evidence-remediation`
- Remediation base: `9f20be9eed0fdf360a61e620993c7075870c29aa`
- Authoritative source commit: `7a132c04d9ef6f28689a02e8e1f4e81d2edc8885`
- Canonical source identity: `c14b2350a6f98c92ce71cbc9ab6cfbd96552e712c755d444f6fb84f83e8324c3`
- Generated: `2026-07-13T07:57:53.4757673+09:00`
- Result: PASS

## Identity remediation

Static, browser, and bundle audits now share `scripts/frontend_audit_source_identity.mjs`. The canonical inventory includes every `app/**/*.tsx` surface, all component TSX files, audit runners, probes, and the existing fixed contract files. It explicitly includes:

- `app/layout.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/not-found.tsx`
- `app/workspace/loading.tsx`

Mutation tests copy the canonical inventory to an isolated fixture, mutate each boundary file, verify that every mutation changes the identity, and verify that the old prerequisite is rejected as stale.

## Canonical browser evidence

The checked-in canonical evidence under `evaluation/frontend-audit-runner-port-v2-2026-07-11/` was regenerated from one clean audit build and one server on port 3037.

- Schema: 3
- Routes: 32
- Route rows: 96
- Workspace theme rows: 6
- Special rows: 4
- Generated rows: 2
- Total: 108
- Successes: 108
- Failed rows: 0
- Findings: 0
- Recovered rows: 0
- Elapsed: 121,269 ms

The browser report top-level source SHA/identity and nested static prerequisite SHA/identity all equal the authoritative values above. The explicit row contract is `96 + 6 + 4 + 2 = 108`.

## Loading evidence

`special:loading` is an audit-only deterministic rendering of the checked-in `app/workspace/loading.tsx` component. Passing requires the loading marker, deterministic probe kind, loading content, no visible `<main>` outside the boundary, a valid screenshot SHA-256, resolved workspace comparison evidence, and a digest distinct from every resolved desktop workspace screenshot.

- Boundary marker: `loading`
- Fallback kind: `deterministic-audit-probe`
- Visible heading: `작업 화면을 준비하고 있습니다`
- Visible content outside boundary: `false`
- Screenshot size: 1440 x 1000
- Screenshot SHA-256: `66ad25859ff30d2c947c78cabf97fc565306e569e6fbd208d08f0ba89cd4479c`
- Resolved workspace digest matches: 0

The image was inspected directly. It contains the loading surface only; the resolved workspace is not visible below it.

## Verification

- Browser evidence reconciliation: PASS, 1 file and 17 tests.
- Bundle contract test: PASS, 1 file and 1 test.
- Typecheck: PASS.
- Static prerequisite: PASS, 32 page files, 23 component files, 0 coverage issues, 0 violations.
- Normal build: PASS, 27/27 static pages, BUILD_ID `XwZEPt1aBUgLTFDh1AvjG`, marker count 0.
- Audit build: PASS, 27/27 static pages, BUILD_ID `sI2fZ2rWpDW_x_YhvBgl3`, marker count 1.
- Full browser audit: PASS, 108/108.

## Audit trail

The first full regeneration at source `7c8030d` passed machine checks, but direct image inspection found resolved workspace content below the fixed loading overlay. A fail-closed visible-outside-boundary check was added. The next run correctly failed the loading row because author CSS overrode the HTML `hidden` attribute. Source `7a132c0` uses audit-only inline `display:none` with cleanup; its preflight and final 108-row run are the authoritative evidence.

The historical runner-port `report.md/json` remains unchanged as a record of its original blocked state. This remediation report and the regenerated schema-3 `browser-report.md/json` supersede it for current release evidence.

## Raw evidence

- `p1-final-static-audit.log`
- `p1-final-build-normal.log`
- `p1-final-bundle-normal.log`
- `p1-final-build-audit.log`
- `p1-final-bundle-audit.log`
- `p1-final-loading-preflight.log`
- `p1-final-browser-108.log`
- `p1-final-focused-tests.log`
- `p1-final-bundle-tests.log`
- `p1-final-typecheck.log`

No product CSS, Reports, PDF, DB/schema, or environment files were modified.
