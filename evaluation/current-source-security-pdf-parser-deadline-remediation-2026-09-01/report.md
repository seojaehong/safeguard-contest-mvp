# PDF Parser Hard-Deadline Remediation

Verdict: `PASS_LIVE_DEPLOYED_PDF_PARSER_ISOLATED_RESCAN_REQUIRED`

## State

- Product/source commit: `6ca006a6f98a5711681767bdc01754ff7c9285e7`
- Production marker: `6ca006a6f98a5711681767bdc01754ff7c9285e7`
- Production deployment: `safeguard-contest-mxyyalnjb-seojaehongs-projects.vercel.app`
- Live after-deployment marker verification: PASS
- Fresh full-repository Standard security rescan: required

## Remediation

All five known PDF parsing sinks now send a bounded immutable byte snapshot to `scripts/pdf_parser_worker.py`. PDF hashing, `PdfReader` construction, page enumeration, text extraction, and recursive image inspection run only in the disposable child. The parent enforces wall-clock, memory, output, page, and text limits and never sends a filesystem path to the parser child.

Windows installs a kill-on-close Job Object with a process-memory cap before PDF bytes are written. POSIX starts a new process group and applies `RLIMIT_AS` before reading stdin. OS process creation and the bounded 32 MiB protocol decode are explicit trusted-platform residual boundaries, not attacker-controlled pypdf execution.

The two provenance-producing ingestion paths reject a parsed snapshot whose child-computed SHA-256 differs from the admitted digest. KOSHA corpus recovery revalidates the full source identity after `snapshot-ready` and immediately before publishing `current.json`.

## Verification

- Python syntax: PASS
- Focused and adjacent Python regression: 5 modules, 98 tests PASS, 161.247 seconds
- Resource warnings treated as errors: PASS
- Strict TypeScript typecheck: PASS
- Next.js 15.5.22 production build: PASS, 29 static pages
- `git diff --check`: PASS
- Targeted secret scan: PASS
- Independent review: four cycles, no remaining blocker

## Preserved Boundaries

The immutable original 18-finding baseline at `f0c8a7be02becd53c21fb80842cf23c571f22b1f` was not edited or reclassified. Production now contains the product commit, but only a fresh Standard full-repository scan may re-evaluate the finding set.

No database mutation, provider dispatch, Share-session creation, embedding/vector mutation, wiki publication, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; approval-gated boundaries remain open.
