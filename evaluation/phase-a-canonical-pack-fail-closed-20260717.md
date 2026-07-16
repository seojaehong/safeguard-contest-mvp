# Phase A canonical-pack pre-provider fail-closed evaluation

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Isolated worktree: `.worktrees/phase-a-canonical-pack-fail-closed-20260717`
- Runtime changes: `lib/mcp-docpack-handler.ts`, `lib/ontology/evidence-chain.ts`
- Focused regression tests: `tests/phase-a-runtime-evidence-bridge.test.ts`
- Database and migration changes: none

## Required invariant

Every non-null Phase A evidence pack returned to an MCP docpack handler is treated as untrusted input. The handler must validate the complete pack against the canonical evidence-chain registry before invoking generation. A mismatch returns a `review_required` fail-closed payload and does not invoke generation, QA review, or persistence.

## TDD evidence

RED command:

```powershell
npm.cmd test -- tests/phase-a-runtime-evidence-bridge.test.ts
```

Before the runtime gate, all 8 forged-pack cases failed at the later product-materialization check. The stack reached `materializePhaseAProductIntoResponse`, proving validation happened after generation instead of before it.

GREEN command:

```powershell
npm.cmd test -- tests/phase-a-runtime-evidence-bridge.test.ts
```

Result after the gate: 1 test file passed, 13 tests passed.

### P2 remediation RED/GREEN

The follow-up review found that malformed nested structures could throw before the
handler returned its honest fail-closed payload, and that persistence assertions
used a non-tenant auth context. The regression matrix now treats the runtime pack
as `unknown`, includes `task: null` and `applicability: null`, and enables tenant
persistence boundaries for both MCP routes.

RED result before the safe validator boundary: 1 test file failed, with 4 malformed
pack cases failing and 13 tests passing. Both plain and reviewed routes threw a
`TypeError` from canonical validation.

GREEN result after the boundary: 1 test file passed, 17 tests passed. Malformed
packs now return the same `canonical_evidence_pack_mismatch` payload as shaped
forgeries.

### Independent re-review remediation RED/GREEN

The exact-null handler gate was verified test-first. With `evidenceContract: false`,
the plain RED reached repository initialization and the reviewed RED returned a
generated/QA result instead of the mismatch payload. Both handlers now treat only
exact `null` as absence. `false`, `0`, and an empty string return
`canonical_evidence_pack_mismatch` before provider, QA, or tenant persistence.

Applicability child validation was also verified test-first. The RED cases for
`fieldHistory: null` reached plain persistence and reviewed generation/QA. The
runtime predicate now requires the exact applicability keys, `scope_only`
authority, arrays for `fieldHistory` and `weather`, and string elements in both
arrays. Wrong authority, malformed children, non-string elements, and extra fields
all fail closed. A valid pack with non-empty string arrays remains accepted.

Final focused handler result: 1 test file passed, 36 tests passed.

## Attack matrix

| MCP route | Untrusted field | Result | Provider calls | QA calls | Persistence boundary calls |
| --- | --- | --- | ---: | ---: | ---: |
| plain | task node | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| plain | control node | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| plain | SIF evidence UID | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| plain | law evidence UID | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| plain | malformed task | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| plain | malformed applicability | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| reviewed | task node | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| reviewed | control node | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| reviewed | SIF evidence UID | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| reviewed | law evidence UID | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| reviewed | malformed task | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| reviewed | malformed applicability | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| plain | `false`, `0`, empty string | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| reviewed | `false`, `0`, empty string | `review_required`, fail closed | 0 | 0 | persist callback 0 |
| plain | malformed applicability children/authority/extra field | `review_required`, fail closed | 0 | N/A | repository initialization 0 |
| reviewed | malformed applicability children/authority/extra field | `review_required`, fail closed | 0 | 0 | persist callback 0 |

The returned payload identifies `canonical_evidence_pack_mismatch`, sets `evidenceChainState` to `review_required`, and sets `failClosed` to `true`.

## Regression verification

```powershell
npm.cmd test -- tests/phase-a-runtime-evidence-bridge.test.ts tests/phase-a-runtime-evidence-grounding.test.ts tests/phase-a-product-materialization.test.ts tests/mcp-product-materialization-persistence.test.ts
```

Result: 4 test files passed, 88 tests passed. This includes valid canonical plain/reviewed MCP behavior, tenant-enabled persistence boundaries, falsy non-null and malformed runtime packs, valid applicability arrays, and the existing canonical materialization forgery matrix.

```powershell
npm.cmd run typecheck
```

Result after correcting the test mock contract and completing the worktree-local dependency setup: `TYPECHECK_EXIT=0` with no TypeScript diagnostics.

```powershell
git diff --check
npm.cmd run build
```

Result: diff check completed without errors. The Next.js 15.5.20 production build
compiled successfully, completed type validation, and generated all 28 static
pages with exit 0.

## Setup note

Current verification used:

```powershell
npm.cmd ci --dry-run --ignore-scripts
```

The command exited 0 at the exact branch HEAD. The lockfile contains both
`@emnapi/core` and `@emnapi/runtime`; the prior statement that they were absent
was stale. The dry run reported only package changes needed to align the existing
worktree-local `node_modules` with the lockfile. No dependency manifest was modified.
