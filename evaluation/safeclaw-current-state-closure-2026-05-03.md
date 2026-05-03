# SafeClaw current state closure

- Date: 2026-05-03
- Branch: codex/document-format-cta
- Scope: current workpack, worker snapshot, dispatch snapshot, download CTA, format verification

## Closed

- The current workpack stored in the browser now carries worker and dispatch snapshots.
- `/documents` preserves worker and dispatch snapshots when document text is edited.
- `/workers` reads the latest workspace worker snapshot when available instead of rebuilding only from the generated document.
- `/dispatch` reads the latest recipient and target worker snapshot when available.
- `/archive` no longer presents the browser snapshot as server history. It separates local snapshot, Supabase login capability, and unconnected server archive status.
- Document card download CTA routes users to the editor/export area instead of pretending to download directly from the card.

## Verification

- `npm.cmd run build`: pass
- `npm.cmd run typecheck`: pass
- `npm.cmd run smoke:quality-matrix`: pass, 100/100 deterministic cases
- `node .\scripts\document_format_verification.mjs`: pass, passCount 9, failCount 0

## Remaining gaps

- Supabase archive list is still not a full server-side history browser from this route.
- HWPX output is `@rhwp` text-based output, not a pixel-perfect reproduction of every original public-institution form cell.
- PDF output remains browser print/export flow.
- Historical untracked evaluation artifacts from 2026-04-27 remain outside this commit.
