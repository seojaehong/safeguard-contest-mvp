# Current-source stale approval evidence binding remediation

- Verdict: `PASS_CURRENT_SOURCE_STALE_APPROVAL_EVIDENCE_BINDING_FAIL_CLOSED`
- Source HEAD: `346f36e3fb2f97cc3b0adda4b73ee970df05d6a7`
- Finding: `csf_86ec127fb3d5b7d397649611` / `approval-integrity.stale-evidence-binding`
- Workflow contracts: `4/4`

| Workflow | Contract | Binding verified | Blocked | Inputs | Packet digest |
| --- | --- | --- | --- | --- | --- |
| rls_llm_wiki | PASS | true | true | 13 | `62534c321a77302198d3b33ceac3818745f90a58ef19ac866e025f8d810e65f4` |
| distributed_admission | PASS | true | true | 4 | `098275e9ec34d5cd7e6bf3a817e1911b5a9ee4d0586b374746ad76ba7c208634` |
| share_recipient_ack | PASS | true | true | 7 | `a157d6df8c2c1fb66760d373cc691828c65f412470163d9ca592dae6aaa7ab48` |
| kosha_exact_promotion | PASS | true | true | 4 | `2b1cfdd5842592d0db8f590491276e1928a7c41744d8e2ab356dac059ad2d071` |

## Boundary

- Historical or mixed evidence is retained as evidence and fails closed instead of being rewritten as current.
- No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved Share remains `MISSING_EVIDENCE`.
- A fresh full repository security rescan is still required before any security-complete claim.
