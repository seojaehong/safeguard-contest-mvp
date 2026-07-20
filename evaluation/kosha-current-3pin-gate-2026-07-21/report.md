# KOSHA Current 3-Pin Gate

Checked at: 2026-07-21 KST

Worktree:

- Git HEAD: `bd4beeebbb02c977b1f34d02b5895f7fcacba568`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Evidence type: current worktree gate, not a fresh production deployment probe

## Verdict

PASS for the current exact trusted KOSHA production gate.

This report supersedes the older wave2 wording for current-state evidence only. The current codebase is no longer a two-pin D-C-13/D-C-7 contract: it has three exact trusted KOSHA pins plus the KOSHA guide corpus runtime bundle.

## Current Contract

Exact trusted KOSHA pins:

- `D-C-13-2026`: 외벽도장보수공사에 안전작업에 관한 기술지원규정
- `D-C-7-2026`: 비계 구조 및 안전작업에 관한 기술지원규정
- `B-E-10-2026`: 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정

Runtime asset contract:

- `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
- `data/safety-knowledge/exact-kosha/d-c-7-2026.json`
- `data/safety-knowledge/exact-kosha/b-e-10-2026.json`
- `data/safety-knowledge/kosha-guides/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/manifest.json`
- `data/safety-knowledge/kosha-guides/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/items.json`
- `data/safety-knowledge/kosha-guides/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/chunks.jsonl`
- `data/safety-knowledge/kosha-guides/e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12/failures.json`

The Next.js trace contract is route-scoped, not global `/*`. Current `exactKoshaConsumers` contains 17 consumers.

## Evidence Harness Position

The grounding order remains:

1. SIF and accident-history signals identify likely high-risk hazards.
2. Exact KOSHA pins and the KOSHA guide corpus provide technical controls and execution guidance.
3. Law and article links classify statutory mandate where verified.
4. LLM output remains naturalization of a fixed evidence pack, not the source of published facts.

## Fresh Verification

Commands run on the current worktree:

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-guide-corpus-audit.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- Focused KOSHA Vitest: 5 files / 173 tests PASS
- Strict TypeScript: PASS
- Production build: PASS, 28/28 static pages generated

## Boundaries

No database migration, schema mutation, Supabase data write, or embedding upload was performed.

This does not claim that every KOSHA guide in the broader corpus is exact-published production evidence. It only confirms the current exact-pin gate and corpus runtime readiness. Full corpus promotion, embeddings, and DB persistence remain separate approval-gated work.
