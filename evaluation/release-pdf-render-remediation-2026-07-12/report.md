# PDF visual and binary release blocker remediation

- Repository root: `.`
- Branch: `fix/release-pdf-render-remediation`
- Initial base: `a1dbedb64e177a4909584274eaad87484aa732f4`
- Parent remediation: `f17dcebcc5700463b0691817aa6be424b0a5a7ee`
- Checksum remediation: `c27ec3f645936bae4f21c2b8e09c12d435b548ec`
- Scope: `app/api/export/pdf/route.ts`, PDF tests/helpers, and this evaluation package only
- Local verdict: visual, final embedded sfnt binary, error-boundary, and evidence-path gates GREEN

## Initial visual RED

The original HTTP route returned a contractually valid response while the page remained unreadable:

- `POST /api/export/pdf`: status `200`
- `content-type`: `application/pdf`
- `cache-control`: `no-store`
- UTF-8 `filename*`: present
- Prefix: `%PDF-`
- Size: `16,635` bytes
- Existing direct-`POST` integration tests: `7/7` passed despite the visual defect

Independent rasterization of the one-page RED PDF agreed across all engines:

| Renderer | Pages | Dark pixels | Dark fraction | Raster bands |
| --- | ---: | ---: | ---: | ---: |
| PyMuPDF | 1 | 4,532 | 0.002262 | 20 |
| PDFium | 1 | 4,847 | 0.002419 | 20 |
| Poppler | 1 | 4,523 | 0.002257 | 20 |

The page contained scattered individual glyphs instead of readable Korean lines. The prior extraction/nonblank assertions did not protect release quality.

## Visual root cause

The following alternatives were isolated before changing production code:

1. Content stream coordinates were sane: each line used a stable `Tm` start at `x=42` with distinct vertical positions.
2. Widths and wrapping were not causal: a tiny standard `page.drawText` control still failed with `{ subset: true }`.
3. The same Noto fonts rendered correctly with full embedding, but the control PDF was `6,494,902` bytes and violated the `<1 MiB` contract.
4. Original Noto Bold glyph record lengths included odd values such as `159`, `181`, and `179` bytes. The generated short-`loca` subset described those records as `158`, `182`, and `178` bytes.
5. FontTools found `80` Regular and `12` Bold glyph parse errors in the original route subset.

The first hypothesis was confirmed: `@pdf-lib/fontkit` emits short `loca` offsets for small TrueType subsets without padding odd-length `glyf` records to a 2-byte boundary. Pre-fontkit glyph alignment fixed visual rendering while retaining subsetting.

## Independent binary rejection of f17dceb

The first remediation was visually correct but not binary-complete. Read-only validation of the actual final `FontFile2` streams in `evaluation/release-pdf-render-remediation-2026-07-12/visual-only-green-f17dceb.pdf` found:

| Font | Table checksum fields | Actual adjustment | Expected adjustment | Whole checksum |
| --- | --- | --- | --- | --- |
| Regular | all 7 were `00000000` | `580468FC` | `20C770A3` | `E8EDA813` |
| Bold | all 7 were `00000000` | `247C03A9` | `4C31A975` | `89FB09EE` |

This established a second, separate root cause: fontkit creates a new subset after source normalization and its final TTF serializer writes zero table directory checksums while leaving a stale `head.checkSumAdjustment`.

## Final subset boundary fix

The route now wraps `Font.createSubset().encodeStream()`, the final sfnt boundary immediately before pdf-lib compresses the `FontFile2` stream:

- Buffers only the small final subset binary.
- Recalculates every sfnt table directory checksum with `head.checkSumAdjustment` zeroed for the `head` table checksum.
- Recalculates and verifies whole-font `checkSumAdjustment` against `0xB1B0AFBA`.
- Emits corrected bytes of identical sfnt length to pdf-lib.
- Does not parse/resave the PDF, replace filters, change stream lengths manually, or rewrite xref offsets.
- Wraps repair failures in a typed font-subset error that feeds the existing controlled font `500` boundary only.

The pre-fontkit glyph alignment remains necessary for visual correctness. The final stream hook adds binary correctness.

## Independent error-boundary rejection of c27ec3f

The c27 checksum remediation incorrectly wrapped every `pdf.embedFont` exception in `PdfFontAssetError`. A new regression forced a deterministic document/reference failure from `PDFDocument.prototype.embedFont`; before this remediation the route returned the controlled `PDF_FONT_ASSET_UNAVAILABLE` response instead of logging and rethrowing the original non-font error.

The error boundary is now limited to operations that prove an asset problem:

- Font file/license access, reads, TrueType normalization, and explicit fontkit parse/subset preflight map to `PdfFontAssetError`.
- Final subset stream and checksum-repair failures retain the typed `PdfFontSubsetError` mapping.
- `PDFDocument.create`, `registerFontkit`, `embedFont`, page/reference operations, and unrelated `save` failures reach the general `PDF export failed` log and rethrow unchanged.
- No pdf-lib message matching or unstable external error classes are used.

