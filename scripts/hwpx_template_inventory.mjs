import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const defaultRoots = [
  { path: "C:\\Users\\iceam\\Downloads", maxDepth: 0 },
  { path: "C:\\Users\\iceam\\OneDrive\\_30_컨설팅\\2025\\산업안전\\4.0 권고사항(절차서 및 서식)", maxDepth: 2 }
];

const outDir = path.resolve(process.env.SAFECLAW_HWPX_INVENTORY_OUT_DIR || path.join(process.cwd(), "evaluation", "hwpx-template-inventory"));
const excludedFilePatterns = [/급여/, /괴롭힘/, /취업규칙/, /업무분장/, /상담신청서/];

export const HWPX_INVENTORY_BUDGETS = Object.freeze({
  inputBytes: 128 * 1024 * 1024,
  archiveEntries: 64,
  centralDirectoryBytes: 1024 * 1024,
  fileNameBytes: 4096,
  eocdSearchBytes: 65_557
});

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, maxDepth, depth = 0) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return depth < maxDepth ? walk(fullPath, maxDepth, depth + 1) : [];
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".hwpx")) return [];
    return excludedFilePatterns.some((pattern) => pattern.test(entry.name)) ? [] : [fullPath];
  });
}

function readUInt16(buffer, offset) {
  return offset + 2 <= buffer.length ? buffer.readUInt16LE(offset) : 0;
}

function readUInt32(buffer, offset) {
  return offset + 4 <= buffer.length ? buffer.readUInt32LE(offset) : 0;
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(buffer, offset) !== 0x06054b50) continue;
    const commentLength = readUInt16(buffer, offset + 20);
    if (offset + 22 + commentLength === buffer.length) return offset;
  }
  return -1;
}

function readExactly(fileDescriptor, length, position) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const bytesRead = fs.readSync(fileDescriptor, buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) throw new Error("zip central directory is truncated");
    offset += bytesRead;
  }
  return buffer;
}

function parseCentralDirectory(buffer, declaredEntryCount) {
  let offset = 0;
  const entries = [];

  while (offset < buffer.length) {
    const signature = readUInt32(buffer, offset);
    if (signature === 0x05054b50) {
      const signatureLength = readUInt16(buffer, offset + 4);
      offset += 6 + signatureLength;
      continue;
    }
    if (signature !== 0x02014b50 || offset + 46 > buffer.length) {
      throw new Error("zip central directory entry is invalid");
    }
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("zip64 members are not supported");
    }
    if (fileNameLength > HWPX_INVENTORY_BUDGETS.fileNameBytes) {
      throw new Error("zip entry name exceeds the byte budget");
    }
    const nameStart = offset + 46;
    const nextOffset = nameStart + fileNameLength + extraLength + commentLength;
    if (nextOffset > buffer.length) throw new Error("zip central directory entry is truncated");
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    entries.push({ name, compressedSize, uncompressedSize });
    if (entries.length > HWPX_INVENTORY_BUDGETS.archiveEntries) {
      throw new Error("zip entry count exceeds the budget");
    }
    offset = nextOffset;
  }

  if (offset !== buffer.length || entries.length !== declaredEntryCount) {
    throw new Error(`zip central directory count mismatch: ${entries.length}/${declaredEntryCount}`);
  }
  return entries;
}

