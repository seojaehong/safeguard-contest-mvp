# Logout retains raw worker data in persistent browser storage

- Severity: medium
- Confidence: high
- Rule: `client-data.persistent-logout-retention`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

The workspace stores raw worker profiles and generated documents in localStorage, while logout paths leave the record available to a later user of the same browser profile.

## Code Evidence

- `lib/current-workpack.ts:12-35`
- `components/AdminLoginPanel.tsx:101-105`
- `components/FieldOperationsWorkspace.tsx:311-315`
- `components/CurrentWorkpackModules.tsx:756-765`

## Attack Path

The workspace stores raw worker profiles and generated documents in localStorage, while logout paths leave the record available to a later user of the same browser profile.

- Impact: medium
- Likelihood: medium

## Limitations

- Exploitation requires access to the same browser profile or same-origin script execution.

## Remediation

Clear tenant workpack storage on every logout, bind retained offline state to user and tenant with expiry, and minimize persisted worker fields.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

