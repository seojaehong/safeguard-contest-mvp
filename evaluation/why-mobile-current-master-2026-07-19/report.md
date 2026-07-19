# Why Mobile Current Master Check

Generated: 2026-07-19 KST

## 기준

- Source HEAD at check start: `d580d9de9562c9324f5512fd4f9de0d36255326e`
- Latest live build-info observed before local test: `b1753200dbc88793f917a78fdb8b50a455230300`
- Route: `https://www.safeclaw.kr/why?theme=day` and `?theme=night`
- DB schema/data mutation: none

## 판단

The previous live audit finding that `/why` mobile comparison content clipped to approximately 889px is not reproduced on current production. The current `/why` comparison table keeps semantic table markup while reflowing each comparison row into a stacked mobile card.

The route still belongs to the broader design-quality workstream, but the specific P0/P1 mobile clipping blocker is closed on current master.

## Live browser metrics

Probe:

```powershell
node playwright chromium probe against https://www.safeclaw.kr/why?theme=day and ?theme=night at 390x844
```

Day `390x844`:

- `clientWidth`: 390
- `scrollWidth`: 390
- page horizontal overflow: false
- comparison table x/right/width: `29 / 361 / 332`
- body row widths: all `332`
- body row display: `grid`
- visible outside viewport elements: 0

Night `390x844`:

- `clientWidth`: 390
- `scrollWidth`: 390
- page horizontal overflow: false
- comparison table x/right/width: `29 / 361 / 332`
- body row widths: all `332`
- body row display: `grid`
- visible outside viewport elements: 0

## Focused browser gate

Command:

```powershell
npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 1 file PASS
- 4 tests PASS
- Duration: 28.63s

Coverage:

- Mobile `390x844` day and night comparison rows are readable stacked cards.
- Mobile document overflow is zero.
- Mobile table remains semantic `TABLE` markup.
- Mobile labeled cells expose column labels through `data-label`.
- Desktop `1440x900` day and night preserve the five-column comparison table.
- Desktop header contrast remains at or above the test threshold.

## Remaining North Star work

This check closes only the current `/why` mobile clipping blocker. It does not claim:

- global contrast is complete on every route;
- all legacy landing routes have final Linear/Dieter Rams information architecture;
- `/knowledge` mobile density and touch targets are fixed;
- provider dispatch production readiness is complete.
