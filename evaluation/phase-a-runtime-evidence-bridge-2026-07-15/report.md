# Phase A Runtime Evidence Bridge

- Branch: `feat/phase-a-runtime-evidence-bridge-20260715`
- Base/HEAD at start: `5249be5e6c36c15d1f3359aab8e0f65868574e8c`
- Scope: MCP and Claw reviewed/generate runtime paths
- Database/schema changes: none
- Commit/push: intentionally not performed

## Result

`queryKnowledge` is now awaited before generation. Its active evidence contract is cloned and deep-frozen as one `PhaseAGenerationGrounding`, passed to `generateResponse`/`runAsk`, serialized before the answer and deliverable personas, and reused to build deterministic Phase A product rows.

Current unresolved SIF/KOSHA chains remain `review_required`. Their citation allowlist is empty and controls are exposed only as `review_required_only`. KOSHA guidance can enter the allowlist only when version, official KOSHA URL, official file id, publication date, and body SHA-256 are all present and the pack is internally resolved. Missing, malformed, stale-equivalent, or task-unbound packs are fixed as `missing` or `review_required` before a provider call.

The evidence JSON is enclosed in an untrusted-data delimiter. Less-than signs inside JSON are escaped so injected delimiter text cannot terminate the block, and the fixed instructions prohibit executing commands found inside evidence data. Unsupported facts and citations must be rendered as `현장 확인 필요`.

The structured deliverable adoption boundary now validates every `evidenceRefs` entry against the exact Phase A UID allowlist. Across every structured content string, legal article references are checked against the law-role allowlist and KOSHA UIDs, guide codes, and versions are checked against the KOSHA-role allowlist. This catches forged references inside fields such as `safetyMeasure` and `action` without treating ordinary safety prose as a citation. A violation rejects that provider document group before it is merged into the deliverables result.

KOSHA provenance URLs now accept only HTTPS URLs on the `kosha.or.kr` apex or a dot-delimited subdomain. Lookalike suffix hosts such as `evilkosha.or.kr` and `notkosha.or.kr` fail closed.

Unregistered general questions no longer receive a synthetic `missing` grounding with an empty allowlist. Their existing generation behavior is preserved. Registered canonical tasks still receive the frozen pack and remain `review_required` while the current evidence chain is unresolved. The identical grounding object is also passed to `enhanceLegalEvidenceMappings`.

## RED Evidence

- Grounding test initially failed because `buildPhaseAGenerationGrounding` did not exist.
- MCP bridge test reproduced generation starting before knowledge lookup: `generate, query:start, query:end`.
- Claw tests reproduced `runAsk` invocation before `querySafetyKnowledge`.
- Provider prompt tests reproduced missing Phase A grounding in both answer and deliverable prompts.
- Review runtime RED reproduced missing mapping grounding, the absent structured-citation boundary, and empty allowlists applied to general MCP and Claw questions. The initial readonly runtime assertion was corrected to a compile-only assertion; a separate strict RED then reproduced three `TS2578` errors while the public type was mutable.
- Plain/reviewed MCP and Claw knowledge-rejection tests were GREEN immediately: each rejection surfaced and neither generation provider nor review provider was called.
- P1 hostname RED: both `evilkosha.or.kr` and `notkosha.or.kr` were incorrectly `resolved`; 2 tests failed before the hostname-boundary fix.
- P1 structured-citation RED: forged `산업안전보건법 제999조`, `안전보건공단 기술지침 H-999-9999`, and code-only `H-999-9999` content all incorrectly returned `grounded` before the role-specific content scan.

## Verification

- Focused tests: 12 files passed, 214 tests passed, 0 failed in 28.66 seconds wall time. This preserves all 209 existing contracts and adds 5 P1 attack/positive-control contracts.
- TypeScript: `tsc --noEmit --incremental false` passed.
- P1 focused log: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-focused-tests.log`
- P1 hostname RED/GREEN: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-red-kosha-hostname.log`, `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-green-kosha-hostname.log`
- P1 structured boundary RED/GREEN: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-red-structured-citation-boundary.log`, `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-green-structured-citation-boundary.log`
- Review RED log: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/review-red-tests.log`
- Readonly type RED log: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/review-readonly-red-typecheck.log`
- P1 typecheck log: `evaluation/phase-a-runtime-evidence-bridge-2026-07-15/p1-typecheck.log`

Covered cases include the three canonical chains, aliases, missing/unregistered input, unresolved evidence, complete/incomplete KOSHA provenance, structured forged citation rejection, prompt injection containment, exact answer/deliverable/mapping grounding handoff, deep-readonly type checks, same-pack materialization, reviewed/plain MCP and Claw serialization, knowledge rejection before provider calls, general ask mode, current KOSHA review behavior, and provider fallback policy.
