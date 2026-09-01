from __future__ import annotations

import argparse
import ctypes
import hashlib
import io
import json
import os
import signal
import struct
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Callable, Sequence


_PROTOCOL_MAGIC = b"PDFW1\x00"
_PROTOCOL_HEADER = struct.Struct(">Q")
_READ_CHUNK_SIZE = 64 * 1024
_MAX_STDERR_BYTES = 64 * 1024
_MIN_OUTPUT_BYTES = 512
_TERMINATION_WAIT_SECONDS = 1.0


@dataclass(frozen=True)
class PdfPageResult:
    text: str
    has_image: bool


@dataclass(frozen=True)
class PdfParseResult:
    page_count: int
    pages: tuple[PdfPageResult, ...]
    input_sha256: str = ""


class PdfWorkerError(RuntimeError):
    pass


class PdfWorkerLimitError(PdfWorkerError):
    def __init__(
        self,
        code: str,
        message: str | None = None,
        *,
        page_count: int | None = None,
    ) -> None:
        self.code = code
        self.page_count = page_count
        super().__init__(message or code)


@dataclass
class _WindowsJob:
    handle: int
    close_handle: Callable[[int], int]
    closed: bool = False

    def close(self) -> None:
        if not self.closed:
            self.close_handle(self.handle)
            self.closed = True


def _validate_limits(
    *,
    extract_pages: int,
    max_total_pages: int,
    max_text_chars: int,
    timeout_seconds: float,
    memory_limit_bytes: int,
    max_output_bytes: int,
) -> None:
    integer_limits = {
        "extract_pages": extract_pages,
        "max_total_pages": max_total_pages,
        "max_text_chars": max_text_chars,
        "memory_limit_bytes": memory_limit_bytes,
        "max_output_bytes": max_output_bytes,
    }
    for name, value in integer_limits.items():
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{name} must be a non-negative integer")
    if max_total_pages == 0:
        raise ValueError("max_total_pages must be greater than zero")
    if memory_limit_bytes == 0:
        raise ValueError("memory_limit_bytes must be greater than zero")
    if max_output_bytes < _MIN_OUTPUT_BYTES:
        raise ValueError(
            f"max_output_bytes must be at least {_MIN_OUTPUT_BYTES} bytes"
        )
    if not isinstance(timeout_seconds, (int, float)) or isinstance(
        timeout_seconds, bool
    ):
        raise ValueError("timeout_seconds must be a positive number")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be greater than zero")


def _build_worker_command(
    *,
    extract_pages: int,
    max_total_pages: int,
    max_text_chars: int,
    max_output_bytes: int,
    memory_limit_bytes: int,
    include_image_flags: bool,
    expected_sha256: str | None,
    hash_only: bool,
) -> list[str]:
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--worker",
        "--extract-pages",
        str(extract_pages),
        "--max-total-pages",
        str(max_total_pages),
        "--max-text-chars",
        str(max_text_chars),
        "--max-output-bytes",
        str(max_output_bytes),
        "--memory-limit-bytes",
        str(memory_limit_bytes),
    ]
    if include_image_flags:
        command.append("--include-image-flags")
    if expected_sha256 is not None:
        command.extend(("--expected-sha256", expected_sha256))
    if hash_only:
        command.append("--hash-only")
    return command


