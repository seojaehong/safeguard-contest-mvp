# Korean binary PDF font integration evaluation

## Scope and source

- Target branch: `feat/pdf-korean-font-integration`
- Target base: `3900892f49a42227ad9d12a2806a87ca02cfb6d3`
- Authoritative reference snapshot: `b61929f615138919dd63d2581819b732fa5360f3`
- Integration method: manual, file-scoped port. No merge or cherry-pick was used.
- Excluded surfaces were not edited: `app/globals.css`, `SafeGuardCommandCenter`, `WorkpackEditor`, reports, current-workpack, and DB harnesses.

## Result

The default binary branch now embeds licensed Noto Sans KR Regular and Bold as per-document dynamic subsets through `pdf-lib` and `@pdf-lib/fontkit`. The previous generic `HYSMyeongJo-Medium` Type0 declaration was removed. PDF.js extraction returns the original Korean strings, the first page renders nonblank, and representative output remains below 1 MiB.

The existing request and response contract remains in place:

- Inputs remain `title`, `scenario`, `rows`, `riskRows`, structured risk-row aliases, `documentText`, `riskLevel`, and `topRisk`.
- Canonical structured rows still flow through the existing parser and normalization path. The existing binary contract uses a generated sequence number rather than rendering the source row `id`.
- Default binary success headers remain exactly `application/pdf`, the existing ASCII plus RFC 5987 filename disposition, and `cache-control: no-store`.
- `?format=html` retains its existing HTML body, filename, content type, disposition, and cache header.
- Missing or invalid font assets are logged and return status 500 with `{ "ok": false, "error": "PDF_FONT_ASSET_UNAVAILABLE" }` and `cache-control: no-store`.

## Dependency and lock audit

Only the four reference dependencies were added:

| Scope | Dependency | Manifest range | Resolved | Installed directory bytes |
| --- | --- | ---: | ---: | ---: |
| production | `@pdf-lib/fontkit` | `^1.1.1` | `1.1.1` | 4,299,890 |
| production | `pdf-lib` | `^1.17.1` | `1.17.1` | 19,495,077 |
| development | `@napi-rs/canvas` | `^1.0.2` | `1.0.2` | 125,307 |
| development | `pdfjs-dist` | `^5.4.624` | `5.7.284` | 73,180,902 |

The Windows canvas binary package occupies 37,699,330 installed bytes and is development-only. Neither canvas nor PDF.js appears in the production route trace.

`package-lock.json` was generated in the backend worktree with `npm.cmd install --package-lock-only`, not copied from the frontend worktree. A second identical command left SHA-256 unchanged. The final lock is 225,754 bytes and 6,210 lines, with SHA-256 `1EF34B92DB1624E51B506A3144B59530ED4629EC89DD082AF97F4D74F04F855F`. Its final content has no diff from the authoritative reference lock, while `package.json` changes remain limited to the four dependencies above. The repository ignore policy changed only by removing the explicit `package-lock.json` line, following the integration decision to track deterministic Vercel installs.

`npm.cmd audit --json` reports existing findings through Next.js, PostCSS, ExcelJS, gaxios, and UUID dependency paths. None of the four newly added PDF dependencies is named in the audit findings. Dependency upgrades for those existing findings are outside this integration scope.

## Font assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `NotoSansKR-Regular.ttf` | 6,225,016 | `98E4E544CC6C3DC0A5F90E5510F56573DF150F846E1BC0E60A17641876D06A23` |
| `NotoSansKR-Bold.ttf` | 6,222,852 | `6BDF9C56784905AD1F9BE8C01686007AB88D9B07EC6D899A68252BB8873D9045` |
| `NotoSansKR-OFL.txt` | 4,387 | `BABCFE66C8A098B2FA279BC724A3A342F8124F77CE18941FBCC1BBB39823CDED` |

The tests parse the font metadata and verify family `Noto Sans KR`, PostScript names `NotoSansKR-Regular` and `NotoSansKR-Bold`, the matching subfamilies, TrueType headers, and the SIL Open Font License text.

## Render and contract verification

TDD evidence:

- Initial RED: dependency/lock, assets, trace/error contract, and real font embedding failed while the existing HTML branch passed.
- Expanded RED: missing and invalid asset requests still returned 200; typography roles and PDF render assertions failed against the generic CIDFontType0 output.
- GREEN after implementation: the two focused files passed all binary, error, HTML, and asset checks.
- Final characterization: canonical structured-row extraction was added without changing the existing sequence-number normalization contract.

Final commands:

| Command | Result |
| --- | --- |
| `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/pdf-font-failure.test.ts` | 2 files, 10 tests passed |
| `npm.cmd run typecheck` | passed after production build |
| `npm.cmd run build` | passed; `/api/export/pdf` emitted as a dynamic route |

The focused suite verifies:

- Exact binary and HTML success headers and filenames.
- Controlled JSON 500 plus `console.error` for both missing and invalid font assets.
- HTML availability while binary assets are unavailable.
- Actual `/CIDFontType2`, `/FontFile2`, `/ToUnicode`, and subset font names.
- No `HYSMyeongJo`, `UniKS-UCS2-H`, or generic `/CIDFontType0` fallback.
- Extracted Korean title, scenario, risk, signature, row, and canonical structured-row content.
- No Unicode replacement glyph in extracted content.
- A rendered first-page title region with opaque nonwhite pixels.
- Representative binary size below 1 MiB and below one quarter of either source font.
- No screenshots or PDF test artifacts were written to disk.

## Vercel trace and cold-start assessment

The production build emitted `.next/server/app/api/export/pdf/route.js.nft.json` with all three literal assets:

- `public/fonts/NotoSansKR-Regular.ttf`
- `public/fonts/NotoSansKR-Bold.ttf`
- `public/fonts/NotoSansKR-OFL.txt`

Local build measurements:

| Item | Measurement |
| --- | ---: |
| NFT referenced files | 57 |
| NFT referenced bytes | 13,614,781 |
| Font bytes inside NFT set | 12,452,255 |
| Compiled route JavaScript | 1,146,979 |
| Route JavaScript plus NFT approximation | 14,761,760 |
| Representative built POST output | 16,716 bytes on first request; 16,713 bytes on second request |
| Local built POST latency | 657 ms on first request; 129 ms on the next request in the same process |

Vercel documents a standard 250 MB uncompressed function bundle limit that includes imported libraries and files such as fonts: [Vercel Functions limits](https://vercel.com/docs/functions/limitations). The local route approximation remains well below that boundary. Bundle-size risk is therefore low for this integration.

Cold-start cost is the meaningful residual risk. Each new process must make the 12.45 MB font assets available and parse the fonts before creating subsets. The module-level byte cache avoids repeated filesystem reads in a warm process, but `pdf-lib` still constructs per-request subsets. The local Windows first/warm measurements are directional only and do not substitute for Vercel production telemetry. After deployment, verify the first invocation duration, memory, function bundle report, and repeated invocation duration in Vercel logs.

## Caveats

- Full source fonts must remain in the server function bundle even though each generated PDF contains only small subsets.
- The route preserves its existing one-page, bounded-row generation behavior; this integration does not add pagination or expand row limits.
- The authoritative controlled-error pattern wraps the complete binary builder. A non-font exception during binary construction will currently receive the same `PDF_FONT_ASSET_UNAVAILABLE` code.
- No Vercel deployment was performed from this worktree. Static tracing, production build, and local built-route POST were verified; live Vercel cold-start behavior remains a post-deploy check.
