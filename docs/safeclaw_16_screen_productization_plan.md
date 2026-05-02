# SafeClaw 16-Screen Productization Plan

## Decision

The designer prototype should not be treated as sixteen production routes. It should become the product blueprint for SafeClaw's operating system.

The current `/workspace` remains untouched for now. It is the working engine. The next design refactor wraps and extracts its features into SafeClaw product modules without breaking the existing document generation, API orchestration, export, evidence, and dispatch flows.

## Grill-Me Decision Tree

### Question 1. Do we build all sixteen screens exactly as separate pages?

Recommended answer: No.

Reason: `Landing A/B` and `Workspace A/B` are design alternatives, not separate user destinations. Shipping both as product screens creates duplicate navigation, duplicate QA, and confused positioning.

Decision:

- Keep `Landing A` as the public landing direction.
- Treat `Landing B` as demo or campaign variant, not a primary route.
- Keep `Workspace A` as the desktop manager workspace direction.
- Treat `Workspace B` as responsive/tablet layout guidance, not a separate product route.

### Question 2. What is the actual product screen set?

Recommended answer: 14 production modules, grouped by job-to-be-done.

| No | Product module | Source prototype screen | Existing implementation | Product route target | Status |
|---:|---|---|---|---|---|
| 1 | Public landing | Landing A | `/` | `/` | Live, needs final visual pass |
| 2 | Demo/campaign landing | Landing B | `/demo`, `/preview`, `/why` | `/demo` and campaign sections | Partial |
| 3 | Login / account entry | Login | Workspace storage copy only | `/login` | Missing |
| 4 | Home dashboard | Home Dashboard | none | `/home` or `/app` | Missing |
| 5 | Work command center | Workspace A | `/workspace` | `/workspace` | Live, keep untouched first |
| 6 | Responsive workspace pattern | Workspace B | mobile CSS fragments | Not separate route | Design system task |
| 7 | Document editor | Document Edit | `WorkpackEditor` inside `/workspace` | `/documents` later | Live inside workspace |
| 8 | Evidence library | Evidence Library | citation/evidence panels, `/knowledge`, `/law/[id]` | `/evidence` later | Partial |
| 9 | Workers and education | Workers / Education | worker cards inside workspace | `/workers` later | Partial |
| 10 | Field dispatch | Dispatch | `WorkflowSharePanel`, n8n endpoint | `/dispatch` later | Live for mail/SMS |
| 11 | Worker mobile view | Worker Mobile | foreign worker messages only | `/worker` later | Missing |
| 12 | TBM fullscreen | TBM Fullscreen | TBM document text only | `/tbm` later | Missing |
| 13 | Archive / history | Archive | Supabase APIs and local state | `/archive` later | Partial |
| 14 | Knowledge DB | Knowledge DB | `/knowledge`, ingest/match/regenerate APIs | `/knowledge` | Live, needs content depth |
| 15 | API operations | API Connection | `/dryrun`, smoke reports | `/ops/api` or `/dryrun` | Live as operator page |
| 16 | Settings | Settings | env/docs only | `/settings` later | Missing |

Production consolidation:

- `Landing A/B` become one landing route plus optional campaign/demo sections.
- `Workspace A/B` become one workspace route with responsive layout rules.
- The product still acknowledges all sixteen prototype screens, but implementation targets are fourteen modules plus two design variants.

### Question 3. What must stay working during refactor?

Recommended answer: the existing `/workspace` engine is frozen until the shell migration is ready.

Do not break:

- Work prompt input.
- Weather prefetch and `/api/ask` orchestration.
- Document pack generation.
- Workpack editor.
- Evidence/citation rendering.
- Excel, HWPX, PDF, text exports.
- Worker language selection.
- Mail/SMS dispatch through n8n.
- Knowledge DB routes and APIs.

### Question 4. What is the first implementation slice?

Recommended answer: build route-level product shells around existing features before moving logic.

Phase 1 should not rewrite business logic. It should introduce navigation and screen ownership:

