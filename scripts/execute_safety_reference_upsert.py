from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence
from urllib import error, parse, request


TABLES = [
    "safety_reference_sources",
    "safety_reference_items",
    "safety_reference_ingestion_runs",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_supabase_config() -> tuple[str, str]:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return supabase_url.rstrip("/"), service_key


def build_headers(service_key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    if extra:
        headers.update(extra)
    return headers


def open_json(url: str, service_key: str, timeout: int = 60) -> Any:
    req = request.Request(url, headers=build_headers(service_key), method="GET")
    with request.urlopen(req, timeout=timeout) as response:
        text = response.read().decode("utf-8", errors="replace")
    return json.loads(text) if text else None


def content_range_total(value: str | None) -> int:
    if not value or "/" not in value:
        return 0
    total = value.rsplit("/", 1)[-1]
    try:
        return int(total)
    except ValueError:
        return 0


def count_table(supabase_url: str, service_key: str, table: str) -> int:
    url = f"{supabase_url}/rest/v1/{table}?select=id&limit=1"
    req = request.Request(
        url,
        headers=build_headers(service_key, {"Prefer": "count=exact"}),
        method="GET",
    )
    try:
        with request.urlopen(req, timeout=60) as response:
            return content_range_total(response.headers.get("content-range"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"schema check failed for {table}: {exc.code} {body}") from exc


def schema_counts(supabase_url: str, service_key: str) -> dict[str, int]:
    return {table: count_table(supabase_url, service_key, table) for table in TABLES}


def chunked(rows: Sequence[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield list(rows[index:index + size])


def upsert_rows(supabase_url: str, service_key: str, table: str, rows: Sequence[dict[str, Any]], chunk_size: int) -> int:
    if not rows:
        return 0
    endpoint = f"{supabase_url}/rest/v1/{table}?on_conflict=id"
    headers = build_headers(service_key, {
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    })
    total = 0
    for rows_chunk in chunked(rows, chunk_size):
        data = json.dumps(rows_chunk, ensure_ascii=False).encode("utf-8")
        req = request.Request(endpoint, data=data, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=120) as response:
                if response.status not in (200, 201, 204):
                    raise RuntimeError(f"unexpected status {response.status} for {table}")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"upsert failed for {table}: {exc.code} {body}") from exc
        total += len(rows_chunk)
    return total


def insert_ingestion_run(supabase_url: str, service_key: str, run_row: dict[str, Any]) -> int:
    endpoint = f"{supabase_url}/rest/v1/safety_reference_ingestion_runs"
    headers = build_headers(service_key, {
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })
    data = json.dumps([run_row], ensure_ascii=False).encode("utf-8")
    req = request.Request(endpoint, data=data, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=60) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError(f"unexpected status {response.status} for safety_reference_ingestion_runs")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"insert failed for safety_reference_ingestion_runs: {exc.code} {body}") from exc
    return 1


def run_search_probe(supabase_url: str, service_key: str, query: str, limit: int) -> dict[str, Any]:
    params = parse.urlencode({
        "select": "id,title,item_type,category,keywords,primary_documents",
        "or": f"(title.ilike.*{query}*,summary.ilike.*{query}*,body.ilike.*{query}*)",
        "limit": str(limit),
    }, safe="().,*")
    url = f"{supabase_url}/rest/v1/safety_reference_items?{params}"
    try:
        data = open_json(url, service_key)
        return {
            "ok": True,
            "query": query,
            "count": len(data) if isinstance(data, list) else 0,
            "items": data if isinstance(data, list) else [],
        }
    except Exception as exc:
        return {
            "ok": False,
            "query": query,
            "count": 0,
            "items": [],
            "error": str(exc),
        }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def write_markdown(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# Final knowledge ingestion report",
        "",
        f"- generated_at: {report['generated_at']}",
        f"- db_mutation_applied: {str(report['db_mutation_applied']).lower()}",
        f"- schema_exists: {str(report['schema_exists']).lower()}",
        f"- elapsed_ms: {report['elapsed_ms']}",
        f"- exact_command: `{report['exact_command']}`",
        "",
        "## Before Counts",
        "",
        *[f"- {table}: {count}" for table, count in report["before_counts"].items()],
        "",
        "## After Counts",
        "",
        *[f"- {table}: {count}" for table, count in report["after_counts"].items()],
        "",
        "## Mutation Summary",
        "",
        f"- sources_upserted: {report['uploaded']['sources']}",
        f"- items_upserted: {report['uploaded']['items']}",
        f"- ingestion_runs_inserted: {report['uploaded']['runs']}",
        f"- success_count: {report['success_count']}",
        f"- failure_count: {report['failure_count']}",
        "",
        "## Verification",
        "",
        f"- status_probe_ok: {str(report['status_probe']['ok']).lower()}",
        f"- search_probe_ok: {str(report['search_probe']['ok']).lower()}",
        f"- search_probe_count: {report['search_probe']['count']}",
    ]
    if report.get("error"):
        lines.extend(["", "## Error", "", str(report["error"])])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def sanitize_for_postgres_text(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [sanitize_for_postgres_text(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_for_postgres_text(item) for key, item in value.items()}
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Execute approved SafeClaw safety reference upsert against existing Supabase tables.")
    parser.add_argument("--payload", default="evaluation/supabase-safety-ingestion-ready-2026-05-03/upsert-payload.json")
    parser.add_argument("--out-dir", default="evaluation/final-knowledge-ingestion")
    parser.add_argument("--chunk-size", type=int, default=100)
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--exact-command", required=True)
    args = parser.parse_args()

    started = time.perf_counter()
    out_dir = Path(args.out_dir)
    report_path = out_dir / "report.json"
    markdown_path = out_dir / "report.md"
    read_env_file(Path(args.env))
    report: dict[str, Any] = {
        "generated_at": now_iso(),
        "db_mutation_applied": False,
        "schema_exists": False,
        "exact_command": args.exact_command,
        "payload_path": args.payload,
        "before_counts": {},
        "after_counts": {},
        "uploaded": {"sources": 0, "items": 0, "runs": 0},
        "success_count": 0,
        "failure_count": 0,
        "elapsed_ms": 0,
        "status_probe": {"ok": False, "reason": "not-run"},
        "search_probe": {"ok": False, "query": "TBM", "count": 0, "items": []},
        "error": None,
    }

    try:
        supabase_url, service_key = get_supabase_config()
        payload = json.loads(Path(args.payload).read_text(encoding="utf-8"))
        sources = sanitize_for_postgres_text(payload.get("sources", []))
        items = sanitize_for_postgres_text(payload.get("items", []))
        if not isinstance(sources, list) or not isinstance(items, list):
            raise RuntimeError("payload sources/items must be arrays")

        before_counts = schema_counts(supabase_url, service_key)
        report["schema_exists"] = True
        report["before_counts"] = before_counts

        uploaded_sources = upsert_rows(supabase_url, service_key, "safety_reference_sources", sources, args.chunk_size)
        report["uploaded"]["sources"] = uploaded_sources
        uploaded_items = upsert_rows(supabase_url, service_key, "safety_reference_items", items, args.chunk_size)
        report["uploaded"]["items"] = uploaded_items

        elapsed_before_run = int((time.perf_counter() - started) * 1000)
        run_details = payload.get("ingestion_run", {}).get("details", {}) if isinstance(payload.get("ingestion_run"), dict) else {}
        run_row = {
            "source_batch": "final-knowledge-ingestion-2026-05-03",
            "source_count": len(sources),
            "item_count": len(items),
            "success_count": len(sources),
            "failure_count": 0,
            "elapsed_ms": elapsed_before_run,
            "report_path": str(report_path),
            "status": "completed",
            "details": {
                "payloadPath": args.payload,
                "sourcePayloadCount": len(sources),
                "itemPayloadCount": len(items),
                "originalDryRun": payload.get("ingestion_run", {}),
                "originalDetails": run_details,
                "operation": "insert/upsert only; no delete; no migration",
            },
        }
        uploaded_runs = insert_ingestion_run(supabase_url, service_key, run_row)
        report["uploaded"]["runs"] = uploaded_runs
        after_counts = schema_counts(supabase_url, service_key)

        status_ok = all(table in after_counts for table in TABLES)
        search_probe = run_search_probe(supabase_url, service_key, "TBM", 5)
        report.update({
            "db_mutation_applied": True,
            "after_counts": after_counts,
            "uploaded": {"sources": uploaded_sources, "items": uploaded_items, "runs": uploaded_runs},
            "success_count": uploaded_sources + uploaded_items + uploaded_runs,
            "failure_count": 0,
            "status_probe": {
                "ok": status_ok,
                "source_count": after_counts.get("safety_reference_sources", 0),
                "item_count": after_counts.get("safety_reference_items", 0),
                "ingestion_run_count": after_counts.get("safety_reference_ingestion_runs", 0),
            },
            "search_probe": search_probe,
        })
    except Exception as exc:
        report["error"] = str(exc)
        report["failure_count"] = 1
        if report["schema_exists"] and not report["after_counts"]:
            try:
                supabase_url, service_key = get_supabase_config()
                report["after_counts"] = schema_counts(supabase_url, service_key)
            except Exception:
                report["after_counts"] = report["before_counts"]
    finally:
        report["elapsed_ms"] = int((time.perf_counter() - started) * 1000)
        write_report(report_path, report)
        write_markdown(markdown_path, report)

    print(json.dumps({
        "report_path": str(report_path),
        "db_mutation_applied": report["db_mutation_applied"],
        "schema_exists": report["schema_exists"],
        "uploaded": report["uploaded"],
        "before_counts": report["before_counts"],
        "after_counts": report["after_counts"],
        "error": report["error"],
    }, ensure_ascii=False, indent=2))
    return 0 if report["db_mutation_applied"] and not report["error"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
