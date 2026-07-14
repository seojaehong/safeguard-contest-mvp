# Phase A ontology conflict contract

This Share branch does not resolve or overwrite the current Phase A ontology candidate `ff093fae30c331816f0068f9075b91b151d05813`.

The merge-tree against product `fc2bd1783fcc413981306f689d67bb6c659a985e` exits `1`. It reports content conflicts in `FieldOperationsWorkspace`, `workpack-commercial-store`, and the authority route test. `SafeGuardCommandCenter` and `CurrentWorkpackModules` auto-merge, but both touch product authority surfaces and still require semantic review.

The later integration must preserve all three workpack context fields: `revision`, `updatedAt`, and `evidenceSummary`. `revision` and `updatedAt` both bind to the authenticated `workpacks.updated_at` row, while `evidenceSummary` stays bound to that row's `evidence_summary`.

Two independent CAS contracts must survive:

1. Phase A confirmation compares `workpacks.updated_at` with `context.revision`, writes a strictly newer revision, and preserves confirmation replay/conflict behavior.
2. Share dispatch compares `workpack_share_sessions.updated_at` at each `access_policy.dispatchGate` transition from ready to reserved to recorded or uncertain.

The integration must also combine exact Phase A confirmation with the existing generation-evidence/readiness fail-close, retain the expanded authenticated Share session binding, keep Share language/return navigation and stale recovery, and keep both route test families. An auto-merge is not approval.

Fresh semantic conflict review on the integration branch is required before adoption.
