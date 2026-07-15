from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

import fitz


OCR_CANDIDATE_SCHEMA_VERSION = "safeclaw-kosha-ocr-candidate/v1"
OCR_REVIEW_ATTESTATION_SCHEMA_VERSION = "safeclaw-kosha-ocr-review-attestation/v1"
OCR_GENERATOR_ID = "safeclaw-kosha-ocr-boundary"
OCR_GENERATOR_VERSION = "1"
DEFAULT_MODEL = "gpt-4.1-mini"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_DPI = 180
DEFAULT_MAX_PAGES = 50
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
RFC3339_PATTERN = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)


class OcrBoundaryError(RuntimeError):
    pass


@dataclass(frozen=True)
class OcrPageResponse:
    text: str
    response_id: str
    model: str
    created_at: int | None
    status: str


class VisionTransport(Protocol):
    def transcribe_page(
        self,
        *,
        page_number: int,
        image_png: bytes,
        image_sha256: str,
    ) -> OcrPageResponse: ...


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _normalize_text(value: str) -> str:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[\t \u00a0]+", " ", line).strip() for line in normalized.split("\n")]
    compacted: list[str] = []
    for line in lines:
        if line or (compacted and compacted[-1]):
            compacted.append(line)
    return "\n".join(compacted).strip()


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _candidate_content_sha256(candidate: dict[str, object]) -> str:
    immutable_content = {key: value for key, value in candidate.items() if key != "review"}
    return _sha256_bytes(_canonical_json(immutable_content).encode("utf-8"))


