# North Star Output Contract Check

Date: 2026-07-18

## Scope

This check verifies the currently deployed SafeClaw production output boundary for risk-assessment exports and harness materialization contracts.

No database schema, Supabase data, or production records were modified.

## Production Output Contract

Command:

```powershell
$env:SAFECLAW_OUTPUT_CONTRACT_BASE_URL='https://www.safeclaw.kr'
$env:SAFECLAW_OUTPUT_CONTRACT_OUT_DIR='evaluation\northstar-output-contract-2026-07-18'
npm.cmd run smoke:output-contract
```

Result: PASS

- Base URL: `https://www.safeclaw.kr`
- XLSX: 200, `위험성평가표` sheet, 18/18 expected headers present
- PDF: 200, `application/pdf`, `%PDF-` magic, not HTML fallback
- TBM risk links generated in source contract: true
- TBM risk links exposed in type contract: true
- KOSHA risk-assessment headers present in XLSX builder: true

Artifacts:

- `evaluation/northstar-output-contract-2026-07-18/report.json`
- `evaluation/northstar-output-contract-2026-07-18/files/risk-assessment-contract.xlsx`
- `evaluation/northstar-output-contract-2026-07-18/files/risk-assessment-contract.pdf`

## Harness / Quality Focused Gate

Command:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\workpack-ontology-qa.test.ts tests\ask-generation-evidence-routes.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS

- Test files: 4/4 passed
- Tests: 68/68 passed

## Related Current Evidence

KOSHA exact trust registry wave 2 is already present on current `master` with the following recorded evidence:

- Focused Vitest: 5 files, 80/80 tests PASS
- KOSHA corpus audit: 1 file, 110/110 tests PASS
- Broad KOSHA/SIF/Ontology Vitest: 31 files PASS, 3 files SKIP; 395 tests PASS, 4 SKIP
- Python acquisition: 19 tests PASS
- Strict TypeScript: PASS
- Production build: 28/28 static pages PASS
- Next NFT: 78 manifests total; 16 consumer manifests include both exact KOSHA JSON assets; partial asset manifests 0

Evidence file: `evaluation/kosha-trust-registry-wave2-2026-07-16/report.md`

## Notes

An initial local invocation of `npm.cmd run smoke:output-contract` without `SAFECLAW_OUTPUT_CONTRACT_BASE_URL` failed because no local server was listening on `127.0.0.1:3110`. The production rerun above is the valid gate evidence.
