# Workspace Operation Ontology Browser Check

Date: 2026-07-09

## Scope

N5 verifies that the workspace exposes the operating ontology as a product surface, not only as a separate `/ontology` demo. The graph is built from the generated `AskResponse.dbHarness.packet` before any Hermes/LangGraph replacement or DB schema migration.

## Implemented Surface

- Current Workpack node from the generated workspace response.
- Similar past Workpack nodes from `dbHarness.packet.workpackMemory`.
- Evidence nodes from direct evidence, SIF cases, and supporting evidence.
- Hazard and Control nodes from `safety_reference_items` fields.
- Improvement nodes from accepted photo/manual/operator improvements.
- Ack nodes are intentionally empty until the share/read-confirmation flow creates them.

## Browser Evidence

- Desktop screenshot: `workspace-ontology-day-desktop.png`
- Desktop panel screenshot: `workspace-ontology-day-desktop-panel.png`
- Mobile screenshot: `workspace-ontology-day-mobile.png`
- Mobile panel screenshot: `workspace-ontology-day-mobile-panel.png`
- Metrics: `browser-check.json`

## Results

- Desktop panel rendered: true
- Mobile panel rendered: true
- Horizontal overflow: false on desktop and mobile
- Current graph stats in browser: `노드 18/30`, `관계 33/64`, `확인 0`
- Mobile list uses internal scroll: height `420`, overflow `auto`
- Ack messaging is explicit: share confirmation will populate Ack nodes after workers confirm.

## Design Adjustment

The first graph render was functionally correct but visually dense, especially on mobile. Workspace graph nodes now render as compact dots by default and expand labels only for the active/hovered node. The full node list remains available in a bounded scroll area.

## Verification Commands

```powershell
npm.cmd test -- tests\workspace-operation-graph.test.ts tests\operation-memory-visualization.test.ts tests\workspace-layout-regression.test.ts
npm.cmd run typecheck
```

## Remaining Notes

The saved Supabase operation graph endpoint is wired for stored workpacks and read confirmations, but live production still needs deployment of this branch before `www.safeclaw.kr/workspace` shows the new surface.
