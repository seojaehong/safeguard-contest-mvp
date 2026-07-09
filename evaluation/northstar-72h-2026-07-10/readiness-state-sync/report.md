# SafeClaw Workspace Readiness + Layout Check

Date: 2026-07-10
Branch: `feature/backend-harness-gate`

## Scope

- Fix the workspace step state mismatch where a generated workpack could look ready while readiness gates still blocked sharing.
- Fix the high-zoom / short-height Day workspace clipping where the first composer could extend below the visible presentation viewport.

## Changes

- Added `blocked` as a workspace step status.
- Wired `assessWorkpackReadiness` into workspace step status generation.
- Kept `/workspace` share page open for inspection after workpack generation, but changed step copy to `검수 필요`, `전송 잠금`, or `보완 확인` when readiness blocks sharing.
- Added compact CSS for `min-width: 901px` and `max-height: 430px` so the first composer remains inside the viewport on high-zoom presentation screens.

## Regression Signal

The new high-zoom regression failed before the CSS fix:

```text
expected 383 to be less than or equal to 357
```

After the fix:

```text
npm.cmd test -- tests\workspace-layout-regression.test.ts -t "high-zoom short day screens"
Test Files  1 passed (1)
Tests  1 passed | 8 skipped (9)
```

## Verification

```text
npm.cmd test -- tests\workspace-pages.test.ts tests\workspace-layout-regression.test.ts
Test Files  2 passed (2)
Tests  14 passed (14)
```

```text
npm.cmd test -- tests\workpack-readiness.test.ts
Test Files  1 passed (1)
Tests  2 passed (2)
```

```text
npm.cmd run typecheck
tsc --noEmit --incremental false
```

```text
npm.cmd run build
Compiled successfully
Generating static pages (27/27)
```

## Browser Evidence

- Screenshot: `evaluation/northstar-72h-2026-07-10/layout-probes/local-workspace-day-1170x365.png`
- Metrics: `evaluation/northstar-72h-2026-07-10/layout-probes/local-workspace-day-1170x365-metrics.json`

Key local metrics after the fix:

```json
{
  "viewportHeight": 365,
  "textarea": {
    "top": 217,
    "bottom": 301,
    "height": 84,
    "scrollTop": 0,
    "clientHeight": 82,
    "scrollHeight": 82
  },
  "helper": {
    "top": 309,
    "bottom": 324
  }
}
```

Result: the composer no longer clips at the bottom of a high-zoom short viewport, and the helper remains separated from the textarea.

## Remaining Notes

- Production at `https://www.safeclaw.kr/workspace?theme=day` was separately probed at `2048x638` and `1365x425`; no topbar-to-main overlap was detected in those probes.
- This report covers layout/state sync only. It does not claim that generated document quality is complete.
