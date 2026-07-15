# Ontology tablet overflow remediation

## Scope

- Base HEAD: `79e48daec4add10706068dd6a5705c4f5ca7d5f9`
- Branch: `fix/ontology-tablet-overflow-20260715`
- Owned files: ontology UI/CSS, focused ontology browser test, and this evaluation directory
- DB/schema, grounded generation, Hermes, and audit runner changes: none

## Reproduction and cause

The current HEAD reproduced the final browser-audit finding at both `1024x900` and `1024x768`:

- document scroll width: `1148px`
- body scroll width: `1148px`
- horizontal overflow: `124px`

At 1024px the module shell keeps its 224px rail. The ontology graph canvas still imposed `min-width: 860px`, which propagated a 912px minimum content width through the ontology grid and expanded the page beyond the viewport.

## TDD change

1. Added `tests/ontology-tablet-overflow.test.ts` for Day/Night at exactly `1024x768`.
2. Verified RED: both tests failed with `documentOverflow: 124`.
3. Added `min-width: 0` to the ontology grid root.
4. In the bounded `901px..1100px` tablet range, allowed the graph canvas to use available width and reduced graph cards to 120px.
5. Verified GREEN without hiding content or changing the audit runner.

The desktop graph remains visible at 1024px. Its expanded two-hop neighborhood still renders 15 nodes with no overlap. The mobile breakpoint remains unchanged and continues to use relation cards plus the fullscreen graph dialog.

## Verification

| Gate | Result |
|---|---|
| Tablet browser regression | 1 file, 2 tests passed |
| Focused ontology/unit/contracts | 13 files passed, 1 environment-gated file skipped; 136 tests passed, 1 skipped |
| Existing desktop/mobile ontology browser contract | 1 file, 1 test passed |
| Strict TypeScript typecheck | passed |
| Frontend static audit | passed; 32 pages, 23 components, 0 coverage issues, 0 violations |
| `git diff --check` | passed |

### Tablet metrics

| Theme | Document overflow | Body overflow | Outside elements | Nodes | Overlaps | Clipped nodes | Minimum control | Minimum node contrast |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Day | 0px | 0px | 0 | 15 | 0 | 0 | 44px | 16.01:1 |
| Night | 0px | 0px | 0 | 15 | 0 | 0 | 44px | 16.01:1 |

Existing 1440/390 browser coverage separately verified neighborhood maximum 15, overlap 0, AA contrast, mobile relation cards, fullscreen graph, and dialog focus trapping.

## Independent review remediation

The follow-up browser regression now scrolls the tablet graph into view and asserts the actual Day/Night product contract at 1024px: graph visible, 15 nodes, 0 overlap pairs, 0 clipped nodes, and minimum node contrast at least 4.5:1. The 1440/390 browser contract remains a separate gate.

The original report's `git diff --check` row described the working tree check but did not disclose that the exact committed range `79e48da..f580f5c` reported five new blank lines at EOF. This follow-up normalizes every committed text evidence file in this bounded evaluation directory. The fixed candidate is checked after commit with an exact immutable range, and that result is added by an evidence-only follow-up so the report does not claim a self-referential commit hash.

## Evidence

- `tablet-browser-metrics.json`
- `tablet-day.png`
- `tablet-night.png`
- `static-audit.json`
- `logs/tablet-browser-regression.log`
- `logs/tablet-browser-metrics.log`
- `logs/focused-ontology-tests.log`
- `logs/desktop-mobile-browser-contract.log`
- `logs/typecheck.log`
- `logs/static-audit.log`
- `logs/final-verification.log`
- `logs/follow-up-verification.log`
