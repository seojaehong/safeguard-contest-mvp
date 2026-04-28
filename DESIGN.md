# SafeGuard DESIGN.md

## Visual Theme & Atmosphere

SafeGuard should feel like a serious field operations workspace, not a contest landing page. The product combines the precision of developer tooling, the calm of document editors, and the structure of inspection checklists.

Use a `field command center` metaphor:
- The first screen is a working console for today's job, not a marketing hero.
- Cards should feel like paper forms and inspection panels.
- Data status should be calm and operational: `연결됨`, `일부 근거 보류`, `연결 점검 필요`.
- Avoid demo language, hype claims, playful badges, and visible implementation words such as mock or fallback.

## Color Palette & Roles

| Token | Color | Role |
|---|---|---|
| Ink | `#171b22` | Primary text, main CTA, high-trust anchors |
| Field Green | `#21594f` | Safety action, verified state, section accent |
| Warm Clay | `#b85f24` | Urgent action, numbered steps, attention |
| Paper | `#fffdf8` | Main card surface |
| Worksite Sand | `#f6f3ed` | App background |
| Line | `#e2ded5` | Form borders, table borders |
| Muted Slate | `#667085` | Secondary text |
| Soft Green | `#e8f1ed` | Selected state, verified chip |
| Warning Soft | `#fff0df` | Connection warning, incomplete setup |

## Typography Rules

- Primary UI font: `Pretendard`, `Noto Sans KR`, `Malgun Gothic`, system fallback.
- Use heavy Korean headings only for actual workflow titles.
- Use compact labels and section headers for operational density.
- Avoid huge slogan-style text except the main product title.
- Tables and exported forms should prioritize legibility over branding.

## Component Styling

- Buttons: rounded pill buttons, black primary, white secondary with border.
- Cards: large radius, paper-white or lightly tinted surfaces, subtle shadow.
- Inputs: large text areas with quiet borders, high readability, no neon focus states.
- Status chips: always operational language, never implementation language.
- Document tabs: left rail, clear title + one-line purpose.
- Reference cards: link-like cards with source, why it matters, and reflected document.

## Layout Principles

- Default desktop layout: 3-column command workspace at top, then document editor.
- Mobile layout: single-column, keep command input first and download actions close to editor.
- Keep the work flow order fixed:
  1. 현장 상황 입력
  2. 오늘 작업 요약
  3. 즉시 조치
  4. 문서팩 편집
  5. 근거 확인
  6. 현장 전파
- Prefer dense but readable panels over oversized marketing sections.

## Depth & Elevation

- Use soft shadows only to separate work surfaces.
- Avoid glassmorphism-heavy or dark-first styling.
- The product should feel deployable inside a public/industrial organization.

## Do's and Don'ts

Do:
- Show real operational states.
- Make every generated document editable.
- Keep source evidence close to the document it supports.
- Use sheet-like output structures for inspection-ready exports.
- Treat foreign-worker communication as a first-class workflow.

Don't:
- Show `demo`, `mock`, `fallback`, `contest`, or `golden path` in user-facing UI.
- Use purple default SaaS gradients.
- Use marketing superlatives.
- Hide API uncertainty; translate it into operational status.
- Copy any brand identity from external design references.

## Responsive Behavior

- Collapse all multi-column panels to one column below tablet width.
- Keep touch targets at least 42px high.
- Keep language chips and channel chips wrap-friendly.
- Document editor text area should remain the largest working surface on mobile.

## Agent Prompt Guide

When modifying UI, use this prompt:

> Build SafeGuard as an inspection-ready industrial safety workspace. Make it feel like Vercel/Linear-level precision applied to Korean field safety documents, with Notion/Airtable-like editable document surfaces. Remove demo language. Use operational status labels and keep the workflow from job input to document pack to evidence to field dispatch.

