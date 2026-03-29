#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

UTC = timezone.utc
WORKSPACE = Path('/home/ubuntu/.openclaw/workspace/contest-mvp')
VALIDATION = WORKSPACE / 'validation'
RUNS = VALIDATION / 'runs'
SOURCE = Path('/home/ubuntu/telegram-codex-workspace/mvp_e2e.py')


def count_api_status(data):
    status = data.get('api_status') or {}
    ok = sum(1 for v in status.values() if v.get('ok') is True)
    fail = sum(1 for v in status.values() if v.get('ok') is False)
    failed = [k for k, v in status.items() if v.get('ok') is False]
    return ok, fail, failed


def append_log(run_id, mode, scenario_name, data, note=''):
    ok, fail, failed = count_api_status(data)
    risk = (data.get('risk_summary') or {}).get('level', 'unknown')
    log_path = VALIDATION / 'VALIDATION-LOG.md'
    with log_path.open('a', encoding='utf-8') as f:
        f.write(f"| {run_id} | {mode} | {scenario_name} | {risk} | {ok} | {fail} | {note or (', '.join(failed[:5]) if failed else 'ok')} |\n")


def write_latest(run_id, mode, scenario_name, data):
    ok, fail, failed = count_api_status(data)
    reasons = (data.get('risk_summary') or {}).get('reasons', [])
    latest = VALIDATION / 'LATEST.md'
    latest.write_text(
        "# Latest Validation Status\n\n"
        f"- run_id: `{run_id}`\n"
        f"- mode: `{mode}`\n"
        f"- scenario: `{scenario_name}`\n"
        f"- risk_level: `{(data.get('risk_summary') or {}).get('level', 'unknown')}`\n"
        f"- api_ok: `{ok}`\n"
        f"- api_fail: `{fail}`\n"
        f"- failed_apis: {', '.join(failed) if failed else '없음'}\n"
        f"- reasons: {', '.join(reasons) if reasons else '없음'}\n",
        encoding='utf-8'
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scenario', required=True)
    parser.add_argument('--mode', choices=['dry-run', 'live'], required=True)
    parser.add_argument('--api-key', default=os.environ.get('PUBLIC_DATA_API_KEY', ''))
    args = parser.parse_args()

    scenario = Path(args.scenario).resolve()
    if not scenario.exists():
        raise SystemExit(f'scenario not found: {scenario}')

    RUNS.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')
    run_id = f'{ts}-{args.mode}'
    out = RUNS / f'{run_id}.json'

    cmd = ['python3', str(SOURCE), '--input', str(scenario), '--out', str(out)]
    env = os.environ.copy()
    # source script requires PUBLIC_DATA_API_KEY even in dry-run mode.
    env['PUBLIC_DATA_API_KEY'] = args.api_key or 'DRY_RUN_PLACEHOLDER'
    if args.mode == 'dry-run':
        cmd.append('--dry-run')
    else:
        if not args.api_key:
            raise SystemExit('PUBLIC_DATA_API_KEY or --api-key is required for live mode')

    proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr or proc.stdout or f'run failed: {proc.returncode}')

    data = json.loads(out.read_text(encoding='utf-8'))
    append_log(run_id, args.mode, scenario.name, data)
    write_latest(run_id, args.mode, scenario.name, data)

    print(json.dumps({
        'run_id': run_id,
        'mode': args.mode,
        'scenario': scenario.name,
        'out': str(out),
        'risk_level': (data.get('risk_summary') or {}).get('level', 'unknown'),
        'api_status': count_api_status(data),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
