from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg


def read_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply the SafeClaw safety reference catalog migration.")
    parser.add_argument("--migration", default="supabase/migrations/004_safety_reference_catalog.sql")
    parser.add_argument("--env", default=".env.local")
    args = parser.parse_args()

    read_env_file(Path(args.env))
    database_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "SUPABASE_DB_URL 또는 DATABASE_URL이 필요합니다. "
            "Supabase SQL editor로 supabase/migrations/004_safety_reference_catalog.sql을 적용해도 됩니다."
        )

    sql = Path(args.migration).read_text(encoding="utf-8")
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        connection.commit()

    print(f"[done] applied migration: {args.migration}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
