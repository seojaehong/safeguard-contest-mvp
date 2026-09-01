# Tenant clients can forge server-authoritative workflow state

## Severity

Medium

## Attack Path

An authenticated tenant owner can bypass server transition logic by writing approval, review, provider, or recipient-policy fields directly through the Data API.

## Source Evidence

supabase/migrations/003_knowledge_runtime.sql:94-126 and 010_commercial_operations.sql:161-210 grant broad FOR ALL access; downstream review/export code trusts these states.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Restrict authoritative fields to server-only transitions or constrained RPCs and immutable authenticated receipts.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

