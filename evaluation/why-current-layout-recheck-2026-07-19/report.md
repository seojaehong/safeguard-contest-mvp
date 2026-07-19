# Why Page Current Layout Recheck

- Date: 2026-07-19
- Route: `/why`
- Local HEAD: `3e6b4c2203328a7261aaf317c5081313d01e6bbb`
- Production build-info during adjacent checks: `1837daae8adf35babeca037afcb52a04b2183c5a`
- Scope: mobile comparison table overflow and desktop comparison table preservation

## Verdict

PASS. The current `/why` page no longer reproduces the historical 390px comparison-table overflow blocker.

## Verification

```powershell
npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: `1 file / 4 tests PASS`.

## Contract Covered

- Mobile Day/Night at `390x844`:
  - document horizontal overflow `0`
  - no visible elements outside viewport
  - no unreadable direct text
  - no under-44px interactive controls
  - comparison rows reflow to readable stacked cards
  - pseudo labels are present for table cells
- Desktop Day/Night at `1440x900`:
  - five-column comparison table preserved
  - document horizontal overflow `0`
  - header contrast at least WCAG AA

## Interpretation

The historical live audit finding that `/why` clipped the comparison table at mobile width is no longer representative of the current product surface.
