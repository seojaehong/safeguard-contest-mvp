# SafeGuard Workflow Dispatch Report

## Summary
- UI: 홈 하단 공유 영역을 `현장 전파` 패널로 교체했다.
- API: `/api/workflow/dispatch`를 추가해 SafeGuard 문서팩을 n8n Webhook으로 전송한다.
- n8n: 서버2 `127.0.0.1:5678` 기준 워크플로우 템플릿을 생성하고 n8n 컨테이너에 import했다.
- Vercel: `127.0.0.1:5678`은 서버 내부 주소라 공개 배포판에서는 `N8N_PUBLIC_BASE`가 추가로 필요하다.

## Required Values
```bash
N8N_INTERNAL_BASE=http://127.0.0.1:5678
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<same value as SAFEGUARD_WEBHOOK_TOKEN in n8n container>
N8N_PUBLIC_BASE=
```

## Server2 n8n Check
- `http://127.0.0.1:5678`: HTTP 200
- `http://127.0.0.1:5679`: HTTP 200
- Listener: `127.0.0.1:5678` local-only
- Listener: `*:5679` all-interface
- SafeGuard target: `5678`

## Production Webhook Check
- Workflow ID: `SafeGuardWorkpackDispatch`
- Workflow active: `true`
- Active version present: `true`
- Trigger count: `1`
- Webhook path: `/webhook/safeguard-workpack`
- Webhook registered: `true`
- Internal URL: `http://127.0.0.1:5678/webhook/safeguard-workpack`
- Good-token smoke: HTTP `200`
- Bad-token smoke: HTTP `200`, empty body. This means the webhook is registered, but the n8n response branch should be hardened before treating token rejection as audited evidence.

## Files
- `components/WorkflowSharePanel.tsx`
- `app/api/workflow/dispatch/route.ts`
- `docs/workflow_distribution_setup.md`
- `docs/n8n_safeguard_workflow_template.json`
- `evaluation/2026-04-27-workflow-dispatch/workflow-dispatch-smoke.json`

## Verification
- `npm.cmd run build`: passed
- `npm.cmd run typecheck`: passed after build regenerated `.next/types`
- Route smoke: passed
- n8n workflow import: passed
- Vercel production smoke: passed

## Deployment
- Production URL: https://safeguard-contest-mvp.vercel.app
- Deployment URL: https://safeguard-contest-n32qch50t-seojaehongs-projects.vercel.app

## Remaining Operator Step
서버2 n8n 컨테이너에 `SAFEGUARD_WEBHOOK_TOKEN`을 넣고 워크플로우를 활성화해야 production webhook이 실제 전송을 받는다. 공개 Vercel에서 바로 전송하려면 `N8N_PUBLIC_BASE`로 접근 가능한 HTTPS reverse proxy 또는 tunnel이 필요하다.
