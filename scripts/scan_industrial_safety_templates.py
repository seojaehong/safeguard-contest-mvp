from __future__ import annotations

import argparse
import json
import re
import time
import zipfile
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from openpyxl import load_workbook
from PIL import Image
from pypdf import PdfReader


KEYWORDS: dict[str, list[str]] = {
    "risk_assessment": ["위험성평가", "유해", "위험요인", "빈도", "강도", "감소대책", "개선대책"],
    "tbm_prework": ["TBM", "작업 전", "작업전", "안전점검회의", "일일안전", "공사감독일지", "안전감독일지"],
    "work_plan": ["작업계획서", "표준 작업계획서", "작업순서", "작업방법", "열수송관", "굴착"],
    "emergency_response": ["중대재해", "비상", "대응", "사고발생", "응급", "보고체계"],
    "education": ["교육", "협력회사", "전달", "근로자", "안전보건교육"],
    "contractor_owner": ["발주자", "시공자", "도급", "수급", "협력사"],
    "inspection": ["점검", "체크", "확인", "평가표", "수준 평가"],
    "photo_evidence": ["사진", "강평", "개선", "작업중지권", "신호수"],
}


@dataclass
class FileRecord:
    path: str
    relativePath: str
    extension: str
    size: int
    modified: str
    categoryHints: list[str]


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def category_hints(text: str) -> list[str]:
    hits: list[str] = []
    for category, words in KEYWORDS.items():
        if any(word.lower() in text.lower() for word in words):
            hits.append(category)
    return hits


def short_text(value: str, limit: int = 120) -> str:
    normalized = normalize_text(value)
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit].rstrip()}..."


def read_zip_xml_text(path: Path, xml_suffixes: tuple[str, ...]) -> list[str]:
    texts: list[str] = []
    try:
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if not name.lower().endswith(xml_suffixes):
                    continue
                try:
                    root = ElementTree.fromstring(archive.read(name))
                except ElementTree.ParseError:
                    continue
                for node in root.iter():
                    if node.text and normalize_text(node.text):
                        texts.append(normalize_text(node.text))
    except (OSError, zipfile.BadZipFile):
        return []
    return texts


def inspect_xlsx(path: Path) -> dict[str, Any]:
    try:
        workbook = load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - report scanner errors without failing the full run.
        return {"path": str(path), "error": str(exc)}

    sheets: list[dict[str, Any]] = []
    total_non_empty = 0
    for sheet in workbook.worksheets[:12]:
        rows: list[list[str]] = []
        non_empty = 0
        for row in sheet.iter_rows(max_row=25, max_col=12, values_only=True):
            values = [short_text(str(value)) if value is not None else "" for value in row]
            if any(values):
                non_empty += 1
                rows.append(values)
            if len(rows) >= 8:
                break
        total_non_empty += non_empty
        joined = " ".join(" ".join(row) for row in rows)
        sheets.append(
            {
                "name": sheet.title,
                "maxRow": sheet.max_row,
                "maxColumn": sheet.max_column,
                "sampleRows": rows,
                "categoryHints": category_hints(f"{sheet.title} {joined}"),
            }
        )
    workbook.close()
    return {
        "path": str(path),
        "sheetCount": len(workbook.sheetnames),
        "sheetNames": workbook.sheetnames[:30],
        "sampledSheets": sheets,
        "sampledNonEmptyRows": total_non_empty,
        "categoryHints": category_hints(f"{path.name} {' '.join(workbook.sheetnames)}"),
    }


def inspect_hwpx(path: Path) -> dict[str, Any]:
    texts = read_zip_xml_text(path, (".xml",))
    joined = " ".join(texts)
    headings = [short_text(text) for text in texts if 3 <= len(text) <= 80]
    return {
        "path": str(path),
        "textNodeCount": len(texts),
        "sampleHeadings": headings[:30],
        "categoryHints": category_hints(f"{path.name} {joined[:3000]}"),
    }


def inspect_pptx(path: Path) -> dict[str, Any]:
    texts = read_zip_xml_text(path, (".xml",))
    joined = " ".join(texts)
    return {
        "path": str(path),
        "textNodeCount": len(texts),
        "sampleTexts": [short_text(text) for text in texts[:60]],
        "categoryHints": category_hints(f"{path.name} {joined[:3000]}"),
    }


