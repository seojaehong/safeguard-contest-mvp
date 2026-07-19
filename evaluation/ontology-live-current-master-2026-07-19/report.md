# Ontology Live Current Master Check

Generated: 2026-07-19 KST

## 기준

- Source HEAD at check start: `b1753200dbc88793f917a78fdb8b50a455230300`
- Live build-info at check time: `b1753200dbc88793f917a78fdb8b50a455230300`
- Route: `https://www.safeclaw.kr/ontology?theme=day`
- DB schema/data mutation: none

## 판단

The previous live audit that classified `/ontology` as a P0 hairball graph blocker is stale for current master. The current production page no longer renders the whole published ontology as an unreadable 166-node graph by default. It renders a selected-node neighborhood explorer and switches mobile to a relation list while preserving the full 166-node evidence count as context.

Current `/ontology` is not complete as a North Star knowledge product, but the specific launch blocker "core graph unusable due dense overlapping hairball" is closed on the current live build.

## Live browser metrics

Probe:

```powershell
node playwright chromium probe against https://www.safeclaw.kr/ontology?theme=day
```

Desktop `1440x900`:

- `clientWidth`: 1440
- `scrollWidth`: 1440
- page horizontal overflow: false
- visible neighborhood node count: 13
- node overlap pairs: 0
- neighborhood graph present: true
- mobile relation fallback element present in DOM: true
- blocked internal terms visible: 0

Mobile `390x844`:

- `clientWidth`: 390
- `scrollWidth`: 390
- page horizontal overflow: false
- visible neighborhood node count: 13
- node overlap pairs: 0
- neighborhood graph present in DOM: true
- mobile relation list present: true
- blocked internal terms visible: 0

Blocked internal terms checked:

- `Obsidian`
- `JSONL`
- `Published ontology`
- `published_ontology`
- `API 계약 보기`
- `node`
- `노드`

## Focused test gate

Command:

```powershell
npm.cmd test -- tests\ontology-ui-remediation.test.ts tests\ontology-visualization.test.ts tests\ontology-ui-browser.test.ts tests\ontology-tablet-overflow.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 4 files executed
- 2 files PASS
- 2 files SKIPPED
- 9 tests PASS
- 3 tests SKIPPED
- Duration: 2.60s

Coverage:

- Two-hop neighborhood is bounded and deterministic.
- Display slots are collision-free.
- One-hop and two-hop exploration stay distinct.
- Operator export formats are absent from the customer explorer.
- Mobile relation list is the default mobile presentation boundary.
- Touch-safe control rules are present in CSS.
- Customer-facing Korean labels replace raw internal ontology terminology.

## Remaining North Star work

This check closes only the current live P0 blocker. It does not claim:

- the whole ontology product is finished;
- every ontology route has final Dieter Rams/Linear-level information architecture;
- the knowledge review queue, Hermes/OpenClaw runtime, or LLM wiki long-term plan is complete;
- all routes outside `/ontology` have passed the same browser gate.

Next candidates remain:

- `/why` mobile comparison table clipping;
- global contrast and route typography consistency;
- `/knowledge` mobile density and sub-44px controls;
- workpack document editor product gap for document-specific structured editors;
- share provider production dispatch readiness.
