from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from typing import Any
from unittest import mock

from scripts import promote_kosha_official_metadata
from scripts import build_kosha_verified_subset


JsonObject = dict[str, Any]


def sha256(value: bytes | str) -> str:
    payload = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(payload).hexdigest()


def write_jsonl(path: Path, rows: list[JsonObject]) -> str:
    text = "".join(
        f"{json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n"
        for row in rows
    )
    path.write_text(text, encoding="utf-8", newline="\n")
    return text


def write_source(root: Path, documents: list[tuple[str, bytes, str]]) -> str:
    staging_dir = root / "staging"
    staging_dir.mkdir(parents=True)
    items: list[JsonObject] = []
    chunks: list[JsonObject] = []
    for index, (version, pdf_bytes, body) in enumerate(documents):
        stable_key = version.rsplit("-", 1)[0]
        item_id = f"kosha-test-{index}"
        body_hash = sha256(" ".join(body.split()))
        items.append({
            "item_id": item_id,
            "item_type": "technical-support-regulation",
            "state": "current-unverified",
            "extraction_status": "success",
            "body_origin": "native",
            "body": body,
            "normalized_text_sha256": body_hash,
            "raw_sha256": sha256(pdf_bytes),
            "stable_key": stable_key,
            "version_key": version,
            "source_key": f"source::{version}.pdf",
            "source_zip": "source.zip",
            "source_member": f"{version}.pdf",
        })
        chunks.append({
            "item_id": item_id,
            "chunk_sha256": sha256(body),
            "text": body,
        })
    items_text = write_jsonl(staging_dir / "items.jsonl", items)
    chunks_text = write_jsonl(staging_dir / "chunks.jsonl", chunks)
    failures_text = write_jsonl(staging_dir / "failures.jsonl", [])
    source_identity_material: JsonObject = {"fixture": "official-metadata-promotion"}
    source_identity = {
        **source_identity_material,
        "identity_sha256": sha256(json.dumps(
            source_identity_material,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )),
    }
    generation_policy: JsonObject = {"fixture_policy": "native-body-only"}
    generation_policy_sha256 = sha256(json.dumps(
        generation_policy,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ))
    output_hashes = {
        "items.jsonl": sha256(items_text),
        "chunks.jsonl": sha256(chunks_text),
        "failures.jsonl": sha256(failures_text),
    }
    reproducibility_material: JsonObject = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "source_identity_sha256": source_identity["identity_sha256"],
        "generation_policy_sha256": generation_policy_sha256,
        "output_hashes": output_hashes,
    }
    snapshot_id = sha256(json.dumps(
        reproducibility_material,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ))
    snapshot_path = Path("snapshots") / snapshot_id
    snapshot_dir = root / snapshot_path
    snapshot_dir.mkdir(parents=True)
    for name in ("items.jsonl", "chunks.jsonl", "failures.jsonl"):
        (staging_dir / name).replace(snapshot_dir / name)
    staging_dir.rmdir()
    manifest: JsonObject = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "snapshot_id": snapshot_id,
        "source_identity": source_identity,
        "generation_policy": generation_policy,
        "generation_policy_sha256": generation_policy_sha256,
        "output_hashes": output_hashes,
        "reproducibility_hash": snapshot_id,
    }
    manifest_text = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
    (snapshot_dir / "manifest.json").write_text(manifest_text, encoding="utf-8", newline="\n")
    current: JsonObject = {
        "snapshot_id": snapshot_id,
        "snapshot_path": snapshot_path.as_posix(),
        "manifest": {
            "path": f"{snapshot_path.as_posix()}/manifest.json",
            "sha256": sha256(manifest_text),
            "size_bytes": len(manifest_text.encode("utf-8")),
        },
    }
    (root / "current.json").write_text(
        json.dumps(current, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
        newline="\n",
    )
    return snapshot_id


def read_source_snapshot_id(root: Path) -> str:
    current = json.loads((root / "current.json").read_text(encoding="utf-8"))
    return str(current["snapshot_id"])


class FakeTransport:
    def __init__(self, pages: dict[int, JsonObject], downloads: dict[str, bytes]) -> None:
        self.pages = pages
        self.downloads = downloads
        self.requested_pages: list[int] = []

    def fetch_page(self, category: str, page: int, rows_per_page: int) -> JsonObject:
        del category, rows_per_page
        self.requested_pages.append(page)
        return self.pages[page]

    def fetch_bytes(self, url: str) -> bytes:
        try:
            return self.downloads[url]
        except KeyError as error:
            raise promote_kosha_official_metadata.PromotionError("simulated-download-failure") from error


class FailingPageTransport(FakeTransport):
    def fetch_page(self, category: str, page: int, rows_per_page: int) -> JsonObject:
        del category, page, rows_per_page
        raise promote_kosha_official_metadata.PromotionError("simulated-page-timeout")


class FakeHttpResponse:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> FakeHttpResponse:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def read(self) -> bytes:
        return self.payload


def official_row(
    version: str,
    file_id: str,
    file_seq: int,
    published: str,
    category: str = "B",
) -> JsonObject:
    return {
        "techGdlnNo": version,
        "techGdlnNm": f"{version} 기술지원규정",
        "techGdlnCtgryCd": category,
        "techGdlnFldSeCd": "BE",
        "techGdlnSttsSeCdSt": "제정",
        "techGdlnOfancYmd": published,
        "techGdlnOrgnlAtcflNo": file_id,
        "techGdlnOrgnlAtcflNoSeq": str(file_seq),
    }


class PromoteKoshaOfficialMetadataTests(unittest.TestCase):
    def failure_codes(
        self,
        root: Path,
        source_documents: list[tuple[str, bytes, str]],
        pages: dict[int, JsonObject],
        downloads: dict[str, bytes],
    ) -> set[str]:
        source = root / "source"
        output = root / "output"
        source.mkdir()
        write_source(source, source_documents)
        report = promote_kosha_official_metadata.run_promotion(
            promote_kosha_official_metadata.PromotionConfig(
                source_root=source,
                output_root=output,
                categories=("B",),
                expected_candidate_count=len(source_documents),
                expected_source_snapshot_id=read_source_snapshot_id(source),
            ),
            FakeTransport(pages, downloads),
        )
        self.assertFalse(report["launch_ready"])
        current = json.loads((output / "current.json").read_text(encoding="utf-8"))
        failures_path = output / current["snapshot_path"] / "failures.jsonl"
        return {
            json.loads(line)["code"]
            for line in failures_path.read_text(encoding="utf-8").splitlines()
        }

    def test_collects_paginated_current_rows_and_writes_verified_ledger(self) -> None:
        pdf_a = b"official-pdf-a"
        pdf_b = b"official-pdf-b"
        url_a = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        url_b = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-B/2"
        pages = {
            1: {"result": "success", "payload": {
                "totalCount": 2,
                "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
            }},
            2: {"result": "success", "payload": {
                "totalCount": 2,
                "list": [official_row("B-E-11-2026", "FILE-B", 2, "20260131")],
            }},
        }
        transport = FakeTransport(pages, {url_a: pdf_a, url_b: pdf_b})

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [
                ("B-E-10-2026", pdf_a, "첫 번째 본문"),
                ("B-E-11-2026", pdf_b, "두 번째 본문"),
            ])

            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("B",),
                    rows_per_page=1,
                    expected_candidate_count=2,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                transport,
            )

            self.assertEqual(transport.requested_pages, [1, 2])
            self.assertTrue(report["launch_ready"])
            self.assertEqual(report["verified_count"], 2)
            self.assertEqual(report["item_count"], 2)
            self.assertEqual(report["success_count"], 2)
            self.assertEqual(report["failure_count"], 0)
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            ledger_path = output / current["snapshot_path"] / "official-metadata.jsonl"
            ledger = [json.loads(line) for line in ledger_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual([row["stable_key"] for row in ledger], ["B-E-10", "B-E-11"])
            self.assertEqual(ledger[0]["pdf_sha256"], sha256(pdf_a))
            self.assertEqual(ledger[1]["publication_date"], "2026-01-31")
            self.assertTrue((output / "report.md").exists())
            self.assertTrue((output / "promotion.log").exists())
            manifest = json.loads(
                (output / current["snapshot_path"] / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertFalse(manifest["trusted_registry_populated"])
            self.assertEqual(manifest["network_policy"], {"timeout_seconds": 20.0, "retries": 1})

    def test_fails_closed_when_non_empty_category_is_truncated_below_total_count(self) -> None:
        pdf_bytes = b"official-pdf"
        official_url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 2,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "본문")])

            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("B",),
                    expected_candidate_count=1,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                FakeTransport(pages, {official_url: pdf_bytes}),
            )

            self.assertFalse(report["launch_ready"])
            self.assertEqual(report["verified_count"], 1)
            self.assertEqual(report["failure_counts"], {"official-category-count-mismatch": 1})
            self.assertEqual(report["category_reconciliations"], [{
                "category": "B",
                "duplicate_count": 0,
                "expected_total_count": 2,
                "matches_total_count": False,
                "normalized_row_count": 1,
                "raw_row_count": 1,
                "unique_row_count": 1,
            }])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            failures_path = output / current["snapshot_path"] / "failures.jsonl"
            failures = [
                json.loads(line)
                for line in failures_path.read_text(encoding="utf-8").splitlines()
            ]
            self.assertEqual(failures, [{
                "category": "B",
                "code": "official-category-count-mismatch",
                "duplicate_count": 0,
                "expected_total_count": 2,
                "normalized_row_count": 1,
                "raw_row_count": 1,
                "unique_row_count": 1,
            }])

    def test_reuses_canonical_page_shards_on_incremental_resume(self) -> None:
        pdf_bytes = b"official-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "검증 본문")])
            config = promote_kosha_official_metadata.PromotionConfig(
                source_root=source,
                output_root=output,
                categories=("B",),
                rows_per_page=100,
                expected_candidate_count=1,
                expected_source_snapshot_id=read_source_snapshot_id(source),
                reuse_page_cache=True,
                cache_max_age_seconds=3600.0,
            )
            first_transport = FakeTransport(pages, {url: pdf_bytes})
            first = promote_kosha_official_metadata.run_promotion(config, first_transport)
            second_transport = FakeTransport({}, {url: pdf_bytes})
            second = promote_kosha_official_metadata.run_promotion(config, second_transport)

            self.assertEqual(first_transport.requested_pages, [1])
            self.assertEqual(second_transport.requested_pages, [])
            self.assertEqual(first["snapshot_id"], second["snapshot_id"])

    def test_default_collection_refreshes_instead_of_reusing_stale_cache(self) -> None:
        pdf_bytes = b"official-pdf"
        changed_pdf = b"changed-official-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "검증 본문")])
            config = promote_kosha_official_metadata.PromotionConfig(
                source_root=source,
                output_root=output,
                categories=("B",),
                expected_candidate_count=1,
                expected_source_snapshot_id=read_source_snapshot_id(source),
            )
            first_transport = FakeTransport(pages, {url: pdf_bytes})
            self.assertTrue(promote_kosha_official_metadata.run_promotion(config, first_transport)["launch_ready"])
            second_transport = FakeTransport(pages, {url: changed_pdf})
            second = promote_kosha_official_metadata.run_promotion(config, second_transport)

            self.assertEqual(second_transport.requested_pages, [1])
            self.assertFalse(second["launch_ready"])
            self.assertEqual(second["failure_counts"], {"official-pdf-hash-mismatch": 1})

    def test_rejects_official_row_from_the_wrong_category(self) -> None:
        pdf_bytes = b"official-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130", category="B")],
        }}}
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "검증 본문")])
            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("A",),
                    expected_candidate_count=1,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                FakeTransport(pages, {url: pdf_bytes}),
            )

            self.assertFalse(report["launch_ready"])
            self.assertEqual(report["failure_counts"].get("official-row-category-mismatch"), 1)

    def test_records_download_failure_and_finishes_fail_closed(self) -> None:
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", b"local-pdf", "검증 본문")])

            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("B",),
                    expected_candidate_count=1,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                FakeTransport(pages, {}),
            )

            self.assertFalse(report["launch_ready"])
            self.assertEqual(report["verified_count"], 0)
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            failures_path = output / current["snapshot_path"] / "failures.jsonl"
            failures = [json.loads(line) for line in failures_path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(failures[0]["code"], "official-download-failed")

    def test_rejects_tampered_parent_snapshot_before_collection(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", b"local-pdf", "검증 본문")])
            current = json.loads((source / "current.json").read_text(encoding="utf-8"))
            chunks_path = source / current["snapshot_path"] / "chunks.jsonl"
            chunks_path.write_text("tampered\n", encoding="utf-8", newline="\n")

            with self.assertRaisesRegex(
                promote_kosha_official_metadata.PromotionError,
                "source-chunks-hash-mismatch",
            ):
                promote_kosha_official_metadata.run_promotion(
                    promote_kosha_official_metadata.PromotionConfig(
                        source_root=source,
                        output_root=output,
                        categories=("B",),
                        expected_candidate_count=1,
                        expected_source_snapshot_id=read_source_snapshot_id(source),
                    ),
                    FakeTransport({}, {}),
                )

    def test_rejects_self_declared_source_identity_that_does_not_recompute(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", b"local-pdf", "검증 본문")])
            current = json.loads((source / "current.json").read_text(encoding="utf-8"))
            manifest_path = source / current["manifest"]["path"]
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["source_identity"]["fixture"] = "tampered"
            source_material = {
                key: value
                for key, value in manifest["source_identity"].items()
                if key != "identity_sha256"
            }
            manifest["source_identity"]["identity_sha256"] = sha256(json.dumps(
                source_material,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ))
            manifest_text = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
            manifest_path.write_text(manifest_text, encoding="utf-8", newline="\n")
            current["manifest"]["sha256"] = sha256(manifest_text)
            current["manifest"]["size_bytes"] = len(manifest_text.encode("utf-8"))
            (source / "current.json").write_text(
                json.dumps(current, sort_keys=True, separators=(",", ":")),
                encoding="utf-8",
                newline="\n",
            )

            with self.assertRaisesRegex(
                promote_kosha_official_metadata.PromotionError,
                "source-reproducibility-identity-mismatch",
            ):
                promote_kosha_official_metadata.run_promotion(
                    promote_kosha_official_metadata.PromotionConfig(
                        source_root=source,
                        output_root=output,
                        categories=("B",),
                        expected_candidate_count=1,
                        expected_source_snapshot_id=read_source_snapshot_id(source),
                    ),
                    FakeTransport({}, {}),
                )

    def test_treats_only_lf_as_jsonl_boundary(self) -> None:
        pdf_bytes = b"official-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "본문\u0085연결")])

            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("B",),
                    expected_candidate_count=1,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                FakeTransport(pages, {url: pdf_bytes}),
            )

            self.assertTrue(report["launch_ready"])

    def test_records_api_failure_and_produces_blocked_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", b"local-pdf", "검증 본문")])

            report = promote_kosha_official_metadata.run_promotion(
                promote_kosha_official_metadata.PromotionConfig(
                    source_root=source,
                    output_root=output,
                    categories=("B",),
                    expected_candidate_count=1,
                    expected_source_snapshot_id=read_source_snapshot_id(source),
                ),
                FailingPageTransport({}, {}),
            )

            self.assertFalse(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            failures_path = output / current["snapshot_path"] / "failures.jsonl"
            failures = [json.loads(line) for line in failures_path.read_text(encoding="utf-8").splitlines()]
            self.assertIn("official-page-fetch-failed", {row["code"] for row in failures})

    def test_fails_closed_for_empty_duplicate_missing_version_and_pdf_mismatch(self) -> None:
        local_pdf = b"local-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        cases: list[tuple[str, dict[int, JsonObject], dict[str, bytes], str]] = [
            (
                "empty",
                {1: {"result": "success", "payload": {"totalCount": 1, "list": []}}},
                {},
                "official-page-empty",
            ),
            (
                "duplicate",
                {1: {"result": "success", "payload": {"totalCount": 2, "list": [
                    official_row("B-E-10-2026", "FILE-A", 1, "20260130"),
                    official_row("B-E-10-2026", "FILE-B", 2, "20260130"),
                ]}}},
                {url: local_pdf},
                "official-stable-key-duplicate",
            ),
            (
                "missing",
                {1: {"result": "success", "payload": {"totalCount": 1, "list": [
                    official_row("B-E-11-2026", "FILE-A", 1, "20260130"),
                ]}}},
                {url: local_pdf},
                "official-row-missing",
            ),
            (
                "version",
                {1: {"result": "success", "payload": {"totalCount": 1, "list": [
                    official_row("B-E-10-2025", "FILE-A", 1, "20260130"),
                ]}}},
                {url: local_pdf},
                "official-version-mismatch",
            ),
            (
                "pdf-hash",
                {1: {"result": "success", "payload": {"totalCount": 1, "list": [
                    official_row("B-E-10-2026", "FILE-A", 1, "20260130"),
                ]}}},
                {url: b"different-official-pdf"},
                "official-pdf-hash-mismatch",
            ),
            (
                "empty-pdf",
                {1: {"result": "success", "payload": {"totalCount": 1, "list": [
                    official_row("B-E-10-2026", "FILE-A", 1, "20260130"),
                ]}}},
                {url: b""},
                "official-download-empty",
            ),
        ]
        for label, pages, downloads, expected_code in cases:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as temp_dir:
                codes = self.failure_codes(
                    Path(temp_dir),
                    [("B-E-10-2026", local_pdf, "검증 본문")],
                    pages,
                    downloads,
                )
                self.assertIn(expected_code, codes)
                if label == "duplicate":
                    self.assertIn("official-category-count-mismatch", codes)

    def test_url_transport_uses_twenty_second_timeout_and_one_retry(self) -> None:
        transport = promote_kosha_official_metadata.UrlLibTransport()
        response = FakeHttpResponse(b'{"result":"success","payload":{"totalCount":0,"list":[]}}')
        with mock.patch.object(
            promote_kosha_official_metadata.request,
            "urlopen",
            side_effect=[urllib.error.URLError("temporary"), response],
        ) as urlopen:
            payload = transport.fetch_page("B", 1, 100)

        self.assertEqual(payload["result"], "success")
        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual([call.kwargs["timeout"] for call in urlopen.call_args_list], [20.0, 20.0])

    def test_refuses_to_overwrite_an_existing_snapshot_with_different_bytes(self) -> None:
        pdf_bytes = b"official-pdf"
        url = "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-A/1"
        pages = {1: {"result": "success", "payload": {
            "totalCount": 1,
            "list": [official_row("B-E-10-2026", "FILE-A", 1, "20260130")],
        }}}
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, [("B-E-10-2026", pdf_bytes, "검증 본문")])
            config = promote_kosha_official_metadata.PromotionConfig(
                source_root=source,
                output_root=output,
                categories=("B",),
                expected_candidate_count=1,
                expected_source_snapshot_id=read_source_snapshot_id(source),
                reuse_page_cache=True,
                cache_max_age_seconds=3600.0,
            )
            first = promote_kosha_official_metadata.run_promotion(
                config,
                FakeTransport(pages, {url: pdf_bytes}),
            )
            ledger_path = output / "snapshots" / str(first["snapshot_id"]) / "official-metadata.jsonl"
            ledger_path.write_text("tampered\n", encoding="utf-8", newline="\n")

            with self.assertRaisesRegex(
                promote_kosha_official_metadata.PromotionError,
                "snapshot-output-mismatch:official-metadata.jsonl",
            ):
                promote_kosha_official_metadata.run_promotion(
                    config,
                    FakeTransport({}, {url: pdf_bytes}),
                )

    def test_checked_in_blocked_artifact_is_hash_complete_and_untrusted(self) -> None:
        root = Path(__file__).resolve().parents[2]
        output = root / "evaluation" / "kosha-official-metadata-promotion-2026-07-15"
        current = json.loads((output / "current.json").read_text(encoding="utf-8"))
        manifest_path = output / current["manifest"]["path"]
        manifest_bytes = manifest_path.read_bytes()
        self.assertEqual(sha256(manifest_bytes), current["manifest"]["sha256"])
        self.assertEqual(len(manifest_bytes), current["manifest"]["size_bytes"])
        manifest = json.loads(manifest_bytes)
        snapshot_dir = output / current["snapshot_path"]
        for name, expected_hash in manifest["identity"]["output_hashes"].items():
            self.assertEqual(sha256((snapshot_dir / name).read_bytes()), expected_hash)
        ledger = (snapshot_dir / "official-metadata.jsonl").read_text(encoding="utf-8").splitlines()
        failures = [
            json.loads(line)
            for line in (snapshot_dir / "failures.jsonl").read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual(len(ledger), 212)
        self.assertEqual(len(failures), 22)
        self.assertEqual({row["code"] for row in failures}, {"official-pdf-hash-mismatch"})
        reconciliations = manifest["identity"]["category_reconciliations"]
        self.assertEqual([row["category"] for row in reconciliations], ["A", "B", "C", "D", "E"])
        self.assertTrue(all(row["matches_total_count"] for row in reconciliations))
        self.assertEqual(sum(row["expected_total_count"] for row in reconciliations), 1039)
        self.assertEqual(sum(row["duplicate_count"] for row in reconciliations), 0)
        self.assertFalse(manifest["launch_ready"])
        self.assertFalse(manifest["trusted_registry_populated"])
        self.assertEqual(
            build_kosha_verified_subset.PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256,
            frozenset({"1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f"}),
        )


if __name__ == "__main__":
    unittest.main()
