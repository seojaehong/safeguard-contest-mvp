# SafeClaw Frontend Consistency Audit Design

## Objective

Make every user-visible SafeClaw surface visually coherent without changing backend contracts, database schemas, or business behavior. The pass covers product pages, authenticated and internal operations pages, demo and prototype routes, special framework states, responsive layouts, Day/Night workspace themes, and generated print or document surfaces.

The final source of truth is `docs/safeclaw_brand_design_guide.md`, which defines SafeClaw as a field operations instrument: steel-neutral surfaces, Hazard Yellow for primary action and urgent signals, 4px corners, no decorative shadows, Pretendard for Korean product copy, and Geist Mono for numeric, source, status, and HUD labels.

## Current Evidence

- 32 App Router page files are user-visible or can render in a browser.
- 22 shared component files participate in those routes.
- `app/globals.css` contains 11,945 lines, approximately 1,515 selectors, 316 `!important` declarations, 421 font-size declarations, 187 line-height declarations, 180 letter-spacing declarations, and 94 font-family declarations.
- Earlier browser QA concentrated on `/workspace`; supporting routes and generated documents have not received an equivalent route-by-route consistency pass.
- Previous brand reports explicitly left legacy soft-demo declarations in place behind later cascade guards. This pass removes confirmed obsolete rules instead of adding another global override layer.

## Scope

### Browser routes

The audit includes:

- `/`, `/home`, `/workspace`, `/reports`
- `/archive`, `/ask`, `/documents`, `/dispatch`, `/evidence`, `/evidence-file`
- `/knowledge`, `/knowledge/[section]/[slug]`, `/search`, `/ontology`, `/tbm`
- `/worker`, `/workers`, `/settings`, `/settings/ai-connect`
- `/why`, `/trust`, `/roadmap`, `/login`, `/auth/callback`
- `/law/[id]`, `/interpretation/[id]`, `/precedent/[id]`
- `/demo`, `/preview`, `/prototype`, `/dryrun`, `/ops/api`
- `not-found`, `error`, `global-error`, and route loading states

Dynamic routes will be exercised with repository fixtures or representative identifiers. A route that cannot render without external state remains in the matrix with its observable fallback, empty, or error state.

### Generated surfaces

- Document editor and document preview typography
- Printable workpack HTML
- PDF export HTML and browser-print output
- Multilingual worker messages and document content
- Tables, approval blocks, signatures, citations, and evidence rails

Generated documents retain a document-appropriate font fallback where renderer support requires it. They do not inherit arbitrary product UI typography.

### Out of scope

- Database schema or data mutation
- API response or persistence contract changes
- Rewriting workflow behavior
- Rebranding beyond the approved SafeClaw guide
- Removing routes or features solely because they are legacy

## Design Architecture

### 1. Canonical typography roles

Use four explicit roles:

1. `product`: Pretendard-first stack for Korean commands, navigation, labels, and body copy.
2. `hud`: Geist Mono-first stack for status, telemetry, sources, identifiers, and numeric readouts.
3. `multilingual`: Noto multilingual fallbacks for worker-facing messages.
4. `document`: print-safe Korean fallback for generated documents and tables.

Typography values are limited to named semantic tiers rather than per-selector invention:

- display and hero
- page title and section title
- component title
- body large, body, and supporting copy
- caption and micro/HUD label
- document title, document body, document table, and document note

Body tracking defaults to `0`. Negative tracking is reserved for large display headings. Positive tracking is reserved for short uppercase HUD labels. Line-height tiers distinguish display, compact UI, normal body, long-form body, and document text.

#### Screen typography specification

Screen typography uses CSS pixels and unitless line-height. Points are reserved for generated print documents.

