# SafeClaw Task 2 Report: SIF Leak Paths

## Scope

- Task: close readable SIF label leaks in remediation and operation memory.
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`
- Base: Task 1 helpers present at `3bbd3ae`.
- DB schema/data changes: none.
- Push: not performed.

## Changes

- `app/api/workpack/remediate/route.ts`
  - `mapCatalogEvidence` now uses `getSafetyReferenceDisplayTitle`.
  - Remediation prompt/source summaries use `getSafetyReferenceDisplaySummary`.
- `lib/ontology/operation-memory.ts`
  - Evidence node labels now use the shared readable display title.
  - Evidence node metadata preserves `rawTitle` and adds `displayTitle`.
- `lib/workpack-learning-export.ts`
  - Markdown evidence bullets and Obsidian Evidence links use readable display titles.
  - JSONL reference events keep raw `title` and add `displayTitle`.
- Tests
  - Added remediation route leak-path coverage.
  - Added operation-memory Evidence node label/provenance coverage.
  - Added learning export Markdown/Obsidian/JSONL coverage.

## RED Evidence

Command:

```powershell
npm.cmd test -- tests\workpack-remediate-route.test.ts tests\ontology-operation-memory.test.ts tests\commercial-harness.test.ts
```

Result: failed as expected.

- `tests/ontology-operation-memory.test.ts`
  - Expected readable title:
    `지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례`
  - Received raw title:
    `1919 / 기타의사업 / 시설관리및사업지원서비스업`
- `tests/commercial-harness.test.ts`
  - Markdown evidence bullet still contained raw title.
- `tests/workpack-remediate-route.test.ts`
  - Remediation `sources` did not contain the readable title.

## GREEN Evidence

Focused command:

```powershell
npm.cmd test -- tests\workpack-remediate-route.test.ts tests\ontology-operation-memory.test.ts tests\commercial-harness.test.ts
```

Result:

- Test Files: 3 passed
- Tests: 25 passed

Regression command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts tests\ontology-operation-memory.test.ts tests\operation-memory-visualization.test.ts tests\workpack-remediate-route.test.ts
```

Result:

- Test Files: 5 passed
- Tests: 37 passed

## Production Gates

Build command:

```powershell
npm.cmd run build
```

Result: exit 0. Next production build compiled, generated static pages, and finalized page optimization.

Typecheck command:

```powershell
npm.cmd run typecheck
```

Result: exit 0. `tsc --noEmit --incremental false` completed successfully.

## Self-Review

- Spec fit: remediation evidence, operation-memory Evidence labels, Markdown bullets, and Obsidian Evidence links now use the shared readable display title.
- Provenance: raw `title` remains unchanged on `SafetyReferenceItem`; JSONL reference events keep raw `title` and add `displayTitle`; operation-memory Evidence node meta keeps `rawTitle` and `displayTitle`.
- Scope: no schema/data changes, no new parsing logic outside `lib/safety-reference-catalog.ts`, no push.
- Risks: pre-existing untracked `docs/superpowers/plans/2026-07-10-sif-human-readable-evidence.md` was left untouched.
