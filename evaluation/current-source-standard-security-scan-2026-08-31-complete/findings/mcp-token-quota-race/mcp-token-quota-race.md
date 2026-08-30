# MCP active-token quota is enforced with a check-then-insert race

**Severity:** low  
**Confidence:** high  
**Rule:** `race-condition.quota-enforcement`  
**Taxonomy:** CWE-362

## Summary

Concurrent authenticated token-creation requests can each pass the active-count check and independently insert credentials without a transaction or quota constraint.

## Attack path

Concurrent authenticated token-creation requests can each pass the active-count check and independently insert credentials without a transaction or quota constraint.

## Evidence

- `app/api/mcp-tokens/route.ts:247-278`

## Validation boundary

Token entropy, hashing, expiry, and tenant binding limit impact but do not make quota atomic.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Enforce count and insert in one transaction or lock-protected RPC.
