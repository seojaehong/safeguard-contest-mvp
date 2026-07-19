# Knowledge Mobile Current Master Check

Generated: 2026-07-19 KST

## 기준

- Source HEAD at check start: `db40ec6d802657845931920708aaac53d1008029`
- Live build-info observed before this report: `d580d9de94d87f6b51f90776bd57d373dd79ee79`
- Route: `https://www.safeclaw.kr/knowledge?theme=day` and `?theme=night`
- DB schema/data mutation: none

## 판단

The earlier `/knowledge` mobile findings for raw English/internal stage labels, sub-44px repeated controls, and an approximately 8,890px single-page mobile surface are stale for current master. The current production page uses a mobile section navigator and shows only the active panel by default.

This does not mean the knowledge product is complete, but the specific mobile IA/touch-target blockers are closed on the current route surface.

## Live browser metrics

Probe:

```powershell
node playwright chromium probe against https://www.safeclaw.kr/knowledge?theme=day and ?theme=night at 390x844
```

Day `390x844`:

- `clientWidth`: 390
- `scrollWidth`: 390
- body height: 1152
- active panel: `today`
- visible raw/internal terms: 0
- visible controls below 44px: 0
- visible outside viewport elements: 0

Night `390x844`:

- `clientWidth`: 390
- `scrollWidth`: 390
- body height: 1152
- active panel: `today`
- visible raw/internal terms: 0
- visible controls below 44px: 0
- visible outside viewport elements: 0

Blocked visible terms checked:

- `Hermes / LLM`
- `human_review`
- `Published ontology`
- `published_ontology`
- `SafeClaw system of record`

## Focused gate

Command:

```powershell
npm.cmd test -- tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-governance-ui-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 3 files PASS
- 18 tests PASS
- Duration: 81.90s

Coverage:

- Mobile knowledge section navigator keeps one active task panel visible.
- User-facing governance labels use Korean presentation labels.
- Raw governance enum values are preserved in data boundaries, not default copy.
- Knowledge page layout and governance contracts remain stable.

## Remaining North Star work

This closes only the current mobile IA blocker. It does not claim:

- the full knowledge review queue is production complete;
- organization/site knowledge promotion is implemented end-to-end;
- Hermes/OpenClaw runtime has reached the long-term shared worker-pool architecture;
- all report/document export surfaces have final customer-facing polish.