| Role | Family | Size | Weight | Line height | Tracking | Use |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Display | Pretendard | `clamp(44px, 6vw, 72px)` | 800 | `0.98` | `-0.045em` | Landing hero only |
| Page title | Pretendard | `clamp(32px, 4vw, 40px)` | 800 | `1.15` | `-0.035em` | One primary title per page |
| Section title | Pretendard | `clamp(24px, 3vw, 28px)` | 800 | `1.25` | `-0.025em` | Major page sections |
| Component title | Pretendard | `20px` | 700 | `1.35` | `-0.015em` | Cards, panels, dialogs |
| Body large | Pretendard | `17px` | 500 | `1.65` | `0` | Introductory and high-emphasis prose |
| Body | Pretendard | `15px` | 500 | `1.60` | `0` | Default product copy |
| Support | Pretendard | `14px` | 500 | `1.60` | `0` | Helper text and secondary content |
| Control | Pretendard | `14px` | 700 | `20px` | `0` | Buttons, inputs, tabs, navigation |
| Table body | Pretendard | `13px` | 500 | `20px` | `0` | Product data tables |
| Table header | Pretendard | `12px` | 700 | `18px` | `0.04em` | Product table headings |
| Caption | Pretendard | `12px` | 600 | `18px` | `0` | Captions and compact metadata |
| HUD | Geist Mono | `11px` | 700 | `16px` | `0.08em` | Short uppercase status/source labels |

- Text smaller than `11px` is not allowed in product UI.
- Body, support, control, table body, and caption text always use `letter-spacing: 0`.
- Negative tracking is allowed only for display, page title, section title, and component title.
- Positive tracking is allowed only for table headers and short HUD labels.
- Long-form knowledge and legal prose uses `15px / 1.75` with a maximum text measure of `72ch`.
- Mobile does not shrink body copy. Only display, page title, and section title change through their `clamp()` minimums.

#### Generated document typography specification

| Role | Family | Size | Weight | Line height | Tracking |
| --- | --- | ---: | ---: | ---: | ---: |
| Document title | Malgun Gothic / Noto Sans KR | `20pt` | 700 | `24pt` | `-0.02em` |
| Document section | Malgun Gothic / Noto Sans KR | `14pt` | 700 | `18pt` | `-0.01em` |
| Document body | Malgun Gothic / Noto Sans KR | `10pt` | 400 | `15pt` | `0` |
| Document table | Malgun Gothic / Noto Sans KR | `8.5pt` | 400 | `12pt` | `0` |
| Document table header | Malgun Gothic / Noto Sans KR | `8.5pt` | 700 | `12pt` | `0` |
| Document note | Malgun Gothic / Noto Sans KR | `8pt` | 400 | `11pt` | `0` |

Document density exceptions require a named class and a recorded reason in the audit; they cannot be anonymous local values.

### 2. Spacing and shape system

- Use the fixed spacing scale `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px`.
- Desktop page gutter is `24px`, tablet gutter is `20px`, and mobile gutter is `16px`.
- Default section separation is `48px` desktop and `32px` mobile.
- Default card/panel padding is `24px` desktop and `16px` mobile.
- Default grid gap is `16px`; dense row gap is `8px`; label-to-control gap is `8px`.
- Default button/input height is `44px`; compact secondary control height is `36px`; icon-only hit area is `44 × 44px`; textarea minimum height is `120px`.
- Product cards, panels, inputs, buttons, menus, dialogs, and tooltips use exactly `4px` radius.
- Micro status tags and inline code markers may use `2px` radius.
- Tables, document paper, progress rails, active side rails, and full-bleed structural regions use `0` radius.
- `50%` is allowed only for genuinely circular geometry such as a status dot or avatar.
- `999px` pill radius is not used for general buttons, tabs, cards, status rows, or navigation.
- Hazard Yellow is reserved for primary action, active progress, and urgent signals.
- Decorative gradients, large pill surfaces, and decorative shadows are removed from core product surfaces.

Normal borders are `1px`; keyboard focus is `2px`; the active operational rail is `4px`. Product surfaces do not use decorative box shadows. Modal separation uses a `rgba(10, 10, 11, 0.56)` scrim and a strong border instead of relying on shadow.

Inline icons are `16px`, control icons are `20px`, and section or empty-state icons are `24px`. Icon-to-label gap is `8px`. Emoji are not used as structural navigation or action icons; worker safety pictograms remain the documented exception.

#### Layout geometry specification