def _install_windows_job(
    process: subprocess.Popen[bytes], memory_limit_bytes: int
) -> _WindowsJob:
    from ctypes import wintypes

    job_object_limit_process_memory = 0x00000100
    job_object_limit_kill_on_job_close = 0x00002000
    job_object_extended_limit_information = 9

    class IoCounters(ctypes.Structure):
        _fields_ = [
            ("ReadOperationCount", ctypes.c_ulonglong),
            ("WriteOperationCount", ctypes.c_ulonglong),
            ("OtherOperationCount", ctypes.c_ulonglong),
            ("ReadTransferCount", ctypes.c_ulonglong),
            ("WriteTransferCount", ctypes.c_ulonglong),
            ("OtherTransferCount", ctypes.c_ulonglong),
        ]

    class BasicLimitInformation(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class ExtendedLimitInformation(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", BasicLimitInformation),
            ("IoInfo", IoCounters),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
    ]
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    raw_handle = kernel32.CreateJobObjectW(None, None)
    if not raw_handle:
        error_code = ctypes.get_last_error()
        raise PdfWorkerError(
            f"failed to create Windows parser job object: error={error_code}"
        )
    handle = int(raw_handle)
    job = _WindowsJob(handle=handle, close_handle=kernel32.CloseHandle)
    limits = ExtendedLimitInformation()
    limits.BasicLimitInformation.LimitFlags = (
        job_object_limit_process_memory | job_object_limit_kill_on_job_close
    )
    limits.ProcessMemoryLimit = memory_limit_bytes

    if not kernel32.SetInformationJobObject(
        raw_handle,
        job_object_extended_limit_information,
        ctypes.byref(limits),
        ctypes.sizeof(limits),
    ):
        error_code = ctypes.get_last_error()
        job.close()
        raise PdfWorkerError(
            f"failed to configure Windows parser job limits: error={error_code}"
        )
    process_handle = wintypes.HANDLE(process._handle)  # type: ignore[attr-defined]
    if not kernel32.AssignProcessToJobObject(raw_handle, process_handle):
        error_code = ctypes.get_last_error()
        job.close()
        raise PdfWorkerError(
            f"failed to assign parser worker to Windows job: error={error_code}"
        )
    return job


def _spawn_worker(
    command: Sequence[str], memory_limit_bytes: int
) -> tuple[subprocess.Popen[bytes], _WindowsJob | None]:
    popen_kwargs: dict[str, object] = {
        "stdin": subprocess.PIPE,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
    }
    if os.name == "posix":
        popen_kwargs["start_new_session"] = True

    try:
        process = subprocess.Popen(command, **popen_kwargs)  # type: ignore[arg-type]
    except OSError as exc:
        raise PdfWorkerError(f"failed to start PDF parser worker: {exc}") from exc

    job: _WindowsJob | None = None
    if os.name == "nt":
        try:
            job = _install_windows_job(process, memory_limit_bytes)
        except Exception:
            _terminate_worker(process, None, close_pipes=True)
            raise
    return process, job


def _terminate_worker(
    process: subprocess.Popen[bytes],
    job: _WindowsJob | None,
    *,
    close_pipes: bool = False,
) -> None:
    if process.poll() is None:
        if os.name == "nt":
            if job is not None:
                job.close()
            if process.poll() is None:
                process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except OSError:
                process.kill()
        try:
            process.wait(timeout=_TERMINATION_WAIT_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
            try:
                process.wait(timeout=_TERMINATION_WAIT_SECONDS)
            except subprocess.TimeoutExpired:
                pass
    if close_pipes:
        for stream in (process.stdin, process.stdout, process.stderr):
            if stream is not None and not stream.closed:
                stream.close()


def _read_stdout_bounded(
    stream: BinaryIO,
    max_output_bytes: int,
    chunks: list[bytes],
    oversized: threading.Event,
    failures: list[BaseException],
) -> None:
    total = 0
    try:
        while True:
            chunk = stream.read(_READ_CHUNK_SIZE)
            if not chunk:
                return
            total += len(chunk)
            if total > max_output_bytes:
                oversized.set()
                return
            chunks.append(chunk)
    except BaseException as exc:
        failures.append(exc)


def _read_stderr_bounded(stream: BinaryIO, chunks: list[bytes]) -> None:
    total = 0
    while True:
        chunk = stream.read(_READ_CHUNK_SIZE)
        if not chunk:
            return
        if total < _MAX_STDERR_BYTES:
            remaining = _MAX_STDERR_BYTES - total
            chunks.append(chunk[:remaining])
            total += min(len(chunk), remaining)


def _write_stdin(
    stream: BinaryIO, data: bytes, failures: list[BaseException]
) -> None:
    try:
        for offset in range(0, len(data), _READ_CHUNK_SIZE):
            stream.write(data[offset : offset + _READ_CHUNK_SIZE])
        stream.flush()
    except (BrokenPipeError, OSError) as exc:
        failures.append(exc)
    finally:
        stream.close()


def _communicate_bounded(
    process: subprocess.Popen[bytes],
    job: _WindowsJob | None,
    data: bytes,
    *,
    deadline: float,
    timeout_seconds: float,
    max_output_bytes: int,
) -> tuple[bytes, bytes]:
    if process.stdin is None or process.stdout is None or process.stderr is None:
        _terminate_worker(process, job, close_pipes=True)
        raise PdfWorkerError("PDF parser worker pipes were not created")

    stdout_chunks: list[bytes] = []
    stderr_chunks: list[bytes] = []
    stdout_failures: list[BaseException] = []
    stdin_failures: list[BaseException] = []
    oversized = threading.Event()
    threads = [
        threading.Thread(
            target=_read_stdout_bounded,
            args=(
                process.stdout,
                max_output_bytes,
                stdout_chunks,
                oversized,
                stdout_failures,
            ),
            daemon=True,
        ),
        threading.Thread(
            target=_read_stderr_bounded,
            args=(process.stderr, stderr_chunks),
            daemon=True,
        ),
        threading.Thread(
            target=_write_stdin,
            args=(process.stdin, data, stdin_failures),
            daemon=True,
        ),
    ]
    for thread in threads:
        thread.start()

    timed_out = False
    while process.poll() is None:
        if oversized.is_set():
            break
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            break
        time.sleep(min(0.01, remaining))

    if timed_out or oversized.is_set():
        _terminate_worker(process, job)
    else:
        process.wait()
    join_deadline = time.monotonic() + 1.0
    for thread in threads:
        thread.join(timeout=max(0.0, join_deadline - time.monotonic()))
    process.stdout.close()
    process.stderr.close()
    if job is not None:
        job.close()

    if timed_out:
        raise PdfWorkerLimitError(
            "timeout",
            f"PDF parser worker exceeded {timeout_seconds:.3f} seconds",
        )
    if oversized.is_set():
        raise PdfWorkerLimitError(
            "output_bytes_limit",
            f"PDF parser worker output exceeded {max_output_bytes} bytes",
        )
    if stdout_failures:
        raise PdfWorkerError(f"failed reading PDF worker output: {stdout_failures[0]}")

    stdout = b"".join(stdout_chunks)
    stderr = b"".join(stderr_chunks)
    if process.returncode != 0:
        detail = stderr.decode("utf-8", errors="replace").strip()
        suffix = f": {detail}" if detail else ""
        raise PdfWorkerError(
            f"PDF parser worker exited with code {process.returncode}{suffix}"
        )
    if stdin_failures and not stdout:
        raise PdfWorkerError(f"failed sending PDF worker input: {stdin_failures[0]}")
    return stdout, stderr


def _decode_packet(raw: bytes, max_output_bytes: int) -> PdfParseResult:
    if len(raw) > max_output_bytes:
        raise PdfWorkerLimitError(
            "output_bytes_limit",
            f"PDF parser worker output exceeded {max_output_bytes} bytes",
        )
    header_size = len(_PROTOCOL_MAGIC) + _PROTOCOL_HEADER.size
    if len(raw) < header_size or not raw.startswith(_PROTOCOL_MAGIC):
        raise PdfWorkerError("malformed PDF worker protocol header")
    payload_size = _PROTOCOL_HEADER.unpack_from(raw, len(_PROTOCOL_MAGIC))[0]
    expected_size = header_size + payload_size
    if expected_size != len(raw):
        if expected_size < len(raw):
            raise PdfWorkerError("trailing bytes in PDF worker protocol")
        raise PdfWorkerError("truncated PDF worker protocol payload")
    try:
        payload = json.loads(raw[header_size:].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PdfWorkerError(f"malformed PDF worker JSON payload: {exc}") from exc
    if not isinstance(payload, dict):
        raise PdfWorkerError("malformed PDF worker payload object")

    status = payload.get("status")
    if status == "error":
        error = payload.get("error")
        if not isinstance(error, dict):
            raise PdfWorkerError("malformed PDF worker error payload")
        code = error.get("code")
        message = error.get("message")
        page_count = error.get("page_count")
        if not isinstance(code, str) or not isinstance(message, str):
            raise PdfWorkerError("malformed PDF worker error fields")
        if page_count is not None and (
            not isinstance(page_count, int) or isinstance(page_count, bool)
        ):
            raise PdfWorkerError("malformed PDF worker error page count")
        if error.get("kind") == "limit":
            raise PdfWorkerLimitError(code, message, page_count=page_count)
        raise PdfWorkerError(f"{code}: {message}")
    if status != "ok":
        raise PdfWorkerError("malformed PDF worker status")

    page_count = payload.get("page_count")
    raw_pages = payload.get("pages")
    if (
        not isinstance(page_count, int)
        or isinstance(page_count, bool)
        or page_count < 0
        or not isinstance(raw_pages, list)
    ):
        raise PdfWorkerError("malformed PDF worker result fields")
    pages: list[PdfPageResult] = []
    for raw_page in raw_pages:
        if not isinstance(raw_page, dict):
            raise PdfWorkerError("malformed PDF worker page entry")
        text = raw_page.get("text")
        has_image = raw_page.get("has_image")
        if not isinstance(text, str) or not isinstance(has_image, bool):
            raise PdfWorkerError("malformed PDF worker page fields")
        pages.append(PdfPageResult(text=text, has_image=has_image))
    if len(pages) > page_count:
        raise PdfWorkerError("PDF worker returned more pages than the document contains")
    input_sha256 = payload.get("input_sha256")
    if (
        not isinstance(input_sha256, str)
        or len(input_sha256) != 64
        or any(character not in "0123456789abcdef" for character in input_sha256)
    ):
        raise PdfWorkerError("malformed PDF worker input digest")
    return PdfParseResult(
        page_count=page_count,
        pages=tuple(pages),
        input_sha256=input_sha256,
    )


def parse_pdf_bytes_bounded(
    data: bytes,
    *,
    extract_pages: int,
    max_total_pages: int,
    max_text_chars: int,
    timeout_seconds: float = 30.0,
    memory_limit_bytes: int = 512 * 1024 * 1024,
    max_output_bytes: int = 32 * 1024 * 1024,
    include_image_flags: bool = False,
    expected_sha256: str | None = None,
    _hash_only: bool = False,
) -> PdfParseResult:
    if not isinstance(data, bytes):
        raise TypeError("data must be bytes")
    _validate_limits(
        extract_pages=extract_pages,
        max_total_pages=max_total_pages,
        max_text_chars=max_text_chars,
        timeout_seconds=timeout_seconds,
        memory_limit_bytes=memory_limit_bytes,
        max_output_bytes=max_output_bytes,
    )
    deadline = time.monotonic() + float(timeout_seconds)
    command = _build_worker_command(
        extract_pages=extract_pages,
        max_total_pages=max_total_pages,
        max_text_chars=max_text_chars,
        max_output_bytes=max_output_bytes,
        memory_limit_bytes=memory_limit_bytes,
        include_image_flags=include_image_flags,
        expected_sha256=expected_sha256,
        hash_only=_hash_only,
    )
    process, job = _spawn_worker(command, memory_limit_bytes)
    remaining_seconds = deadline - time.monotonic()
    if remaining_seconds <= 0:
        _terminate_worker(process, job, close_pipes=True)
        raise PdfWorkerLimitError(
            "timeout",
            f"PDF parser worker exceeded {timeout_seconds:.3f} seconds",
        )
    raw, _stderr = _communicate_bounded(
        process,
        job,
        data,
        deadline=deadline,
        timeout_seconds=float(timeout_seconds),
        max_output_bytes=max_output_bytes,
    )
    if time.monotonic() >= deadline:
        raise PdfWorkerLimitError(
            "timeout",
            f"PDF parser worker exceeded {timeout_seconds:.3f} seconds",
        )
    result = _decode_packet(raw, max_output_bytes)
    if time.monotonic() >= deadline:
        raise PdfWorkerLimitError(
            "timeout",
            f"PDF parser worker exceeded {timeout_seconds:.3f} seconds",
        )
    return result


def parse_pdf_file_bounded(
    path: Path,
    *,
    max_input_bytes: int,
    extract_pages: int,
    max_total_pages: int,
    max_text_chars: int,
    timeout_seconds: float = 30.0,
    memory_limit_bytes: int = 512 * 1024 * 1024,
    max_output_bytes: int = 32 * 1024 * 1024,
    include_image_flags: bool = False,
    expected_sha256: str | None = None,
) -> PdfParseResult:
    if not isinstance(path, Path):
        raise TypeError("path must be pathlib.Path")
    if (
        not isinstance(max_input_bytes, int)
        or isinstance(max_input_bytes, bool)
        or max_input_bytes < 0
    ):
        raise ValueError("max_input_bytes must be a non-negative integer")
    started_at = time.monotonic()
    with path.open("rb") as source:
        snapshot = source.read(max_input_bytes + 1)
    if len(snapshot) > max_input_bytes:
        raise PdfWorkerLimitError(
            "input_bytes_limit",
            f"PDF input exceeded {max_input_bytes} bytes",
        )
    remaining_seconds = timeout_seconds - (time.monotonic() - started_at)
    if remaining_seconds <= 0:
        raise PdfWorkerLimitError(
            "timeout",
            f"PDF snapshot and parser exceeded {timeout_seconds:.3f} seconds",
        )
    return parse_pdf_bytes_bounded(
        snapshot,
        extract_pages=extract_pages,
        max_total_pages=max_total_pages,
        max_text_chars=max_text_chars,
        timeout_seconds=remaining_seconds,
        memory_limit_bytes=memory_limit_bytes,
        max_output_bytes=max_output_bytes,
        include_image_flags=include_image_flags,
        expected_sha256=expected_sha256,
    )


def hash_pdf_bytes_bounded(
    data: bytes,
    *,
    timeout_seconds: float = 10.0,
    memory_limit_bytes: int = 128 * 1024 * 1024,
) -> str:
    result = parse_pdf_bytes_bounded(
        data,
        extract_pages=0,
        max_total_pages=1,
        max_text_chars=0,
        timeout_seconds=timeout_seconds,
        memory_limit_bytes=memory_limit_bytes,
        max_output_bytes=4096,
        _hash_only=True,
    )
    return result.input_sha256


def hash_pdf_file_bounded(
    path: Path,
    *,
    max_input_bytes: int,
    timeout_seconds: float = 10.0,
    memory_limit_bytes: int = 128 * 1024 * 1024,
) -> str:
    with path.open("rb") as source:
        snapshot = source.read(max_input_bytes + 1)
    if len(snapshot) > max_input_bytes:
        raise PdfWorkerLimitError(
            "input_bytes_limit",
            f"PDF input exceeded {max_input_bytes} bytes",
        )
    return hash_pdf_bytes_bounded(
        snapshot,
        timeout_seconds=timeout_seconds,
        memory_limit_bytes=memory_limit_bytes,
    )


def _encode_payload(payload: dict[str, object]) -> bytes:
    body = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return _PROTOCOL_MAGIC + _PROTOCOL_HEADER.pack(len(body)) + body


def _limit_payload(
    code: str, message: str, page_count: int | None = None
) -> dict[str, object]:
    error: dict[str, object] = {
        "kind": "limit",
        "code": code,
        "message": message,
    }
    if page_count is not None:
        error["page_count"] = page_count
    return {"status": "error", "error": error}


def _object_has_image(value: object, seen: set[int]) -> bool:
    resolver = getattr(value, "get_object", None)
    if callable(resolver):
        value = resolver()
    identity = id(value)
    if identity in seen:
        return False
    seen.add(identity)
    getter = getattr(value, "get", None)
    if not callable(getter):
        return False
    if str(getter("/Subtype")) == "/Image":
        return True
    resources = getter("/Resources")
    if resources is not None and _resources_have_image(resources, seen):
        return True
    return False


def _resources_have_image(resources: object, seen: set[int] | None = None) -> bool:
    seen = seen if seen is not None else set()
    resolver = getattr(resources, "get_object", None)
    if callable(resolver):
        resources = resolver()
    getter = getattr(resources, "get", None)
    if not callable(getter):
        return False
    xobjects = getter("/XObject")
    if xobjects is None:
        return False
    resolver = getattr(xobjects, "get_object", None)
    if callable(resolver):
        xobjects = resolver()
    values = getattr(xobjects, "values", None)
    if not callable(values):
        return False
    return any(_object_has_image(value, seen) for value in values())


def _worker_parse(
    data: bytes,
    *,
    extract_pages: int,
    max_total_pages: int,
    max_text_chars: int,
    include_image_flags: bool,
    test_mode: str | None,
    expected_sha256: str | None,
    hash_only: bool,
) -> dict[str, object]:
    if test_mode == "hang_before_reader":
        while True:
            time.sleep(60.0)
    input_sha256 = hashlib.sha256(data).hexdigest()
    if expected_sha256 is not None and input_sha256 != expected_sha256:
        return {
            "status": "error",
            "error": {
                "kind": "worker",
                "code": "snapshot_digest_mismatch",
                "message": "PDF snapshot SHA-256 did not match the admitted file digest",
            },
        }
    if hash_only:
        return {
            "status": "ok",
            "page_count": 0,
            "pages": [],
            "input_sha256": input_sha256,
        }
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    page_count = len(reader.pages)
    if page_count > max_total_pages:
        return _limit_payload(
            "page_count_limit",
            f"PDF page count {page_count} exceeded {max_total_pages}",
            page_count,
        )

    pages: list[dict[str, object]] = []
    text_chars = 0
    for page_index in range(min(extract_pages, page_count)):
        page = reader.pages[page_index]
        if test_mode == "hang_after_reader":
            while True:
                time.sleep(60.0)
        text = page.extract_text() or ""
        text_chars += len(text)
        if text_chars > max_text_chars:
            return _limit_payload(
                "text_chars_limit",
                f"PDF extracted text exceeded {max_text_chars} characters",
                page_count,
            )
        has_image = False
        if include_image_flags:
            has_image = _resources_have_image(page.get("/Resources"))
        pages.append({"text": text, "has_image": has_image})
    return {
        "status": "ok",
        "page_count": page_count,
        "pages": pages,
        "input_sha256": input_sha256,
    }


def _write_worker_packet(payload: dict[str, object], max_output_bytes: int) -> None:
    packet = _encode_payload(payload)
    if len(packet) > max_output_bytes:
        packet = _encode_payload(
            _limit_payload(
                "output_bytes_limit",
                f"PDF worker output exceeded {max_output_bytes} bytes",
            )
        )
    sys.stdout.buffer.write(packet)
    sys.stdout.buffer.flush()


def _worker_main(args: argparse.Namespace) -> int:
    if os.name == "posix":
        import resource

        resource.setrlimit(
            resource.RLIMIT_AS,
            (args.memory_limit_bytes, args.memory_limit_bytes),
        )
    data = sys.stdin.buffer.read()
    if args.test_mode == "crash":
        os._exit(23)
    if args.test_mode == "malformed":
        sys.stdout.buffer.write(b"not-a-pdf-worker-packet")
        sys.stdout.buffer.flush()
        return 0
    if args.test_mode == "oversized":
        sys.stdout.buffer.write(b"x" * (args.max_output_bytes + 1))
        sys.stdout.buffer.flush()
        return 0
    try:
        payload = _worker_parse(
            data,
            extract_pages=args.extract_pages,
            max_total_pages=args.max_total_pages,
            max_text_chars=args.max_text_chars,
            include_image_flags=args.include_image_flags,
            test_mode=args.test_mode,
            expected_sha256=args.expected_sha256,
            hash_only=args.hash_only,
        )
        _write_worker_packet(payload, args.max_output_bytes)
        if args.test_mode == "trailing":
            sys.stdout.buffer.write(b"trailing")
            sys.stdout.buffer.flush()
        return 0
    except MemoryError:
        _write_worker_packet(
            _limit_payload("memory_limit", "PDF parser worker exhausted memory"),
            args.max_output_bytes,
        )
        return 0
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        print(f"PDF parser worker failed: {message}", file=sys.stderr)
        _write_worker_packet(
            {
                "status": "error",
                "error": {
                    "kind": "worker",
                    "code": "parse_error",
                    "message": message,
                },
            },
            args.max_output_bytes,
        )
        return 0


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Disposable bounded PDF parser worker")
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--extract-pages", type=int)
    parser.add_argument("--max-total-pages", type=int)
    parser.add_argument("--max-text-chars", type=int)
    parser.add_argument("--max-output-bytes", type=int)
    parser.add_argument("--memory-limit-bytes", type=int)
    parser.add_argument("--expected-sha256")
    parser.add_argument("--hash-only", action="store_true")
    parser.add_argument("--include-image-flags", action="store_true")
    parser.add_argument(
        "--test-mode",
        choices=(
            "hang_before_reader",
            "hang_after_reader",
            "crash",
            "malformed",
            "trailing",
            "oversized",
        ),
        help=argparse.SUPPRESS,
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_argument_parser()
    args = parser.parse_args(argv)
    if not args.worker:
        parser.error("--worker is required")
    required = (
        "extract_pages",
        "max_total_pages",
        "max_text_chars",
        "max_output_bytes",
    )
    missing = [name for name in required if getattr(args, name) is None]
    if missing:
        parser.error(f"missing worker limits: {', '.join(missing)}")
    return _worker_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
