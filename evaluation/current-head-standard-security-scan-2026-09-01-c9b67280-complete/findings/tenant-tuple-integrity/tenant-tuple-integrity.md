# Relational tenant tuples are not enforced by composite constraints

## Severity

Low

## Attack Path

A tenant owner who knows a foreign object UUID can write an own-organization child row that references the foreign object.

## Source Evidence

Migrations 002, 003, and 010 use independent foreign keys while RLS checks only the supplied organization_id.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Add composite tenant keys and foreign keys plus relationship-aware WITH CHECK policies.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

