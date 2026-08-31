# Static reproduction evidence

1. Open the cited current-revision source locations.
2. Follow the described entry point or input to the missing, non-atomic, or fail-open control.
3. Confirm the sensitive sink remains reachable before an equivalent authoritative control executes.
4. Treat deployment state as unverified and do not perform approval-gated mutation.

Observed invariant failure: The active-token count and token insert are separate operations with no database serialization.

