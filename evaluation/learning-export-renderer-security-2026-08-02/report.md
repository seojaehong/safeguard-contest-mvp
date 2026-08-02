# Learning Export Renderer Security

## Verdict

`PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT`

The deferred Markdown/Obsidian candidate is bounded in current source without assuming a particular external renderer configuration. The application emits downloadable files; it does not embed a Markdown renderer.

## Product Contract

- Dynamic text cannot emit raw HTML tags, Markdown image/link openers, Obsidian embeds, or active/local URI schemes.
- Obsidian wikilink segments cannot escape their virtual kind folder through path or embed metacharacters.
- Frontmatter uses the same inert-text boundary.
- JSONL retains raw provenance because it is structured data rather than rendered Markdown.
- Successful downloads use attachment disposition, CSP sandbox, `nosniff`, private no-store caching, and no-referrer.

## Verification

- Focused tests: 5 files, 87 tests passed.
- Strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Hostile fixture includes raw HTML, remote image syntax, Obsidian embed syntax, `javascript:`, `data:`, and `file:` inputs. None remain active in Markdown/Obsidian output bytes; the JSONL event retains the original provenance.

## Deployment Boundary

- Product commit: `0697a6127bef20014910ac1991ae53da3d5fec03`.
- Production marker at evidence time: `0697a6127bef20014910ac1991ae53da3d5fec03`.
- Source and production marker are aligned. A successful export still requires an authenticated owned stored workpack, so no production DB-backed fixture was created merely for this check; the live claim is limited to the deployed source contract and verified local response behavior.

## Non-Closure Boundary

The sealed follow-up scan remains immutable with completeness `partial` and one deferred candidate. This current-source remediation does not rewrite that canonical result or permit a security-complete claim. A later full repository rescan must reclassify the candidate. Exact saved Share remains `MISSING_EVIDENCE`; DB, provider, share-session, vector, wiki, and exact KOSHA registry mutations were not performed.
