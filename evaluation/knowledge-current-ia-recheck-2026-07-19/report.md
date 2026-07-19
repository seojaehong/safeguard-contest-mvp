# Knowledge Current IA Recheck

- Date: 2026-07-19
- Route: `/knowledge`
- Scope: mobile information architecture, governance terminology, disclosure/link touch targets

## Verdict

PASS. The current knowledge surface no longer relies on one very long mobile page for the primary experience. Mobile uses six reachable tab panels, and governance terminology is localized at the presentation boundary while preserving machine identifiers in data attributes.

## Verification

```powershell
npm.cmd test -- tests\knowledge-mobile-ia-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: `1 file / 4 tests PASS`.

```powershell
npm.cmd test -- tests\knowledge-governance-ui-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: `1 file / 7 tests PASS`.

## Contract Covered

- Mobile Day/Night at `390x844`:
  - one visible active panel
  - six reachable tabs
  - tab controls at least `44px`
  - document height under the mobile budget
  - horizontal overflow `0`
  - hash deep links and browser history map to the active panel
  - no hydration/page errors in the browser test
- No-JS fallback:
  - all six sections remain visible
  - inactive tab navigation is hidden
- Desktop:
  - all six sections remain visible in source order
- Governance copy:
  - machine identifiers remain in data attributes
  - user-facing labels are Korean
  - publication remains blocked behind human review
  - repeated evidence disclosures and links have `44px` touch targets

## Interpretation

The historical `/knowledge` findings for overlong mobile IA, raw enum/English presentation, and sub-44px repeated evidence controls are no longer representative of the current product surface.
