# SafeClaw Brand & Design Guide Implementation

SafeClaw is a field operation system for safety documents. The interface should feel like an instrument panel used before work starts, not a campaign landing page.

## Brand Essence

- Main promise: `현장 운영 체제. 실행 우선.`
- Product posture: short, firm, evidence-backed, and action-oriented.
- User expectation: the screen should help a field manager decide, document, transmit, and keep evidence.

## Visual Rules

- Hazard Yellow is reserved for primary action and urgent operation signals.
- Steel neutrals carry the interface: panels, borders, status rows, and secondary actions.
- Corners use 4px. Large pill cards and soft rounded demo panels should be avoided.
- Decorative shadows are not part of the system.
- Gradients are not used for core product surfaces.
- Korean is the main product voice. English or mono labels are allowed only as HUD-style tags.

## Typography

- Korean body and commands: Pretendard fallback stack, then Noto Sans KR and Malgun Gothic.
- Numeric, source, and status labels: Geist Mono fallback stack.
- Headlines can be strong, but command copy should stay short.
- Avoid inflated marketing phrasing. Prefer clear operational verbs.

## Color Tokens

- `--sc-black`: primary ink and command surface.
- `--sc-hazard-yellow`: action and urgent operation signal.
- `--sc-steel-*`: neutral UI, borders, secondary controls, and HUD labels.
- `--sc-ok`, `--sc-warning`, `--sc-danger`: semantic status only.

## Component Rules

- Primary button: black border, Hazard Yellow background, 4px radius.
- Secondary button/chip: white or steel surface, steel border, 4px radius.
- Active step/card: steel surface with a Hazard Yellow left rail.
- Brand mark: black square with yellow `SC`.
- Progress meters: square rail, no pill gloss.
- Rubric and document status should read like a checklist, not a scorecard.

## Copy Rules

- Say what is happening now.
- Use periods deliberately.
- Do not imply final legal judgment.
- Use `공식 근거 기반 초안`, `현장 확인 필요`, `제출 전 점검` instead of certification language.
- Worker-facing multilingual messages may use limited safety pictograms when they make instructions easier to understand.

## Implementation Status

The current implementation applies the brand guide at the global CSS token and component layer:

- SafeClaw color tokens and steel/yellow palette.
- 4px radius tokens.
- Shadow removal for main workspace surfaces.
- Primary action button styling.
- HUD label typography.
- `SC` brand mark.

Remaining work for a later pixel pass:

- Remove legacy CSS rules instead of overriding them.
- Compare the production page against the standalone remix/brand guide screenshot.
- Extend the system to every supporting route, including long-form docs pages.
