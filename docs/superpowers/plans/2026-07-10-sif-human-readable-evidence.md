# SIF Human-Readable Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the SIF archive's raw identifiers while presenting task-readable accident titles and summaries everywhere the DB harness reaches users or LLM naturalization.

**Architecture:** Derive optional display fields during safety-reference normalization, using the labeled `재해개요` section already stored in each SIF summary. Keep `title` and `summary` untouched as source-of-record fields, and make harness/prompt/risk/UI consumers prefer the derived display title through one exported helper.

**Tech Stack:** TypeScript strict mode, Next.js 14, Vitest, Supabase REST DTOs.

## Global Constraints

- Do not change the Supabase schema or mutate existing SIF records.
- Preserve raw `title` and `summary` for provenance.
- Do not add `any`.
- Only `sif-case` rows with archive-style numeric titles may be rewritten for display.
- Existing human-readable SIF titles must remain unchanged.
- Generated display text must not expose raw field labels such as `연번:`, `재해개요:`, or `기인물:`.
- Harness prompt, deterministic risk-row evidence references, and workspace evidence UI must use the same display-title rule.
- Follow TDD: add the failing test, observe the expected failure, then implement.
- Use `npm.cmd`, never `npm`.

---

### Task 1: Derive and propagate readable SIF evidence labels

**Files:**
- Modify: `lib/safety-reference-catalog.ts`
- Modify: `lib/db-harness.ts`
- Modify: `lib/search.ts`
- Modify: `components/SafeGuardCommandCenter.tsx`
- Modify: `components/FieldOperationsWorkspace.tsx`
- Test: `tests/safety-reference-hybrid.test.ts`
- Test: `tests/commercial-harness.test.ts`

**Interfaces:**
- Produces: `getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string`
- Produces: optional `display_title` and `display_summary` fields on normalized `SafetyReferenceItem`
- Consumes: existing SIF `summary` labels and existing normalized reference DTOs

- [ ] **Step 1: Add failing catalog tests**

Add tests proving that an archive row titled `1919 / 기타의사업 / 시설관리및사업지원서비스업` derives a readable title from its `재해개요`, retains the raw title, omits archive labels from display text, and leaves an already-readable SIF title unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests\\safety-reference-hybrid.test.ts`

Expected: FAIL because the display-title helper/fields do not exist or still return the numeric archive title.

- [ ] **Step 3: Implement minimal catalog normalization**

Parse only the `재해개요` section up to the next labeled field, strip leading dates and repeated victim wording, compact it to a stable UI length, append `사례` once, and set `display_title`/`display_summary` without modifying raw source fields.

- [ ] **Step 4: Add failing propagation tests**

Add assertions that `buildHarnessPromptContext` and `buildSafetyReferenceRiskRows` surface the readable SIF title and do not surface the numeric archive title.

- [ ] **Step 5: Run focused tests and verify RED**

Run: `npm.cmd test -- tests\\commercial-harness.test.ts`

Expected: FAIL because harness and risk-row consumers still read `item.title`.

- [ ] **Step 6: Propagate the shared display-title rule**

Use the exported helper in DB harness prompt lines, compressed safety references, deterministic risk rows/evidence refs, and both workspace evidence mappings. `SafeGuardCommandCenter.buildDocumentEvidence` is the production `/workspace` evidence rail and must prefer the shared display title. Do not duplicate parsing logic in consumers.

- [ ] **Step 7: Verify GREEN and regressions**

Run: `npm.cmd test -- tests\\safety-reference-hybrid.test.ts tests\\commercial-harness.test.ts tests\\quality-contract.test.ts tests\\pump-confined-scenario.test.ts`

Expected: all test files pass with no warnings.

- [ ] **Step 8: Run production gates**

Run: `npm.cmd run build`

Run: `npm.cmd run typecheck`

Expected: both exit 0.

- [ ] **Step 9: Commit**

`git add lib/safety-reference-catalog.ts lib/db-harness.ts lib/search.ts components/SafeGuardCommandCenter.tsx components/FieldOperationsWorkspace.tsx tests/safety-reference-hybrid.test.ts tests/commercial-harness.test.ts docs/superpowers/plans/2026-07-10-sif-human-readable-evidence.md`

`git commit -m "feat: surface readable SIF evidence labels"`

---

### Task 2: Close readable-label leaks in remediation and operation memory

**Files:**
- Modify: `app/api/workpack/remediate/route.ts`
- Modify: `lib/ontology/operation-memory.ts`
- Modify: `lib/workpack-learning-export.ts`
- Test: `tests/ontology-operation-memory.test.ts`
- Test: `tests/commercial-harness.test.ts`
- Test: the existing remediation route test that covers `mapCatalogEvidence`, or add the narrowest route-level test beside current workpack remediation tests

**Interfaces:**
- Consumes: `getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string` from Task 1
- Preserves: raw `title` in machine-readable provenance fields
- Produces: readable evidence labels in remediation responses, operation-memory graph nodes, Markdown, and Obsidian export

- [ ] **Step 1: Add failing leak-path tests**

Use an archive-style SIF fixture and assert that remediation evidence, operation-memory Evidence node labels, Markdown evidence bullets, and Obsidian Evidence links use the readable display title. Assert that JSONL retains raw `title` and adds a readable `displayTitle` field.

- [ ] **Step 2: Run focused tests and verify RED**

Run the selected remediation test together with:
`npm.cmd test -- tests\\ontology-operation-memory.test.ts tests\\commercial-harness.test.ts`

Expected: FAIL because these consumers still read `reference.title` directly.

- [ ] **Step 3: Propagate the shared helper without changing provenance**

Use the Task 1 helper for user-facing labels. In graph node metadata and JSONL, keep the original raw title and add the display title rather than overwriting source-of-record data.

- [ ] **Step 4: Verify GREEN and regressions**

Run the focused tests, then:
`npm.cmd test -- tests\\safety-reference-hybrid.test.ts tests\\commercial-harness.test.ts tests\\ontology-operation-memory.test.ts tests\\operation-memory-visualization.test.ts`

Expected: all pass with no warnings.

- [ ] **Step 5: Run production gates**

Run: `npm.cmd run build`

Run: `npm.cmd run typecheck`

Expected: both exit 0.

- [ ] **Step 6: Commit**

`git add app/api/workpack/remediate/route.ts lib/ontology/operation-memory.ts lib/workpack-learning-export.ts tests/ontology-operation-memory.test.ts tests/commercial-harness.test.ts docs/superpowers/plans/2026-07-10-sif-human-readable-evidence.md`

`git commit -m "fix: keep SIF labels readable across exports"`
