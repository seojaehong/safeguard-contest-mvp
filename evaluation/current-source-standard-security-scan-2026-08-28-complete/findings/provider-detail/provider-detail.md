# Public provider diagnostics expose bounded upstream failure details

**Severity:** Low

Provider exception or bounded response text is embedded in adapter details and concatenated into the public ask status response.

## Remediation

Return stable public codes and keep raw diagnostics in server logs.