## Evidence path hygiene

An automated recursive assertion scans every committed file, including PDF and PNG evidence, in `evaluation/release-pdf-render-remediation-2026-07-12/` using a byte-preserving representation. Text evidence rejects every drive-letter, Windows user, or POSIX user absolute path; binary evidence rejects user-directory and `.worktrees` signatures without treating random compressed bytes as paths. All recorded artifact paths are now repository-relative.

## TDD gates

### Final FontFile2 checksum gate

The test extracts each actual returned PDF `FontFile2`, independently validates every table checksum, compares actual/expected `checkSumAdjustment`, and checks whole-font magic. It failed before the stream hook because all seven stored table checksums were zero, then passed after the fix.

### Visual geometry gate

The general visual test renders the direct `POST` result with PDF.js at 2x scale, maps extracted Korean lines to raster regions, and verifies dark-pixel density plus horizontal bucket occupancy.

### Short-label and mutation gate

The added P3 test explicitly measures:

- Regular labels: `작성자`, `검토`, `승인`
- Bold labels: `위험수준`, `확인 항목`

It also erases half of the `승인` label raster in memory and confirms the geometry gate rejects the mutation.

### Embed-stage non-font gate

The new regression injects an unrelated failure directly at `PDFDocument.prototype.embedFont`. It was RED against c27ec3f because the request resolved to a controlled font `500`; it now confirms the original error is logged by the general PDF boundary and rethrown unchanged.

## Final visual and binary GREEN

The latest route response preserves the release contract:

- Status `200`, `application/pdf`, `no-store`, UTF-8 filename, `%PDF-`
- Size `16,744` bytes
- Korean text extraction retained
- `/CIDFontType2`, `/FontFile2`, `/ToUnicode`, Regular/Bold subsets retained
- FontTools subset parse errors: Regular `0/119`, Bold `0/17`

Final sfnt validation:

| Font | Table mismatches | Actual adjustment | Expected adjustment | Whole checksum |
| --- | ---: | --- | --- | --- |
| Regular | 0 | `B5E6A6C3` | `B5E6A6C3` | `B1B0AFBA` |
| Bold | 0 | `ECB13FC4` | `ECB13FC4` | `B1B0AFBA` |

Three independent renderers produced readable, aligned Korean text after binary repair:

| Renderer | Pages | Dark pixels | Dark fraction | Raster bands |
| --- | ---: | ---: | ---: | ---: |
| PyMuPDF | 1 | 23,939 | 0.011946 | 13 |
| PDFium | 1 | 25,450 | 0.012700 | 13 |
| Poppler | 1 | 23,908 | 0.011930 | 13 |

Verification:

- Focused PDF tests: `16/16` passed
- Evidence absolute-path scan: passed with `0` matches
- TypeScript: `tsc --noEmit --incremental false` passed
- Production build: `next build` passed
- NFT route manifest: `11` files, including both Noto TTF files and the OFL license

## Evidence paths

- Initial visual RED PDF and renders: `evaluation/release-pdf-render-remediation-2026-07-12/red-route.pdf`, `evaluation/release-pdf-render-remediation-2026-07-12/red-rendered/`
- f17 visual-only/binary-RED PDF: `evaluation/release-pdf-render-remediation-2026-07-12/visual-only-green-f17dceb.pdf`
- f17 checksum RED: `evaluation/release-pdf-render-remediation-2026-07-12/checksum-red-f17dceb.log`
- c27 embed-boundary RED: `evaluation/release-pdf-render-remediation-2026-07-12/embed-boundary-red-c27ec3f.log`
- c27 evidence-path RED: `evaluation/release-pdf-render-remediation-2026-07-12/evidence-path-scan-red-c27ec3f.log`
- Final visual+binary GREEN PDF: `evaluation/release-pdf-render-remediation-2026-07-12/green-route.pdf`
- Final GREEN renders and metrics: `evaluation/release-pdf-render-remediation-2026-07-12/green-rendered/`
- Final checksum GREEN: `evaluation/release-pdf-render-remediation-2026-07-12/checksum-green-final.log`
- Raw/aligned subset controls: `evaluation/release-pdf-render-remediation-2026-07-12/subset-control-rendered/`, `evaluation/release-pdf-render-remediation-2026-07-12/normalized-subset-control-rendered/`
- Focused suite: `evaluation/release-pdf-render-remediation-2026-07-12/focused-pdf-tests.log`
- Font structure: `evaluation/release-pdf-render-remediation-2026-07-12/red-subset-font-validation.log`, `evaluation/release-pdf-render-remediation-2026-07-12/green-subset-font-validation.log`
- Typecheck/build: `evaluation/release-pdf-render-remediation-2026-07-12/typecheck.log`, `evaluation/release-pdf-render-remediation-2026-07-12/build.log`
