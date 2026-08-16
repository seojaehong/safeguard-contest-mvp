# Hermes Knowledge Review Evidence Inspector

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVIDENCE_INSPECTOR_LIVE_PENDING`
- Product commit: `be8a0f143f40689fc02af791bc0b7ae5509046cd`
- Probe source: `dac7ec54dc8999b54cdac43203b7b339c4d3b036`
- Local production geometry: 8/8 PASS across Day/Night and 1440x900, 1440x723, 390x844, 390x723.

## Result

- The selected Hermes candidate now exposes a bounded evidence inspector without another DB query or write.
- Desktop mounts candidate and evidence as a contained two-pane workbench. Mobile mounts only one candidate/evidence pane behind a 44px segmented control.
- The fixture exposes five relation-valid items. Authority counts match the existing review contract, and the inspector is capped at 20 items.
- Public law, KOSHA, and SIF items expose only allowlisted official HTTPS links and bounded metadata. Organization/site items expose generic labels and shortened digests, not raw titles, payloads, source IDs, tenant IDs, or private URLs.
- The selected candidate height is 580px on desktop and 618.44px on mobile. Maximum first-action depth is 903.61px; horizontal overflow is zero in all eight rows.

## Verification

- Focused and adjacent tests: 8 files / 117 tests PASS.
- Strict typecheck: PASS.
- Next.js 15.5.22 build: PASS, 28 static pages.
- Machine report and viewport screenshots: `after-local/`.

## Boundary

- This is current-source local-production evidence. Live after-deployment evidence is still required.
- No DB, provider, Share-session, ontology, vector/embedding, Wiki, or KOSHA registry mutation was performed.
- The immutable original 18-finding security baseline remains preserved; a fresh full-repository scan is still required before any security-complete claim.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- LLM Wiki publication, RLS live isolation, and provider persistence remain `APPROVAL_GATED`.
