# HWPX anonymization succeeds with missing or invalid policy

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

A missing or malformed cleanup policy becomes an empty token list while output is still marked successful.

## Evidence

scripts/anonymize_hwpx_templates.mjs:25-42,202-236

## Remediation

Fail closed and require a post-output residual identifier scan.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

