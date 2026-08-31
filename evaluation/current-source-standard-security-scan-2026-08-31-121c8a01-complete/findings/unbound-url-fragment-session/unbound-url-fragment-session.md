# Non-callback pages accept unbound Supabase sessions from URL fragments

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Default browser clients can process an injected session fragment outside the transaction-validating callback.

## Evidence

components/AuthCallbackClient.tsx:20-58; AdminLoginPanel.tsx:16-52; FieldOperationsWorkspace.tsx:163-172,275-295

## Remediation

Disable URL session detection outside the callback and clear unexpected fragments.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

