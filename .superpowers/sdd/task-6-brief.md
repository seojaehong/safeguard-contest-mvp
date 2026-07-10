### Task 6: Generated-document typography system

**Files:**
- Modify: `components/WorkpackEditor.tsx`
- Modify: `app/api/export/pdf/route.ts`
- Modify: `app/globals.css`
- Create: `tests/generated-document-typography.test.ts`

**Interfaces:**
- Consumes: `frontendTypography.fonts.document` and `generatedSurfaceFiles`.
- Produces: the same print-safe title, section, body, table, and note hierarchy in editor preview, printable HTML, and PDF HTML.

**Exact document roles:**
- Font stack: `Malgun Gothic`, Noto Korean fallback, then system sans-serif.
- Document title: `20pt / 700 / 24pt`.
- Section title: `14pt / 700 / 18pt`.
- Body: `10pt / 400 / 15pt`.
- Table: `8.5pt / 400 / 12pt`.
- Note: `8pt / 400 / 11pt`.
- Numeric table cells may use tabular numerals, but product HUD/mono typography must not leak into document prose or tables.

- [ ] **Step 1: Write failing generated-document contract tests**

Read the embedded HTML/CSS sources and require the same font ordering and exact role tuples across preview, print HTML, and PDF HTML. Assert that document fields, values, ordering, page sizing, signatures, API handlers, and export response contracts are unchanged.

- [ ] **Step 2: Verify RED**

Run `npm.cmd test -- tests/generated-document-typography.test.ts` and record the expected failures caused by current divergent stacks and arbitrary sizes.

- [ ] **Step 3: Normalize document CSS only**

Apply the exact scale to every generated-document surface. Preserve dense safety/legal table readability, page size, pagination, signatures, data interpolation, response headers, and output behavior. Do not touch API/data semantics.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm.cmd test -- tests/generated-document-typography.test.ts tests/output-contract-smoke.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
node scripts/frontend_consistency_audit.mjs
```

If `tests/output-contract-smoke.test.ts` does not exist, use the repository output-contract smoke command and record its server dependency.

Commit only intended files with `fix: standardize generated document typography`. Keep F6 `in_progress` and `passes: false` until independent review.
