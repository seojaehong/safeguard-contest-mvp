# SafeClaw authoritative release gate

## Scope

- Source HEAD: `2b4316056b44b8729903d364d93022a916383ab6`
- KOSHA exact-trust Wave 2: already present on the authoritative branch with equivalent product and evidence patches.
- Remote Hermes: trusted-transport and durable-attempt-ledger boundary integrated; product execution remains disabled until those application-owned dependencies are supplied.

## Verification

### Full test suite

- Command: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=hanging-process`
- Result before evidence refresh: 184 files, 175 passed, 1 failed, 8 skipped; 2,062 tests passed, 1 failed, 14 skipped.
- The only failure was a stale frontend browser-evidence source identity after the Hermes integration. It was not a product assertion failure.
- Evidence log: `evaluation/2026-07-17-authoritative-full-test.log` (local generated log, intentionally not committed).
- After regenerating the static and browser evidence, the failed contract suite passed: 1 file / 39 tests.

### Focused backend trust gate

- Integrated Hermes and KOSHA focus: 15 files / 274 tests passed.
- Strict typecheck passed.

### Build and frontend audit

- Normal production build: passed, 28/28 static pages generated.
- Static frontend contract: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Normal bundle contract: passed; audit marker count 0.
- Audit bundle contract: passed; deterministic marker present only in the audit graph.
- Audit runtime boundary: HTTP 500 expected, one boundary marker, no unfiltered page or console errors.
- Browser matrix: 108/108 rows passed, 108 screenshots, 0 failed rows, 0 recovered rows, 0 findings.

### Export contract

- Direct XLSX POST: HTTP 200, 8,384 bytes, 18/18 expected headers, no missing headers.
- Direct binary PDF POST: HTTP 200, `application/pdf`, 22,106 bytes, `%PDF-` magic, not HTML.
- PDF NFT trace contains Noto Sans KR Regular, Bold, and OFL assets.
- Focused PDF/export tests: 3 files / 30 tests passed in the build-dependent focused run; production-only browser matrices remained conditionally skipped and are covered by the 108-row audit.
- Artifact: `evaluation/2026-07-17-authoritative-output-contract/report.json`.

## Honest limitations

- Remote Hermes production execution is intentionally unavailable until an application-owned connection-pinned transport and durable attempt ledger are wired.
- DB migration, published ontology mutation, and production data mutation were not performed.
- Existing unrelated/generated screenshot changes outside the current audit artifact set were not staged.
