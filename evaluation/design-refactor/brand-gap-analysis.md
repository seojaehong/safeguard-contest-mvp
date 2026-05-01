# SafeClaw Brand Gap Analysis

## Scope

- Target: `C:/Users/iceam/Downloads/safeclaw Brand Guide _standalone_.html`
- Current implementation: `/` landing page and shared SafeClaw CSS in `app/globals.css`
- Review mode: gap-analysis + grill-me. Questions that can be answered from files were answered from the codebase and guide.

## Findings

### 1. Font loading was not equivalent to the guide

- Guide uses `Pretendard` for Korean product copy and `Geist Mono` for HUD/numeric labels.
- App CSS declared `Pretendard` and `Geist Mono`, but only loaded Noto font families through Google Fonts.
- Impact: Chrome could render the headline with Noto or local fallback fonts, causing different width, weight, and line breaks from the design guide.
- Closure: Added explicit Pretendard and Geist Mono webfont imports.

### 2. Headline weight and spacing were stronger than the guide

- Guide headline reference: `font-weight: 800`, `letter-spacing: -0.045em`, `line-height: 0.98`.
- App headline before patch: `font-weight: 950`, `letter-spacing: -0.08em`, `line-height: 0.94`.
- Impact: the landing felt heavier and more compressed than the guide, especially at Chrome 80-100% zoom.
- Closure: Aligned landing display typography to guide-style weight, tracking, and line-height.

### 3. Yellow hazard mark was double-skewed

- Guide `.skew-mark` uses `transform: skewX(-6deg)` and does not use `font-style: italic`.
- App mark before patch used both `font-style: italic` and `transform: skewX(-4deg)`.
- Impact: the yellow cell text looked like an italic font plus a skewed container, which created the subtle mismatch reported in review.
- Closure: Removed true italic styling and matched the guide's skew behavior.

### 4. Highlight copy was too long for the visual rule

- Guide voice rule: short, firm sentences; split when more than one sentence is needed.
- App section copy had long phrases inside a single yellow mark, causing orphaned last syllables such as `다.` at narrow widths.
- Impact: large yellow rectangles with broken final syllables made the landing feel unstable.
- Closure: Shortened section copy and preserved intentional line breaks.

## Current Decision

- The yellow cell is a skewed hazard mark, not italic text.
- The production landing should use the guide's font stack and type rhythm rather than the heavier prototype fallback.
- Long value propositions belong in body copy, not inside the yellow mark.

## Verification Targets

- `/` should load Pretendard and Geist Mono.
- Hero lines should remain intentional: `오늘 작업을`, `안전 문서팩으로`, `정리합니다.`
- Section highlight copy should not split the final syllable into a separate line at ordinary desktop zoom.
- Build and typecheck must pass.
