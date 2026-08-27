# HWPX limits bound compressed artifacts but not peak archive-expansion memory

- Severity: $(@{ruleId=resource-exhaustion.hwpx-archive-expansion; identity=; title=HWPX limits bound compressed artifacts but not peak archive-expansion memory; summary=Compressed input and final output are capped, but decompressed entries and peak allocation are not.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Validate entry count, total uncompressed bytes, and maximum entry size before decompression; enforce peak-memory and streaming caps.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=resource-exhaustion.hwpx-archive-expansion; identity=; title=HWPX limits bound compressed artifacts but not peak archive-expansion memory; summary=Compressed input and final output are capped, but decompressed entries and peak allocation are not.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Validate entry count, total uncompressed bytes, and maximum entry size before decompression; enforce peak-memory and streaming caps.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=resource-exhaustion.hwpx-archive-expansion; identity=; title=HWPX limits bound compressed artifacts but not peak archive-expansion memory; summary=Compressed input and final output are capped, but decompressed entries and peak allocation are not.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Validate entry count, total uncompressed bytes, and maximum entry size before decompression; enforce peak-memory and streaming caps.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=resource-exhaustion.hwpx-archive-expansion; identity=; title=HWPX limits bound compressed artifacts but not peak archive-expansion memory; summary=Compressed input and final output are capped, but decompressed entries and peak allocation are not.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Validate entry count, total uncompressed bytes, and maximum entry size before decompression; enforce peak-memory and streaming caps.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Compressed input and final output are capped, but decompressed entries and peak allocation are not.

## Root Cause

Budgets govern compressed artifacts, not expansion and peak memory.

## Locations

- $(@{path=lib/hwpx-template.ts; startLine=16; endLine=20; role=root_control}.path):16 (root_control)
- $(@{path=lib/hwpx-template.ts; startLine=176; endLine=201; role=sink}.path):176 (sink)
- $(@{path=templates/hwpx/moel-workplan-truck.hwpx; startLine=1; endLine=1; role=evidence}.path):1 (evidence)

## Validation

Current template is 3.72 MiB compressed, 15.18 MiB uncompressed, largest entry 8.53 MiB.

- Templates are committed.

## Attack Path

Repeat the largest allowlisted template to force archive expansion.

## Remediation

Validate entry count, total uncompressed bytes, and maximum entry size before decompression; enforce peak-memory and streaming caps.

## Regression Tests

- Reject over-budget archive before getData.
- Validate template manifest in CI.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