- Wide product container: maximum `1440px`.
- Standard content container: maximum `1200px`.
- Long-form reading measure: maximum `72ch`.
- Desktop workbench at `1280px` and above: `224px minmax(0, 1fr) 320px` with `16px` gaps.
- Tablet workbench from `768px` through `1279px`: main content plus one contextual rail; the secondary rail moves below the main content.
- Mobile below `768px`: one column, `16px` page gutter, no fixed-width child wider than the viewport.
- Two-column marketing or information sections use equal `minmax(0, 1fr)` tracks unless one side is a defined contextual rail.
- Three- and four-column card grids collapse to two columns below `1180px` and one column below `768px`.
- Text content aligns to an 8px baseline rhythm. Adjacent headings, descriptions, controls, and cards do not use arbitrary offsets to fake alignment.

### 3. Cascade strategy

Use a hybrid cleanup instead of a rewrite or a final override patch:

1. Define canonical font, type, spacing, radius, color, and control tokens at the beginning of the global style entrypoint.
2. Normalize base HTML and reusable shell/component behavior.
3. Map every selector to a live route or generated surface.
4. Replace divergent live declarations with semantic tokens.
5. Remove rules confirmed to be obsolete or superseded.
6. Keep feature-specific layout rules where their structure is intentional.

CSS may be split into a small number of purpose-based files only where it materially reduces cascade ambiguity. It must not become a new component abstraction project.

### 4. Shared component alignment

The pass standardizes common UI families before correcting isolated pages:

- application and module shells
- headers, navigation, breadcrumbs, and status bars
- primary, secondary, destructive, and icon-only controls
- forms, search inputs, textareas, validation, and disabled states
- cards, panels, empty states, loading states, and error states
- tables, tabs, badges, progress indicators, citations, and evidence items
- document preview, print layout, and multilingual message blocks

This ordering lets route-specific corrections inherit stable shared behavior.

## Audit and Verification

### Static inventory

Create a machine-readable route matrix recording each route, component family, theme, responsive state, typography role, and validation result. Static checks flag:

- undeclared font-family stacks
- font sizes, line heights, and tracking outside the approved tiers
- raw colors or radii that bypass semantic tokens
- unnecessary `!important` declarations
- touch targets below the product minimum
- missing focus, disabled, empty, error, or loading treatment

Generated-document styles are checked against the separate document token family rather than product UI rules.

### Browser verification

Render every route at representative desktop and mobile widths. Workspace and other theme-aware surfaces are tested in each exposed theme. Verification records:

- horizontal overflow
- font loading and fallback behavior
- heading hierarchy and wrapping
- spacing rhythm and alignment
- interactive focus, hover, active, disabled, loading, empty, and error states where reachable
- Day/Night contrast and semantic status visibility
- document preview and print readability

Screenshots are stored by route and viewport under `evaluation/frontend-consistency-audit-2026-07-11/`.

### Automated gates

- full unit test suite
- TypeScript typecheck
- production build
- route/static consistency audit
- browser console and page error scan
- screenshot and route coverage reconciliation

Completion requires every in-scope row to have a recorded result. An inaccessible dynamic or external-state route is not silently omitted; it is recorded with the tested fallback and the remaining dependency.

## Artifacts and Cross-Session Communication

The implementation branch is `feat/frontend-consistency-audit` in the isolated worktree `.worktrees/frontend-consistency-audit`.

A draft pull request is the coordination surface for the parallel backend session. Its description and updates will include:

- exact frontend-only scope
- backend and database non-goals
- shared files that may create merge conflicts
- current verification status
- route coverage totals
- screenshots and audit report paths

Required repository artifacts:

- `evaluation/frontend-consistency-audit-2026-07-11/report.md`
- `evaluation/frontend-consistency-audit-2026-07-11/report.json`
- route and viewport screenshots
- implementation plan under `docs/superpowers/plans/`

## Acceptance Criteria

- Every user-visible route and special framework state appears in the audit matrix.
- Every generated document surface appears in the separate typography matrix.
- Product, HUD, multilingual, and document typography roles are used consistently.
- Equivalent components share font size, line height, tracking, control height, padding, radius, and interaction states.
- Desktop and mobile captures have no unintended horizontal overflow or clipped primary content.
- Theme-aware surfaces are verified independently.
- No backend contract, database schema, or persistence behavior changes.
- Tests, typecheck, build, and browser audit pass, or each remaining external-state limitation is explicitly documented.
- The draft PR contains sufficient scope and conflict information for the parallel backend session.
