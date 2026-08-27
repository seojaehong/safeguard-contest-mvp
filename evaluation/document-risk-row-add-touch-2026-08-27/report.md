# Document Risk Row Add Touch Target

Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_ADD_TOUCH_TARGET`

## Finding

Current production at `eb000039` kept the `/documents` page body bounded at 723px and used a local-scroll editor shell, but the mobile `+ 위험 항목` action was only 32px high at 390x723. Adjacent risk-row selectors and core controls already used the 44px touch contract.

## Remediation

Product commit `fbe35641` restores the mobile-only `addRiskRowButton` minimum height to 44px without changing document generation, selected-only authoring, route structure, or backend behavior.

## Live Result

Production `fbe35641` passes Day and Night at 390x723:

- add-risk-row action: 44px
- page height: 723px
- horizontal overflow: 0
- editor shell: local `overflow-y: auto`
- live rows: 2/2 PASS

The before screenshot retains the 32px RED. Local and live screenshots retain the 44px action in both themes.

## Verification

- CSS token contract: 1 file / 3 tests PASS
- strict typecheck: PASS
- Next.js 15.5.22 build: PASS, 28/28 static pages
- local browser: 2/2 PASS
- live browser: 2/2 PASS
- visual inspection: 5 screenshots PASS

The isolated Next browser suites timed out in their 90-second `beforeAll` hook before assertions on this OneDrive worktree. This is recorded as an environment limitation, not counted as a product PASS or product RED; the production build plus direct local/live browser geometry are the evidence for this bounded wave.

## Boundary

No DB, provider, Share-session, vector, Wiki-publication, or KOSHA-registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; Wiki publication, SIF embedding runtime, provider persistence, Supabase RLS isolation, and KOSHA exact promotion remain `APPROVAL_GATED`. Human review is not complete, and route splitting alone is not accepted as the UX fix.
