# Document ingestion and audit parsers lack uniform expansion and memory limits

**Severity:** medium  
**Confidence:** high  
**Rule:** `resource-exhaustion.unbounded-document-parser`  
**Taxonomy:** CWE-400

## Summary

Operator ingestion, inventory, and audit scripts initialize XLSX, CSV, HWPX, and ZIP parsers without the shared expansion, member, row/cell, memory, and elapsed-time admission layer.

## Attack path

Operator ingestion, inventory, and audit scripts initialize XLSX, CSV, HWPX, and ZIP parsers without the shared expansion, member, row/cell, memory, and elapsed-time admission layer.

## Evidence

- `scripts/extract_kogas_risk_standard_models.py:916-996`
- `scripts/parse_download_safety_forms.py:200-225`
- `scripts/prepare_supabase_safety_ingestion.py:275-310`
- `scripts/ingest_safety_reference_catalog.py:164-220`
- `scripts/final_output_integrity_audit.mjs:214-235`

## Validation boundary

These are operator workflows, not public runtime routes; protected sibling paths show the intended control.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Apply bounded admission before parser initialization and isolate complex parsing with memory and wall-clock limits.
