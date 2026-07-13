# Workspace document editor layout remediation

## Scope

- `/workspace` document review to `위험성평가표` edit flow
- Desktop 1440x900 and mobile 390x844
- Day and Night themes
- Full-width editor focus, export controls, compact headers, worker fields, and Claw empty-state copy

## Production browser result

| Viewport | Theme | Page height | Canvas width | Editor width | Horizontal overflow | Side cards in editor | Export overlap |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| Desktop | Day | 2,823px | 968px | 672px | None | 0 | None |
| Desktop | Night | 2,884px | 968px | 672px | None | 0 | None |
| Mobile | Day | 4,283px | 336px | 336px | None | 0 | None |
| Mobile | Night | 4,418px | 336px | 336px | None | 0 | None |

The pre-fix desktop regression fixture measured 11,624px. The editor canvas was previously auto-placed into a 224px grid track, which caused citation and supporting cards to wrap into multi-thousand-pixel heights.

## Automated evidence

- Static workbench and Claw contracts: 19/19 passed
- Generated document edit browser regression: 1/1 passed at desktop and mobile geometry assertions
- Strict TypeScript typecheck: passed
- Next production build: 27/27 static pages generated
- Production browser matrix: 4/4 rows passed

Machine-readable metrics are in `report.json`. Screenshots are stored beside this report.
