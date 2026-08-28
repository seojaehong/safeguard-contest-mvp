# Knowledge review commits event and run transitions non-atomically

**Severity:** Low

The review flow updates events one at a time and updates the run later. Its own errors acknowledge compensation-required partial state.

## Remediation

Move the entire transition into one idempotent transaction or security-definer RPC.
