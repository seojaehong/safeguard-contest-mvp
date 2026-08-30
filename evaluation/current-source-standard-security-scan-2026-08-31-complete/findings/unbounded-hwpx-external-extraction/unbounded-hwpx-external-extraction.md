# HWPX anonymization extracts archives with unbounded PATH-selected tools

**Severity:** medium  
**Confidence:** medium  
**Rule:** `archive-extraction.unbounded-external-tool`  
**Taxonomy:** CWE-22

## Summary

The anonymization script passes HWPX directly to PATH-resolved unzip and shell-based zip, then recursively reads extracted paths without traversal, symlink, expansion, executable-path, or timeout validation.

## Attack path

The anonymization script passes HWPX directly to PATH-resolved unzip and shell-based zip, then recursively reads extracted paths without traversal, symlink, expansion, executable-path, or timeout validation.

## Evidence

- `scripts/anonymize_hwpx_templates.mjs:106-152`

## Validation boundary

Fixed repository input paths and randomized temp directories reduce likelihood; malicious template supply plus operator execution is required.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Use the bounded in-process ZIP reader, canonical containment, expansion limits, and no shell commands.
