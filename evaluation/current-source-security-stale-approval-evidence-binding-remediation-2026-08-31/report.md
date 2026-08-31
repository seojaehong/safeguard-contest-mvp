# Current-source stale approval evidence binding remediation

- Verdict: `PASS_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_FAIL_CLOSED`
- Source HEAD: `3ac91d3d1530ec7f89b13631969995c887f58ea4`
- Finding: `csf_86ec127fb3d5b7d397649611` / `approval-integrity.stale-evidence-binding`
- Workflow contracts: `4/4`

| Workflow | Contract | Binding verified | Blocked | Inputs | Packet digest |
| --- | --- | --- | --- | --- | --- |
| rls_llm_wiki | PASS | true | true | 13 | `1f088ccb6614efc59a27f358268d52290847a67cc86ad187bf935b0fc952b38a` |
| distributed_admission | PASS | true | true | 4 | `aa40571fd6c4785cc0dcd28110b52ae8ea3adb7d57cc233a1799b3b7e8b21b68` |
| share_recipient_ack | PASS | true | true | 7 | `7de4b2bffa9e99db1388b43bdd805612535d457279449700ccb3df61f24aa22f` |
| kosha_exact_promotion | PASS | true | true | 4 | `76825ad2d20015fdceaac81fb9c563cb8ab270cd21029df5488c26c194f370b4` |

## Boundary

- Historical or mixed evidence is retained as evidence and fails closed instead of being rewritten as current.
- No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved Share remains `MISSING_EVIDENCE`.
- A fresh full repository security rescan is still required before any security-complete claim.
