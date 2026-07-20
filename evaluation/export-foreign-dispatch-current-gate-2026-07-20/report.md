# Export / Foreign Dispatch Current Gate

Checked at: 2026-07-20T06:18:50.698Z

## Verdict

PASS on current launch lineage through `ac037c3a2a910f2ac64ad7eea04a8a3b13acd1c4`.

Current master/launch branch contains the active export and foreign-dispatch integration line through `ac037c3a2a910f2ac64ad7eea04a8a3b13acd1c4`. Earlier isolated candidate SHAs are not direct ancestors, but the current integrated files preserve the relevant contracts through the active route/component tests.

## Verified Scope

- Document export localization.
- Editor export integrity.
- XLSX export route rendering.
- PDF Korean font integration and font-failure behavior.
- Foreign worker language generation/parse contracts.
- Dispatch capability and idempotency policy.

## Verification

```powershell
npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workflow-share-capability-browser.test.ts tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts tests\document-export-localization.test.ts tests\editor-export-integrity.test.ts tests\xlsx-export-route.test.ts tests\pdf-korean-font-integration.test.ts tests\pdf-font-failure.test.ts tests\foreign-worker-languages.test.ts tests\foreign-parse.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\provider-dispatch-idempotency-gate.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 13 files / 143 tests / 58.63s.

## Notes

- This gate does not adopt the rejected multi-process candidate branch as a range merge.
- No DB schema change, Supabase mutation, or provider dispatch side effect was performed.
- Current rerun result: 13 test files passed / 143 tests passed / 58.63s.
