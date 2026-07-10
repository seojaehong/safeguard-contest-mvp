# Task 1 Implementation Report: Derive and propagate readable SIF evidence labels

## Status

Complete.

Implementation commit: `ee9b7c4` (`feat: surface readable SIF evidence labels`)

## Scope Implemented

- Preserved raw SIF `title` and `summary` source-of-record fields.
- Added derived optional `display_title` and `display_summary` fields during safety reference normalization.
- Exported `getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string`.
- Limited generated display labels to archive-style numeric `sif-case` titles.
- Left already-readable SIF titles and header-like titles such as `공종 / 작업명` unchanged.
- Propagated the shared display-title rule through:
  - DB harness prompt context and answer evidence titles.
  - Deterministic safety-reference risk rows and evidence refs.
  - Compressed safety-reference prompt/appendix entries.
  - `externalData.safetyReference.items` payload while preserving `rawTitle`.
  - `FieldOperationsWorkspace` safety-reference evidence rendering.
  - Mandatory actual `/workspace` render path: `SafeGuardCommandCenter` evidence rail now prefers `displayTitle || title`.
- No DB migration or mutation was performed.

## Spec Corrections Recorded

The actual `/workspace` route renders `SafeGuardCommandCenter`, not only `FieldOperationsWorkspace`. The mandatory evidence rail path in `components/SafeGuardCommandCenter.tsx` was added to the write scope and updated to prefer the display-title payload. Build/typecheck cover this call site.

Read-only corpus audit gaps were added as RED/GREEN tests:

- `재해개요` parsing stops at `재해유발요인`.
- `재해개요` parsing stops at `위험성 감소대책(예시)`.
- Leading year-month forms such as `2019년 03월경` and `2018년 8월경` are stripped.
- Victim wording includes `피재자`.
- Header-like SIF title `공종 / 작업명` never receives generated display fields.

## Changed Files

- `lib/safety-reference-catalog.ts`
- `lib/db-harness.ts`
- `lib/search.ts`
- `lib/types.ts`
- `components/FieldOperationsWorkspace.tsx`
- `components/SafeGuardCommandCenter.tsx`
- `tests/safety-reference-hybrid.test.ts`
- `tests/commercial-harness.test.ts`

## RED Evidence

### Catalog RED: helper/display fields missing

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

❯ tests/safety-reference-hybrid.test.ts (7 tests | 2 failed) 25ms
  × derives a readable display title from archive-style SIF rows without changing source fields
  × keeps already-readable SIF titles as their display title

AssertionError: expected undefined to be type of 'function'
Expected: "function"
Received: "undefined"

Test Files  1 failed (1)
Tests  2 failed | 5 passed (7)
```

### Propagation RED: harness prompt still surfaced raw archive title

Command:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\commercial-harness.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

❯ tests/commercial-harness.test.ts (19 tests | 1 failed) 5765ms
  × surfaces readable SIF display titles in harness prompts and deterministic risk evidence

AssertionError: expected '역할: LLM은 DB harness가 고정한 근거를 문장화만 한다.…' to contain '지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서…'

Received included:
SIF: 1919 / 기타의사업 / 시설관리및사업지원서비스업 -> 산소농도 측정 / 전원 차단 및 잠금표지

Test Files  1 failed (1)
Tests  1 failed | 18 passed (19)
```

### Corpus Audit RED: section boundary/year-month/victim wording gaps

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

❯ tests/safety-reference-hybrid.test.ts (9 tests | 1 failed) 31ms
  × stops SIF overview parsing at corpus labels and strips year-month plus victim wording

AssertionError: expected '2019년 03월경 피재자가 탱크 내부 청소 중 질식함. 재해유발요…' to be '탱크 내부 청소 중 질식함 사례'

Expected: "탱크 내부 청소 중 질식함 사례"
Received: "2019년 03월경 피재자가 탱크 내부 청소 중 질식함. 재해유발요인: 환기 미흡 위험성 감소대책(예시): 산소농도 측정 및 강제환기 사례"

Test Files  1 failed (1)
Tests  1 failed | 8 passed (9)
```

## GREEN Evidence

### Catalog GREEN after display-title implementation

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  1 passed (1)
Tests  7 passed (7)
```

### Propagation GREEN after shared helper propagation

Command:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\commercial-harness.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  1 passed (1)
Tests  19 passed (19)
```

### Corpus Audit GREEN after parser boundary/date/victim fix

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  1 passed (1)
Tests  9 passed (9)
```

