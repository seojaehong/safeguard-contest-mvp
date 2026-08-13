# SIF embedding upload proceeds despite failed corpus quality checks

- Severity: `medium`
- Confidence: `high`
- Rule: `integrity.corpus-quality-admission`

## Summary

The uploader computes missing-control, missing-document, and duplicate-content failures but does not enforce them before embedding and upload.

## Attack Path

prepare_sif_embedding_corpus.mjs --embed/--upload crosses the broken control into OpenAI embedding and Supabase vector upsert.

## Impact

The uploader computes missing-control, missing-document, and duplicate-content failures but does not enforce them before embedding and upload.

## Source Locations

- `scripts/prepare_sif_embedding_corpus.mjs:330` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Fail closed on mandatory corpus validation and bind approval to the exact corpus and manifest identity.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.