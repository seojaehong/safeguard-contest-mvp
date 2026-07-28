# Security Review: seojaehong/safeguard-contest-mvp

## Scope

Single-pass repository security scan of the immutable SafeClaw revision, including application routes, server policies, Supabase migrations, scripts, tests, tracked evaluation evidence, and dependency manifests.

- Scan mode: repository
- Target kind: git_revision
- Target ID: sha256:2869cdc1a90b9223b0b07877f453ee6e75bd3e3b7a02236e364a5a08866ffd37
- Revision: 47b07b6aff72ced25e8c1884ecd16f010e1fc170
- Inventory strategy: repository
- Included paths: .
- Excluded paths: .git/\*\*, node_modules/\*\*, .next/\*\*
- Runtime or test status: Static source/control/sink validation plus 7 focused test files and 102 passing tests. No destructive load, provider-spend, DB mutation, or saved Share session creation was performed.
- Artifacts reviewed: 4,772-file deterministic repository inventory, Repository threat model, 21-candidate compact discovery ledger, Route authorization inventory and focused security test evidence
- Scan context: The threat model was generated for this scan. Public generation and export access is intentional, so findings require a concrete cost, availability, cross-tenant, or client-parser consequence.

Limitations and exclusions:
- No live denial-of-service or paid-provider load was generated.
- No cross-tenant database row or public Share session was created because those actions cross approval boundaries.
- 1,309 binary files were metadata-accounted; their executable semantics were not reverse engineered.
- Exact saved /share/\[sessionId\] product evidence remains MISSING_EVIDENCE and was not substituted with fixtures.
- Excluded .git/\*\*: Git object-store internals are not repository product content.
- Excluded node_modules/\*\*: Generated dependency tree; lockfile and package manifests were reviewed instead.
- Excluded .next/\*\*: Generated Next.js build output; source and build configuration were reviewed instead.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 18 |
| Severity mix | medium: 5, low: 13 |
| Confidence mix | high: 9, medium: 9 |
| Coverage | complete |
| Validation mode | compact standard-scan static trace with focused existing tests |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw crosses public browser, authenticated tenant, service-role Supabase, bearer Share, MCP, cron, AI/provider, and document-parser trust boundaries. Highest-impact risks are cross-tenant mutation or disclosure, unsafe automation, provider-cost abuse, and untrusted content reaching downloadable document interpreters.

### Assets

- Tenant organizations, sites, workers, contacts, workpacks, confirmations, and dispatch data
- Generated safety-document integrity and legal/KOSHA/SIF provenance
- Supabase, MCP, cron, provider, dispatch, and signing credentials
- Provider budgets and availability of generation, search, weather, and export services

### Trust Boundaries

- Internet/browser to public Next.js APIs
- Authenticated browser to service-role Supabase routes
- Bearer Share links to private workpack documents
- Cron and automation to tenant-owned persisted settings
- SafeClaw to AI, weather, legal, KOSHA, Supabase, and messaging providers
- Untrusted document text to CSV, TSV, XLSX, HWP, PDF, and browser interpreters

### Attacker Capabilities

- Send unauthenticated requests, query strings, JSON bodies, export rows, and AI prompts
- Persist tenant-owned settings and workpack content after authentication
- Influence upstream or generated text that is later exported
- Possess transferable Share bearer identifiers when a recipient link is disclosed

### Security Objectives

- Bind every service-role read and write to the authenticated tenant and related objects
- Bound public request sizes, downstream calls, concurrency, and provider spend
- Keep exported user-controlled content inert in downstream parsers
- Preserve explicit approval boundaries for DB, provider, Share, publication, and registry mutations

### Assumptions

