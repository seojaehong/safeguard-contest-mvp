# SafeGuard Product UI Reference

Generated at: 2026-04-26

## Design References

- Linear: restrained workspace density, quiet navigation, and issue-like operational hierarchy.
- Notion: editable document-first surface where generated content remains directly modifiable.
- Tally: low-friction text input and clear primary action without a heavy form experience.
- Rows: data-backed work surface that blends references, generated outputs, and operational context.

## Applied Direction

SafeGuard now presents itself as a safety workpack product rather than a contest demo screen. The home screen removes public-facing `live`, `fallback`, `mock`, and contest-status wording, and instead focuses on the user job: convert one field situation into editable safety documents.

## Official Form Logic

The output structure follows common field documentation practices used around KOSHA/KRAS-style risk assessment, TBM sharing, and safety education evidence:

- Risk assessment: process, hazard, current risk, reduction measure, residual risk, confirmation.
- TBM briefing: today's hazards, immediate actions, emergency response, worker confirmation questions.
- TBM log: date/time, site, work details, attendees, delivered content, unresolved hazards, worker confirmation.
- Safety education record: education name, date/time, place, target workers, contents, PPE/work-method emphasis, confirmation.

## Export Scope

The browser editor supports:

- TXT for quick copy/archive.
- JSON for system handoff or later automation.
- HTML for printable web document.
- JPG for messenger/image sharing.
- PDF through browser print/save-as-PDF.
- HWPX package for Korean document workflow handoff.

The HWPX export is generated client-side as a lightweight package. It should be revalidated against a formal HWPX template if a government-submission-grade file is required after the contest demo.
