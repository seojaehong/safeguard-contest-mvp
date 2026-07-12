# PDF visual-render release blocker remediation

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\release-pdf-render-remediation`
- Branch: `fix/release-pdf-render-remediation`
- Base: `a1dbedb64e177a4909584274eaad87484aa732f4`
- Scope: `app/api/export/pdf/route.ts`, PDF tests, and this evaluation package only
- Local verdict: GREEN after focused tests, typecheck, production build, NFT trace, and three-renderer visual review

## RED reproduction

The HTTP route reproduced the contractual success response while the page remained unreadable:

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

The page contained scattered individual glyphs instead of readable Korean lines. The prior nonblank-region assertion therefore did not protect release quality.

## Root cause trace

The following alternatives were isolated before changing production code:

1. Content stream coordinates were sane: each line used a stable `Tm` start at `x=42` with distinct vertical positions.
2. Widths and wrapping were not causal: the route used the expected Noto metrics and 42-character wrapping, and a tiny standard `page.drawText` control still failed with `{ subset: true }`.
3. The same Noto fonts rendered correctly with full embedding, but the control PDF was `6,494,902` bytes and violated the `<1 MiB` contract.
4. Original Noto Bold glyph record lengths included odd values such as `159`, `181`, and `179` bytes. The generated short-`loca` subset described those records as `158`, `182`, and `178` bytes.
5. FontTools found `80` Regular and `12` Bold glyph parse errors in the RED route subset.

The stated hypothesis was confirmed: `@pdf-lib/fontkit` emits short `loca` offsets for small TrueType subsets without first padding odd-length `glyf` records to a 2-byte boundary. The rounded offsets corrupt glyph boundaries while `/ToUnicode` extraction remains intact.

A same-font control confirmed the fix mechanism:

| Control | PDF bytes | Poppler dark pixels | Raster bands | Visual result |
| --- | ---: | ---: | ---: | --- |
| Standard `drawText`, raw Noto subset | 10,709 | 1,945 | 12 | Broken/scattered |
| Standard `drawText`, aligned Noto subset | 10,724 | 12,298 | 7 | Readable |

## Minimal fix

`loadEmbeddedPdfFonts()` now normalizes the in-memory TrueType fonts before the existing `pdf-lib` subset path:

- Pads odd-length `glyf` records to 2-byte boundaries.
- Rewrites `loca` entries and `head.indexToLocFormat` when needed.
- Rebuilds table offsets and checksums, including `checkSumAdjustment`.
- Leaves the source font assets unchanged.
- Retains `{ subset: true }`, Korean extraction, and the small binary size.

The typed `PdfFontAssetError` boundary remains unchanged. Missing or malformed font data returns the controlled `500` JSON response; unrelated PDF errors are still logged and rethrown.

## TDD visual gate

The new regression renders the direct `POST` result with PDF.js at 2x scale, maps extracted Korean lines to their raster regions, and verifies both:

- Dark-pixel density per non-whitespace character.
- Horizontal bucket occupancy across each expected line width.

It failed before the fix on `위험성평가표` with density `0`. On the latest route PDF, every measured Korean line occupied all horizontal buckets; the lowest observed density was `49.95`, above the test floor of `45`.

## GREEN evidence

The latest route response preserves the release contract:

- Status `200`, `application/pdf`, `no-store`, UTF-8 filename, `%PDF-`
- Size `16,591` bytes
- Korean text extraction retained
- `/CIDFontType2`, `/FontFile2`, `/ToUnicode`, Regular/Bold subsets retained
- FontTools subset parse errors: Regular `0/118`, Bold `0/17`

Three independent renderers produced readable, aligned Korean text:

| Renderer | Pages | Dark pixels | Dark fraction | Raster bands |
| --- | ---: | ---: | ---: | ---: |
| PyMuPDF | 1 | 23,951 | 0.011952 | 13 |
| PDFium | 1 | 25,472 | 0.012711 | 13 |
| Poppler | 1 | 23,927 | 0.011940 | 13 |

Verification:

- Focused PDF tests: `12/12` passed
- TypeScript: `tsc --noEmit --incremental false` passed
- Production build: `next build` passed
- NFT route manifest: `11` files, including both Noto TTF files and the OFL license

## Evidence paths

- RED PDF: `red-route.pdf`
- RED PNGs and metrics: `red-rendered/`
- GREEN PDF: `green-route.pdf`
- GREEN PNGs and metrics: `green-rendered/`
- Raw subset control: `subset-draw-text-control.pdf`, `subset-control-rendered/`
- Aligned subset control: `normalized-subset-draw-text-control.pdf`, `normalized-subset-control-rendered/`
- TDD logs: `red-visual-regression-test.log`, `green-visual-regression-test.log`
- Focused suite: `focused-pdf-tests.log`
- Font structure: `red-subset-font-validation.log`, `green-subset-font-validation.log`
- Typecheck/build: `typecheck.log`, `build.log`
