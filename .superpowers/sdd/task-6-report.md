# Task 6 implementation report

## Scope

- Standardized the rendered editor preview, printable/export HTML, and PDF-ready HTML on the document font stack and exact print role tuples.
- Preserved all document interpolation, field order, approval/signature markup, A4 page contract, API request parsing, binary PDF path, and response headers.
- Added tabular numerals only to document table cells. Product HUD typography is not used in document prose or tables.

## TDD evidence

- RED: `npm.cmd test -- tests/generated-document-typography.test.ts` failed 4 of 5 tests on the original divergent preview, printable, and PDF-ready typography.
- GREEN: the same command passes 6 of 6 tests after the bounded CSS changes, including a repository-wide embedded `font-size` scan of the editor/export source.

## Verification

- `npm.cmd test -- tests/generated-document-typography.test.ts tests/frontend-design-contract.test.ts`: PASS, 2 files / 24 tests.
- `npm.cmd test`: PASS, 56 files / 508 tests.
- `node scripts/frontend_consistency_audit.mjs`: PASS, 32 routes, 22 components, zero coverage issues, zero violations, zero `!important` declarations.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS; production `BUILD_ID` produced.
- `git diff --check`: PASS (line-ending conversion warnings only).

## Output-contract note

`tests/output-contract-smoke.test.ts` does not exist. The repository alternative is `npm.cmd run smoke:output-contract`, which requires a running SafeClaw server at `SAFECLAW_OUTPUT_CONTRACT_BASE_URL` (default `http://127.0.0.1:3110`) and writes files under `evaluation/2026-05-08-output-contract-smoke`. This server-backed smoke is deferred to the integrated browser/server verification task; source-level response contracts and the full repository suite pass here.

## Review state

F6 remains `in_progress` with `passes: false` pending independent specification and code-quality review.

## Independent-review remediation

- Added exact `title`, `section`, `body`, `table`, and `note` roles to the default binary PDF branch. The CID PDF now declares Malgun Gothic regular and bold resources and emits role-specific font size, leading, and tracking operators.
- Covered every editor-preview text owner with a document-scoped rule that defeats the earlier screen/HUD cascade, including approval, metadata labels and values, confirmation rows, tables, notes, and signatures.
- Removed the newly introduced shared `@page` declaration from `formCss`; downloadable HTML/XLS/Word/browser-print behavior retains its prior page-size behavior. The pre-existing PDF-ready HTML A4 rule remains unchanged.
- Replaced broad source substring evidence with independently delimited template checks and direct `POST` invocation for both default binary PDF and `?format=html` responses. Tests assert representative values, order, signatures, status, MIME, disposition, cache headers, PDF magic, font resources, and every typography role.
- Review RED: strengthened suite failed 5 of 9 tests before remediation.
- Review GREEN: generated plus design-contract tests pass 27/27; full suite passes 56 files / 511 tests; static audit, typecheck, build, and diff-check pass.

## Embedded-font remediation

- Replaced the non-embedded Malgun Gothic name declarations with two real Noto Sans KR TrueType programs: static 400 and 700 instances generated from the official Google Fonts variable TTF. The included `NotoSansKR-OFL.txt` records the SIL Open Font License; no Windows system font is redistributed.
- The binary PDF now uses `/CIDFontType2`, raw `/FontFile2` streams, per-font `/CIDToGIDMap` streams built from each TrueType Unicode `cmap`, `/Identity-H`, and a shared `/ToUnicode` identity CMap. HTML continues to use the Malgun-first print-safe stack and the embedded Noto font is the portable binary fallback.
- RED: 3 of 10 generated-document tests failed on missing assets, invalid CID subtype, absent font programs/ToUnicode, and missing Korean extraction proof.
- GREEN: actual response bytes contain two TrueType programs and the expected font-resource graph; the ToUnicode extraction check recovers Korean title, company, site, work, and signature text.
- Verified: focused generated plus design-contract tests 28/28, full suite 56 files/512 tests, static audit zero violations, typecheck, production build (`6VXzX-xnqM5yUVHrW-rCG`), and diff-check pass.

## Subset-font recovery

- Replaced the 12.13 MiB handcrafted full-font PDF assembly with `pdf-lib` plus `@pdf-lib/fontkit` dynamic subsetting. A representative response is 15,770 bytes, below the enforced 1 MiB budget (SHA-256 `4DC006D2BCDEDEF95F6ACF124C955D54612CBCB494F5A32A0A20C5319D3D62D9`).
- Corrected both source TrueType name tables and checksums. Independent fontTools inspection reports family `Noto Sans KR`, PostScript names `NotoSansKR-Regular` and `NotoSansKR-Bold`, subfamilies `Regular` and `Bold`, OS/2 weights 400 and 700, and zero checksum errors.
- Registered the exact subset font resource keys on the PDF page before emitting the title, section, body, table, and note operators. This preserves the exact role sizes, leading, tracking, A4 media box, row order, signatures, and response headers while producing valid `/CIDFontType2`, `/FontFile2`, and `/ToUnicode` resources.
- Independent runtime proof now uses PDF.js text extraction rather than raw operand decoding. It recovers the Korean title, company, site, work description, writer, and approver. `@napi-rs/canvas` then renders the title region and requires nonblank dark glyph pixels.
- Recovery RED: focused verification failed 1 of 28 checks because the first low-level operator version referenced logical font names instead of the page's generated resource keys; PDF.js returned subset CIDs instead of Korean text.
- Recovery GREEN: focused generated-document and design-contract verification passes 28/28; the full suite passes 56 files/512 tests; static audit covers 32 routes and 22 components with zero coverage issues and zero violations; strict typecheck passes; production build `CIHaGCAgAeMgGgzv-QwIB` passes; diff-check passes.
- F6 remains `in_progress` with `passes: false` pending fresh independent specification and code-quality review.