- Vercel TLS, Supabase Auth, cryptographic primitives, and provider authentication work as configured
- Environment variables and deployment endpoints are operator controlled
- Public generation and export access is intentional but still requires abuse controls
- In-memory serverless rate limits are soft per-instance controls rather than durable quotas

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Public knowledge regeneration can spend provider quota without abuse controls](#finding-1) | medium | high | inline below |
| [Whole-workpack XLSX export accepts an unbounded work budget](#finding-2) | medium | medium | inline below |
| [HWP table export accepts an unbounded work budget](#finding-3) | medium | medium | inline below |
| [Scheduled briefing email can redirect workpack creation into another tenant](#finding-4) | medium | high | inline below |
| [Public workpack remediation can spend database and model resources without abuse controls](#finding-5) | medium | high | inline below |
| [Whole-workpack CSV export permits spreadsheet formula injection](#finding-6) | low | high | inline below |
| [Downloaded Sheets TSV permits spreadsheet formula injection](#finding-7) | low | high | inline below |
| [Permit-inspection XLSX export accepts unbounded structured input](#finding-8) | low | medium | inline below |
| [Education-record XLSX export accepts unbounded structured input](#finding-9) | low | medium | inline below |
| [Public weather lookup can amplify requests to multiple upstream APIs](#finding-10) | low | high | inline below |
| [Clipboard Sheets TSV permits spreadsheet formula injection](#finding-11) | low | high | inline below |
| [TBM log XLSX export accepts unbounded structured input](#finding-12) | low | medium | inline below |
| [Single-document XLSX export accepts an unbounded work budget](#finding-13) | low | medium | inline below |
| [TBM briefing XLSX export accepts unbounded structured input](#finding-14) | low | medium | inline below |
| [Work-plan XLSX export accepts unbounded structured input](#finding-15) | low | medium | inline below |
| [A single public Ask request can drive an unbounded multi-provider work budget](#finding-16) | low | medium | inline below |
| [Workpack archive can disclose site metadata from another tenant](#finding-17) | low | high | inline below |
| [Single-document CSV export permits spreadsheet formula injection](#finding-18) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Public knowledge regeneration can spend provider quota without abuse controls

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | A public POST with generate=true reaches generateKnowledgeText without authentication or rate limiting; tests confirm generation occurs while mutation remains blocked. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400, CWE-770 |
| Affected lines | app/api/knowledge/regenerate/route.ts:10-13, lib/knowledge-candidate-route.ts:180-194, lib/knowledge-candidate-route.ts:228-234 |

#### Summary

The public knowledge-regeneration route can invoke the configured language model without authentication or rate limiting.

#### Root Cause

POST /api/knowledge/regenerate directly installs createKnowledgeCandidatePostHandler. The handler accepts generate=true from any caller and invokes generateKnowledgeText, while the route has no workspace authentication and no rate limiter. The blocked mutation gateway prevents database publication but does not prevent model cost or concurrent request consumption.

**Entrypoint evidence** — `app/api/knowledge/regenerate/route.ts:10-13`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export const POST = createKnowledgeCandidatePostHandler({
  generateText: generateKnowledgeText,
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY
});
```

**Entrypoint evidence** — `lib/knowledge-candidate-route.ts:180-194`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  return async function post(request: NextRequest) {
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: "JSON object body is required" },
        { status: 400 }
      );
    }

    const record = body as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const limit = typeof record.limit === "number"
      ? Math.min(Math.max(Math.trunc(record.limit), 1), 10)
      : 4;
    const shouldGenerate = record.generate === true;
```

**Sink evidence** — `lib/knowledge-candidate-route.ts:228-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const { bundle, candidate, reviewContract, generated } = await buildKnowledgeCandidateDraft({
      question,
      rawEvents: events,
      tenantContext,
      limit,
      generate: shouldGenerate
    }, dependencies);
```

#### Validation

A public POST with generate=true reaches generateKnowledgeText without authentication or rate limiting; tests confirm generation occurs while mutation remains blocked.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/knowledge/regenerate/route.ts:10-13`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export const POST = createKnowledgeCandidatePostHandler({
  generateText: generateKnowledgeText,
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY
});
```

**Entrypoint evidence** — `lib/knowledge-candidate-route.ts:180-194`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  return async function post(request: NextRequest) {
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: "JSON object body is required" },
        { status: 400 }
      );
    }

    const record = body as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const limit = typeof record.limit === "number"
      ? Math.min(Math.max(Math.trunc(record.limit), 1), 10)
      : 4;
    const shouldGenerate = record.generate === true;
```

**Sink evidence** — `lib/knowledge-candidate-route.ts:228-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const { bundle, candidate, reviewContract, generated } = await buildKnowledgeCandidateDraft({
      question,
      rawEvents: events,
      tenantContext,
      limit,
      generate: shouldGenerate
    }, dependencies);
```

Evidence:
- app/api/knowledge/regenerate/route.ts directly exposes createKnowledgeCandidatePostHandler.
- lib/knowledge-candidate-route.ts accepts caller-supplied tenant context and invokes the configured model when generate=true.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- The blocked mutation gateway prevents publication but does not prevent model cost or request-concurrency consumption.
- Provider-side quota and platform concurrency controls may reduce impact but are not repository controls.

#### Dataflow

Unauthenticated POST with generate=true and valid candidate inputs -\> public knowledge candidate handler -\> generateKnowledgeText -\> configured AI provider.

- **Source:** Unauthenticated JSON with generate=true and valid-shaped raw events/tenant IDs.

- **Sink:** generateKnowledgeText provider call.

- **Outcome:** medium

**Entrypoint evidence** — `app/api/knowledge/regenerate/route.ts:10-13`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export const POST = createKnowledgeCandidatePostHandler({
  generateText: generateKnowledgeText,
  mutationGateway: BLOCKED_KNOWLEDGE_MUTATION_GATEWAY
});
```

**Entrypoint evidence** — `lib/knowledge-candidate-route.ts:180-194`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  return async function post(request: NextRequest) {
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: "JSON object body is required" },
        { status: 400 }
      );
    }

    const record = body as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const limit = typeof record.limit === "number"
      ? Math.min(Math.max(Math.trunc(record.limit), 1), 10)
      : 4;
    const shouldGenerate = record.generate === true;
```

**Sink evidence** — `lib/knowledge-candidate-route.ts:228-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const { bundle, candidate, reviewContract, generated } = await buildKnowledgeCandidateDraft({
      question,
      rawEvents: events,
      tenantContext,
      limit,
      generate: shouldGenerate
    }, dependencies);
```

#### Reachability

The force-dynamic route is public, has no identity or rate control, and a single accepted request reaches a paid model call when the provider is configured.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/knowledge/regenerate/route.ts

- **Outcome:** medium

Preconditions:
- AI provider is configured.

#### Severity

**Medium** — A remote unauthenticated caller can repeatedly consume a configured AI provider and server time; impact is sustained cost/availability abuse without knowledge mutation or tenant data compromise.

Lower if deployment disables generation or enforces durable upstream quotas; raise only with evidence of material service-wide outage or unusually large provider spend per request.

#### Remediation

Require an authenticated, tenant-bound review capability for `generate=true`, add a durable rate and concurrency budget, and cap question, event count, event payload bytes, and prompt size before calling the model. Keep stateless non-generating candidate inspection available separately if required.

Tests:
- Verify unauthenticated `generate=true` requests are rejected without calling the provider.
- Verify size and event-count budgets fail closed.

Preventive controls:
- Track provider-call quotas by authenticated tenant and route.

<a id="finding-2"></a>

### [2] Whole-workpack XLSX export accepts an unbounded work budget

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-168, app/api/export/xlsx/route.ts:205-226, lib/xlsx-builder.ts:1534-1640 |

#### Summary

Workpack XLSX export permits unbounded documents and rows.

#### Root Cause

The workpack branch maps every supplied document and all nested rows without count or string-length limits, then creates a worksheet per document and serializes the workbook in memory.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:205-222`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    if (mode === "workpack") {
      const docs = Array.isArray(body.documents) ? body.documents : [];
      const documents = docs
        .map((d) => {
          if (!isRecord(d)) return null;
          const title = readString(d.title);
          if (!title) return null;
          return {
            title,
            rows: parseRows(d.rows, title),
            profile: parseProfile(d.profile),
            structuredRiskRows: d.edited === true ? [] : parseRiskRowsFromBody(d)
          };
        })
        .filter((d): d is {
          title: string;
          rows: SheetRow[];
          profile: ReturnType<typeof parseProfile>;
```

**Evidence evidence** — `lib/xlsx-builder.ts:1534-1551`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function buildWorkpackXlsx(
  scenario: AskResponse["scenario"],
  documents: Array<{ title: string; rows: SheetRow[]; profile: SafetyFormProfile; structuredRiskRows?: StructuredRiskAssessmentRow[] }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  // Cover sheet
  const cover = wb.addWorksheet("표지", { pageSetup: { paperSize: 9, orientation: "landscape" } });
  cover.columns = [{ width: 18 }, { width: 60 }];
  cover.getCell(1, 1).value = "SafeClaw 안전 문서팩";
  cover.getCell(1, 1).font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: "FF1F4D43" } };
  cover.mergeCells(1, 1, 1, 2);
  const coverRows: Array<[string, string]> = [
    ["사업장", scenario.companyName || ""],
    ["현장/공정", scenario.siteName || ""],
    ["작업내용", scenario.workSummary || ""],
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:205-222`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    if (mode === "workpack") {
      const docs = Array.isArray(body.documents) ? body.documents : [];
      const documents = docs
        .map((d) => {
          if (!isRecord(d)) return null;
          const title = readString(d.title);
          if (!title) return null;
          return {
            title,
            rows: parseRows(d.rows, title),
            profile: parseProfile(d.profile),
            structuredRiskRows: d.edited === true ? [] : parseRiskRowsFromBody(d)
          };
        })
        .filter((d): d is {
          title: string;
          rows: SheetRow[];
          profile: ReturnType<typeof parseProfile>;
```

**Evidence evidence** — `lib/xlsx-builder.ts:1534-1551`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function buildWorkpackXlsx(
  scenario: AskResponse["scenario"],
  documents: Array<{ title: string; rows: SheetRow[]; profile: SafetyFormProfile; structuredRiskRows?: StructuredRiskAssessmentRow[] }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  // Cover sheet
  const cover = wb.addWorksheet("표지", { pageSetup: { paperSize: 9, orientation: "landscape" } });
  cover.columns = [{ width: 18 }, { width: 60 }];
  cover.getCell(1, 1).value = "SafeClaw 안전 문서팩";
  cover.getCell(1, 1).font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: "FF1F4D43" } };
  cover.mergeCells(1, 1, 1, 2);
  const coverRows: Array<[string, string]> = [
    ["사업장", scenario.companyName || ""],
    ["현장/공정", scenario.siteName || ""],
    ["작업내용", scenario.workSummary || ""],
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Every supplied document and nested row becomes workbook state before serialization; this is independently triggerable from single/structured modes.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated workpack-mode XLSX JSON -\> unbounded documents and nested rows -\> worksheet per document -\> full in-memory ExcelJS writeBuffer.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS multi-worksheet workpack construction and writeBuffer

- **Outcome:** medium

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:205-222`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    if (mode === "workpack") {
      const docs = Array.isArray(body.documents) ? body.documents : [];
      const documents = docs
        .map((d) => {
          if (!isRecord(d)) return null;
          const title = readString(d.title);
          if (!title) return null;
          return {
            title,
            rows: parseRows(d.rows, title),
            profile: parseProfile(d.profile),
            structuredRiskRows: d.edited === true ? [] : parseRiskRowsFromBody(d)
          };
        })
        .filter((d): d is {
          title: string;
          rows: SheetRow[];
          profile: ReturnType<typeof parseProfile>;
```

**Evidence evidence** — `lib/xlsx-builder.ts:1534-1551`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function buildWorkpackXlsx(
  scenario: AskResponse["scenario"],
  documents: Array<{ title: string; rows: SheetRow[]; profile: SafetyFormProfile; structuredRiskRows?: StructuredRiskAssessmentRow[] }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeClaw";
  wb.created = new Date();

  // Cover sheet
  const cover = wb.addWorksheet("표지", { pageSetup: { paperSize: 9, orientation: "landscape" } });
  cover.columns = [{ width: 18 }, { width: 60 }];
  cover.getCell(1, 1).value = "SafeClaw 안전 문서팩";
  cover.getCell(1, 1).font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: "FF1F4D43" } };
  cover.mergeCells(1, 1, 1, 2);
  const coverRows: Array<[string, string]> = [
    ["사업장", scenario.companyName || ""],
    ["현장/공정", scenario.siteName || ""],
    ["작업내용", scenario.workSummary || ""],
```

#### Reachability

The public workpack mode is independently selectable and multiplies attacker-controlled documents into worksheets without route-local size, count, or rate limits.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** medium

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Medium** — An unauthenticated caller can repeatedly drive comparatively expensive multi-worksheet serialization, supporting sustained service availability abuse while remaining short of broader compromise.

Lower if durable edge quotas and strict document/row caps exist in deployment; raise only if bounded load evidence demonstrates material service-wide outage.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `workpack` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-3"></a>

### [3] HWP table export accepts an unbounded work budget

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/hwp/route.ts:291-301, app/api/export/hwp/route.ts:98-110, app/api/export/hwp/route.ts:185-198 |

#### Summary

HWP export has no request, row, or field resource budget.

#### Root Cause

The public POST handler parses the entire JSON request, retains every supplied row and string, creates a table sized from the row count, and inserts every cell through WASM before exporting the document. Large inputs can exhaust CPU or memory.

**Entrypoint evidence** — `app/api/export/hwp/route.ts:291-301`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const scenario = parseScenario(body.scenario);
  const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);

  try {
    const buffer = buildHwpBuffer({ title, rows, profile, scenario, structuredRiskRows });
```

**Root Control evidence** — `app/api/export/hwp/route.ts:98-110`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseRows(value: unknown, fallbackDoc: string): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SheetRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content && readString(item.item) === "") return [];
    return [{
      document: readString(item.document, fallbackDoc),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
```

**Sink evidence** — `app/api/export/hwp/route.ts:185-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function insertHwpTable(document: HwpDocument, paraIdx: number, rows: readonly (readonly string[])[], label: string): number {
  const colCount = rows[0]?.length ?? 0;
  if (!rows.length || !colCount || rows.some((row) => row.length !== colCount)) {
    throw new Error(`${label} 표 데이터가 올바르지 않습니다.`);
  }
  const table = parseJsonResult(document.createTable(0, paraIdx, 0, rows.length, colCount));
  if (!table?.ok || typeof table.paraIdx !== "number") {
    throw new Error(`${label} 표를 만들지 못했습니다.`);
  }
  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      document.insertTextInCell(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, 0, 0, value);
    });
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/hwp/route.ts:291-301`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const scenario = parseScenario(body.scenario);
  const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);

  try {
    const buffer = buildHwpBuffer({ title, rows, profile, scenario, structuredRiskRows });
```

**Root Control evidence** — `app/api/export/hwp/route.ts:98-110`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseRows(value: unknown, fallbackDoc: string): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SheetRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content && readString(item.item) === "") return [];
    return [{
      document: readString(item.document, fallbackDoc),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
```

**Sink evidence** — `app/api/export/hwp/route.ts:185-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function insertHwpTable(document: HwpDocument, paraIdx: number, rows: readonly (readonly string[])[], label: string): number {
  const colCount = rows[0]?.length ?? 0;
  if (!rows.length || !colCount || rows.some((row) => row.length !== colCount)) {
    throw new Error(`${label} 표 데이터가 올바르지 않습니다.`);
  }
  const table = parseJsonResult(document.createTable(0, paraIdx, 0, rows.length, colCount));
  if (!table?.ok || typeof table.paraIdx !== "number") {
    throw new Error(`${label} 표를 만들지 못했습니다.`);
  }
  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      document.insertTextInCell(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, 0, 0, value);
    });
```

Evidence:
- app/api/export/hwp/route.ts accepts the complete JSON payload without a route-local resource budget.
- The route sizes a WASM table from attacker-controlled rows and inserts every cell before exporting the document.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated HWP export JSON -\> unbounded rows/profile arrays -\> WASM HwpDocument table construction -\> in-memory export buffer.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** WASM HWP createTable/insertTextInCell/exportHwp

- **Outcome:** medium

**Entrypoint evidence** — `app/api/export/hwp/route.ts:291-301`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const title = readString(body.title, "SafeClaw 안전 문서");
  const rows = parseRows(body.rows, title);
  const profile = parseProfile(body.profile);
  const scenario = parseScenario(body.scenario);
  const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);

  try {
    const buffer = buildHwpBuffer({ title, rows, profile, scenario, structuredRiskRows });
```

**Root Control evidence** — `app/api/export/hwp/route.ts:98-110`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseRows(value: unknown, fallbackDoc: string): SheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SheetRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content && readString(item.item) === "") return [];
    return [{
      document: readString(item.document, fallbackDoc),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
```

**Sink evidence** — `app/api/export/hwp/route.ts:185-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function insertHwpTable(document: HwpDocument, paraIdx: number, rows: readonly (readonly string[])[], label: string): number {
  const colCount = rows[0]?.length ?? 0;
  if (!rows.length || !colCount || rows.some((row) => row.length !== colCount)) {
    throw new Error(`${label} 표 데이터가 올바르지 않습니다.`);
  }
  const table = parseJsonResult(document.createTable(0, paraIdx, 0, rows.length, colCount));
  if (!table?.ok || typeof table.paraIdx !== "number") {
    throw new Error(`${label} 표를 만들지 못했습니다.`);
  }
  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  rows.forEach((row, rIdx) => {
    row.forEach((value, cIdx) => {
      document.insertTextInCell(0, table.paraIdx as number, controlIdx, rIdx * colCount + cIdx, 0, 0, value);
    });
```

#### Reachability

The public HWP POST path initializes a server-side WASM document engine and expands every accepted row without application-level resource or rate limits.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/hwp/route.ts

- **Outcome:** medium

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Medium** — Public unauthenticated requests can repeatedly drive CPU/memory-heavy WASM document generation, supporting sustained availability abuse without broader compromise.

Lower if durable edge quotas and strict body limits are confirmed sufficient; raise only if bounded load evidence demonstrates a material service-wide outage or high operational cost.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `hwp-table` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-4"></a>

### [4] Scheduled briefing email can redirect workpack creation into another tenant

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | An authenticated user can persist any syntactically email-like briefing_email on their own site. The authorized cron later treats that value as the workpack owner, resolves it through service-role auth administration, and inserts into the resolved user tenant. |
| Category | Authorization bypass / cross-tenant write |
| CWE | CWE-639 |
| Affected lines | app/api/briefing/run/route.ts:121-159, app/api/briefing/settings/route.ts:120-141, app/api/briefing/settings/route.ts:122-124, lib/workpack-store.ts:513-543 |

#### Summary

A workspace user can make the cron job create a generated workpack in another user's tenant by setting briefing_email to the victim's registered email address.

#### Root Cause

The authenticated settings route accepts any syntactically email-like body.email and stores it on the caller's site without binding it to user.email or a recipient-only identity. The cron route later reads all enabled sites with a service-role client and passes site.email to saveAskResponseAsWorkpack as the owner identity. That helper resolves the supplied email to a Supabase auth user and inserts the generated workpack into that user's workspace. Thus an attacker who knows another registered email can select the provider prompt through briefing_question, select the victim through briefing_email, and wait for the authorized cron execution to perform the cross-tenant insert.

**Entrypoint evidence** — `app/api/briefing/run/route.ts:121-138`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const dbRows = await fetchBriefingSiteRows(supabaseClient);
  const { sites, source, truncated, error } = resolveBriefingSites(dbRows, process.env.BRIEFING_SITES);

  if (truncated) {
    log.warn("briefing sites exceeded cap — extra sites skipped this run", { source, cap: sites.length });
  }

  if (sites.length === 0) {
    log.info("briefing run: no sites configured", { source, error });
    return NextResponse.json({ ok: true, message: "no sites", source, results: [] });
  }

  const results: SiteResult[] = [];

  for (const site of sites) {
    let weatherSummary = "";
    let generated = false;
    let saved = false;
```

**Entrypoint evidence** — `app/api/briefing/settings/route.ts:120-137`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const enabled = body.enabled === true;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      message: "브리핑을 켜려면 작업 설명과 유효한 수신 이메일이 필요합니다."
    }, { status: 400 });
  }

  try {
    const context = await ensureWorkspaceContext(client, user, {});

    const { error } = await client
      .from("sites")
```

**Root Control evidence** — `app/api/briefing/settings/route.ts:122-124`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
```

**Sink evidence** — `lib/workpack-store.ts:513-530`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(client, ownerEmail);
  } catch (error) {
    console.error("briefing workpack save: user lookup failed", error);
    return { ok: false, workpackId: null, message: "이메일 소유자 조회에 실패했습니다." };
  }

  if (!userId) {
    return { ok: false, workpackId: null, message: `${ownerEmail} 계정을 찾지 못해 저장을 건너뛰었습니다.` };
  }

  const context = await ensureWorkspaceContext(client, { id: userId, email: ownerEmail }, {
    siteName,
    companyName: siteName
  });

  const evidenceSummary = buildWorkpackEvidenceSummary(response, verification.snapshot);
```

#### Validation

An authenticated user can persist any syntactically email-like briefing_email on their own site. The authorized cron later treats that value as the workpack owner, resolves it through service-role auth administration, and inserts into the resolved user tenant.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/briefing/run/route.ts:121-138`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const dbRows = await fetchBriefingSiteRows(supabaseClient);
  const { sites, source, truncated, error } = resolveBriefingSites(dbRows, process.env.BRIEFING_SITES);

  if (truncated) {
    log.warn("briefing sites exceeded cap — extra sites skipped this run", { source, cap: sites.length });
  }

  if (sites.length === 0) {
    log.info("briefing run: no sites configured", { source, error });
    return NextResponse.json({ ok: true, message: "no sites", source, results: [] });
  }

  const results: SiteResult[] = [];

  for (const site of sites) {
    let weatherSummary = "";
    let generated = false;
    let saved = false;
```

**Entrypoint evidence** — `app/api/briefing/settings/route.ts:120-137`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const enabled = body.enabled === true;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      message: "브리핑을 켜려면 작업 설명과 유효한 수신 이메일이 필요합니다."
    }, { status: 400 });
  }

  try {
    const context = await ensureWorkspaceContext(client, user, {});

    const { error } = await client
      .from("sites")
```

**Root Control evidence** — `app/api/briefing/settings/route.ts:122-124`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
```

**Sink evidence** — `lib/workpack-store.ts:513-530`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(client, ownerEmail);
  } catch (error) {
    console.error("briefing workpack save: user lookup failed", error);
    return { ok: false, workpackId: null, message: "이메일 소유자 조회에 실패했습니다." };
  }

  if (!userId) {
    return { ok: false, workpackId: null, message: `${ownerEmail} 계정을 찾지 못해 저장을 건너뛰었습니다.` };
  }

  const context = await ensureWorkspaceContext(client, { id: userId, email: ownerEmail }, {
    siteName,
    companyName: siteName
  });

  const evidenceSummary = buildWorkpackEvidenceSummary(response, verification.snapshot);
```

Evidence:
- app/api/briefing/settings/route.ts:120-141 binds the row update to the caller site but does not bind email to the caller identity.
- app/api/briefing/run/route.ts passes site.email to saveAskResponseAsWorkpack.
- lib/workpack-store.ts:465-543 resolves that email to a user and inserts into that user workspace.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- CRON_SECRET protects direct cron invocation and provider dispatch is fail-closed, but neither restores ownership binding for persisted settings consumed by the legitimate cron.
- Exploitability requires knowledge of another registered email and an enabled scheduled run; no live data mutation was attempted.

#### Dataflow

Authenticated user stores victim registered email plus chosen briefing question on own site -\> legitimate CRON_SECRET run reads settings -\> service-role user lookup -\> generated workpack insert in victim workspace.

- **Source:** Authenticated tenant-controlled briefing_email and briefing_question.

- **Sink:** Service-role workpack insert into the email-resolved user tenant.

- **Outcome:** medium

**Entrypoint evidence** — `app/api/briefing/run/route.ts:121-138`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const dbRows = await fetchBriefingSiteRows(supabaseClient);
  const { sites, source, truncated, error } = resolveBriefingSites(dbRows, process.env.BRIEFING_SITES);

  if (truncated) {
    log.warn("briefing sites exceeded cap — extra sites skipped this run", { source, cap: sites.length });
  }

  if (sites.length === 0) {
    log.info("briefing run: no sites configured", { source, error });
    return NextResponse.json({ ok: true, message: "no sites", source, results: [] });
  }

  const results: SiteResult[] = [];

  for (const site of sites) {
    let weatherSummary = "";
    let generated = false;
    let saved = false;
```

**Entrypoint evidence** — `app/api/briefing/settings/route.ts:120-137`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const enabled = body.enabled === true;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
    return NextResponse.json({
      ok: false,
      configured: true,
      dispatch,
      message: "브리핑을 켜려면 작업 설명과 유효한 수신 이메일이 필요합니다."
    }, { status: 400 });
  }

  try {
    const context = await ensureWorkspaceContext(client, user, {});

    const { error } = await client
      .from("sites")
```

**Root Control evidence** — `app/api/briefing/settings/route.ts:122-124`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (enabled && (!question || !email.includes("@"))) {
```

**Sink evidence** — `lib/workpack-store.ts:513-530`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(client, ownerEmail);
  } catch (error) {
    console.error("briefing workpack save: user lookup failed", error);
    return { ok: false, workpackId: null, message: "이메일 소유자 조회에 실패했습니다." };
  }

  if (!userId) {
    return { ok: false, workpackId: null, message: `${ownerEmail} 계정을 찾지 못해 저장을 건너뛰었습니다.` };
  }

  const context = await ensureWorkspaceContext(client, { id: userId, email: ownerEmail }, {
    siteName,
    companyName: siteName
  });

  const evidenceSummary = buildWorkpackEvidenceSummary(response, verification.snapshot);
```

#### Reachability

The settings write is reachable to a workspace user; exploitation completes when the enabled scheduled briefing job runs and generation evidence verifies.

- **Attacker:** Authenticated workspace user

- **Entry point:** app/api/briefing/run/route.ts

- **Outcome:** medium

Preconditions:
- Victim email is registered and the authorized scheduled briefing job runs.

#### Severity

**Medium** — The path crosses a tenant boundary and writes attacker-influenced safety workpack content into a victim workspace, but it is one scheduled object, requires a known email, and does not dispatch or expose data.

Raise if the inserted workpack is automatically trusted/dispatched or scalable across many victims; lower if briefing_email is bound to the caller or treated solely as a recipient while ownership comes from the persisted tenant identity.

#### Remediation

Persist the authenticated owner or organization identifier with the briefing configuration and pass that immutable identity to the cron save path. Treat `briefing_email` only as a delivery recipient, never as a workpack owner lookup key.

Tests:
- Configure a briefing recipient matching another account and verify the workpack remains in the caller tenant.
- Verify the cron path rejects stale or mismatched owner/site bindings.

Preventive controls:
- Use tenant IDs rather than email addresses for service-role ownership decisions.

<a id="finding-5"></a>

### [5] Public workpack remediation can spend database and model resources without abuse controls

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The public remediation route performs safety-reference searches and a 120-second-budget model generation without authentication, rate limiting, or a request-level work budget. Prompt truncation bounds selected strings but not request frequency or provider calls. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400, CWE-770 |
| Affected lines | app/api/workpack/remediate/route.ts:177-184, app/api/workpack/remediate/route.ts:189-191, app/api/workpack/remediate/route.ts:113-125 |

#### Summary

The public workpack-remediation route performs database searches and a language-model generation without authentication, rate limiting, or an input work budget.

#### Root Cause

Any caller can submit a question, document text, and rubric item. The route performs safety-reference searches, builds a large prompt, and calls generateKnowledgeText with a 120-second route budget. It has neither getWorkspaceUser nor enforceRateLimit, so repeated requests can consume provider quota and server concurrency.

**Entrypoint evidence** — `app/api/workpack/remediate/route.ts:177-184`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  const parsed = readRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const promptBundle = await buildPrompt(parsed.request);
```

**Sink evidence** — `app/api/workpack/remediate/route.ts:189-191`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const generated = await generateKnowledgeText(promptBundle.prompt);
  const fallbackText = buildFallbackText(promptBundle.rubricItem.title, promptBundle.rubricItem.improvementAction);
  const text = generated.text.trim() || fallbackText;
```

**Concrete Implementation evidence** — `app/api/workpack/remediate/route.ts:113-125`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function buildPrompt(request: RemediationRequest) {
  const rubricItem = publicSafetyDocumentRubric.find((item) => item.id === request.rubricItemId);
  if (!rubricItem) return null;

  const matches = matchSafetyKnowledge(request.question, 4);
  const catalogQuery = [
    request.question,
    rubricItem.title,
    rubricItem.improvementAction,
    rubricItem.researchAction
  ].join(" ");
  const catalog = await searchSafetyReferences({ query: catalogQuery, limit: 6 });
  const evidence = matches.map((match, index) => ({
```

#### Validation

The public remediation route performs safety-reference searches and a 120-second-budget model generation without authentication, rate limiting, or a request-level work budget. Prompt truncation bounds selected strings but not request frequency or provider calls.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/workpack/remediate/route.ts:177-184`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  const parsed = readRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const promptBundle = await buildPrompt(parsed.request);
```

**Sink evidence** — `app/api/workpack/remediate/route.ts:189-191`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const generated = await generateKnowledgeText(promptBundle.prompt);
  const fallbackText = buildFallbackText(promptBundle.rubricItem.title, promptBundle.rubricItem.improvementAction);
  const text = generated.text.trim() || fallbackText;
```

**Concrete Implementation evidence** — `app/api/workpack/remediate/route.ts:113-125`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function buildPrompt(request: RemediationRequest) {
  const rubricItem = publicSafetyDocumentRubric.find((item) => item.id === request.rubricItemId);
  if (!rubricItem) return null;

  const matches = matchSafetyKnowledge(request.question, 4);
  const catalogQuery = [
    request.question,
    rubricItem.title,
    rubricItem.improvementAction,
    rubricItem.researchAction
  ].join(" ");
  const catalog = await searchSafetyReferences({ query: catalogQuery, limit: 6 });
  const evidence = matches.map((match, index) => ({
```

Evidence:
- app/api/workpack/remediate/route.ts validates shape, truncates prompt fields, searches references, then invokes generateKnowledgeText.
- Focused route tests confirm the generation path is reachable.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Prompt truncation reduces per-call text size and the endpoint does not mutate a workpack, but neither control prevents provider-cost and concurrency exhaustion.
- Provider quotas and platform concurrency may bound total impact; no external provider load test was run.

#### Dataflow

Unauthenticated remediation POST -\> bounded prompt construction plus safety-reference search -\> generateKnowledgeText -\> response proposal.

- **Source:** Unauthenticated remediation JSON.

- **Sink:** Reference searches plus generateKnowledgeText.

- **Outcome:** medium

**Entrypoint evidence** — `app/api/workpack/remediate/route.ts:177-184`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  const parsed = readRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const promptBundle = await buildPrompt(parsed.request);
```

**Sink evidence** — `app/api/workpack/remediate/route.ts:189-191`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const generated = await generateKnowledgeText(promptBundle.prompt);
  const fallbackText = buildFallbackText(promptBundle.rubricItem.title, promptBundle.rubricItem.improvementAction);
  const text = generated.text.trim() || fallbackText;
```

**Concrete Implementation evidence** — `app/api/workpack/remediate/route.ts:113-125`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function buildPrompt(request: RemediationRequest) {
  const rubricItem = publicSafetyDocumentRubric.find((item) => item.id === request.rubricItemId);
  if (!rubricItem) return null;

  const matches = matchSafetyKnowledge(request.question, 4);
  const catalogQuery = [
    request.question,
    rubricItem.title,
    rubricItem.improvementAction,
    rubricItem.researchAction
  ].join(" ");
  const catalog = await searchSafetyReferences({ query: catalogQuery, limit: 6 });
  const evidence = matches.map((match, index) => ({
```

#### Reachability

The public route has no authentication or rate limiter and each valid rubric request reaches database/reference work and a configured model call under a long route budget.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/workpack/remediate/route.ts

- **Outcome:** medium

Preconditions:
- AI provider is configured.

#### Severity

**Medium** — A remote caller can repeatedly consume model quota, database searches, and server concurrency; the route is stateless, so impact is cost/availability rather than document integrity.

Lower if the production route is protected by durable edge quotas or generation is disabled; raise only with evidence of material service-wide outage or exceptional per-request provider cost.

#### Remediation

Require an authenticated tenant context, apply durable rate and concurrency limits, and cap question and document lengths before safety-reference searches or model generation.

Tests:
- Verify unauthenticated remediation cannot reach database search or model generation.
- Verify request and prompt budgets fail closed.

Preventive controls:
- Record route-level provider and database work budgets.

<a id="finding-6"></a>

### [6] Whole-workpack CSV export permits spreadsheet formula injection

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes. |
| Category | Spreadsheet formula injection |
| CWE | CWE-1236 |
| Affected lines | components/WorkpackEditor.tsx:1814-1823, components/WorkpackEditor.tsx:3796-3798 |

#### Summary

Whole-workpack CSV export does not neutralize spreadsheet formulas.

#### Root Cause

buildLaunchSheetRows includes editable workpack text, while buildDelimited only doubles quotes and wraps CSV fields. Formula-leading cells are preserved into the downloaded CSV.

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3796-3798`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadAllCsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.csv`);
```

#### Validation

Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes.

Validation method: static source/control/sink trace plus focused existing tests

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3796-3798`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadAllCsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.csv`);
```

Evidence:
- components/WorkpackEditor.tsx:1818-1823 preserves leading =, +, -, and @ characters.
- Whole-workpack CSV download reaches that helper and emits or copies spreadsheet-importable text.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- No formula-neutralization helper or spreadsheet-safe prefix is applied on this path. Existing CSV neutralization coverage belongs to a different reporting export implementation.
- The exact spreadsheet application and its formula-evaluation policy affect exploit behavior, but the emitted cells remain formula-capable.

#### Dataflow

Editable/generated workpack cells -\> buildDelimited CSV quoting -\> whole-workpack CSV download -\> victim opens/imports file.

- **Source:** User-edited and generated workpack row values.

- **Sink:** Whole-workpack CSV download

- **Outcome:** low

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3796-3798`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadAllCsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(data.scenario.companyName)}-safeclaw-workpack.csv`);
```

#### Reachability

The whole-workpack CSV mode is independently triggerable from the editor and preserves formula prefixes through the download sink.

- **Attacker:** Actor able to influence exported workpack text

- **Entry point:** components/WorkpackEditor.tsx

- **Outcome:** low

Preconditions:
- A victim imports/pastes the exported content into formula-evaluating spreadsheet software.

#### Severity

**Low** — This is a real downloadable-artifact injection boundary, but current evidence supports limited client-side integrity impact with user interaction rather than credential or tenant compromise.

Raise if exported attacker-controlled cells are routinely delivered to a distinct privileged victim and a supported client permits exfiltrating formulas; ignore if supported importers categorically disable formulas.

#### Remediation

Route every CSV and TSV cell through one formula-neutralization helper before quoting or joining. Prefix cells whose first significant character is `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe, and preserve the original value only in non-spreadsheet formats.

Tests:
- Add a regression test for `downloadAllCsv` showing formula-leading editable content is emitted as inert text.
- Cover leading whitespace and tab/carriage-return formula prefixes.

Preventive controls:
- Use one shared delimited-cell encoder for every CSV, TSV, download, and clipboard mode.
- Keep export-specific security fixtures for spreadsheet applications.

<a id="finding-7"></a>

### [7] Downloaded Sheets TSV permits spreadsheet formula injection

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes. |
| Category | Spreadsheet formula injection |
| CWE | CWE-1236 |
| Affected lines | components/WorkpackEditor.tsx:1818-1823, components/WorkpackEditor.tsx:3806-3811 |

#### Summary

Downloaded Google Sheets TSV does not neutralize spreadsheet formulas.

#### Root Cause

The TSV branch removes tabs and line breaks but leaves formula prefixes intact before creating an importable tab-separated file from editable workpack rows.

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3806-3811`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadSheetsTsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(
      new Blob([`\uFEFF${buildDelimited(rows, "\t")}`], { type: "text/tab-separated-values;charset=utf-8" }),
      `${sanitizeFileName(data.scenario.companyName)}-google-sheets.tsv`
    );
```

#### Validation

Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes.

Validation method: static source/control/sink trace plus focused existing tests

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3806-3811`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadSheetsTsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(
      new Blob([`\uFEFF${buildDelimited(rows, "\t")}`], { type: "text/tab-separated-values;charset=utf-8" }),
      `${sanitizeFileName(data.scenario.companyName)}-google-sheets.tsv`
    );
```

Evidence:
- components/WorkpackEditor.tsx:1818-1823 preserves leading =, +, -, and @ characters.
- Downloaded TSV import reaches that helper and emits or copies spreadsheet-importable text.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- No formula-neutralization helper or spreadsheet-safe prefix is applied on this path. Existing CSV neutralization coverage belongs to a different reporting export implementation.
- The exact spreadsheet application and its formula-evaluation policy affect exploit behavior, but the emitted cells remain formula-capable.

#### Dataflow

Editable/generated workpack cells -\> TSV tab/newline cleanup -\> downloaded TSV -\> victim imports into Google Sheets or another spreadsheet.

- **Source:** User-edited and generated workpack row values.

- **Sink:** Downloaded TSV import

- **Outcome:** low

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3806-3811`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadSheetsTsv() {
    const rows = buildLaunchSheetRows(values);
    downloadBlob(
      new Blob([`\uFEFF${buildDelimited(rows, "\t")}`], { type: "text/tab-separated-values;charset=utf-8" }),
      `${sanitizeFileName(data.scenario.companyName)}-google-sheets.tsv`
    );
```

#### Reachability

The downloaded TSV mode is independently triggerable and preserves leading formula metacharacters.

- **Attacker:** Actor able to influence exported workpack text

- **Entry point:** components/WorkpackEditor.tsx

- **Outcome:** low

Preconditions:
- A victim imports/pastes the exported content into formula-evaluating spreadsheet software.

#### Severity

**Low** — The repository proves formula-capable output but only a constrained downloadable-artifact integrity risk, so low severity matches the threat-model calibration.

Raise if the product automatically shares this artifact with another privileged user and a supported client permits data exfiltration or privileged formula actions; ignore if formulas are disabled on import.

#### Remediation

Route every CSV and TSV cell through one formula-neutralization helper before quoting or joining. Prefix cells whose first significant character is `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe, and preserve the original value only in non-spreadsheet formats.

Tests:
- Add a regression test for `downloadSheetsTsv` showing formula-leading editable content is emitted as inert text.
- Cover leading whitespace and tab/carriage-return formula prefixes.

Preventive controls:
- Use one shared delimited-cell encoder for every CSV, TSV, download, and clipboard mode.
- Keep export-specific security fixtures for spreadsheet applications.

<a id="finding-8"></a>

### [8] Permit-inspection XLSX export accepts unbounded structured input

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-187, app/api/export/xlsx/route.ts:186-188, lib/xlsx-builder.ts:763-800 |

#### Summary

Structured permit XLSX export accepts unbounded nested arrays and strings.

#### Root Cause

The structured permit branch passes attacker-sized conditions, attachments, completion checks, and text fields into in-memory worksheet generation without request, item-count, or field-length limits.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:186-188`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "permitInspectionStructured") {
        const buffer = await buildPermitInspectionStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-안전작업허가-확인서`, "safeclaw-work-permit");
```

**Evidence evidence** — `lib/xlsx-builder.ts:763-780`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parsePermitInspectionStructured(value: StructuredRecord): PermitInspectionStructured {
  const basicInfo = isRecord(value.basicInfo) ? value.basicInfo : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions : [];
  const attachments = Array.isArray(value.attachments) ? value.attachments : [];
  const completionChecks = Array.isArray(value.completionChecks) ? value.completionChecks : [];
  const approvers = isRecord(value.approvers) ? value.approvers : {};

  return {
    basicInfo: {
      permitNo: readString(basicInfo.permitNo, "현장 발급"),
      permitType: readPermitType(basicInfo.permitType),
      workName: readString(basicInfo.workName, "작업명 확인"),
      location: readString(basicInfo.location, "작업장소 확인"),
      workDate: readString(basicInfo.workDate, "작업일 확인"),
      workerCount: readNumber(basicInfo.workerCount, 0),
      requester: readString(basicInfo.requester, "작업반장"),
      approver: readString(basicInfo.approver, "관리감독자")
    },
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:186-188`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "permitInspectionStructured") {
        const buffer = await buildPermitInspectionStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-안전작업허가-확인서`, "safeclaw-work-permit");
```

**Evidence evidence** — `lib/xlsx-builder.ts:763-780`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parsePermitInspectionStructured(value: StructuredRecord): PermitInspectionStructured {
  const basicInfo = isRecord(value.basicInfo) ? value.basicInfo : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions : [];
  const attachments = Array.isArray(value.attachments) ? value.attachments : [];
  const completionChecks = Array.isArray(value.completionChecks) ? value.completionChecks : [];
  const approvers = isRecord(value.approvers) ? value.approvers : {};

  return {
    basicInfo: {
      permitNo: readString(basicInfo.permitNo, "현장 발급"),
      permitType: readPermitType(basicInfo.permitType),
      workName: readString(basicInfo.workName, "작업명 확인"),
      location: readString(basicInfo.location, "작업장소 확인"),
      workDate: readString(basicInfo.workDate, "작업일 확인"),
      workerCount: readNumber(basicInfo.workerCount, 0),
      requester: readString(basicInfo.requester, "작업반장"),
      approver: readString(basicInfo.approver, "관리감독자")
    },
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Conditions, attachments, completion checks, and strings are expanded in memory.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated permitInspectionStructured JSON -\> nested permit arrays/string parsing -\> in-memory ExcelJS workbook -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS permit workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:186-188`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "permitInspectionStructured") {
        const buffer = await buildPermitInspectionStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-안전작업허가-확인서`, "safeclaw-work-permit");
```

**Evidence evidence** — `lib/xlsx-builder.ts:763-780`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parsePermitInspectionStructured(value: StructuredRecord): PermitInspectionStructured {
  const basicInfo = isRecord(value.basicInfo) ? value.basicInfo : {};
  const conditions = Array.isArray(value.conditions) ? value.conditions : [];
  const attachments = Array.isArray(value.attachments) ? value.attachments : [];
  const completionChecks = Array.isArray(value.completionChecks) ? value.completionChecks : [];
  const approvers = isRecord(value.approvers) ? value.approvers : {};

  return {
    basicInfo: {
      permitNo: readString(basicInfo.permitNo, "현장 발급"),
      permitType: readPermitType(basicInfo.permitType),
      workName: readString(basicInfo.workName, "작업명 확인"),
      location: readString(basicInfo.location, "작업장소 확인"),
      workDate: readString(basicInfo.workDate, "작업일 확인"),
      workerCount: readNumber(basicInfo.workerCount, 0),
      requester: readString(basicInfo.requester, "작업반장"),
      approver: readString(basicInfo.approver, "관리감독자")
    },
```

#### Reachability

This structured permit mode is independently selectable and has no application-level workload or rate budget.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — The public route permits resource consumption, but current evidence supports only bounded ephemeral export degradation for this mode.

Raise if accepted nested data expands disproportionately or repeated requests materially impair production; ignore if durable request and collection caps are enforced upstream.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `permitInspectionStructured` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-9"></a>

### [9] Education-record XLSX export accepts unbounded structured input

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-202, app/api/export/xlsx/route.ts:201-202, lib/xlsx-builder.ts:685-710 |

#### Summary

Structured education-record XLSX export accepts unbounded curriculum data and strings.

#### Root Cause

The complete request body and curriculum array are parsed without size or count limits before every item is written and the workbook is serialized in memory.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:201-202`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      const buffer = await buildEducationRecordStructuredXlsx(scenario, body.structured, { editedRows });
      return xlsxResponse(buffer, `${scenario.companyName}-안전보건교육-기록`, "safeclaw-education-record");
```

**Evidence evidence** — `lib/xlsx-builder.ts:685-702`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseEducationRecordStructured(value: StructuredRecord): EducationRecordStructured {
  const curriculum = Array.isArray(value.curriculum) ? value.curriculum : [];
  const type = readString(value.type, "기타");
  const safeType: EducationRecordStructured["type"] =
    type === "정기교육" || type === "특별교육" || type === "외국인교육" || type === "신규자교육" || type === "관리감독자교육"
      ? type
      : "기타";
  return {
    educationName: readString(value.educationName, "안전보건교육"),
    type: safeType,
    dateTime: readString(value.dateTime, "일시 확인"),
    location: readString(value.location, "장소 확인"),
    target: readString(value.target, "교육대상 확인"),
    instructor: readString(value.instructor, "실시자 확인"),
    confirmer: readString(value.confirmer, "확인자 확인"),
    curriculum: curriculum.flatMap((item): EducationRecordStructured["curriculum"] => {
      if (!isRecord(item)) return [];
      return [{
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:201-202`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      const buffer = await buildEducationRecordStructuredXlsx(scenario, body.structured, { editedRows });
      return xlsxResponse(buffer, `${scenario.companyName}-안전보건교육-기록`, "safeclaw-education-record");
```

**Evidence evidence** — `lib/xlsx-builder.ts:685-702`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseEducationRecordStructured(value: StructuredRecord): EducationRecordStructured {
  const curriculum = Array.isArray(value.curriculum) ? value.curriculum : [];
  const type = readString(value.type, "기타");
  const safeType: EducationRecordStructured["type"] =
    type === "정기교육" || type === "특별교육" || type === "외국인교육" || type === "신규자교육" || type === "관리감독자교육"
      ? type
      : "기타";
  return {
    educationName: readString(value.educationName, "안전보건교육"),
    type: safeType,
    dateTime: readString(value.dateTime, "일시 확인"),
    location: readString(value.location, "장소 확인"),
    target: readString(value.target, "교육대상 확인"),
    instructor: readString(value.instructor, "실시자 확인"),
    confirmer: readString(value.confirmer, "확인자 확인"),
    curriculum: curriculum.flatMap((item): EducationRecordStructured["curriculum"] => {
      if (!isRecord(item)) return [];
      return [{
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Curriculum arrays and strings are expanded into worksheet rows before in-memory XLSX serialization.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated educationRecordStructured JSON -\> nested curriculum/attendee parsing -\> in-memory ExcelJS workbook -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS education-record workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:201-202`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      const buffer = await buildEducationRecordStructuredXlsx(scenario, body.structured, { editedRows });
      return xlsxResponse(buffer, `${scenario.companyName}-안전보건교육-기록`, "safeclaw-education-record");
```

**Evidence evidence** — `lib/xlsx-builder.ts:685-702`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseEducationRecordStructured(value: StructuredRecord): EducationRecordStructured {
  const curriculum = Array.isArray(value.curriculum) ? value.curriculum : [];
  const type = readString(value.type, "기타");
  const safeType: EducationRecordStructured["type"] =
    type === "정기교육" || type === "특별교육" || type === "외국인교육" || type === "신규자교육" || type === "관리감독자교육"
      ? type
      : "기타";
  return {
    educationName: readString(value.educationName, "안전보건교육"),
    type: safeType,
    dateTime: readString(value.dateTime, "일시 확인"),
    location: readString(value.location, "장소 확인"),
    target: readString(value.target, "교육대상 확인"),
    instructor: readString(value.instructor, "실시자 확인"),
    confirmer: readString(value.confirmer, "확인자 확인"),
    curriculum: curriculum.flatMap((item): EducationRecordStructured["curriculum"] => {
      if (!isRecord(item)) return [];
      return [{
```

#### Reachability

This structured mode is independently selectable on the public XLSX POST route and lacks route-local byte, item-count, field-length, or rate budgets.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — A remote caller can consume CPU and memory with accepted nested data, but the single-request expansion is transport-bounded and limited to ephemeral export availability.

Raise if a small accepted payload causes disproportionate memory amplification or repeated requests materially impair the service; ignore if durable edge limits and parser caps bound all nested collections.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `educationRecordStructured` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-10"></a>

### [10] Public weather lookup can amplify requests to multiple upstream APIs

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The unauthenticated weather GET lacks rate limiting and in-flight request coalescing; concurrent misses for the same heat-related query each launch the multi-signal retry-capable upstream fan-out. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400, CWE-770 |
| Affected lines | app/api/weather/route.ts:6-17, app/api/weather/route.ts:7, lib/weather.ts:379-397, lib/weather.ts:883-895, lib/weather.ts:844-846 |

#### Summary

Unauthenticated weather requests can create a concurrent outbound-request amplification burst.

#### Root Cause

GET /api/weather accepts an arbitrary question without authentication or rate limiting. A question matching outdoor-heat terms selects eight upstream weather signals; each signal uses fetchWithTimeout with one retry. The cache is populated only after all requests finish and there is no in-flight request coalescing, so many concurrent requests for the same uncached key each launch the full five- or eight-signal fan-out before any cache entry exists.

**Entrypoint evidence** — `app/api/weather/route.ts:6-17`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchWeatherSignal(question);
    return NextResponse.json({ ok: true, weather });
```

**Entrypoint evidence** — `app/api/weather/route.ts:7`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
```

**Sink evidence** — `lib/weather.ts:379-396`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function fetchWithTimeout(url: string, label: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= KMA_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KMA_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text.slice(0, 180) || `${label} HTTP ${response.status}`);
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
```

**Sink evidence** — `lib/weather.ts:883-895`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const baseSignals = await Promise.all([
    fetchUltraNowSignal(location),
    fetchUltraForecastSignal(location),
    fetchVillageForecastSignal(location),
    fetchWarningSignal(location),
    fetchImpactForecastSignal(location)
  ]);
  const outdoorSignals = outdoorHeatContext
    ? await Promise.all([
        fetchLivingUvSignal(location),
        fetchLivingHeatIndexSignal(location),
        fetchErythemalUvSignal(location)
      ])
```

**Concrete Implementation evidence** — `lib/weather.ts:844-846`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function fetchWeatherSignal(question: string): Promise<WeatherSignal> {
  const location = pickLocation(question);
  const outdoorHeatContext = isOutdoorHeatContext(question);
```

#### Validation

The unauthenticated weather GET lacks rate limiting and in-flight request coalescing; concurrent misses for the same heat-related query each launch the multi-signal retry-capable upstream fan-out.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/weather/route.ts:6-17`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchWeatherSignal(question);
    return NextResponse.json({ ok: true, weather });
```

**Entrypoint evidence** — `app/api/weather/route.ts:7`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
```

**Sink evidence** — `lib/weather.ts:379-396`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function fetchWithTimeout(url: string, label: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= KMA_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KMA_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text.slice(0, 180) || `${label} HTTP ${response.status}`);
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
```

**Sink evidence** — `lib/weather.ts:883-895`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const baseSignals = await Promise.all([
    fetchUltraNowSignal(location),
    fetchUltraForecastSignal(location),
    fetchVillageForecastSignal(location),
    fetchWarningSignal(location),
    fetchImpactForecastSignal(location)
  ]);
  const outdoorSignals = outdoorHeatContext
    ? await Promise.all([
        fetchLivingUvSignal(location),
        fetchLivingHeatIndexSignal(location),
        fetchErythemalUvSignal(location)
      ])
```

**Concrete Implementation evidence** — `lib/weather.ts:844-846`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function fetchWeatherSignal(question: string): Promise<WeatherSignal> {
  const location = pickLocation(question);
  const outdoorHeatContext = isOutdoorHeatContext(question);
```

Evidence:
- app/api/weather/route.ts forwards arbitrary question text without enforceRateLimit.
- lib/weather.ts selects up to eight signals and fetches them before populating the cache; each fetch permits one retry.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- The completed-result cache limits repeated requests after the first finishes, but it does not coalesce concurrent cache misses.
- Upstream and hosting concurrency limits affect the maximum amplification; no external load was generated.

#### Dataflow

Unauthenticated heat-related weather query -\> cold cache miss -\> up to eight signal fetches -\> one retry per failed signal.

- **Source:** Unauthenticated weather query string.

- **Sink:** Concurrent outbound weather fetches with retry.

- **Outcome:** low

**Entrypoint evidence** — `app/api/weather/route.ts:6-17`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function GET(request: NextRequest) {
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
  if (!question) {
    return NextResponse.json(
      { ok: false, message: "question query is required" },
      { status: 400 }
    );
  }

  try {
    const weather = await fetchWeatherSignal(question);
    return NextResponse.json({ ok: true, weather });
```

**Entrypoint evidence** — `app/api/weather/route.ts:7`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const question = request.nextUrl.searchParams.get("question")?.trim() || "";
```

**Sink evidence** — `lib/weather.ts:379-396`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
async function fetchWithTimeout(url: string, label: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= KMA_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KMA_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text.slice(0, 180) || `${label} HTTP ${response.status}`);
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
```

**Sink evidence** — `lib/weather.ts:883-895`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const baseSignals = await Promise.all([
    fetchUltraNowSignal(location),
    fetchUltraForecastSignal(location),
    fetchVillageForecastSignal(location),
    fetchWarningSignal(location),
    fetchImpactForecastSignal(location)
  ]);
  const outdoorSignals = outdoorHeatContext
    ? await Promise.all([
        fetchLivingUvSignal(location),
        fetchLivingHeatIndexSignal(location),
        fetchErythemalUvSignal(location)
      ])
```

**Concrete Implementation evidence** — `lib/weather.ts:844-846`

This concrete_implementation carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function fetchWeatherSignal(question: string): Promise<WeatherSignal> {
  const location = pickLocation(question);
  const outdoorHeatContext = isOutdoorHeatContext(question);
```

#### Reachability

The public GET lacks rate limiting and concurrent miss coalescing, so simultaneous cold-key requests can overlap before the completed-result cache is populated.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/weather/route.ts

- **Outcome:** low

Preconditions:
- Weather integrations are configured and the cache key is cold.

#### Severity

**Low** — Remote amplification is easy to trigger, but it is bounded to fixed public weather calls and currently supports only modest quota/concurrency impact.

Raise if weather quota exhaustion materially disables safety workflows or load evidence shows service-wide resource loss; ignore if an upstream durable rate limit or request coalescing fully bounds the route.

#### Remediation

Bound the question length, cache and coalesce equivalent weather lookups, and add a durable route-level rate and concurrency limit before starting upstream requests.

Tests:
- Verify oversized questions are rejected before upstream fetches.
- Verify concurrent identical lookups share one in-flight result.

Preventive controls:
- Track and cap upstream weather calls per request and client.

<a id="finding-11"></a>

### [11] Clipboard Sheets TSV permits spreadsheet formula injection

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes. |
| Category | Spreadsheet formula injection |
| CWE | CWE-1236 |
| Affected lines | components/WorkpackEditor.tsx:1818-1823, components/WorkpackEditor.tsx:3826-3834 |

#### Summary

Clipboard export to Google Sheets does not neutralize spreadsheet formulas.

#### Root Cause

Editable workpack values are copied as TSV directly to the clipboard. Pasting into the newly opened sheet can evaluate cells beginning with spreadsheet formula metacharacters.

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3826-3834`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  async function copySheetsTsv() {
    const confirmed = window.confirm("새 Google Sheets를 열고 표 데이터를 클립보드에 복사합니다. 열린 빈 시트의 A1 셀에 Ctrl+V로 붙여넣으면 문서팩 표가 들어갑니다.");
    if (!confirmed) return;

    const rows = buildLaunchSheetRows(values);
    const sheetWindow = window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(buildDelimited(rows, "\t"));
      setSheetStatus("copied");
```

#### Validation

Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes.

Validation method: static source/control/sink trace plus focused existing tests

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3826-3834`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  async function copySheetsTsv() {
    const confirmed = window.confirm("새 Google Sheets를 열고 표 데이터를 클립보드에 복사합니다. 열린 빈 시트의 A1 셀에 Ctrl+V로 붙여넣으면 문서팩 표가 들어갑니다.");
    if (!confirmed) return;

    const rows = buildLaunchSheetRows(values);
    const sheetWindow = window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(buildDelimited(rows, "\t"));
      setSheetStatus("copied");
```

Evidence:
- components/WorkpackEditor.tsx:1818-1823 preserves leading =, +, -, and @ characters.
- Clipboard write followed by Google Sheets paste reaches that helper and emits or copies spreadsheet-importable text.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- No formula-neutralization helper or spreadsheet-safe prefix is applied on this path. Existing CSV neutralization coverage belongs to a different reporting export implementation.
- The exact spreadsheet application and its formula-evaluation policy affect exploit behavior, but the emitted cells remain formula-capable.

#### Dataflow

Editable/generated workpack cells -\> buildDelimited TSV normalization -\> clipboard -\> victim paste into Google Sheets.

- **Source:** User-edited and generated workpack row values.

- **Sink:** Clipboard write followed by Google Sheets paste

- **Outcome:** low

**Root Control evidence** — `components/WorkpackEditor.tsx:1818-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3826-3834`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  async function copySheetsTsv() {
    const confirmed = window.confirm("새 Google Sheets를 열고 표 데이터를 클립보드에 복사합니다. 열린 빈 시트의 A1 셀에 Ctrl+V로 붙여넣으면 문서팩 표가 들어갑니다.");
    if (!confirmed) return;

    const rows = buildLaunchSheetRows(values);
    const sheetWindow = window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(buildDelimited(rows, "\t"));
      setSheetStatus("copied");
```

#### Reachability

Authenticated editor action is independently reachable; formula-leading values survive and execute only if the victim pastes into formula-evaluating spreadsheet software.

- **Attacker:** Actor able to influence exported workpack text

- **Entry point:** components/WorkpackEditor.tsx

- **Outcome:** low

Preconditions:
- A victim imports/pastes the exported content into formula-evaluating spreadsheet software.

#### Severity

**Low** — Spreadsheet formula execution can alter a victim-owned sheet, but requires an export/paste action and the repository does not prove credential theft, cross-tenant delivery, or a higher-impact formula workflow.

Raise only if a realistic lower-privileged attacker can plant cells into another user tenant and the supported spreadsheet client enables data exfiltration or privileged actions; ignore if all supported clients neutralize formula prefixes.

#### Remediation

Route every CSV and TSV cell through one formula-neutralization helper before quoting or joining. Prefix cells whose first significant character is `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe, and preserve the original value only in non-spreadsheet formats.

Tests:
- Add a regression test for `copySheetsTsv` showing formula-leading editable content is emitted as inert text.
- Cover leading whitespace and tab/carriage-return formula prefixes.

Preventive controls:
- Use one shared delimited-cell encoder for every CSV, TSV, download, and clipboard mode.
- Keep export-specific security fixtures for spreadsheet applications.

<a id="finding-12"></a>

### [12] TBM log XLSX export accepts unbounded structured input

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-197, app/api/export/xlsx/route.ts:196-198, lib/xlsx-builder.ts:619-660 |

#### Summary

Structured TBM log XLSX export accepts unbounded nested arrays and strings.

#### Root Cause

The handler permits attacker-sized attendees, hazards, confirmations, education items, unresolved items, photo locations, and strings, all of which can be expanded during in-memory workbook generation.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:196-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmLogStructured") {
        const buffer = await buildTbmLogStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-일지`, "safeclaw-tbm-log");
```

**Evidence evidence** — `lib/xlsx-builder.ts:619-636`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmLogStructured(value: StructuredRecord): TbmLogStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const attendance = isRecord(value.attendance) ? value.attendance : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazardsDiscussed) ? value.hazardsDiscussed : [];
  const safetyEducation = isRecord(value.safetyEducation) ? value.safetyEducation : {};
  const unaddressedItems = Array.isArray(value.unaddressedItems) ? value.unaddressedItems : [];
  const photoEvidence = isRecord(value.photoEvidence) ? value.photoEvidence : {};
  const signatures = isRecord(value.signatures) ? value.signatures : {};
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      workType: readString(meta.workType, "공종 확인"),
      instructor: readString(meta.instructor, "진행자 확인")
    },
    attendance: {
      expected: readNumber(attendance.expected, 0),
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:196-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmLogStructured") {
        const buffer = await buildTbmLogStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-일지`, "safeclaw-tbm-log");
```

**Evidence evidence** — `lib/xlsx-builder.ts:619-636`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmLogStructured(value: StructuredRecord): TbmLogStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const attendance = isRecord(value.attendance) ? value.attendance : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazardsDiscussed) ? value.hazardsDiscussed : [];
  const safetyEducation = isRecord(value.safetyEducation) ? value.safetyEducation : {};
  const unaddressedItems = Array.isArray(value.unaddressedItems) ? value.unaddressedItems : [];
  const photoEvidence = isRecord(value.photoEvidence) ? value.photoEvidence : {};
  const signatures = isRecord(value.signatures) ? value.signatures : {};
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      workType: readString(meta.workType, "공종 확인"),
      instructor: readString(meta.instructor, "진행자 확인")
    },
    attendance: {
      expected: readNumber(attendance.expected, 0),
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Attendees, hazards, confirmations, education items, unresolved items, and photo locations are expanded in memory.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated tbmLogStructured JSON -\> attendees/hazards/confirmations/photo-location arrays -\> in-memory ExcelJS workbook -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS TBM log workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:196-198`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmLogStructured") {
        const buffer = await buildTbmLogStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-일지`, "safeclaw-tbm-log");
```

**Evidence evidence** — `lib/xlsx-builder.ts:619-636`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmLogStructured(value: StructuredRecord): TbmLogStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const attendance = isRecord(value.attendance) ? value.attendance : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazardsDiscussed) ? value.hazardsDiscussed : [];
  const safetyEducation = isRecord(value.safetyEducation) ? value.safetyEducation : {};
  const unaddressedItems = Array.isArray(value.unaddressedItems) ? value.unaddressedItems : [];
  const photoEvidence = isRecord(value.photoEvidence) ? value.photoEvidence : {};
  const signatures = isRecord(value.signatures) ? value.signatures : {};
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      workType: readString(meta.workType, "공종 확인"),
      instructor: readString(meta.instructor, "진행자 확인")
    },
    attendance: {
      expected: readNumber(attendance.expected, 0),
```

#### Reachability

The TBM log mode is independently selectable and has no item-count, field-length, request, or rate budget.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — Many nested collections increase work, but current evidence still supports a bounded public export resource drain with low impact.

Raise if low-volume requests reliably exhaust memory or block production concurrency; ignore if durable request and nested-item caps are present outside the repository.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `tbmLogStructured` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-13"></a>

### [13] Single-document XLSX export accepts an unbounded work budget

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-168, app/api/export/xlsx/route.ts:229-234, lib/xlsx-builder.ts:1411-1499 |

#### Summary

Single-document XLSX export has no request, row, or field resource budget.

#### Root Cause

The public POST handler parses the complete JSON body, accepts an unbounded rows array and strings, then builds and serializes every worksheet row in memory. A large request can consume substantial CPU and memory before writeBuffer completes.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:229-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);
    const buffer = await buildXlsxForDocument({ title, rows, profile, scenario, structuredRiskRows });
    return xlsxResponse(buffer, `${scenario.companyName}-${title}`, "safeclaw-document");
```

**Evidence evidence** — `lib/xlsx-builder.ts:1411-1428`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  // 4) Section summary
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
    acc[r.section] = [...(acc[r.section] || []), r];
    return acc;
  }, {});
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "섹션 요약";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  const summaryHeader = ["섹션", "항목 수", "주요 항목"];
  ws.getCell(row, 1).value = summaryHeader[0];
  ws.mergeCells(row, 2, row, 3);
  ws.getCell(row, 2).value = summaryHeader[1];
  ws.mergeCells(row, 4, row, 6);
  ws.getCell(row, 4).value = summaryHeader[2];
  [1, 2, 4].forEach((c) => {
    ws.getCell(row, c).fill = HEADER_FILL;
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:229-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);
    const buffer = await buildXlsxForDocument({ title, rows, profile, scenario, structuredRiskRows });
    return xlsxResponse(buffer, `${scenario.companyName}-${title}`, "safeclaw-document");
```

**Evidence evidence** — `lib/xlsx-builder.ts:1411-1428`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  // 4) Section summary
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
    acc[r.section] = [...(acc[r.section] || []), r];
    return acc;
  }, {});
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "섹션 요약";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  const summaryHeader = ["섹션", "항목 수", "주요 항목"];
  ws.getCell(row, 1).value = summaryHeader[0];
  ws.mergeCells(row, 2, row, 3);
  ws.getCell(row, 2).value = summaryHeader[1];
  ws.mergeCells(row, 4, row, 6);
  ws.getCell(row, 4).value = summaryHeader[2];
  [1, 2, 4].forEach((c) => {
    ws.getCell(row, c).fill = HEADER_FILL;
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- All accepted rows and strings are retained and serialized in memory.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated single-mode XLSX JSON -\> unbounded rows/strings -\> in-memory ExcelJS worksheet -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS single-document workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-168`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

```

**Sink evidence** — `app/api/export/xlsx/route.ts:229-234`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const title = readString(body.title, "SafeClaw 안전 문서");
    const rows = parseRows(body.rows, title);
    const profile = parseProfile(body.profile);
    const structuredRiskRows = body.edited === true ? [] : parseRiskRowsFromBody(body);
    const buffer = await buildXlsxForDocument({ title, rows, profile, scenario, structuredRiskRows });
    return xlsxResponse(buffer, `${scenario.companyName}-${title}`, "safeclaw-document");
```

**Evidence evidence** — `lib/xlsx-builder.ts:1411-1428`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  // 4) Section summary
  const grouped = rows.reduce<Record<string, SheetRow[]>>((acc, r) => {
    acc[r.section] = [...(acc[r.section] || []), r];
    return acc;
  }, {});
  ws.mergeCells(row, 1, row, 6);
  ws.getCell(row, 1).value = "섹션 요약";
  ws.getCell(row, 1).font = { name: "Malgun Gothic", size: 12, bold: true };
  row += 1;

  const summaryHeader = ["섹션", "항목 수", "주요 항목"];
  ws.getCell(row, 1).value = summaryHeader[0];
  ws.mergeCells(row, 2, row, 3);
  ws.getCell(row, 2).value = summaryHeader[1];
  ws.mergeCells(row, 4, row, 6);
  ws.getCell(row, 4).value = summaryHeader[2];
  [1, 2, 4].forEach((c) => {
    ws.getCell(row, c).fill = HEADER_FILL;
```

#### Reachability

The default single-document mode is independently reachable on the public POST route and has no row, field, body, or rate budget in application code.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — Remote CPU/memory consumption is plausible, but single-sheet expansion is transport-bounded and presently supports low availability impact.

Raise if a small accepted body yields disproportionate workbook memory growth or concurrent requests materially impair service; ignore if durable limits fully cap rows and fields.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `single` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-14"></a>

### [14] TBM briefing XLSX export accepts unbounded structured input

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-192, app/api/export/xlsx/route.ts:191-193, lib/xlsx-builder.ts:570-608 |

#### Summary

Structured TBM briefing XLSX export accepts unbounded nested arrays and strings.

#### Root Cause

Hazards, measures, stop criteria, confirmation topics, and their strings are parsed without budgets and expanded into a workbook fully in memory.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:191-193`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmBriefingStructured") {
        const buffer = await buildTbmBriefingStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-브리핑`, "safeclaw-tbm-briefing");
```

**Evidence evidence** — `lib/xlsx-builder.ts:570-587`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmBriefingStructured(value: StructuredRecord): TbmBriefingStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazards) ? value.hazards : [];
  const measures = Array.isArray(value.measures) ? value.measures : [];
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      target: readString(meta.target, "대상 확인"),
      attendees: readString(meta.attendees, "참석자 확인")
    },
    todayWork: {
      name: readString(todayWork.name, "작업명 확인"),
      location: readString(todayWork.location, "작업 위치 확인"),
      time: readString(todayWork.time, "작업 시간 확인"),
      equipment: readStringArray(todayWork.equipment)
    },
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:191-193`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmBriefingStructured") {
        const buffer = await buildTbmBriefingStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-브리핑`, "safeclaw-tbm-briefing");
```

**Evidence evidence** — `lib/xlsx-builder.ts:570-587`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmBriefingStructured(value: StructuredRecord): TbmBriefingStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazards) ? value.hazards : [];
  const measures = Array.isArray(value.measures) ? value.measures : [];
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      target: readString(meta.target, "대상 확인"),
      attendees: readString(meta.attendees, "참석자 확인")
    },
    todayWork: {
      name: readString(todayWork.name, "작업명 확인"),
      location: readString(todayWork.location, "작업 위치 확인"),
      time: readString(todayWork.time, "작업 시간 확인"),
      equipment: readStringArray(todayWork.equipment)
    },
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Hazards, measures, stop criteria, confirmation topics, and strings are expanded in memory.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated tbmBriefingStructured JSON -\> nested hazard/control arrays -\> in-memory ExcelJS workbook -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS TBM briefing workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:191-193`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "tbmBriefingStructured") {
        const buffer = await buildTbmBriefingStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-TBM-브리핑`, "safeclaw-tbm-briefing");
```

**Evidence evidence** — `lib/xlsx-builder.ts:570-587`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseTbmBriefingStructured(value: StructuredRecord): TbmBriefingStructured {
  const meta = isRecord(value.meta) ? value.meta : {};
  const todayWork = isRecord(value.todayWork) ? value.todayWork : {};
  const hazards = Array.isArray(value.hazards) ? value.hazards : [];
  const measures = Array.isArray(value.measures) ? value.measures : [];
  return {
    meta: {
      dateTime: readString(meta.dateTime, "일시 확인"),
      location: readString(meta.location, "장소 확인"),
      target: readString(meta.target, "대상 확인"),
      attendees: readString(meta.attendees, "참석자 확인")
    },
    todayWork: {
      name: readString(todayWork.name, "작업명 확인"),
      location: readString(todayWork.location, "작업 위치 확인"),
      time: readString(todayWork.time, "작업 시간 확인"),
      equipment: readStringArray(todayWork.equipment)
    },
```

#### Reachability

The TBM briefing mode is independently selectable and expands attacker-sized nested arrays without route-local limits.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — This is a reachable public resource drain, but evidence supports bounded export availability impact rather than sustained broader compromise.

Raise if nested expansion is shown to exhaust production memory/concurrency at low attacker cost; ignore if durable edge and collection limits are confirmed.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `tbmBriefingStructured` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-15"></a>

### [15] Work-plan XLSX export accepts unbounded structured input

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400 |
| Affected lines | app/api/export/xlsx/route.ts:163-182, app/api/export/xlsx/route.ts:181-183, lib/xlsx-builder.ts:525-553 |

#### Summary

Structured work-plan XLSX export accepts unbounded nested arrays and strings.

#### Root Cause

The route reads the whole body and passes the structured object directly to a parser that maps workSteps and string arrays without budgets before generating an in-memory workbook.

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:181-183`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "workPlanStructured") {
        const buffer = await buildWorkPlanStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-작업계획서`, "safeclaw-work-plan");
```

**Evidence evidence** — `lib/xlsx-builder.ts:525-542`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseWorkPlanStructured(value: StructuredRecord): WorkPlanStructured {
  const overview = isRecord(value.workOverview) ? value.workOverview : {};
  const emergency = isRecord(value.emergencyResponse) ? value.emergencyResponse : {};
  const approvers = isRecord(value.approvers) ? value.approvers : {};
  const steps = Array.isArray(value.workSteps) ? value.workSteps : [];
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts : [];
  return {
    workOverview: {
      workName: readString(overview.workName, "작업명 확인"),
      description: readString(overview.description, "작업내용 확인"),
      workerCount: readNumber(overview.workerCount, 0),
      location: readString(overview.location, "작업장소 확인"),
      condition: readString(overview.condition, "작업조건 확인"),
      equipment: readStringArray(overview.equipment)
    },
    workSteps: steps.flatMap((item, index): WorkPlanStructured["workSteps"] => {
      if (!isRecord(item)) return [];
      return [{
```

#### Validation

The public route parses attacker-sized JSON without an application-level byte, item-count, or field-length budget and expands it in memory at the concrete workbook/HWP sink. Focused functional tests confirm these modes are live and independently reachable.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:181-183`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "workPlanStructured") {
        const buffer = await buildWorkPlanStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-작업계획서`, "safeclaw-work-plan");
```

**Evidence evidence** — `lib/xlsx-builder.ts:525-542`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseWorkPlanStructured(value: StructuredRecord): WorkPlanStructured {
  const overview = isRecord(value.workOverview) ? value.workOverview : {};
  const emergency = isRecord(value.emergencyResponse) ? value.emergencyResponse : {};
  const approvers = isRecord(value.approvers) ? value.approvers : {};
  const steps = Array.isArray(value.workSteps) ? value.workSteps : [];
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts : [];
  return {
    workOverview: {
      workName: readString(overview.workName, "작업명 확인"),
      description: readString(overview.description, "작업내용 확인"),
      workerCount: readNumber(overview.workerCount, 0),
      location: readString(overview.location, "작업장소 확인"),
      condition: readString(overview.condition, "작업조건 확인"),
      equipment: readStringArray(overview.equipment)
    },
    workSteps: steps.flatMap((item, index): WorkPlanStructured["workSteps"] => {
      if (!isRecord(item)) return [];
      return [{
```

Evidence:
- app/api/export/xlsx/route.ts accepts the complete JSON payload without a route-local resource budget.
- Work steps and nested string arrays are expanded in memory.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- Hosting request-size limits provide an outer transport bound but do not cap row counts, nested item counts, cell lengths, or in-process expansion within accepted requests.
- No destructive load test was run; deployment memory/concurrency limits determine the exact failure threshold.

#### Dataflow

Unauthenticated workPlanStructured JSON -\> workSteps and nested string arrays -\> in-memory ExcelJS workbook -\> writeBuffer response.

- **Source:** Unauthenticated POST JSON body.

- **Sink:** ExcelJS work-plan workbook construction and writeBuffer

- **Outcome:** low

**Entrypoint evidence** — `app/api/export/xlsx/route.ts:163-180`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function POST(request: NextRequest) {
  const parsed = await request.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const mode = readString(body.mode, "single");
  const scenario = parseScenario(body.scenario);

  try {
    if (mode === "workPlanStructured" || mode === "permitInspectionStructured" || mode === "tbmBriefingStructured" || mode === "tbmLogStructured" || mode === "educationRecordStructured") {
      if (!isRecord(body.structured)) {
        return NextResponse.json(
          { ok: false, error: "structured must be a non-array object for structured xlsx export" },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }
      const editedRows = body.edited === true
        ? parseRows(body.rows, structuredFallbackTitle(mode))
        : undefined;

```

**Sink evidence** — `app/api/export/xlsx/route.ts:181-183`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
      if (mode === "workPlanStructured") {
        const buffer = await buildWorkPlanStructuredXlsx(scenario, body.structured, { editedRows });
        return xlsxResponse(buffer, `${scenario.companyName}-작업계획서`, "safeclaw-work-plan");
```

**Evidence evidence** — `lib/xlsx-builder.ts:525-542`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function parseWorkPlanStructured(value: StructuredRecord): WorkPlanStructured {
  const overview = isRecord(value.workOverview) ? value.workOverview : {};
  const emergency = isRecord(value.emergencyResponse) ? value.emergencyResponse : {};
  const approvers = isRecord(value.approvers) ? value.approvers : {};
  const steps = Array.isArray(value.workSteps) ? value.workSteps : [];
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts : [];
  return {
    workOverview: {
      workName: readString(overview.workName, "작업명 확인"),
      description: readString(overview.description, "작업내용 확인"),
      workerCount: readNumber(overview.workerCount, 0),
      location: readString(overview.location, "작업장소 확인"),
      condition: readString(overview.condition, "작업조건 확인"),
      equipment: readStringArray(overview.equipment)
    },
    workSteps: steps.flatMap((item, index): WorkPlanStructured["workSteps"] => {
      if (!isRecord(item)) return [];
      return [{
```

#### Reachability

The work-plan structured mode is independently selectable and accepts attacker-sized collections without application-level budgets.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** app/api/export/xlsx/route.ts

- **Outcome:** low

Preconditions:
- An attacker can repeatedly submit large but transport-accepted export requests.

#### Severity

**Low** — The path is remotely reachable, but impact is limited to ephemeral CPU/memory use under transport bounds.

Raise if repository-compatible payloads demonstrate disproportionate expansion or material service degradation; ignore if durable upstream limits cap collections and concurrency.

#### Remediation

Reject oversized requests before JSON parsing where possible, then enforce mode-specific limits for document count, row count, nested array entries, field characters, rendered cells, and output bytes. Return a stable 413 or 422 response before allocating the workbook or HWP document.

Tests:
- Add boundary and over-limit tests for the `workPlanStructured` export mode.
- Verify oversized payloads fail before workbook or HWP generation begins.

Preventive controls:
- Share one export-budget policy across PDF, XLSX, and HWP routes.
- Apply durable abuse controls to unauthenticated export endpoints.

<a id="finding-16"></a>

### [16] A single public Ask request can drive an unbounded multi-provider work budget

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Public ask entrypoints accept unbounded question text and one accepted request reaches multiple database, public-data, reference, weather, and model operations. The IP limiter bounds request count but not per-request work or input size. |
| Category | Uncontrolled resource consumption |
| CWE | CWE-400, CWE-770 |
| Affected lines | lib/search.ts:2118, lib/search.ts:2169-2220, lib/search.ts:2251-2256, lib/search.ts:2317-2341 |

#### Summary

An unbounded question can drive a high-cost multi-provider and model fan-out in runAsk.

#### Root Cause

runAsk accepts question without a length or per-request work budget, then passes it into accident-case, legal, answer-generation, weather, training, KOSHA, KOSHA OpenAPI, and four safety-reference searches, with full-mode deliverable generation chained in parallel. Nearby public API callers pass request.question through without truncation; their soft per-instance IP limiter limits request count but does not bound attacker-selected input size or the number/cost of downstream operations performed by one accepted request.

**Entrypoint evidence** — `lib/search.ts:2118`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function runAsk(question: string, options: RunAskOptions = {}): Promise<AskResponse> {
```

**Sink evidence** — `lib/search.ts:2169-2186`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const accidentCasesPromise = fetchAccidentCases(question, {
      requestTimeoutMs: 5_000,
      retryCount: 0,
      budgetLabel: "KOSHA accident case enrichment budget"
    });

    // Fix 5: decouple enhance and generateAnswer — both branch off rawCitations in parallel.
    // enhanceLegalEvidenceMappings is a quality add-on (AI reorders citations); it no longer
    // gates generateAnswer. generateAnswer starts as soon as raw citations arrive.
    // citationsPromise resolves to enhanced citations when available (best-effort).
    const rawCitationsPromise = searchLegalSources(question);
    const rawCitationsBasePromise = rawCitationsPromise.then(async (raw) =>
      raw.length ? raw : searchLegalSources("산업안전보건법")
    );
    // enhanceLegalEvidenceMappings: optional quality pass, runs in parallel, best-effort.
    const citationsPromise = rawCitationsBasePromise.then((base) =>
      enhanceLegalEvidenceMappings(question, base, options.phaseAGrounding).catch((error) => {
        log.error(
```

**Sink evidence** — `lib/search.ts:2251-2256`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const safetyReferencePromise = (async () => {
      const [supportReg, guideline, sifSearch, general] = await Promise.all([
        safeSearch({ query: question, limit: 3, itemType: "technical-support-regulation" }),
        safeSearch({ query: question, limit: 3, itemType: "technical-guideline" }),
        safeSearch({ query: question, limit: 3, itemType: "sif-case" }),
        safeSearch({ query: question, limit: 5 })
```

**Sink evidence** — `lib/search.ts:2317-2334`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    // Fix 6: Start full-mode deliverables generation as a Promise BEFORE awaiting allSettled.
    // Scenario is derived synchronously from the question (inferScenario is pure).
    // We chain off rawCitationsBasePromise/weather/training/kosha/accident so the
    // full-mode Vertex calls start as soon as those resolve (~2-5s), running
    // fully in parallel with responsePromise's Vertex call. Enhanced mode is
    // row-first: DB/SIF/KOSHA/photo harness rows are assembled deterministically.
    const earlyScenario = inferScenario(question);
    const earlyScenarioParsed = {
      companyName: earlyScenario.companyName,
      companyType: earlyScenario.companyType,
      siteName: earlyScenario.siteName,
      workSummary: earlyScenario.workSummary,
      workerCount: earlyScenario.workerCount,
      weatherNote: earlyScenario.weatherNote
    };
    const deliverablesPromise: Promise<{ deliverables: Awaited<ReturnType<typeof generateAllDeliverables>>; diagnostics: Awaited<ReturnType<typeof generateAllDeliverablesWithDiagnostics>>["diagnostics"] } | null> =
      aiMode === "full"
        ? Promise.all([
```

#### Validation

Public ask entrypoints accept unbounded question text and one accepted request reaches multiple database, public-data, reference, weather, and model operations. The IP limiter bounds request count but not per-request work or input size.

Validation method: static source/control/sink trace plus focused existing tests

**Entrypoint evidence** — `lib/search.ts:2118`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function runAsk(question: string, options: RunAskOptions = {}): Promise<AskResponse> {
```

**Sink evidence** — `lib/search.ts:2169-2186`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const accidentCasesPromise = fetchAccidentCases(question, {
      requestTimeoutMs: 5_000,
      retryCount: 0,
      budgetLabel: "KOSHA accident case enrichment budget"
    });

    // Fix 5: decouple enhance and generateAnswer — both branch off rawCitations in parallel.
    // enhanceLegalEvidenceMappings is a quality add-on (AI reorders citations); it no longer
    // gates generateAnswer. generateAnswer starts as soon as raw citations arrive.
    // citationsPromise resolves to enhanced citations when available (best-effort).
    const rawCitationsPromise = searchLegalSources(question);
    const rawCitationsBasePromise = rawCitationsPromise.then(async (raw) =>
      raw.length ? raw : searchLegalSources("산업안전보건법")
    );
    // enhanceLegalEvidenceMappings: optional quality pass, runs in parallel, best-effort.
    const citationsPromise = rawCitationsBasePromise.then((base) =>
      enhanceLegalEvidenceMappings(question, base, options.phaseAGrounding).catch((error) => {
        log.error(
```

**Sink evidence** — `lib/search.ts:2251-2256`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const safetyReferencePromise = (async () => {
      const [supportReg, guideline, sifSearch, general] = await Promise.all([
        safeSearch({ query: question, limit: 3, itemType: "technical-support-regulation" }),
        safeSearch({ query: question, limit: 3, itemType: "technical-guideline" }),
        safeSearch({ query: question, limit: 3, itemType: "sif-case" }),
        safeSearch({ query: question, limit: 5 })
```

**Sink evidence** — `lib/search.ts:2317-2334`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    // Fix 6: Start full-mode deliverables generation as a Promise BEFORE awaiting allSettled.
    // Scenario is derived synchronously from the question (inferScenario is pure).
    // We chain off rawCitationsBasePromise/weather/training/kosha/accident so the
    // full-mode Vertex calls start as soon as those resolve (~2-5s), running
    // fully in parallel with responsePromise's Vertex call. Enhanced mode is
    // row-first: DB/SIF/KOSHA/photo harness rows are assembled deterministically.
    const earlyScenario = inferScenario(question);
    const earlyScenarioParsed = {
      companyName: earlyScenario.companyName,
      companyType: earlyScenario.companyType,
      siteName: earlyScenario.siteName,
      workSummary: earlyScenario.workSummary,
      workerCount: earlyScenario.workerCount,
      weatherNote: earlyScenario.weatherNote
    };
    const deliverablesPromise: Promise<{ deliverables: Awaited<ReturnType<typeof generateAllDeliverables>>; diagnostics: Awaited<ReturnType<typeof generateAllDeliverablesWithDiagnostics>>["diagnostics"] } | null> =
      aiMode === "full"
        ? Promise.all([
```

Evidence:
- app/api/ask/route.ts and stream/route.ts pass question to runAsk after only a soft per-instance IP limiter.
- lib/search.ts:2118 onward fans the question into multiple searches and generation paths.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- A rate limiter exists, so this is not an entirely uncontrolled endpoint; however it does not impose a question length or downstream operation budget.
- Exact provider fan-out varies by AI mode, configuration, cache state, and fallback behavior; no cost-amplification load test was run.

#### Dataflow

Public ask/stream question -\> runAsk -\> database/reference/weather/provider fan-out -\> optional full-mode document generation.

- **Source:** Public ask question and AI mode.

- **Sink:** Multi-provider/search/model runAsk pipeline.

- **Outcome:** medium

**Entrypoint evidence** — `lib/search.ts:2118`

This entrypoint carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
export async function runAsk(question: string, options: RunAskOptions = {}): Promise<AskResponse> {
```

**Sink evidence** — `lib/search.ts:2169-2186`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const accidentCasesPromise = fetchAccidentCases(question, {
      requestTimeoutMs: 5_000,
      retryCount: 0,
      budgetLabel: "KOSHA accident case enrichment budget"
    });

    // Fix 5: decouple enhance and generateAnswer — both branch off rawCitations in parallel.
    // enhanceLegalEvidenceMappings is a quality add-on (AI reorders citations); it no longer
    // gates generateAnswer. generateAnswer starts as soon as raw citations arrive.
    // citationsPromise resolves to enhanced citations when available (best-effort).
    const rawCitationsPromise = searchLegalSources(question);
    const rawCitationsBasePromise = rawCitationsPromise.then(async (raw) =>
      raw.length ? raw : searchLegalSources("산업안전보건법")
    );
    // enhanceLegalEvidenceMappings: optional quality pass, runs in parallel, best-effort.
    const citationsPromise = rawCitationsBasePromise.then((base) =>
      enhanceLegalEvidenceMappings(question, base, options.phaseAGrounding).catch((error) => {
        log.error(
```

**Sink evidence** — `lib/search.ts:2251-2256`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    const safetyReferencePromise = (async () => {
      const [supportReg, guideline, sifSearch, general] = await Promise.all([
        safeSearch({ query: question, limit: 3, itemType: "technical-support-regulation" }),
        safeSearch({ query: question, limit: 3, itemType: "technical-guideline" }),
        safeSearch({ query: question, limit: 3, itemType: "sif-case" }),
        safeSearch({ query: question, limit: 5 })
```

**Sink evidence** — `lib/search.ts:2317-2334`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
    // Fix 6: Start full-mode deliverables generation as a Promise BEFORE awaiting allSettled.
    // Scenario is derived synchronously from the question (inferScenario is pure).
    // We chain off rawCitationsBasePromise/weather/training/kosha/accident so the
    // full-mode Vertex calls start as soon as those resolve (~2-5s), running
    // fully in parallel with responsePromise's Vertex call. Enhanced mode is
    // row-first: DB/SIF/KOSHA/photo harness rows are assembled deterministically.
    const earlyScenario = inferScenario(question);
    const earlyScenarioParsed = {
      companyName: earlyScenario.companyName,
      companyType: earlyScenario.companyType,
      siteName: earlyScenario.siteName,
      workSummary: earlyScenario.workSummary,
      workerCount: earlyScenario.workerCount,
      weatherNote: earlyScenario.weatherNote
    };
    const deliverablesPromise: Promise<{ deliverables: Awaited<ReturnType<typeof generateAllDeliverables>>; diagnostics: Awaited<ReturnType<typeof generateAllDeliverablesWithDiagnostics>>["diagnostics"] } | null> =
      aiMode === "full"
        ? Promise.all([
```

#### Reachability

Accepted public requests reach multiple downstream operations, but a soft per-instance IP request limiter already reduces repeated use from one normalized source.

- **Attacker:** Unauthenticated internet caller

- **Entry point:** lib/search.ts

- **Outcome:** medium

Preconditions:
- At least one costly provider or database integration is configured.

#### Severity

**Low** — One accepted request can amplify work across providers, but current controls and configuration-dependent fan-out make sustained material impact less likely; the policy matrix maps medium impact and medium likelihood to low.

Raise if durable testing shows accepted requests reliably trigger costly full fan-out and bypass the soft limiter at scale; lower or ignore if platform body limits and provider-disabled modes make incremental cost negligible.

#### Remediation

Set a byte and character limit before `runAsk`, reject oversized harness memory, and enforce a durable tenant or anonymous quota that covers all downstream provider calls rather than only per-instance request count.

Tests:
- Verify oversized questions and harness-memory payloads fail before `runAsk`.
- Verify one logical request consumes a bounded downstream-call budget.

Preventive controls:
- Use a distributed quota for serverless public generation.

<a id="finding-17"></a>

### [17] Workpack archive can disclose site metadata from another tenant

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Workpack RLS constrains organization_id ownership but not site_id ownership. An authenticated owner can create an own-organization workpack referencing an existing foreign site UUID; the service-role archive then fetches site metadata by that UUID without an organization predicate. |
| Category | Authorization bypass / IDOR |
| CWE | CWE-639 |
| Affected lines | app/api/workpacks/route.ts:112-115, app/api/workpacks/route.ts:124-143, supabase/migrations/002_workspace_productization.sql:44-47, supabase/migrations/002_workspace_productization.sql:149-164 |

#### Summary

Workpack archive resolves site metadata by site_id without constraining the site to an organization owned by the caller, allowing cross-tenant site metadata disclosure through a mismatched workpack reference.

#### Root Cause

GET first limits workpacks to caller-owned organization_ids, but then collects their site_id values and queries sites only with .in("id", siteIds). The schema has independent foreign keys for workpacks.organization_id and workpacks.site_id, and the workpacks RLS WITH CHECK validates only organization ownership. An authenticated tenant can therefore insert or update an own-organization workpack whose site_id names another tenant site; this service-role route then returns that site name, industry, and region.

**Root Control evidence** — `app/api/workpacks/route.ts:112-115`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const siteIds = Array.from(new Set((workpacks || []).map((workpack) => workpack.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name,industry,region").in("id", siteIds)
    : { data: [], error: null };
```

**Sink evidence** — `app/api/workpacks/route.ts:124-141`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const archiveWorkpacks = (workpacks || []).map((workpack) => {
    const site = workpack.site_id ? siteMap.get(workpack.site_id) : null;
    const encodedId = encodeURIComponent(workpack.id);
    return {
      id: workpack.id,
      organizationName: organizationMap.get(workpack.organization_id) || "SafeClaw Pilot",
      siteName: site?.name || "기본 현장",
      industry: site?.industry || null,
      region: site?.region || null,
      question: workpack.question,
      scenario: workpack.scenario,
      documentKeys: documentKeysFromDeliverables(workpack.deliverables),
      workerSummary: workpack.worker_summary,
      status: workpack.status,
      createdAt: workpack.created_at,
      updatedAt: workpack.updated_at,
      lastGeneratedAt: workpack.updated_at || workpack.created_at,
      reopenHref: `/documents?workpackId=${encodedId}`,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:44-47`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create table if not exists workpacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:149-164`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create policy "owners can manage workpacks"
  on workpacks for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  );
```

#### Validation

Workpack RLS constrains organization_id ownership but not site_id ownership. An authenticated owner can create an own-organization workpack referencing an existing foreign site UUID; the service-role archive then fetches site metadata by that UUID without an organization predicate.

Validation method: static source/control/sink trace plus focused existing tests

**Root Control evidence** — `app/api/workpacks/route.ts:112-115`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const siteIds = Array.from(new Set((workpacks || []).map((workpack) => workpack.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name,industry,region").in("id", siteIds)
    : { data: [], error: null };
```

**Sink evidence** — `app/api/workpacks/route.ts:124-141`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const archiveWorkpacks = (workpacks || []).map((workpack) => {
    const site = workpack.site_id ? siteMap.get(workpack.site_id) : null;
    const encodedId = encodeURIComponent(workpack.id);
    return {
      id: workpack.id,
      organizationName: organizationMap.get(workpack.organization_id) || "SafeClaw Pilot",
      siteName: site?.name || "기본 현장",
      industry: site?.industry || null,
      region: site?.region || null,
      question: workpack.question,
      scenario: workpack.scenario,
      documentKeys: documentKeysFromDeliverables(workpack.deliverables),
      workerSummary: workpack.worker_summary,
      status: workpack.status,
      createdAt: workpack.created_at,
      updatedAt: workpack.updated_at,
      lastGeneratedAt: workpack.updated_at || workpack.created_at,
      reopenHref: `/documents?workpackId=${encodedId}`,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:44-47`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create table if not exists workpacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:149-164`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create policy "owners can manage workpacks"
  on workpacks for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  );
```

Evidence:
- supabase/migrations/002_workspace_productization.sql defines independent foreign keys and checks only workpacks.organization_id in RLS.
- app/api/workpacks/route.ts first scopes workpacks by owned organizations, then queries sites solely with .in("id", siteIds) and returns name, industry, and region.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- UUID entropy is a precondition, not an authorization control. No composite foreign key, trigger, RLS site-organization check, or route-level organization filter closes this path.
- No live cross-tenant row was created; the proof is static because exercising it would require prohibited data mutation.

#### Dataflow

Authenticated organization owner creates/updates own workpack with foreign site UUID -\> archive GET scopes workpack by owned organization -\> service-role site lookup by site_id alone -\> foreign name/industry/region returned.

- **Source:** Authenticated tenant workpack insert/update with a foreign site_id.

- **Sink:** Service-role site metadata query and archive response.

- **Outcome:** low

**Root Control evidence** — `app/api/workpacks/route.ts:112-115`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const siteIds = Array.from(new Set((workpacks || []).map((workpack) => workpack.site_id).filter((id): id is string => Boolean(id))));
  const { data: sites, error: siteError } = siteIds.length
    ? await client.from("sites").select("id,name,industry,region").in("id", siteIds)
    : { data: [], error: null };
```

**Sink evidence** — `app/api/workpacks/route.ts:124-141`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  const archiveWorkpacks = (workpacks || []).map((workpack) => {
    const site = workpack.site_id ? siteMap.get(workpack.site_id) : null;
    const encodedId = encodeURIComponent(workpack.id);
    return {
      id: workpack.id,
      organizationName: organizationMap.get(workpack.organization_id) || "SafeClaw Pilot",
      siteName: site?.name || "기본 현장",
      industry: site?.industry || null,
      region: site?.region || null,
      question: workpack.question,
      scenario: workpack.scenario,
      documentKeys: documentKeysFromDeliverables(workpack.deliverables),
      workerSummary: workpack.worker_summary,
      status: workpack.status,
      createdAt: workpack.created_at,
      updatedAt: workpack.updated_at,
      lastGeneratedAt: workpack.updated_at || workpack.created_at,
      reopenHref: `/documents?workpackId=${encodedId}`,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:44-47`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create table if not exists workpacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
```

**Evidence evidence** — `supabase/migrations/002_workspace_productization.sql:149-164`

This evidence carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```text
create policy "owners can manage workpacks"
  on workpacks for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  );
```

#### Reachability

The route is reachable to an authenticated workspace user and the schema/RLS permits the mismatched relationship; exploitation requires obtaining a valid foreign site UUID.

- **Attacker:** Authenticated tenant user with direct workpack write capability

- **Entry point:** app/api/workpacks/route.ts

- **Outcome:** low

Preconditions:
- Attacker knows or obtains a valid foreign site UUID.

#### Severity

**Low** — This is a real cross-tenant read through service-role access, but only low-sensitivity site metadata is exposed and a target UUID is required.

Raise if foreign site UUIDs are enumerable or the archive response expands to contacts/private safety data; ignore if a composite constraint or route predicate enforces site.organization_id membership.

#### Remediation

Constrain the site enrichment query by both `site_id` and the already authorized organization IDs. Also enforce a database invariant or trigger ensuring every workpack `site_id` belongs to its `organization_id`.

Tests:
- Create a mismatched workpack/site fixture and verify archive enrichment returns no foreign site metadata.
- Add a schema-level relationship test for site and organization consistency.

Preventive controls:
- Centralize organization-scoped site lookups for service-role routes.

<a id="finding-18"></a>

### [18] Single-document CSV export permits spreadsheet formula injection

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes. |
| Category | Spreadsheet formula injection |
| CWE | CWE-1236 |
| Affected lines | components/WorkpackEditor.tsx:1814-1823, components/WorkpackEditor.tsx:3626-3628 |

#### Summary

Single-document CSV export does not neutralize spreadsheet formulas.

#### Root Cause

User-editable document, section, item, and content values are only CSV-quoted. Values beginning with =, +, -, or @ remain formula-capable when the downloaded CSV is opened in spreadsheet software.

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3626-3628`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadCsv() {
    const rows = buildRowsForDocument(selected, values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
```

#### Validation

Editable or generated workpack strings flow unchanged through buildDelimited into an independently triggerable spreadsheet import surface; the only transformations quote CSV or remove TSV tabs/newlines and do not neutralize formula prefixes.

Validation method: static source/control/sink trace plus focused existing tests

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3626-3628`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadCsv() {
    const rows = buildRowsForDocument(selected, values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
```

Evidence:
- components/WorkpackEditor.tsx:1818-1823 preserves leading =, +, -, and @ characters.
- Single-document CSV download reaches that helper and emits or copies spreadsheet-importable text.
- Focused existing Vitest suites passed: 7 files, 102 tests (knowledge regeneration, workpack remediation, XLSX/HWP export, public share authority and tenant hardening, briefing).

Counterevidence and remaining uncertainty:
- No formula-neutralization helper or spreadsheet-safe prefix is applied on this path. Existing CSV neutralization coverage belongs to a different reporting export implementation.
- The exact spreadsheet application and its formula-evaluation policy affect exploit behavior, but the emitted cells remain formula-capable.

#### Dataflow

Editable/generated document cells -\> buildDelimited CSV quoting -\> single-document CSV download -\> victim opens/imports file.

- **Source:** User-edited and generated workpack row values.

- **Sink:** Single-document CSV download

- **Outcome:** low

**Root Control evidence** — `components/WorkpackEditor.tsx:1814-1823`

This root_control carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
function escapeCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildDelimited(rows: SheetRow[], delimiter: "," | "\t") {
  const header = ["문서", "섹션", "항목", "내용"];
  const body = rows.map((row) => [row.document, row.section, row.item, row.content]
    .map((value) => delimiter === "," ? escapeCell(value) : value.replace(/\t/g, " ").replace(/\r?\n/g, " "))
    .join(delimiter));
  return [header.join(delimiter), ...body].join("\n");
```

**Sink evidence** — `components/WorkpackEditor.tsx:3626-3628`

This sink carries the candidate's attacker-controlled value or missing control along the validated source-to-sink path.

```typescript
  function downloadCsv() {
    const rows = buildRowsForDocument(selected, values);
    downloadBlob(new Blob([`\uFEFF${buildDelimited(rows, ",")}`], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
```

#### Reachability

The single-document CSV mode is independently triggerable and formula-leading document, section, item, and content fields reach the artifact unchanged.

- **Attacker:** Actor able to influence exported workpack text

- **Entry point:** components/WorkpackEditor.tsx

- **Outcome:** low

Preconditions:
- A victim imports/pastes the exported content into formula-evaluating spreadsheet software.

#### Severity

**Low** — Formula-capable cells create a low-impact artifact injection risk because exploitation depends on victim import behavior and no stronger confidentiality or authorization impact is evidenced.

Raise if another tenant or lower-privileged actor can persist the exported fields for a privileged victim and supported formulas can exfiltrate data; ignore if supported clients neutralize formulas.

#### Remediation

Route every CSV and TSV cell through one formula-neutralization helper before quoting or joining. Prefix cells whose first significant character is `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe, and preserve the original value only in non-spreadsheet formats.

Tests:
- Add a regression test for `downloadCsv` showing formula-leading editable content is emitted as inert text.
- Cover leading whitespace and tab/carriage-return formula prefixes.

Preventive controls:
- Use one shared delimited-cell encoder for every CSV, TSV, download, and clipboard mode.
- Keep export-specific security fixtures for spreadsheet applications.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Tenant and object authorization | Cross-tenant reads and writes through service-role or RLS gaps | Reported | Briefing ownership reuse and workpack/site relationship binding produced reportable findings. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/02_discovery/raw_dispatch.coverage.md, artifacts/02_discovery/raw_supabase.coverage.md, artifacts/03_coverage/repository_coverage_ledger.md |
| Public AI, search, and weather workloads | Provider cost and service availability | Reported | Public provider and upstream fan-out paths lack durable or per-request work budgets. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/02_discovery/raw_public_ai.coverage.md, artifacts/02_discovery/raw_photo_network.coverage.md, artifacts/03_coverage/repository_coverage_ledger.md |
| CSV, TSV, XLSX, and HWP exports | Spreadsheet formula injection and resource exhaustion | Reported | Four delimited export modes and eight in-memory document-generation modes survived validation. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/02_discovery/raw_exports.coverage.md, artifacts/03_coverage/repository_coverage_ledger.md |
| Public Share capability and read confirmations | Bearer capability authorization and confirmation integrity | Rejected | The sessionId plus workerId pair is the intentional high-entropy recipient capability. The duplicate confirmation race remains a data-integrity issue but has no present security-gate impact. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/02_discovery/raw_share.coverage.md, artifacts/03_coverage/repository_coverage_ledger.md |
| Agent, MCP, and privileged token boundaries | Authentication, scope, replay, and tool authorization | No issue found | A focused auth and agent review found no surviving candidate; 161 relevant tests passed during discovery. Evidence: artifacts/02_discovery/file_review_receipts.jsonl, artifacts/02_discovery/raw_agent.coverage.md, artifacts/02_discovery/route_auth_inventory.json, artifacts/03_coverage/repository_coverage_ledger.md |
| HTML, file, archive, and secret-handling surfaces | XSS, unsafe file operations, and credential exposure | No issue found | Pattern review and manual triage found no credible surviving XSS, archive-path, command-execution, or secret candidate. Evidence: artifacts/02_discovery/file_review_receipts.jsonl, artifacts/02_discovery/automated_hits.txt, artifacts/03_coverage/repository_coverage_ledger.md |
| Repository-wide file inventory | Coverage completeness | No issue found | All 4,772 in-scope files were accounted for: 766 source text, 191 structured/document text, 2,495 generated evidence text, 1,309 binary files metadata-accounted, and 11 other files. Evidence: artifacts/02_discovery/in_scope_files.txt, artifacts/02_discovery/file_classification_summary.json, artifacts/02_discovery/file_review_receipts.jsonl, artifacts/03_coverage/repository_coverage_ledger.md |

## Open Questions And Follow Up

- What durable global quotas exist outside the repository for public AI, weather, and export routes?
  - Follow-up prompt: At revision 47b07b6aff72ced25e8c1884ecd16f010e1fc170, verify Vercel and provider-side body, concurrency, and spend controls for /api/ask, /api/knowledge/regenerate, /api/workpack/remediate, /api/weather, /api/export/xlsx, and /api/export/hwp.
- Can untrusted or shared workpack text reach a different operator's spreadsheet export workflow?
  - Follow-up prompt: At revision 47b07b6aff72ced25e8c1884ecd16f010e1fc170, trace attacker-to-victim provenance for WorkpackEditor CSV and TSV exports and validate formula execution in the supported spreadsheet applications.
- Will read confirmations become a legal, billing, or safety-release gate?
  - Follow-up prompt: If confirmations become authorization-relevant, add a database unique constraint and authenticated or recipient-specific proof before relying on them.
