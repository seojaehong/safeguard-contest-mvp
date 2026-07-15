# Exact KOSHA runAsk Grounding Wiring

## Scope

- Production boundary: `lib/search.ts`
- Regression boundary: `tests/kosha-current-review-run-ask.test.ts`
- Database and schema changes: none

## Defect

The verified current D-C-13 reference was promoted to `DbHarnessPacket.directEvidence`, but `runAsk` built `eligibleKoshaIds` only from parent-ready supporting evidence. The provider grounding packet therefore omitted the exact trusted KOSHA source and its controls.

## TDD Evidence

RED command:

```powershell
npm.cmd test -- tests/kosha-current-review-run-ask.test.ts -t "wires exact trusted D-C-13 direct evidence"
```

RED result: 1 failed. The response DB packet contained D-C-13, while the captured provider grounding packet contained no KOSHA source.

GREEN implementation:

- Include direct KOSHA references only when both `isKoshaTechnicalReference` and `isSafetyReferenceDirectEligible` pass.
- Preserve the existing parent-ready gate for supporting KOSHA references.
- Do not promote general supporting-only, stale, tampered, or unresolved KOSHA references.

## Verification

```powershell
npm.cmd test -- tests/exact-trusted-kosha-grounding.test.ts tests/kosha-current-review-run-ask.test.ts
npm.cmd run typecheck
```

- Focused tests: 2 files, 39 tests passed.
- Strict TypeScript: passed in an isolated clean worktree after lock-respecting dependency installation.
- `package.json` and `package-lock.json`: no diff.
- Existing general supporting-only and stale/tampered fail-closed assertions remained green.

## Result

The actual `runAsk` provider input now receives the verified current D-C-13 source as `kind: "kosha"`, and every control retained in the DB direct-evidence packet is preserved in the grounding packet control set. Existing supporting-only and review-required boundaries are unchanged.
