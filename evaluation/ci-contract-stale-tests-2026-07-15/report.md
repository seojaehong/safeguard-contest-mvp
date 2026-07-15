# CI contract stale test remediation

Date: 2026-07-15
Branch: `fix/ci-contract-stale-tests-20260715`
Base: `79e48daec4add10706068dd6a5705c4f5ca7d5f9`

## Scope

- Updated only the three stale assertions in the two requested test files.
- Preserved the reports product behavior: two customer download actions remain visible by default, while three administrator files remain inspectable in a closed disclosure.
- Preserved authoritative improvement history as a separately inspectable surface and verified that it is not merged into sample report evidence.
- Moved ontology copy ownership checks to the current `page.tsx` and `OntologyExplorer.tsx` sources.
- Moved the operation graph path assertion to its production caller, `FieldOperationsWorkspace.tsx`.
- Did not change product code, `frontend-route-coverage`, ontology CSS, audit probes, globals, DB/schema, grounded, or Hermes sources.

## RED

Command:

```powershell
npm.cmd test -- tests/reports-download-center.test.ts tests/user-visible-korean-copy.test.ts
```

Result: 3 failed, 14 passed.

- Reports expected five visible buttons but received two because three administrator actions are intentionally collapsed.
- Ontology copy expected the retired visible label `노드` in `app/ontology/page.tsx`.
- Operation graph path was expected in `app/ontology/page.tsx`, although the live caller is `components/FieldOperationsWorkspace.tsx`.

## GREEN

Exact requested files:

```powershell
npm.cmd test -- tests/reports-download-center.test.ts tests/user-visible-korean-copy.test.ts
```

Result: 2 files passed, 17 tests passed, duration 32.59s.

Related tests:

```powershell
npm.cmd test -- tests/reports-design-remediation.test.ts tests/reporting-downloads.test.ts tests/ontology-ui-remediation.test.ts tests/ontology-ui-browser.test.ts tests/workspace-operation-graph.test.ts tests/operation-memory-visualization.test.ts
```

Result: 5 files passed, 1 skipped; 66 tests passed, 1 skipped; duration 122.41s.

Typecheck:

```powershell
npm.cmd run typecheck
```

The first attempt exposed broken temporary junctions for already-declared `pdf-lib` dependencies. After repairing only the ignored local `node_modules` installation, typecheck passed with no diagnostics. No dependency manifest or lockfile changed.

## Diff gate

- `git diff --check`: passed.
- Tracked scope before evaluation: exactly the two requested test files.
- Final intended commit scope: those two tests plus this bounded Markdown/JSON evaluation pair.
- `tests/frontend-route-coverage.test.ts`: untouched; its closure remains dependent on final 108 evidence.
