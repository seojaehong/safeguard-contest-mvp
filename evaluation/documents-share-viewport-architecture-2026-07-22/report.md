# Documents / Share viewport architecture diagnosis

Source state: `ff90306b`

This report records the code-level reason why the user can still experience the Documents screen as a long page and the Share screen as mobile-like, even after the reporting gate now correctly rejects route split alone as a fix.

## Current diagnosis

The issue is not only page count. Splitting `/workspace`, `/documents`, and `/share` helps orientation, but each route can still fail if it renders the full artifact stack in the page body.

The durable structure should be:

- step shell for orientation;
- first-viewport cockpit for status, selected artifact, source/provenance, and primary action;
- selected-only bounded workbench for the currently active document/message;
- drilldown, drawer, accordion, local scroll, or detail route for long raw content.

## Documents route

`app/documents/page.tsx` renders `CurrentDocumentsModule` inside `SafeClawModuleShell`.

The current module already has a cockpit structure:

- `components/CurrentWorkpackModules.tsx:778` defines `DocumentCockpit`.
- `components/CurrentWorkpackModules.tsx:855` renders the document index.
- `components/CurrentWorkpackModules.tsx:869` renders the primary document preview area.
- `components/CurrentWorkpackModules.tsx:884` renders export/readiness.
- `components/CurrentWorkpackModules.tsx:967` renders `DocumentCockpit`.
- `components/CurrentWorkpackModules.tsx:972` renders `WorkpackEditor` immediately after the cockpit.

The likely remaining long-page cause is that the cockpit is followed by the full editor as another page-level block. Even if the cockpit prioritizes core documents and collapses supporting documents, the selected editor still expands below the cockpit instead of being contained as part of the first-viewport workbench.

Implementation direction:

- Keep `DocumentCockpit` as the orientation layer.
- Move or visually bind `WorkpackEditor` into a bounded selected-document region.
- Ensure the first viewport exposes the selected document action/editor entry, not the whole long editor body.
- Keep long document body, provenance, section fields, and source text in local scroll or drilldown.
- Preserve selected document synchronization through `selectedDocumentKey`, `requestedDocumentKey`, `focusToken`, and `onSelectedDocumentChange`.

Do not treat hiding the editor entirely as a fix. The first viewport still needs a clear selected document affordance and an actionable edit/review path.

## Share route split

There are at least two Share surfaces that must remain separate in evidence:

- recipient portal: `app/share/[sessionId]/page.tsx`;
- manager/workspace share panel: `components/WorkflowSharePanel.tsx` inside `FieldOperationsWorkspace`.

The recipient portal is intentionally compact and recipient-first:

- `app/share/[sessionId]/page.tsx:632` renders `safeclaw-share-recipient-page`.
- `app/globals.css:15566` gives the recipient page a compact default grid.
- `app/globals.css:15568` sets a narrow default max width.
- `app/globals.css:15690` switches the recipient page to a wider desktop grid.

The manager share panel already has desktop-specific grid rules:

- `components/WorkflowSharePanel.tsx:1184` renders the mobile cockpit summary.
- `components/WorkflowSharePanel.tsx:1220` renders the mobile config toggle.
- `components/WorkflowSharePanel.tsx:1230` renders `share-form-shell`.
- `components/WorkflowSharePanel.tsx:1346` renders the message preview panel.
- `app/globals.css:14949` defines the share panel shell.
- `app/globals.css:14952` sets its default max width.
- `app/globals.css:14967` applies workspace share desktop grid layout.
- `app/globals.css:14969` sets the desktop two-region columns.

If the user still sees a desktop page as mobile-like, the next implementation wave must first identify which Share surface is being viewed. A pass on the invited recipient fixture cannot close a complaint about an exact saved/generated user session.

Implementation direction:

- Keep recipient portal mobile-friendly, but verify the desktop breakpoint expands into multiple regions.
- Keep manager/workspace share panel desktop as a real multi-pane workbench.
- Verify exact saved `/share/[sessionId]` sessions separately from generated fixture routes.
- Keep mobile-only elements visually suppressed or de-emphasized on desktop when they make the page feel like a phone layout.
- Do not use a single route proof to close all Share route complaints.

## Acceptance evidence for the next UI wave

The next product patch should not pass with only static report evidence. It needs browser geometry evidence for:

- `/documents` desktop first viewport;
- `/documents` mobile first viewport;
- manager/workspace share route desktop;
- recipient `/share/[sessionId]` exact saved session desktop;
- recipient `/share/[sessionId]` exact saved session mobile.

Evidence should record:

- viewport;
- total document height;
- first actionable editor/control y-position;
- selected editor count;
- root width ratio;
- visible layout region count;
- sticky overlap;
- horizontal overflow;
- whether route split alone was used as the claimed fix.

## Current conclusion

The previous fixes are live-aligned and correctly prevent an overbroad launch claim. They do not prove that the user-facing Documents and Share layout complaint is resolved.

The next aligned work is a bounded UI implementation wave, not another reporting-only wave.
