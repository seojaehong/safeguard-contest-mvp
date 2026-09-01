from __future__ import annotations

import io
import hashlib
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import pdf_parser_worker
from pdf_parser_worker import (
    PdfParseResult,
    PdfWorkerError,
    PdfWorkerLimitError,
    hash_pdf_bytes_bounded,
    hash_pdf_file_bounded,
    parse_pdf_bytes_bounded,
    parse_pdf_file_bounded,
)


def build_pdf_bytes(
    page_texts: list[str], image_pages: set[int] | None = None
) -> bytes:
    writer = PdfWriter()
    image_pages = image_pages or set()
    for page_index, text in enumerate(page_texts, start=1):
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        resources = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        content = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        commands = [f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET"]
        if page_index in image_pages:
            image = DecodedStreamObject()
            image.set_data(b"\x00")
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(1),
                    NameObject("/Height"): NumberObject(1),
                    NameObject("/ColorSpace"): NameObject("/DeviceGray"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            resources[NameObject("/XObject")] = DictionaryObject(
                {NameObject("/Im1"): writer._add_object(image)}
            )
            commands.append("q 1 0 0 1 0 0 cm /Im1 Do Q")
        content.set_data("\n".join(commands).encode("ascii"))
        page[NameObject("/Resources")] = resources
        page[NameObject("/Contents")] = writer._add_object(content)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def parse_pdf(data: bytes, **overrides: object) -> PdfParseResult:
    limits: dict[str, object] = {
        "extract_pages": 10,
        "max_total_pages": 20,
        "max_text_chars": 10_000,
        "timeout_seconds": 3.0,
        "memory_limit_bytes": 256 * 1024 * 1024,
        "max_output_bytes": 1024 * 1024,
        "include_image_flags": False,
    }
    limits.update(overrides)
    return parse_pdf_bytes_bounded(data, **limits)  # type: ignore[arg-type]


class WorkerMode:
    def __init__(self, mode: str) -> None:
        self.mode = mode
        self.original = pdf_parser_worker._build_worker_command
        self.patcher = patch.object(
            pdf_parser_worker,
            "_build_worker_command",
            side_effect=self._command,
        )

    def _command(self, **kwargs: object) -> list[str]:
        command = self.original(**kwargs)  # type: ignore[arg-type]
        return [*command, "--test-mode", self.mode]

    def __enter__(self) -> None:
        self.patcher.start()

    def __exit__(self, *args: object) -> None:
        self.patcher.stop()


class PdfParserWorkerTest(unittest.TestCase):
    def test_hash_only_worker_returns_digest_without_constructing_pdf_reader(self) -> None:
        data = b"not-even-a-pdf"

        self.assertEqual(
            hash_pdf_bytes_bounded(data),
            hashlib.sha256(data).hexdigest(),
        )

    def test_hash_only_worker_hard_timeout_keeps_parent_alive(self) -> None:
        with WorkerMode("hang_before_reader"):
            with self.assertRaises(PdfWorkerLimitError) as raised:
                hash_pdf_bytes_bounded(b"bounded", timeout_seconds=0.15)

        self.assertEqual(raised.exception.code, "timeout")
        self.assertEqual(hash_pdf_bytes_bounded(b"alive"), hashlib.sha256(b"alive").hexdigest())

    def test_hash_file_worker_uses_bounded_snapshot(self) -> None:
        data = b"bounded-file"
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "source.pdf"
            path.write_bytes(data)
            digest = hash_pdf_file_bounded(path, max_input_bytes=len(data))

        self.assertEqual(digest, hashlib.sha256(data).hexdigest())

    def test_normal_pdf_matches_direct_reader_page_count_and_raw_text(self) -> None:
        data = build_pdf_bytes(["first page", "second (raw) page"])
        direct_reader = PdfReader(io.BytesIO(data))
        expected_text = tuple(page.extract_text() or "" for page in direct_reader.pages)

        result = parse_pdf(data)

        self.assertEqual(result.page_count, len(direct_reader.pages))
        self.assertEqual(tuple(page.text for page in result.pages), expected_text)
        self.assertEqual(tuple(page.has_image for page in result.pages), (False, False))

    def test_extract_pages_preserves_exact_total_page_count(self) -> None:
        data = build_pdf_bytes(["one", "two", "three"])
        expected_text = PdfReader(io.BytesIO(data)).pages[0].extract_text() or ""

        result = parse_pdf(data, extract_pages=1)

        self.assertEqual(result.page_count, 3)
        self.assertEqual(len(result.pages), 1)
        self.assertEqual(result.pages[0].text, expected_text)

    def test_constructor_and_parse_hangs_are_killed_without_killing_parent(self) -> None:
        data = build_pdf_bytes(["still alive"])
        for mode in ("hang_before_reader", "hang_after_reader"):
            with self.subTest(mode=mode):
                started_at = time.monotonic()
                with WorkerMode(mode):
                    with self.assertRaises(PdfWorkerLimitError) as raised:
                        parse_pdf(data, timeout_seconds=0.15)
                self.assertEqual(raised.exception.code, "timeout")
                self.assertLess(time.monotonic() - started_at, 2.0)
                self.assertEqual(parse_pdf(data).page_count, 1)

    def test_worker_spawn_time_is_charged_to_the_absolute_deadline(self) -> None:
        original_spawn = pdf_parser_worker._spawn_worker

        def delayed_spawn(*args: object, **kwargs: object) -> object:
            result = original_spawn(*args, **kwargs)  # type: ignore[arg-type]
            time.sleep(0.15)
            return result

        with patch.object(
            pdf_parser_worker,
            "_spawn_worker",
            side_effect=delayed_spawn,
        ):
            with self.assertRaises(PdfWorkerLimitError) as raised:
                parse_pdf(
                    build_pdf_bytes(["deadline"]),
                    timeout_seconds=0.1,
                )

        self.assertEqual(raised.exception.code, "timeout")

    def test_child_crash_is_reported(self) -> None:
        with WorkerMode("crash"):
            with self.assertRaisesRegex(PdfWorkerError, "exited with code 23"):
                parse_pdf(build_pdf_bytes(["crash"]))

    def test_rejects_malformed_and_trailing_protocol(self) -> None:
        data = build_pdf_bytes(["protocol"])
        for mode, message in (
            ("malformed", "malformed PDF worker protocol header"),
            ("trailing", "trailing bytes"),
        ):
            with self.subTest(mode=mode):
                with WorkerMode(mode):
                    with self.assertRaisesRegex(PdfWorkerError, message):
                        parse_pdf(data)

    def test_parent_rejects_oversized_worker_output(self) -> None:
        with WorkerMode("oversized"):
            with self.assertRaises(PdfWorkerLimitError) as raised:
                parse_pdf(build_pdf_bytes(["large"]), max_output_bytes=512)

        self.assertEqual(raised.exception.code, "output_bytes_limit")

    def test_result_serialization_respects_output_limit(self) -> None:
        with self.assertRaises(PdfWorkerLimitError) as raised:
            parse_pdf(
                build_pdf_bytes(["x" * 2_000]),
                max_text_chars=3_000,
                max_output_bytes=512,
            )

        self.assertEqual(raised.exception.code, "output_bytes_limit")

    def test_page_and_text_limits_include_page_count(self) -> None:
        data = build_pdf_bytes(["alpha", "bravo"])
        with self.assertRaises(PdfWorkerLimitError) as page_raised:
            parse_pdf(data, max_total_pages=1)
        self.assertEqual(page_raised.exception.code, "page_count_limit")
        self.assertEqual(page_raised.exception.page_count, 2)

        with self.assertRaises(PdfWorkerLimitError) as text_raised:
            parse_pdf(data, max_text_chars=5)
        self.assertEqual(text_raised.exception.code, "text_chars_limit")
        self.assertEqual(text_raised.exception.page_count, 2)

    def test_file_parser_uses_one_immutable_bounded_snapshot(self) -> None:
        original = build_pdf_bytes(["original"])
        replacement = build_pdf_bytes(["replacement"])
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "document.pdf"
            path.write_bytes(original)

            def capture_snapshot(data: bytes, **_kwargs: object) -> PdfParseResult:
                path.write_bytes(replacement)
                self.assertEqual(data, original)
                return PdfParseResult(page_count=0, pages=())

            with patch.object(
                pdf_parser_worker,
                "parse_pdf_bytes_bounded",
                side_effect=capture_snapshot,
            ) as bounded_parse:
                result = parse_pdf_file_bounded(
                    path,
                    max_input_bytes=len(original),
                    extract_pages=1,
                    max_total_pages=2,
                    max_text_chars=100,
                )

        self.assertEqual(result.page_count, 0)
        bounded_parse.assert_called_once()

    def test_file_parser_rejects_input_above_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "large.pdf"
            path.write_bytes(b"1234")

            with self.assertRaises(PdfWorkerLimitError) as raised:
                parse_pdf_file_bounded(
                    path,
                    max_input_bytes=3,
                    extract_pages=1,
                    max_total_pages=2,
                    max_text_chars=100,
                )

        self.assertEqual(raised.exception.code, "input_bytes_limit")

    def test_file_parser_rejects_snapshot_that_differs_from_admitted_digest(self) -> None:
        data = build_pdf_bytes(["replacement"])
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "replaced.pdf"
            path.write_bytes(data)

            with self.assertRaisesRegex(PdfWorkerError, "did not match"):
                parse_pdf_file_bounded(
                    path,
                    max_input_bytes=len(data),
                    extract_pages=1,
                    max_total_pages=2,
                    max_text_chars=100,
                    expected_sha256=hashlib.sha256(b"original").hexdigest(),
                )

    def test_optional_image_flags_match_page_resources(self) -> None:
        result = parse_pdf(
            build_pdf_bytes(["no image", "image"], image_pages={2}),
            include_image_flags=True,
        )

        self.assertEqual(tuple(page.has_image for page in result.pages), (False, True))

    def test_windows_job_is_installed_during_spawn_before_input_handling(self) -> None:
        process = MagicMock(spec=subprocess.Popen)
        process.stdin = MagicMock()
        process.stdout = MagicMock()
        process.stderr = MagicMock()
        job = MagicMock()
        call_order: list[str] = []

        with (
            patch.object(pdf_parser_worker.os, "name", "nt"),
            patch.object(
                pdf_parser_worker.subprocess,
                "Popen",
                side_effect=lambda *_args, **_kwargs: (
                    call_order.append("spawn") or process
                ),
            ),
            patch.object(
                pdf_parser_worker,
                "_install_windows_job",
                side_effect=lambda *_args: call_order.append("job") or job,
            ) as install_job,
        ):
            spawned_process, spawned_job = pdf_parser_worker._spawn_worker(
                ["worker"], 12345
            )

        self.assertEqual(call_order, ["spawn", "job"])
        self.assertIs(spawned_process, process)
        self.assertIs(spawned_job, job)
        install_job.assert_called_once_with(process, 12345)

    def test_posix_spawn_avoids_preexec_and_starts_a_new_process_group(self) -> None:
        process = MagicMock(spec=subprocess.Popen)
        process.stdin = MagicMock()
        process.stdout = MagicMock()
        process.stderr = MagicMock()
        with (
            patch.object(pdf_parser_worker.os, "name", "posix"),
            patch.object(
                pdf_parser_worker.subprocess,
                "Popen",
                return_value=process,
            ) as popen,
        ):
            spawned_process, spawned_job = pdf_parser_worker._spawn_worker(
                ["worker"],
                12345,
            )

        self.assertIs(spawned_process, process)
        self.assertIsNone(spawned_job)
        kwargs = popen.call_args.kwargs
        self.assertTrue(kwargs["start_new_session"])
        self.assertNotIn("preexec_fn", kwargs)

    def test_windows_job_install_failure_uses_bounded_termination_helper(self) -> None:
        process = MagicMock(spec=subprocess.Popen)
        process.stdin = MagicMock()
        process.stdout = MagicMock()
        process.stderr = MagicMock()
        with (
            patch.object(pdf_parser_worker.os, "name", "nt"),
            patch.object(pdf_parser_worker.subprocess, "Popen", return_value=process),
            patch.object(
                pdf_parser_worker,
                "_install_windows_job",
                side_effect=PdfWorkerError("job assignment failed"),
            ),
            patch.object(pdf_parser_worker, "_terminate_worker") as terminate,
        ):
            with self.assertRaisesRegex(PdfWorkerError, "job assignment failed"):
                pdf_parser_worker._spawn_worker(["worker"], 12345)

        terminate.assert_called_once_with(process, None, close_pipes=True)


if __name__ == "__main__":
    unittest.main()