def _validate_reviewed_at(value: object) -> str:
    if not isinstance(value, str) or not RFC3339_PATTERN.fullmatch(value):
        raise OcrBoundaryError("ocr_candidate_reviewed_at_invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise OcrBoundaryError("ocr_candidate_reviewed_at_invalid") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise OcrBoundaryError("ocr_candidate_reviewed_at_invalid")
    return value


def _require_review_hmac_key(hmac_key: bytes) -> None:
    if len(hmac_key) < 32:
        raise OcrBoundaryError("ocr_candidate_review_key_too_short")


def _review_signature_payload(review: dict[str, object]) -> dict[str, object]:
    return {
        "attestation_schema": review.get("attestation_schema"),
        "content_sha256": review.get("content_sha256"),
        "human_confirmed": review.get("human_confirmed"),
        "reviewed_at": review.get("reviewed_at"),
        "reviewed_by": review.get("reviewed_by"),
        "state": review.get("state"),
    }


def create_review_attestation(
    candidate: dict[str, object],
    *,
    reviewer_id: str,
    reviewed_at: str,
    hmac_key: bytes,
) -> dict[str, object]:
    reviewer = reviewer_id.strip()
    if not reviewer:
        raise OcrBoundaryError("ocr_candidate_reviewer_missing")
    timestamp = _validate_reviewed_at(reviewed_at)
    _require_review_hmac_key(hmac_key)
    review: dict[str, object] = {
        "state": "verified",
        "human_confirmed": True,
        "reviewed_by": reviewer,
        "reviewed_at": timestamp,
        "attestation_schema": OCR_REVIEW_ATTESTATION_SCHEMA_VERSION,
        "content_sha256": _candidate_content_sha256(candidate),
    }
    signature = hmac.new(
        hmac_key,
        _canonical_json(_review_signature_payload(review)).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {**review, "signature_hmac_sha256": signature}


def validate_output_path(source_pdf: Path, output: Path, *, overwrite: bool) -> Path:
    source_resolved = source_pdf.resolve()
    output_resolved = output.resolve()
    if output_resolved == source_resolved:
        raise OcrBoundaryError("output_matches_source")
    if output_resolved.suffix.lower() != ".json":
        raise OcrBoundaryError("output_must_be_json")
    if output_resolved.exists():
        if output_resolved.is_dir():
            raise OcrBoundaryError("output_is_directory")
        if not overwrite:
            raise OcrBoundaryError("output_exists")
    return output_resolved


def _atomic_write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = f"{_canonical_json(value)}\n".encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as file:
            file.write(encoded)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_name, path)
    finally:
        temporary_path = Path(temporary_name)
        if temporary_path.exists():
            temporary_path.unlink()


def _read_text(record: dict[str, object], key: str) -> str:
    value = record.get(key)
    return value.strip() if isinstance(value, str) else ""


def _extract_response_text(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text
    output = payload.get("output")
    if not isinstance(output, list):
        return ""
    parts: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text)
    return "\n".join(parts)


def _ocr_prompt(page_number: int) -> str:
    return (
        f"이 이미지는 KOSHA 기술지원규정 PDF의 물리 페이지 {page_number}입니다. "
        "페이지에 보이는 한국어와 영문을 읽기 순서대로 정확히 전사하세요. "
        "제목, 조항 번호, 표 셀, 머리말과 꼬리말을 빠뜨리지 말고, 보이지 않는 내용을 추론하지 마세요. "
        "설명, 요약, 마크다운 코드펜스 없이 전사한 본문만 출력하세요."
    )


class OpenAiResponsesVisionTransport:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        retries: int = 1,
    ) -> None:
        if not api_key.strip():
            raise OcrBoundaryError("openai_api_key_missing")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be greater than zero")
        if retries < 0 or retries > 3:
            raise ValueError("retries must be between zero and three")
        self._api_key = api_key.strip()
        self._model = model.strip() or DEFAULT_MODEL
        self._timeout_seconds = timeout_seconds
        self._retries = retries

    def _request(self, body: bytes) -> dict[str, object]:
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=body,
            method="POST",
            headers={
                "authorization": f"Bearer {self._api_key}",
                "content-type": "application/json",
            },
        )
        last_error = "unknown"
        for attempt in range(self._retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self._timeout_seconds) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                if not isinstance(payload, dict):
                    raise OcrBoundaryError("openai_response_not_object")
                return payload
            except urllib.error.HTTPError as exc:
                last_error = f"http_{exc.code}"
                retryable = exc.code == 429 or exc.code >= 500
                if not retryable or attempt >= self._retries:
                    break
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = type(exc).__name__
                if attempt >= self._retries:
                    break
            if attempt < self._retries:
                time.sleep(0.5 * (attempt + 1))
        raise OcrBoundaryError(f"openai_vision_failed:{last_error}")

    def transcribe_page(
        self,
        *,
        page_number: int,
        image_png: bytes,
        image_sha256: str,
    ) -> OcrPageResponse:
        if _sha256_bytes(image_png) != image_sha256:
            raise OcrBoundaryError(f"page_image_hash_mismatch:{page_number}")
        image_url = f"data:image/png;base64,{base64.b64encode(image_png).decode('ascii')}"
        body = _canonical_json(
            {
                "model": self._model,
                "input": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": _ocr_prompt(page_number)},
                            {"type": "input_image", "image_url": image_url, "detail": "high"},
                        ],
                    }
                ],
                "max_output_tokens": 4000,
                "store": False,
            }
        ).encode("utf-8")
        payload = self._request(body)
        status = _read_text(payload, "status")
        if status != "completed":
            incomplete_details = payload.get("incomplete_details")
            reason = (
                _read_text(incomplete_details, "reason")
                if isinstance(incomplete_details, dict)
                else ""
            )
            if status == "incomplete":
                raise OcrBoundaryError(
                    f"openai_response_incomplete:{page_number}:{reason or 'unknown'}"
                )
            raise OcrBoundaryError(
                f"openai_response_status_invalid:{page_number}:{status or 'missing'}"
            )
        text = _extract_response_text(payload)
        response_id = _read_text(payload, "id")
        model = _read_text(payload, "model") or self._model
        created_value = payload.get("created_at")
        created_at = int(created_value) if isinstance(created_value, int | float) else None
        if not response_id:
            raise OcrBoundaryError(f"openai_response_id_missing:{page_number}")
        return OcrPageResponse(
            text=text,
            response_id=response_id,
            model=model,
            created_at=created_at,
            status=status,
        )


