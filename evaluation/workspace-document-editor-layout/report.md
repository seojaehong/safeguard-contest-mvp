# Workspace document editor layout remediation

## Scope

- `/workspace` document review to `위험성평가표` edit flow
- Desktop 1440x900 and mobile 390x844
- Day and Night themes
- Full-width editor focus, export controls, compact headers, worker fields, and Claw empty-state copy

## Production browser result

Tested source commit: `2f1f80e8fbdb006e0c1e9af084103e5eb9be8cee`

| Viewport | Theme | Default page height | Expanded tools height | Canvas width | Role / phone width | Header overlap | Export overlap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Desktop | Day | 4,116px | 8,183px | 968px | 401px / 401px | 0 | None |
| Desktop | Night | 4,178px | 8,246px | 968px | 400px / 400px | 0 | None |
| Mobile | Day | 7,109px | 14,233px | 336px | 242px / 242px | 0 | None |
| Mobile | Night | 7,141px | 14,370px | 336px | 240px / 240px | 0 | None |

The pre-fix desktop regression fixture measured 11,624px and placed the editor canvas in a 224px grid track. The fixed default view keeps the editor, evidence, graph, and checklist visible while placing worker, Claw, sharing, and history functions in an explicit collapsed `운영 도구` disclosure. Expanding it preserves every operation without creating blank layout tracks.

Expanded component bounds also passed the focused limits: compact header maximum 76px, impact list 252px, citation group maximum 796px, and share panel maximum 3,928px on the narrow mobile viewport.

## Automated evidence

- Static workbench and Claw contracts: 19/19 passed
- Generated document edit browser regression: 1/1 passed at desktop and mobile geometry assertions
- Strict TypeScript typecheck: passed
- Next production build: 27/27 static pages generated
- Production browser matrix: 4/4 rows passed, including expanded operation controls

Machine-readable metrics are in `report.json`. Screenshots are stored beside this report.
