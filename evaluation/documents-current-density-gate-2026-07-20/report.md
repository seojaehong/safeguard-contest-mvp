# Documents Current Density Gate (2026-07-20)

## Verdict

IMPROVED.

The standalone `/documents` management page keeps horizontal overflow at zero and now uses the same compact document-launcher direction as the workspace surface. Desktop density is materially reduced; mobile was already compact and remains stable.

## Scope

- Route: `https://www.safeclaw.kr/documents`
- Local product patch: route-scoped `/documents` CSS compact launcher
- Viewports: desktop `1440x900`, mobile `390x844`
- Product code changed in this pass: yes, `app/globals.css`

## Browser Metrics

### Desktop Before

- Document height: `3500px` (`3.89x` viewport)
- Horizontal overflow: `false`
- Outside visible elements: `0`
- First structured editor y: `1978px`
- First textarea y: `2006px`
- Under-44 visible controls sampled: `20`

### Desktop After

- Document height: `2286px` (`2.54x` viewport)
- Horizontal overflow: `false`
- Outside visible elements: `0`
- Compact launcher y: `323px`, height `151px`
- Workpack editor y: `506px`
- First structured editor y: `763px`
- First textarea y: `791px`
- Production live check at commit `5a77590b`: same metrics

### Mobile Before

- Document height: `2529px` (`3.00x` viewport)
- Horizontal overflow: `false`
- Outside visible elements: `0`
- First structured editor y: `1008px`
- First textarea y: `1036px`
- Under-44 visible controls sampled: `3`

### Mobile After

- Document height: `2525px` (`2.99x` viewport)
- Horizontal overflow: `false`
- Outside visible elements: `0`
- Compact launcher y: `311px`, height `218px`
- First structured editor y: `1004px`
- First textarea y: `1032px`
- Production live check at commit `5a77590b`: same metrics

## Interpretation

- Desktop no longer spends the first half of the page on a full three-column cockpit.
- The full document index, preview grid, and export summary are hidden by default on the standalone route; the compact launcher keeps the three core documents visible and keeps the rest behind a submission details control.
- The editor starts much earlier on desktop (`506px` instead of below the long cockpit), while mobile remains stable.
- The page is still a document management surface, so it remains longer than `/workspace`, but the visible IA now follows the same "less is better" direction.

## Verification

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts -t "desktop documents surface|requested document" --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run build
```

Results:

- Focused layout tests: `2 passed | 28 skipped`
- Full documents regression: `30 passed / 30`
- Build: `28/28` static pages

## Artifacts

- `metrics.json`
- `desktop-documents.png`
- `mobile-documents.png`
- `desktop-after-documents.png`
- `mobile-after-documents.png`
- `desktop-live-after-documents.png`
- `mobile-live-after-documents.png`
