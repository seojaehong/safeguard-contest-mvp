# Vision Harness V2 Remediation Evaluation

Date: 2026-07-11
Branch: `feature/vision-harness-v2`
Reviewed implementation: `30e909fa`

## Scope

- Remediated `POST /api/input-photos/hazard-analysis`, candidate grounding, workspace review DTOs, and confirmed-only generation integration.
- Reused the repository's Supabase bearer-session authentication pattern before multipart parsing or provider execution.
- Made no DB schema, migration, Supabase mutation, environment, secret, upload, deployment, or remote-state changes.
- Excluded the pre-existing external change at `output/playwright/2026-07-10/module-shell-hardening/desktop-workers-night.png`.

## Implemented Contract

- Generic review vocabulary such as safety, status, review, check, confirmation, and need cannot establish candidate-domain grounding by itself.
- Positive grounding requires a candidate-specific domain term in reference identity metadata such as title, classification, keywords, or risk tags; controls and generic body text cannot bootstrap their own relevance.
- Candidate-only no-instruction policy now covers summary, site signals, labels, inference, candidate observation, and visual observation. Literal OCR observation and `ocrText` remain preserved.
- Workspace parsing preserves `partial`, per-category counts, per-image failures, candidate `harness`, `userDecision`, provider response/model metadata, signature validation mode, and reference source/retrieval provenance.
- Candidate add controls and generation builders both require a consistent confirmed harness: evidence, confirmed controls, confirmation time, and an allowed pending acceptance decision.
- Unauthenticated requests return 401 before `formData()` or provider work. An unconfigured authentication store returns 503.
- Requests require a valid `Content-Length`, reject more than 41 MiB before multipart parsing, and re-check a 40 MiB aggregate photo cap after parsing. Each photo remains capped at 20 MiB.
- Direct `analyzeHazardPhotos` calls enforce the same aggregate photo cap.
- Provider image work and candidate DB/MCP resolution use bounded, order-preserving concurrency.
- Partial responses distinguish analyzed, rejected, failed, and unconfigured image counts; workspace state retains individual failure messages.
- The OpenAI adapter preserves the actual Responses API response ID, response model, and creation timestamp per image. Aggregate model uses the actual successful response model.
- Harness evidence preserves catalog record ID, source ID, source URL, item type, evidence role, and direct/SIF/supporting retrieval query, mode, source, and vector status.
- File validation is explicitly `signature_only`: 12 signature bytes are checked, while pixel decode is delegated to the vision provider.

## TDD Evidence

Observed RED before implementation for:

1. Generic review vocabulary produced a `confirmed` candidate with generic evidence and controls.
2. Workspace parsing functions were absent, then confirmed and insufficient selected keys both entered the generation appendix.
3. An unauthenticated route request reached multipart/provider code.
4. Three individually valid files with an oversized aggregate reached analysis; direct analysis also read every image before failing.
5. Five provider calls ran concurrently instead of respecting the configured bound.
6. Instructions in visual and candidate observation fields were accepted as analyzed output.
7. A partial response collapsed rejected and failed images into one generic remainder count.
8. The configured model replaced the actual OpenAI response model and response ID was discarded.
9. Catalog source and retrieval provenance disappeared from candidate evidence and the workspace DTO.
10. Readiness did not disclose that validation was signature-only and did not decode pixels.

## Verification

- `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts tests/operation-improvements.test.ts`
  - PASS: 3 files, 54 tests, 0 failures.
- `npm.cmd run typecheck`
  - PASS: `tsc --noEmit --incremental false`, exit code 0.
- `git diff --check`
  - PASS: no whitespace errors; Windows LF-to-CRLF notices remain.

## Concerns

- Signature checks identify file families but do not prove that pixel data fully decodes. Malformed signed files are isolated as provider failures; the API now states this limitation explicitly.
- Candidate relevance is intentionally conservative. New domain terminology absent from reference identity metadata remains `insufficient` rather than borrowing generic or neighboring evidence.
- Authentication now requires a valid workspace session. Guest photo analysis is intentionally unavailable.
- Bounded concurrency favors provider and database protection over fastest possible ten-photo completion.
- Aggregate model records the first successful actual response model; every individual response/model remains available in `providerResponses` for mixed-model diagnosis.
- No live OpenAI, Supabase, MCP, browser, or Playwright execution was performed. Focused contract tests use injected providers and mocked read-only retrieval/auth adapters.
