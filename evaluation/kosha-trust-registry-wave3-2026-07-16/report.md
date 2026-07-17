# KOSHA exact registry wave 3 evaluation

- Base: `530efbfafb30c6145c1536172b260ff644845846`
- Target: `B-E-10-2026 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정`
- Registry: 2 exact items -> 3 exact items
- Acquisition: verified local corpus and receipt assets only; no network fetch
- Mutations: no DB, schema, or production data mutation

## Independent review remediation

- Follow-up parent: `a38ba4a94677c0dcaab007ff86363ec5959d5b7a`
- B-E-10 control anchors: corpus PDF page `6`; no page `5` is emitted
- Printed page: the PDF body labels the same content as printed page `3`, but the anchor schema has only one page field, so the printed number is not encoded
- Published date: required and exactly pinned for all 3 assets; missing, null, or mismatch fails closed
- Commercial negatives: `임대`, `비용`, `구입`, `제품`, and `쇼핑` added while mixed queries require clear operational electrical-work intent

## Immutable pins

- Body characters: `15,049`
- Exact body SHA-256: `6fe137a8f788914b0f9804fbd81e8f9fa987dd108ce6edb2fd47eda9bee9b121`
- Corpus whitespace-normalized body SHA-256: `36d16c70c54669d0a8b57d346d7b2f85ab0c491ff8fc1202e4c717f868042e4d`
- PDF SHA-256: `0a44548411eb5402761934de46fd70393064dca22c56b7b8a27967c3cab4eb23`
- Provenance SHA-256: `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`
- Official file: `CTC2026012913263450093332`
- Published: `2026-01-30`

## Gates

- Focused Vitest: 6 files, 151 tests passed
- Strict TypeScript: passed
- Production build: passed, 28 static pages
- NFT: 78 manifests, 16 complete consumers, 0 partial consumers
- Diff check: passed
- Applicability: outage, LOTO, voltage-absence verification, and electrical work only
- Commercial and announcement queries: blocked
- Controls: 3 controls and 3 anchors are exact substrings of the pinned body
- Prompt grounding: query-relevant body anchors replace blind first-window grounding when anchors exist

## Reproducible commands

```powershell
npm.cmd test -- --run tests/exact-trusted-kosha-registry-wave3.test.ts tests/exact-trusted-kosha-registry-wave2.test.ts tests/exact-trusted-kosha-grounding.test.ts tests/exact-kosha-applicability-policy.test.ts tests/grounded-generation-contract.test.ts tests/photo-vision-analysis.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
npm.cmd run build
node -e "const fs=require('fs'),path=require('path'); const manifests=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.nft.json')) manifests.push(p);}}; walk('.next'); const assets=['d-c-13-2026.json','d-c-7-2026.json','b-e-10-2026.json']; let allThreeCount=0,partialCount=0; const routes=[]; for(const manifest of manifests){const files=JSON.parse(fs.readFileSync(manifest,'utf8')).files||[]; const present=assets.filter(asset=>files.some(file=>file.split(path.sep).join('/').endsWith('/data/safety-knowledge/exact-kosha/'+asset))); if(present.length===3){allThreeCount++; routes.push(manifest.split(path.sep).join('/').replace(/^\.next\/server\/app\//,'').replace(/\/route\.js\.nft\.json$|\/page\.js\.nft\.json$|\.js\.nft\.json$/,''));} else if(present.length>0) partialCount++;} const exactAssetBytes=assets.reduce((sum,asset)=>sum+fs.statSync(path.join('data/safety-knowledge/exact-kosha',asset)).size,0); console.log(JSON.stringify({manifestCount:manifests.length,allThreeCount,partialCount,exactAssetBytes,routes:routes.sort()},null,2));"
git diff --check
```
