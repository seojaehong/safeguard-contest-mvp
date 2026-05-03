#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const defaultRoots = [
  { path: "C:\\Users\\iceam\\Downloads", maxDepth: 0 },
  { path: "C:\\Users\\iceam\\OneDrive\\_30_컨설팅\\2025\\산업안전\\4.0 권고사항(절차서 및 서식)", maxDepth: 2 }
];

const outDir = path.resolve(process.env.SAFECLAW_HWPX_INVENTORY_OUT_DIR || path.join(process.cwd(), "evaluation", "hwpx-template-inventory"));
const excludedFilePatterns = [/급여/, /괴롭힘/, /취업규칙/, /업무분장/, /상담신청서/];

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
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65558); offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) return offset;
  }
  return -1;
}

function listZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    return { ok: false, entries: [], error: "zip central directory not found" };
  }

  const entryCount = readUInt16(buffer, eocd + 10);
  let offset = readUInt32(buffer, eocd + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) break;
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const nameStart = offset + 46;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    entries.push({ name, compressedSize, uncompressedSize });
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return { ok: true, entries, error: "" };
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
  const stat = fs.statSync(filePath);
  const zip = listZipEntries(filePath);
  const entries = zip.entries;
  const sectionEntries = entries.filter((entry) => /^Contents\/section/i.test(entry.name));
  const hasManifest = entries.some((entry) => /manifest\.xml$/i.test(entry.name));
  const hasVersion = entries.some((entry) => /version\.xml$/i.test(entry.name));
  return {
    path: filePath,
    fileName: path.basename(filePath),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
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

main();
