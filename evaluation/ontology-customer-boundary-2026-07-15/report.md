# Ontology customer boundary remediation

- Base commit: `e4ac87c65c8f6b4d7e7c6d22659a4aaaf98ec45e`
- Date: 2026-07-15 KST
- Scope: `/ontology` customer presentation only. Graph API, report exports, and operator routes remain available at their existing owners.

## Changes

- Removed raw JSON, JSONL, Obsidian, and API contract links from the default customer explorer.
- Preserved the task-focused neighborhood graph, search, filters, relation cards, and full-screen graph.
- Prevented the global Night theme text color from leaking onto light ontology node cards.
- Added a 390px visible-element bounds gate.
- Added contrast checks for node labels, titles, and metadata in both desktop and mobile full-screen graph states.

## Verification

- TDD red: 2 focused presentation tests failed while raw operator terms remained.
- Focused presentation tests: 2 files, 14 tests passed.
- Browser contract: 1 test passed across desktop 1440 and mobile 390, Day and Night.
- Browser metrics: horizontal overflow 0, mobile outside elements 0, overlap pairs 0, minimum control height 44px, minimum node contrast 16.01:1, minimum child text contrast 5.6:1.
- Strict typecheck: passed.
- Production build: 28/28 static pages generated.
- Static frontend audit: 32 pages, 23 product components, coverage issues 0, violations 0.
- GitHub CI for the base commit: typecheck, serial full test suite, and production build passed in run `29418118669`.

## Evidence

- `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`
- `evaluation/ontology-ui-remediation-2026-07-15/desktop-day.png`
- `evaluation/ontology-ui-remediation-2026-07-15/desktop-night.png`
- `evaluation/ontology-ui-remediation-2026-07-15/mobile-day.png`
- `evaluation/ontology-ui-remediation-2026-07-15/mobile-night.png`

## Remaining gate

This report is local authoritative-branch evidence, not production verification. After deployment, `/ontology` must be checked again at the production URL in Day and Night at 1440px and 390px.
