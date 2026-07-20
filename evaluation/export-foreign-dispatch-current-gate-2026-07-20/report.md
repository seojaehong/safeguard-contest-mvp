# Export / Foreign Dispatch Current Gate

Checked at: 2026-07-20T05:40:18.000Z

## Verdict

PASS on current launch lineage through `76111d0d19dda046ad988dcdc254d21abab38d65`.

Current master/launch branch contains the active export and foreign-dispatch integration line through `76111d0d19dda046ad988dcdc254d21abab38d65`. Earlier isolated candidate SHAs are not direct ancestors, but the current integrated files preserve the relevant contracts through the active route/component tests.

## Verified Scope

- Document export localization.
- Editor export integrity.
- XLSX export route rendering.
- PDF Korean font integration and font-failure behavior.
- Foreign worker language generation/parse contracts.
- Dispatch capability and idempotency policy.

## Verification

```powershell
npm.cmd test -- tests\document-export-localization.test.ts tests\editor-export-integrity.test.ts tests\xlsx-export-route.test.ts tests\pdf-korean-font-integration.test.ts tests\pdf-font-failure.test.ts tests\foreign-worker-languages.test.ts tests\foreign-parse.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\provider-dispatch-idempotency-gate.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 9 files / 67 tests.

## Notes

- This gate does not adopt the rejected multi-process candidate branch as a range merge.
- No DB schema change, Supabase mutation, or provider dispatch side effect was performed.
- Current rerun result: 9 test files passed / 67 tests passed / 7.10s.
