# KOSHA official body recovery

- Status: **pass**
- Launch ready: **true**
- Original ZIPs / extracted PDFs / official replacements: `10 / 1040 / 22`
- New corpus snapshot: `935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844`
- Corpus completed / hard failures / retained boundary: `1040 / 0 / 1`
- Promotion snapshot: `d9f5935188984d1fbf6f5378e588e607ee0a2c225796dbc0ba166f4e7a26d5c6`
- Verified / failures: `234 / 0`
- Official metadata SHA256: `1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f`
- Independent checks: `11` passed, `0` failed

## Boundaries

- Original ZIPs and the prior corpus snapshot were read only.
- No database, schema, migration, environment, upload, or trusted-registry mutation was performed.
- The existing unrelated body-missing boundary remains in the full corpus; it is outside the 234 current-native promotion set.
- Two operational retries are retained in logs: a Windows long-path failure before snapshot publication and a read-handle fsync failure before any replacement.

## Evidence portability P1

- Status: **pass**
- Ledger: `evaluation/kosha-official-body-recovery-2026-07-15/portability-ledger.json`
- Ledger SHA256: `b2ade4323cddecc0a50dab98f944f0781dc09885c8bdece4c1a6c0ea2010d0ef`
- Records / external blobs / source ZIP identities: `22 / 22 / 7`
- External bundle: `output/kep1/bundle` (37387427 bytes, Git excluded)
- Missing local bundle: fail closed with exit `2`
- Official refetch: opt-in only, timeout `20s`, retry `1`
- Verification: `23` Python tests, `120` focused Vitest tests, typecheck and diff-check passed

### Verify

```powershell
python scripts/verify_kosha_evidence_ledger.py --ledger evaluation/kosha-official-body-recovery-2026-07-15/portability-ledger.json --bundle-root output/kep1/bundle --corpus-root output/kobr26/corpus --promotion-root output/kobr26/promotion
```

### Rehydrate from local bundle

```powershell
python scripts/rehydrate_kosha_evidence_bundle.py --ledger evaluation/kosha-official-body-recovery-2026-07-15/portability-ledger.json --source-bundle-root output/kep1/bundle --output-bundle-root output/kep1-rehydrated/bundle
```

### Rehydrate from official URLs

```powershell
python scripts/rehydrate_kosha_evidence_bundle.py --ledger evaluation/kosha-official-body-recovery-2026-07-15/portability-ledger.json --source-bundle-root output/missing-bundle --output-bundle-root output/kep1-refetched/bundle --allow-official-refetch
```