### Focused Regression Suite

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\pump-confined-scenario.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\pump-confined-scenario.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  4 passed (4)
Tests  35 passed (35)
```

## Build Output

Command:

```powershell
npm.cmd run build
```

Output:

```text
> safeclaw@0.1.0 build
> next build

▲ Next.js 15.5.15
- Environments: .env.local

Creating an optimized production build ...
✓ Compiled successfully in 23.4s
Linting and checking validity of types ...
Collecting page data ...
Generating static pages (0/27) ...
Generating static pages (6/27)
Generating static pages (13/27)
Generating static pages (20/27)
✓ Generating static pages (27/27)
Finalizing page optimization ...
Collecting build traces ...

└ ƒ /workspace                               29.9 kB         237 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Typecheck Output

Command:

```powershell
npm.cmd run typecheck
```

Output:

```text
> safeclaw@0.1.0 typecheck
> tsc --noEmit --incremental false

Exit code: 0
```

## Self-Review

- Source-of-record fields are preserved: raw `title` remains on `SafetyReferenceItem`, and `rawTitle` is exposed in the UI payload when a display title is used.
- Derived labels are restricted to archive-style numeric `sif-case` titles via `hasArchiveStyleSifTitle`.
- Parsing logic is centralized in `lib/safety-reference-catalog.ts`; consumers call `getSafetyReferenceDisplayTitle` or use the payload fields derived from it.
- Consumer propagation now covers the Task 1 scope plus the corrected actual `/workspace` evidence rail path.
- No schema changes, migrations, DB writes, or data mutations were introduced.
- No `any` types were added.

## Concerns

- Task 2 leak paths are intentionally out of scope per user direction: remediation API, operation-memory graph, and learning-export will need separate review.
- The SIF parser is label-based and conservative. Unknown future corpus labels may require adding to the boundary list, but current audit gaps are covered by focused tests.

## Reviewer Fix: Display Summary for Empty-Control Risk Rows

Reviewer finding: `lib/search.ts` still used `item.short_summary || item.summary` in deterministic risk-row hazard and current-control fallback paths. Archive SIF rows with `controls: []` could therefore leak raw labels such as `연번:`, `재해개요:`, and `기인물:`.

Fix implemented:

- Added exported `getSafetyReferenceDisplaySummary(item: SafetyReferenceItem): string` in `lib/safety-reference-catalog.ts`.
- The helper prefers `display_summary`, derives a clean SIF overview when needed, and falls back to label-stripped existing summary/short summary.
- Updated `deriveSafetyReferenceHazard` and `buildSafetyReferenceRiskRows` current-control fallback to use `getSafetyReferenceDisplaySummary`.
- Added a regression test with an archive-style SIF row, `controls: []`, and a labeled raw summary.

### Reviewer Fix RED

Command:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\commercial-harness.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

❯ tests/commercial-harness.test.ts (20 tests | 1 failed) 5513ms
  × uses cleaned SIF summaries for risk-row text when archive rows have no controls 35ms

AssertionError: expected '질식 위험: 연번: 2020 재해개요: 2019년 03월경 피재자가…' not to match /연번:|재해개요:|기인물:/u

Received:
"질식 위험: 연번: 2020 재해개요: 2019년 03월경 피재자가 탱크 내부 청소 중 질식함. 기인물: 탱크 위험성 감소대책(예시): 산소농도 측정 및 환기 미… 연번: 2020 재해개요: 2019년 03월경 피재자가 탱크 내부 청소 중 질식함. 기인물: 탱크 위험성 감소대책(예시): 산소농도 측정 및 환기 ..."

Test Files  1 failed (1)
Tests  1 failed | 19 passed (20)
```

### Reviewer Fix GREEN

Command:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\commercial-harness.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  1 passed (1)
Tests  20 passed (20)
```

### Reviewer Fix Focused Suite

Command:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts
```

Output:

```text
> safeclaw@0.1.0 test
> vitest run tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts

RUN  v4.1.9 C:/Users/iceam/dev/safeguard-contest-mvp/.worktrees/backend-harness-gate

Test Files  2 passed (2)
Tests  29 passed (29)
```

### Reviewer Fix Typecheck

Command:

```powershell
npm.cmd run typecheck
```

Output:

```text
> safeclaw@0.1.0 typecheck
> tsc --noEmit --incremental false

Exit code: 0
```