def recover_pdf_candidate(
    *,
    source_pdf: Path,
    item_id: str,
    expected_raw_sha256: str,
    transport: VisionTransport,
    dpi: int = DEFAULT_DPI,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> dict[str, object]:
    if not source_pdf.is_file():
        raise OcrBoundaryError("source_pdf_missing")
    if not item_id.strip():
        raise OcrBoundaryError("item_id_missing")
    expected_hash = expected_raw_sha256.strip().lower()
    if not SHA256_PATTERN.fullmatch(expected_hash):
        raise OcrBoundaryError("expected_raw_sha256_invalid")
    if dpi < 72 or dpi > 300:
        raise OcrBoundaryError("dpi_out_of_range")
    if max_pages <= 0 or max_pages > 200:
        raise OcrBoundaryError("max_pages_out_of_range")

    source_bytes = source_pdf.read_bytes()
    raw_sha256 = _sha256_bytes(source_bytes)
    if raw_sha256 != expected_hash:
        raise OcrBoundaryError(f"source_hash_mismatch:{raw_sha256}")

    try:
        document = fitz.open(stream=source_bytes, filetype="pdf")
    except Exception as exc:
        raise OcrBoundaryError(f"source_pdf_invalid:{type(exc).__name__}") from exc
    try:
        page_count = document.page_count
        if page_count <= 0:
            raise OcrBoundaryError("source_pdf_has_no_pages")
        if page_count > max_pages:
            raise OcrBoundaryError(f"source_pdf_page_limit:{page_count}/{max_pages}")
        matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        page_rows: list[dict[str, object]] = []
        page_texts: list[str] = []
        for index in range(page_count):
            page_number = index + 1
            page = document.load_page(index)
            image_png = page.get_pixmap(matrix=matrix, alpha=False).tobytes("png")
            image_sha256 = _sha256_bytes(image_png)
            response = transport.transcribe_page(
                page_number=page_number,
                image_png=image_png,
                image_sha256=image_sha256,
            )
            text = _normalize_text(response.text)
            if response.status != "completed":
                raise OcrBoundaryError(
                    f"ocr_page_response_status_invalid:{page_number}:{response.status or 'missing'}"
                )
            if not text:
                raise OcrBoundaryError(f"empty_ocr_page:{page_number}")
            text_sha256 = _sha256_bytes(text.encode("utf-8"))
            page_rows.append(
                {
                    "page_number": page_number,
                    "image_sha256": image_sha256,
                    "text": text,
                    "text_sha256": text_sha256,
                    "normalized_char_count": len(re.sub(r"\s+", "", text)),
                    "response_id": response.response_id,
                    "model": response.model,
                    "created_at": response.created_at,
                    "response_status": response.status,
                }
            )
            page_texts.append(text)
    finally:
        document.close()

    body = "\n".join(page_texts)
    return {
        "schema_version": OCR_CANDIDATE_SCHEMA_VERSION,
        "status": "candidate",
        "source": {
            "item_id": item_id.strip(),
            "file_name": source_pdf.name,
            "raw_sha256": raw_sha256,
            "page_count": page_count,
            "render_dpi": dpi,
        },
        "generator": {
            "id": OCR_GENERATOR_ID,
            "version": OCR_GENERATOR_VERSION,
            "script_sha256": _sha256_bytes(Path(__file__).read_bytes()),
        },
        "pages": page_rows,
        "body": body,
        "body_sha256": _sha256_bytes(body.encode("utf-8")),
        "normalized_char_count": len(re.sub(r"\s+", "", body)),
        "review": {
            "state": "draft",
            "human_confirmed": False,
            "reviewed_by": None,
            "reviewed_at": None,
        },
        "network_calls_performed": True,
        "ocr_performed": True,
        "db_mutation_performed": False,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def validate_reviewed_candidate(
    candidate: dict[str, object],
    *,
    expected_item_id: str,
    expected_raw_sha256: str,
    source_pdf: Path | None = None,
    trusted_reviewer_ids: set[str] | None = None,
    review_hmac_key: bytes | None = None,
    expected_generator_sha256: str | None = None,
) -> dict[str, object]:
    if candidate.get("schema_version") != OCR_CANDIDATE_SCHEMA_VERSION:
        raise OcrBoundaryError("ocr_candidate_schema_invalid")
    if candidate.get("status") != "candidate":
        raise OcrBoundaryError("ocr_candidate_status_invalid")
    source = candidate.get("source")
    if not isinstance(source, dict):
        raise OcrBoundaryError("ocr_candidate_source_invalid")
    if source.get("item_id") != expected_item_id:
        raise OcrBoundaryError("ocr_candidate_item_mismatch")
    if source.get("raw_sha256") != expected_raw_sha256:
        raise OcrBoundaryError("ocr_candidate_source_hash_mismatch")
    generator = candidate.get("generator")
    if not isinstance(generator, dict):
        raise OcrBoundaryError("ocr_candidate_generator_missing")
    if generator.get("id") != OCR_GENERATOR_ID or generator.get("version") != OCR_GENERATOR_VERSION:
        raise OcrBoundaryError("ocr_candidate_generator_invalid")
    if not SHA256_PATTERN.fullmatch(_read_text(generator, "script_sha256")):
        raise OcrBoundaryError("ocr_candidate_generator_hash_invalid")
    review = candidate.get("review")
    if not isinstance(review, dict):
        raise OcrBoundaryError("ocr_candidate_review_invalid")
    if review.get("state") != "verified" or review.get("human_confirmed") is not True:
        raise OcrBoundaryError("ocr_candidate_not_human_confirmed")
    reviewer = _read_text(review, "reviewed_by")
    if not reviewer:
        raise OcrBoundaryError("ocr_candidate_reviewer_missing")
    if trusted_reviewer_ids is None or reviewer not in trusted_reviewer_ids:
        raise OcrBoundaryError("ocr_candidate_reviewer_untrusted")
    expected_generator_hash = (expected_generator_sha256 or "").strip().lower()
    if not SHA256_PATTERN.fullmatch(expected_generator_hash):
        raise OcrBoundaryError("ocr_candidate_generator_hash_required")
    if _read_text(generator, "script_sha256") != expected_generator_hash:
        raise OcrBoundaryError("ocr_candidate_generator_hash_mismatch")
    _validate_reviewed_at(review.get("reviewed_at"))
    if review.get("attestation_schema") != OCR_REVIEW_ATTESTATION_SCHEMA_VERSION:
        raise OcrBoundaryError("ocr_candidate_attestation_schema_invalid")
    pages = candidate.get("pages")
    if not isinstance(pages, list) or not pages:
        raise OcrBoundaryError("ocr_candidate_pages_missing")
    if source.get("page_count") != len(pages):
        raise OcrBoundaryError("ocr_candidate_page_count_mismatch")
    page_texts: list[str] = []
    for expected_page, row in enumerate(pages, start=1):
        if not isinstance(row, dict) or row.get("page_number") != expected_page:
            raise OcrBoundaryError(f"ocr_candidate_page_sequence_invalid:{expected_page}")
        if not _read_text(row, "response_id") or not _read_text(row, "model"):
            raise OcrBoundaryError(f"ocr_candidate_page_response_missing:{expected_page}")
        if row.get("response_status") != "completed":
            raise OcrBoundaryError(f"ocr_candidate_page_response_incomplete:{expected_page}")
        image_sha256 = _read_text(row, "image_sha256")
        if not SHA256_PATTERN.fullmatch(image_sha256):
            raise OcrBoundaryError(f"ocr_candidate_page_image_hash_invalid:{expected_page}")
        text = row.get("text")
        if not isinstance(text, str) or not text.strip():
            raise OcrBoundaryError(f"ocr_candidate_page_text_missing:{expected_page}")
        normalized = _normalize_text(text)
        if row.get("text_sha256") != _sha256_bytes(normalized.encode("utf-8")):
            raise OcrBoundaryError(f"ocr_candidate_page_text_hash_mismatch:{expected_page}")
        page_texts.append(normalized)
    body = "\n".join(page_texts)
    if candidate.get("body") != body:
        raise OcrBoundaryError("ocr_candidate_body_mismatch")
    if candidate.get("body_sha256") != _sha256_bytes(body.encode("utf-8")):
        raise OcrBoundaryError("ocr_candidate_body_hash_mismatch")
    if candidate.get("db_mutation_performed") is not False:
        raise OcrBoundaryError("ocr_candidate_db_boundary_invalid")
    if source_pdf is None:
        raise OcrBoundaryError("ocr_candidate_source_pdf_required")
    if not source_pdf.is_file():
        raise OcrBoundaryError("ocr_candidate_source_pdf_missing")
    source_bytes = source_pdf.read_bytes()
    if _sha256_bytes(source_bytes) != expected_raw_sha256:
        raise OcrBoundaryError("ocr_candidate_source_file_hash_mismatch")
    render_dpi = source.get("render_dpi")
    if not isinstance(render_dpi, int) or render_dpi < 72 or render_dpi > 300:
        raise OcrBoundaryError("ocr_candidate_render_dpi_invalid")
    try:
        document = fitz.open(stream=source_bytes, filetype="pdf")
    except Exception as exc:
        raise OcrBoundaryError(f"ocr_candidate_source_pdf_invalid:{type(exc).__name__}") from exc
    try:
        if document.page_count != len(pages):
            raise OcrBoundaryError("ocr_candidate_source_page_count_mismatch")
        matrix = fitz.Matrix(render_dpi / 72.0, render_dpi / 72.0)
        for index, row in enumerate(pages):
            rendered = document.load_page(index).get_pixmap(matrix=matrix, alpha=False).tobytes("png")
            if row.get("image_sha256") != _sha256_bytes(rendered):
                raise OcrBoundaryError(f"ocr_candidate_source_image_hash_mismatch:{index + 1}")
    finally:
        document.close()
    content_sha256 = _candidate_content_sha256(candidate)
    if review.get("content_sha256") != content_sha256:
        raise OcrBoundaryError("ocr_candidate_attestation_content_mismatch")
    if review_hmac_key is None:
        raise OcrBoundaryError("ocr_candidate_review_key_missing")
    _require_review_hmac_key(review_hmac_key)
    expected_signature = hmac.new(
        review_hmac_key,
        _canonical_json(_review_signature_payload(review)).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    signature = _read_text(review, "signature_hmac_sha256")
    if not hmac.compare_digest(signature, expected_signature):
        raise OcrBoundaryError("ocr_candidate_attestation_signature_invalid")
    return candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a fail-closed OCR candidate for one image-only KOSHA PDF."
    )
    parser.add_argument("--source-pdf", required=True)
    parser.add_argument("--item-id", required=True)
    parser.add_argument("--expected-raw-sha256", required=True)
    parser.add_argument("--output")
    parser.add_argument("--model", default=os.environ.get("OPENAI_VISION_MODEL", DEFAULT_MODEL))
    parser.add_argument("--dpi", type=int, default=DEFAULT_DPI)
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES)
    parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    source_pdf = Path(args.source_pdf)
    try:
        if not source_pdf.is_file():
            raise OcrBoundaryError("source_pdf_missing")
        raw_sha256 = _sha256_bytes(source_pdf.read_bytes())
        if raw_sha256 != args.expected_raw_sha256.strip().lower():
            raise OcrBoundaryError(f"source_hash_mismatch:{raw_sha256}")
        with fitz.open(source_pdf) as document:
            page_count = document.page_count
        if args.preflight:
            print(
                _canonical_json(
                    {
                        "ok": True,
                        "source_file": source_pdf.name,
                        "raw_sha256": raw_sha256,
                        "page_count": page_count,
                        "network_calls_performed": False,
                        "db_mutation_performed": False,
                    }
                )
            )
            return 0
        if not args.output:
            raise OcrBoundaryError("output_path_required")
        output = validate_output_path(source_pdf, Path(args.output), overwrite=args.overwrite)
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        transport = OpenAiResponsesVisionTransport(
            api_key=api_key,
            model=args.model,
            timeout_seconds=args.timeout_seconds,
            retries=args.retries,
        )
        candidate = recover_pdf_candidate(
            source_pdf=source_pdf,
            item_id=args.item_id,
            expected_raw_sha256=raw_sha256,
            transport=transport,
            dpi=args.dpi,
            max_pages=args.max_pages,
        )
        _atomic_write_json(output, candidate)
        print(
            _canonical_json(
                {
                    "ok": True,
                    "status": candidate["status"],
                    "item_id": args.item_id,
                    "page_count": page_count,
                    "body_sha256": candidate["body_sha256"],
                    "output": output.name,
                    "human_confirmed": False,
                    "db_mutation_performed": False,
                }
            )
        )
        return 0
    except Exception as exc:
        print(f"KOSHA OCR boundary recovery failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