1. Add a SafeClaw app shell component shared by product routes.
2. Keep `/workspace` as the engine route.
3. Create lightweight route shells for `/home`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/settings`.
4. Each shell initially embeds or links to the working `/workspace` section.
5. Only after visual QA, extract components one by one.

This gives the site the product structure without destabilizing the working engine.

## Module-by-Module Closure Plan

### 1. Landing

Current: live at `/`.

Required closure:

- Final brand typography and hero layout pass.
- CTA split: `작업공간 열기`, `30초 데모`, `도입 문의`.
- Remove prototype-only labels from public landing.

### 2. Login

Current: not a full screen.

Required closure:

- Supabase OTP login UI.
- Guest mode vs manager mode copy.
- No secrets or env details exposed to end users.

### 3. Home Dashboard

Current: missing.

Required closure:

- Today's workpacks.
- Sites requiring action.
- Weather risk highlights.
- Failed dispatch / unconfirmed education.
- Recent workpack resume.

Minimum submission version:

- Local or Supabase-backed recent workpacks.
- Cards linking into `/workspace`.

### 4. Workspace

Current: live and functional.

Required closure:

- Keep unchanged until the app shell is stable.
- Later replace outer shell only.
- Preserve all current tests.

### 5. Document Editor

Current: live inside workspace.

Required closure:

- Route shell `/documents` can open selected workpack.
- Keep source-of-truth document state shared with workspace.
- Add explicit `편집`, `보완 생성`, `편집 후 삽입`, `바로 삽입` flow.

### 6. Evidence Library

Current: partial.

Required closure:

- Separate legal/KOSHA/accident/MSDS/media tabs.
- Show where each evidence item is reflected in documents.
- Fix broken links and empty states.
- Prefer seeded legal/KOSHA knowledge DB plus incremental API refresh.

### 7. Workers / Education

Current: partial.

Required closure:

- Worker list with role, nationality, language, education status, phone/email.
- No sensitive identity fields.
- Education confirmation linked to safety education record.
- Foreign-language dispatch defaults from worker language.

### 8. Dispatch

Current: mail/SMS live through n8n.

Required closure:

- Dedicated dispatch history screen.
- Per-channel status: sent, failed, unconfigured, skipped.
- Korean and foreign worker message variants.
- Kakao/Band locked until provider approval.

### 9. Worker Mobile

Current: missing.

Required closure:

- Mobile-only view with today's risk, stop-work rule, PPE, confirmation.
- Language toggle.
- No document editor.
- Optional QR entry from TBM screen.

### 10. TBM Fullscreen

Current: missing.

Required closure:

- Fullscreen readout for site TV/tablet.
- Three hazards, three questions, attendance/confirmation.
- Large type, no dense panels.

### 11. Archive

Current: partial via storage APIs.

Required closure:

- Search by site, date, work type, risk, worker, dispatch status.
- Open previous workpack.
- Duplicate previous workpack into today's delta input.

### 12. Knowledge DB

Current: live but needs depth.

Required closure:

- Seeded statute full text and KOSHA guide records.
- Incremental API refresh rather than relying only on live search.
- LLM regeneration uses citations from knowledge records.

### 13. API Operations

Current: `/dryrun` and smoke artifacts.

Required closure:

- Operator-facing health page.
- Public API status, last success, last failure reason.
- No raw secrets.

### 14. Settings

Current: missing.

Required closure:

- Organization/site defaults.
- Dispatch channels.
- Submission identity.
- Export preferences.
- Plan/upgrade labels later, not now.

## Implementation Phases

### Phase A. Product IA Lock

- Convert the `/prototype` page from visual gallery to product blueprint.
- Mark screens as `Live`, `Partial`, `Missing`, and `Variant`.
- Replace "16 screens" wording with "14 modules + 2 variants" where appropriate.
- Artifact: this document and `evaluation/design-refactor/prototype-productization-plan.json`.

### Phase B. Shell Routes Without Logic Migration

- Add route shells: `/home`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/settings`.
- Route shells display real status and link back to working `/workspace` sections.
- No business logic extraction yet.

### Phase C. Component Extraction

- Move document editor, evidence, workers, dispatch panels into reusable components.
- `/workspace` and new routes consume the same components.
- Keep all current E2E smoke tests green.

### Phase D. Missing Field Screens

- Build `/worker` mobile view.
- Build `/tbm` fullscreen view.
- Connect both to generated workpack state.

### Phase E. Operations Layer

- Archive/history search.
- API health.
- Settings.
- Knowledge DB refresh workflow.

## Submission Gate

For the next submission-grade cut, SafeClaw should show:

- Public landing.
- Working `/workspace`.
- Product blueprint page with honest module statuses.
- At least one route shell for each missing module, even if it links back to the working engine.
- Evidence that mail/SMS dispatch, exports, knowledge DB, and API orchestration are working.

This is the honest middle ground: not pretending the 16-screen prototype is fully implemented, but turning it into a credible product system plan and migration map.
