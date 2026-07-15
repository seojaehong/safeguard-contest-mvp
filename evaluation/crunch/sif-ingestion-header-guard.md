# SIF Ingestion Header Guard

## Scope

- Source workbook: `C:\Users\iceam\Downloads\붙임1. 사망사고 고위험요인(SIF) 아카이브(제조업 등, 건설업).xlsx`
- No Supabase credentials, REST calls, uploads, migrations, or data deletion were performed.

## Root Cause and Guard

The construction archive has an upper header followed by a second header row. The parser treated that first post-header row as a `sif-case`, producing one extra item.

The guard skips only the first post-header row when all of these source-schema conditions hold:

1. The upper header's third field is `고위험작업·상황`.
2. Columns three through five are exactly `공종`, `작업명`, and `단위작업명`.
3. Every other cell in that row is empty.

The parser keeps its workbook-relative row index in the item ID, so the remaining records retain their existing incremental upsert keys. It also logs the skip and closes the read-only workbook after parsing.

## TDD Evidence

The initial focused fixture test failed with `AssertionError: 2 != 1` before the guard was implemented. It passed after the implementation.

```powershell
python -m unittest scripts.tests.test_ingest_safety_reference_catalog.ParseSifArchiveTest.test_skips_the_repeated_construction_subheader_without_dropping_a_record -v
python -m unittest scripts.tests.test_ingest_safety_reference_catalog -v
```

Final unit-test result: `Ran 1 test` and `OK`.

## Read-Only Source Verification

The source was parsed directly through `parse_sif_archive` in a Python dry-run. This command did not call `main`, read an environment file, or pass `--upload`.

```powershell
@'
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

script_path = Path("scripts/ingest_safety_reference_catalog.py").resolve()
spec = importlib.util.spec_from_file_location("sif_dry_run", script_path)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load {script_path}")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
_, items = module.parse_sif_archive(Path(r"C:\Users\iceam\Downloads\붙임1. 사망사고 고위험요인(SIF) 아카이브(제조업 등, 건설업).xlsx"))
print(json.dumps({"itemCount": len(items), "bySheet": dict(Counter(item.category for item in items))}, ensure_ascii=True))
'@ | python -
```

Observed counts:

| Sheet | Parsed SIF cases |
| --- | ---: |
| `아카이브(제조업등)` | 2,573 |
| `아카이브(건설업)` | 3,459 |
| Total | 6,032 |

The run logged `Skipping repeated SIF construction subheader` and confirmed `containsConstructionSubheaderRecord=false`.

## Existing DB Audit Boundary

The supplied prior DB audit reported 6,033 rows. This change prevents that repeated header from being included by future ingestion while preserving stable IDs for the 6,032 valid source records. It intentionally does not remove the already-audited extra DB row; correcting that persisted row requires a separately approved data operation.
