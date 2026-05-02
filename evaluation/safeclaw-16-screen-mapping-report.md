# SafeClaw 16 Screen Mapping Report

Date: 2026-05-02

## Scope

This pass keeps `/workspace` as the stable workpack engine and maps the designer prototype screens to product routes. No DB migration, data mutation, or public API caller change was performed.

## Route Mapping

| Prototype screen | Route | Status | Connected implementation |
|---|---|---|---|
| Landing A | `/` | live | `SafeClawLanding` |
| Landing B | `/demo` | partial | v2 demo routes |
| Login | `/workspace` | partial | existing storage/auth status panel |
| Home dashboard | `/home` | planned | product shell with workspace fallback |
| Workspace A | `/workspace#command` | live | existing command center engine |
| Workspace B | `/workspace` | planned | responsive workspace candidate |
| Document editor | `/documents` | live | `WorkpackEditor` with sample workpack |
| Evidence library | `/evidence` | partial | `CitationList`, KOSHA references, accident cases |
| Workers and education | `/workers` | partial | worker summary, education draft structure |
| Field dispatch | `/dispatch` | live | `WorkflowSharePanel`, n8n dispatch flow |
| Worker mobile | `/worker` | planned | mobile notice shell with workspace fallback |
| TBM fullscreen | `/tbm` | planned | fullscreen TBM shell with workspace fallback |
| Archive | `/archive` | partial | workpacks/dispatch/education API route map |
| Knowledge DB | `/knowledge` | live | existing knowledge page |
| API operations | `/ops/api` | live | dryrun snapshot shell with `/dryrun` fallback |
| Settings | `/settings` | planned | settings shell with workspace fallback |

## Verification

- `npm.cmd run typecheck`: pass.
- `npm.cmd run build`: pass.
- New routes included in Next build output: `/documents`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/ops/api`, `/home`, `/worker`, `/tbm`, `/settings`.
- Existing stable engine route included in build output: `/workspace`.

## Notes

- `/workspace` remains the source of truth for real workpack generation, API orchestration, document editing, worker selection, and dispatch.
- Planned routes are intentionally not fake-complete. Each page states the required future capability and points users back to the current usable path.
- Prototype navigation now opens the mapped product route instead of only jumping to old workspace anchors.
