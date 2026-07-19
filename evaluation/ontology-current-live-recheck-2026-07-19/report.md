# Ontology Current Live Recheck

- Date: 2026-07-19
- Live URL: `https://www.safeclaw.kr/ontology`
- Verified production commit at time of adjacent KOSHA/live checks: `9e77e53671498d91284c71b9cb58a69401ed9e4e`
- Browser metrics: `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`

## Verdict

PASS. The current live ontology page no longer exposes the full graph as an unreadable hairball. The default surface uses a selected-neighborhood model and keeps mobile on relation cards with an optional fullscreen graph.

## Browser Gate

```powershell
$env:ONTOLOGY_BASE_URL='https://www.safeclaw.kr'
npm.cmd test -- tests\ontology-ui-browser.test.ts --maxWorkers=1 --fileParallelism=false
Remove-Item Env:ONTOLOGY_BASE_URL
```

Result: `1 file / 1 test PASS`.

Additional local regression:

```powershell
npm.cmd test -- tests\ontology-ui-remediation.test.ts tests\ontology-tablet-overflow.test.ts tests\ontology-visualization.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: `2 files PASS / 1 skipped`, `9 tests PASS / 2 skipped`.

## Current Live Metrics

- Desktop Day/Night: 15 visible neighborhood nodes, overlap pairs `0`, horizontal overflow `0`.
- Tablet Day/Night: 15 visible neighborhood nodes, overlap pairs `0`, horizontal overflow `0`.
- Mobile Day/Night: desktop graph hidden, relation cards visible, fullscreen graph verified with 15 nodes.
- Mobile outside elements: `0`.
- Minimum control height: `44px`.
- Minimum node text contrast: `5.6:1`.
- Minimum node surface contrast: `16.01:1`.
- Dialog keyboard contract: PASS on mobile fullscreen graph.

## Interpretation

The historical production audit that classified `/ontology` as a P0 graph usability blocker is no longer representative of the current product. The current implementation limits the default graph to a bounded neighborhood and preserves the full graph only as a controlled fullscreen exploration path.
