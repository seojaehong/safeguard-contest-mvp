# Current-source stale approval evidence binding remediation

- Verdict: `PASS_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_FAIL_CLOSED`
- Source HEAD: `355a2dbd7def9e47054782d89bb35561dc62514f`
- Finding: `csf_86ec127fb3d5b7d397649611` / `approval-integrity.stale-evidence-binding`
- Workflow contracts: `4/4`

| Workflow | Contract | Binding verified | Blocked | Inputs | Packet digest |
| --- | --- | --- | --- | --- | --- |
| rls_llm_wiki | PASS | false | true | 13 | `b9c6df7033c9b2387bd3efec381eb90f84e2ba561a88a26366bdb015c29b867c` |
| distributed_admission | PASS | true | true | 4 | `b632026648e05f8af75ef5dda545f1b69ed2a69f37a1d268243898a38062ee31` |
| share_recipient_ack | PASS | true | true | 7 | `c8a57a996560f6c95d22989223251fd3a312c27162f8f479d75f855aa7d375b7` |
| kosha_exact_promotion | PASS | true | true | 4 | `b4e65674b71af66bc857c6cca9c1aefb8683fc245de59631fdeaaf37974e6746` |

## Boundary

- Historical or mixed evidence is retained as evidence and fails closed instead of being rewritten as current.
- No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved Share remains `MISSING_EVIDENCE`.
- A fresh full repository security rescan is still required before any security-complete claim.
