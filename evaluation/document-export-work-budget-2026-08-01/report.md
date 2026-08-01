# Document export work budget remediation

Verdict: `PASS_CURRENT_SOURCE_DOCUMENT_EXPORT_WORK_BUDGETS`

Source/product commit: `29e1e1ec5d0e4fc57e7b1ce5daa61170d2238c44`

Base: `94bd0dcaa1e691b0a482b8ed2f552023a21ffcd4`

## Scope

This closes the approval-free `document-export-work-budgets` wave from the repository security remediation plan.

Finding IDs:

- `csf_9f4d050101c5687bad6441dc`
- `csf_bcec0c4f5c9d784eba666a36`
- `csf_6a2c44d7d7c5ea908f1fc62d`
- `csf_b0dbb71a9aeca1ffa150b9d9`
- `csf_e5354308ff5ff4d402961a70`
- `csf_21d7f195b719e0f73ad4c73a`
- `csf_7c616e59ae8f50e96114a026`
- `csf_90fab9d634e762871753178a`

## Security invariant

`/api/export/xlsx` and `/api/export/hwp` must fail closed before expensive document generation when user-controlled export bodies exceed bounded budgets for request bytes, document count, row count, nested entries, field characters, rendered cell estimate, or output bytes.

Legitimate bounded single XLSX, workpack XLSX, structured XLSX, and HWP exports must continue to return binary documents.

## Implementation

Changed files:

- `app/api/export/xlsx/route.ts`
- `app/api/export/hwp/route.ts`
- `lib/document-export-budget.ts`
- `tests/document-export-budget.test.ts`

The patch adds a shared route-level budget helper. Existing XLSX/HWP builders are unchanged. The two routes now:

- read request bodies with a 256 KiB byte budget;
- reject over-budget documents, rows, nested entries, field strings, rendered cell estimates, and generated output;
- return deterministic `413` JSON with `cache-control: no-store` and no `content-disposition`;
- preserve current `500` error behavior for genuine builder failures.

No DB, Share, provider, vector, wiki, or KOSHA registry mutation was performed.

## Verification

| Gate | Result |
|---|---|
| `npm.cmd install` | PASS, audit 0 |
| `npm.cmd exec -- vitest run tests/document-export-budget.test.ts tests/xlsx-export-route.test.ts tests/editor-export-integrity.test.ts tests/document-export-localization.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 4 files / 31 tests |
| `npm.cmd exec -- tsc --noEmit` | PASS |
| `npm.cmd audit --omit=dev` | PASS, 0 vulnerabilities |
| `npm.cmd exec -- vitest run tests/document-export-budget.test.ts tests/xlsx-export-route.test.ts tests/editor-export-integrity.test.ts tests/document-export-localization.test.ts tests/pdf-korean-font-integration.test.ts --maxWorkers=1 --fileParallelism=false` | PASS, 5 files / 49 tests |
| `git diff --check` | PASS with LF-to-CRLF notices only |
| `npm.cmd run build` | PASS, Next 15.5.22, 28/28 static pages |

## Boundaries still open

- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`
- KOSHA exact promotion and reviewer checklist: approval-gated
- Full repository security complete claim: not allowed until open findings are closed and rescanned
