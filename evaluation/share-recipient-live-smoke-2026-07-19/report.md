# Share Recipient Live Smoke (2026-07-19)

## Verdict

PASS for non-mutating route availability and fail-closed API behavior on the current production deployment.

This smoke does not create a share session, does not send a provider message, and does not write a read confirmation. It only proves that the recipient portal route is deployed and that an invalid API lookup does not expose session data.

## Current HEAD

- Source HEAD: `36b1a3ee2d9730239bacb0cbae6befe80e2becc3`
- Production build-info: `commitSha=36b1a3ee2d9730239bacb0cbae6befe80e2becc3`, `branch=master`, `environment=production`
- CI run: `29650771772`, success

## Live Probes

| Probe | Result | Meaning |
| --- | --- | --- |
| `GET https://www.safeclaw.kr/share/not-a-session?lang=vi` | HTTP 200, HTML shell rendered | Recipient portal route is deployed and routable. |
| `GET https://www.safeclaw.kr/api/share-sessions/not-a-session?workerId=00000000-0000-0000-0000-000000000000` | HTTP 400, empty body from the PowerShell probe | Invalid session lookup fails closed without exposing documents or recipient messages. |

## Remaining Gap

The worker-facing product loop still needs a live or preview end-to-end proof with a real invited share session:

1. Create or load a real workpack.
2. Select today participants.
3. Create a share session.
4. Open `/share/{sessionId}?workerId={workerId}`.
5. Press the worker confirmation button.
6. Verify the manager acknowledgment panel updates.

That proof is not performed here because it would require production data/session writes.
