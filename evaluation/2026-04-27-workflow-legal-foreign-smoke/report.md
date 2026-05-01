# Workflow, Legal Evidence, Foreign Worker Smoke

## Local API Smoke
- `/api/ask`: live
- First citation type: law
- Citation groups: law 3, interpretation 3
- Risk assessment legal appendix: true
- TBM legal appendix: true
- Safety education legal appendix: true
- Serious accident prevention appendix: true
- Foreign worker language count: 10
- n8n dispatch through SSH tunnel: true

## Public Relay
- Caddy domain: https://node.pe.kr
- Exposed path: /webhook/safeguard-workpack only
- Reverse proxy target: n8n:5678 through Docker network `n8n_default`
- Public relay smoke: HTTP 200
- Caddy backups were created on server before edits.

## Vercel Env Rule
- Production uses N8N_PUBLIC_BASE=https://node.pe.kr
- Production must not use N8N_INTERNAL_BASE
- Local/Oracle internal runtime may use N8N_INTERNAL_BASE=http://127.0.0.1:5678