export function listZipEntries(filePath) {
  let fileDescriptor;
  let bytes = 0;
  let modifiedAt = null;
  try {
    fileDescriptor = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fileDescriptor);
    bytes = stat.size;
    modifiedAt = stat.mtime.toISOString();
    if (stat.size > HWPX_INVENTORY_BUDGETS.inputBytes) {
      throw new Error(`hwpx file exceeds the byte budget: ${stat.size}/${HWPX_INVENTORY_BUDGETS.inputBytes}`);
    }
    if (stat.size < 22) throw new Error("zip central directory not found");

    const tailSize = Math.min(stat.size, HWPX_INVENTORY_BUDGETS.eocdSearchBytes);
    const tailStart = stat.size - tailSize;
    const tail = readExactly(fileDescriptor, tailSize, tailStart);
    const eocd = findEndOfCentralDirectory(tail);
    if (eocd < 0) throw new Error("zip central directory not found");

    const diskNumber = readUInt16(tail, eocd + 4);
    const centralDirectoryDisk = readUInt16(tail, eocd + 6);
    const diskEntryCount = readUInt16(tail, eocd + 8);
    const entryCount = readUInt16(tail, eocd + 10);
    const centralDirectorySize = readUInt32(tail, eocd + 12);
    const centralDirectoryOffset = readUInt32(tail, eocd + 16);
    const eocdAbsoluteOffset = tailStart + eocd;
    if (diskNumber !== 0 || centralDirectoryDisk !== 0 || diskEntryCount !== entryCount) {
      throw new Error("multi-disk zip archives are not supported");
    }
    if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
      throw new Error("zip64 central directories are not supported");
    }
    if (entryCount > HWPX_INVENTORY_BUDGETS.archiveEntries) {
      throw new Error("zip entry count exceeds the budget");
    }
    if (centralDirectorySize > HWPX_INVENTORY_BUDGETS.centralDirectoryBytes) {
      throw new Error("zip central directory exceeds the byte budget");
    }
    if (centralDirectoryOffset + centralDirectorySize > eocdAbsoluteOffset) {
      throw new Error("zip central directory bounds are invalid");
    }

    const centralDirectory = readExactly(fileDescriptor, centralDirectorySize, centralDirectoryOffset);
    return { ok: true, entries: parseCentralDirectory(centralDirectory, entryCount), error: "", bytes, modifiedAt };
  } catch (error) {
    return {
      ok: false,
      entries: [],
      error: error instanceof Error ? error.message : String(error),
      bytes,
      modifiedAt
    };
  } finally {
    if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
  }
}

function classifyTemplate(filePath, entries) {
  const fileName = path.basename(filePath);
  const haystack = `${fileName} ${entries.map((entry) => entry.name).join(" ")}`;
  if (/TBM|Tool Box|툴박스/i.test(haystack)) return "tbm";
  if (/위험성평가|risk/i.test(haystack)) return "risk-assessment";
  if (/작업계획|work plan/i.test(haystack)) return "work-plan";
  if (/허가|permit/i.test(haystack)) return "permit";
  if (/교육|안전수칙|이행각서/i.test(haystack)) return "education";
  if (/건강|문진/i.test(haystack)) return "health-check";
  if (/감독일지|일지/i.test(haystack)) return "daily-log";
  if (/중대재해|비상|대응/i.test(haystack)) return "emergency";
  return "other";
}

function summarizeTemplate(filePath) {
  const zip = listZipEntries(filePath);
  const entries = zip.entries;
  const sectionEntries = entries.filter((entry) => /^Contents\/section/i.test(entry.name));
  const hasManifest = entries.some((entry) => /manifest\.xml$/i.test(entry.name));
  const hasVersion = entries.some((entry) => /version\.xml$/i.test(entry.name));
  return {
    path: filePath,
    fileName: path.basename(filePath),
    bytes: zip.bytes,
    modifiedAt: zip.modifiedAt,
    readableZip: zip.ok,
    error: zip.error || null,
    class: classifyTemplate(filePath, entries),
    entryCount: entries.length,
    sectionCount: sectionEntries.length,
    hasManifest,
    hasVersion,
    representativeEntries: entries.slice(0, 12).map((entry) => entry.name)
  };
}

function main() {
  ensureDir(outDir);
  const rootConfigs = process.env.SAFECLAW_HWPX_TEMPLATE_ROOTS
    ? process.env.SAFECLAW_HWPX_TEMPLATE_ROOTS.split(";")
      .map((root) => ({ path: root.trim(), maxDepth: 4 }))
      .filter((root) => root.path)
    : defaultRoots;
  const files = Array.from(new Set(rootConfigs.flatMap((root) => walk(root.path, root.maxDepth)))).sort((left, right) => left.localeCompare(right, "ko-KR"));
  const templates = files.map(summarizeTemplate);
  const byClass = templates.reduce((acc, template) => {
    acc[template.class] = (acc[template.class] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    roots: rootConfigs,
    totalFiles: templates.length,
    readableZipCount: templates.filter((template) => template.readableZip).length,
    byClass,
    launchUse: {
      currentState: "SafeClaw HWPX export uses @rhwp text generation.",
      nextGate: "Pixel-level public-institution forms require a template-preserving HWPX renderer that edits existing package XML instead of rebuilding a plain document."
    },
    templates
  };
  fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outDir, totalFiles: report.totalFiles, readableZipCount: report.readableZipCount, byClass }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