def inspect_pdf(path: Path) -> dict[str, Any]:
    try:
        reader = PdfReader(str(path))
        page_count = len(reader.pages)
        snippets: list[str] = []
        for page in reader.pages[:5]:
            text = page.extract_text() or ""
            for line in text.splitlines():
                clean = normalize_text(line)
                if len(clean) >= 3:
                    snippets.append(short_text(clean))
                if len(snippets) >= 30:
                    break
            if len(snippets) >= 30:
                break
    except Exception as exc:  # noqa: BLE001
        return {"path": str(path), "error": str(exc)}
    return {
        "path": str(path),
        "pageCount": page_count,
        "sampleTexts": snippets,
        "categoryHints": category_hints(f"{path.name} {' '.join(snippets)}"),
    }


def inspect_image(path: Path) -> dict[str, Any]:
    try:
        with Image.open(path) as image:
            width, height = image.size
            mode = image.mode
    except Exception as exc:  # noqa: BLE001
        return {"path": str(path), "error": str(exc)}
    return {
        "path": str(path),
        "width": width,
        "height": height,
        "mode": mode,
        "megapixels": round((width * height) / 1_000_000, 2),
        "categoryHints": category_hints(path.name),
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan industrial safety template sources.")
    parser.add_argument("--source", required=True, help="Source directory to scan.")
    parser.add_argument("--out", required=True, help="Output directory for scan artifacts.")
    args = parser.parse_args()

    started = time.perf_counter()
    source = Path(args.source)
    out = Path(args.out)
    files = [path for path in source.rglob("*") if path.is_file()]
    records: list[FileRecord] = []
    by_extension: Counter[str] = Counter()
    by_top_folder: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    largest: list[dict[str, Any]] = []

    for path in files:
        extension = path.suffix.lower() or "[none]"
        relative = path.relative_to(source)
        hint_text = f"{relative.as_posix()} {path.name}"
        hints = category_hints(hint_text)
        for hint in hints:
            category_counts[hint] += 1
        by_extension[extension] += 1
        parts = relative.parts
        by_top_folder[parts[0] if len(parts) > 1 else "[root]"] += 1
        records.append(
            FileRecord(
                path=str(path),
                relativePath=str(relative),
                extension=extension,
                size=path.stat().st_size,
                modified=path.stat().st_mtime_ns.__str__(),
                categoryHints=hints,
            )
        )
        largest.append({"path": str(path), "relativePath": str(relative), "size": path.stat().st_size})

    largest = sorted(largest, key=lambda item: int(item["size"]), reverse=True)[:50]

    structured_docs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for path in files:
        suffix = path.suffix.lower()
        if suffix == ".xlsx":
            structured_docs["xlsx"].append(inspect_xlsx(path))
        elif suffix == ".hwpx":
            structured_docs["hwpx"].append(inspect_hwpx(path))
        elif suffix == ".pdf":
            structured_docs["pdf"].append(inspect_pdf(path))
        elif suffix == ".pptx":
            structured_docs["pptx"].append(inspect_pptx(path))

    image_records = [inspect_image(path) for path in files if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp"}]
    image_by_folder: Counter[str] = Counter()
    for item in image_records:
        raw_path = item.get("path")
        if not isinstance(raw_path, str):
            continue
        relative = Path(raw_path).relative_to(source)
        image_by_folder[relative.parts[0] if len(relative.parts) > 1 else "[root]"] += 1

    summary = {
        "sourceDirectory": str(source),
        "elapsedSeconds": round(time.perf_counter() - started, 2),
        "fileCount": len(files),
        "byExtension": dict(by_extension.most_common()),
        "byTopFolder": dict(by_top_folder.most_common()),
        "categoryCounts": dict(category_counts.most_common()),
        "largestFiles": largest,
        "structuredCounts": {key: len(value) for key, value in structured_docs.items()},
        "imageCount": len(image_records),
        "imageByTopFolder": dict(image_by_folder.most_common()),
    }

    candidate_records = [
        asdict(record)
        for record in records
        if record.extension in {".xlsx", ".hwpx", ".pdf", ".pptx", ".hwp"}
        or record.categoryHints
    ]

    write_json(out / "summary.json", summary)
    write_json(out / "inventory.json", [asdict(record) for record in records])
    write_json(out / "candidate-records.json", candidate_records)
    write_json(out / "structured-documents.json", structured_docs)
    write_json(out / "image-inventory-summary.json", {"count": len(image_records), "samples": image_records[:120]})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
