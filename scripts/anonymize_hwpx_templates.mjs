#!/usr/bin/env node
// Anonymize HWPX templates by replacing company names with placeholders.
// Reads templates/hwpx-source/*.hwpx (gitignored), writes templates/hwpx/*.hwpx (committed).
// HWPX requires `mimetype` first and STORED; the in-process archive transform
// preserves that contract without materializing archive members on disk.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import AdmZip from "adm-zip";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(repoRoot, "templates", "hwpx-source");
const outDir = path.join(repoRoot, "templates", "hwpx");

export const HWPX_ANONYMIZATION_BUDGETS = {
  inputBytes: 8 * 1024 * 1024,
  outputBytes: 8 * 1024 * 1024,
  archiveEntries: 64,
  archiveTotalUncompressedBytes: 20 * 1024 * 1024,
  archiveEntryUncompressedBytes: 10 * 1024 * 1024,
  elapsedMs: 10_000
};

function loadCleanupTokens() {
  const configPath = path.join(srcDir, ".cleanup-tokens.json");
  if (!fs.existsSync(configPath)) {
    console.warn(
      `Cleanup tokens config missing at ${configPath}. `
      + "Create a JSON file with {\"companyTokens\": [\"<name>\", ...]} for build-time anonymization."
    );
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return Array.isArray(data.companyTokens)
      ? data.companyTokens.filter((value) => typeof value === "string" && value.trim())
      : [];
  } catch (error) {
    console.warn("Failed to parse cleanup tokens config:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

function injectCompanyPlaceholder(xmlText) {
  if (xmlText.includes("__COMPANY__")) return xmlText;
  return xmlText.replace(/<hp:t([^>]*)>([\s\S]*?)<\/hp:t>/u, (_match, attrs, body) => {
    const prefix = "[__COMPANY__ 현장] ";
    const newBody = body.trim().length === 0 ? prefix : `${prefix}${body}`;
    return `<hp:t${attrs}>${newBody}</hp:t>`;
  });
}

const selected = [
  { src: "4.4-risk-assessment-rules.hwpx", out: "risk-assessment.hwpx", title: "위험성평가표" },
  { src: "4.3-work-plan-standard.hwpx", out: "work-plan.hwpx", title: "작업계획서" },
  { src: "4.1-construction-supervision-log.hwpx", out: "permit-inspection.hwpx", title: "공사·안전감독일지" },
  { src: "tbm-log.hwpx", out: "tbm-log.hwpx", title: "TBM 일지" },
  { src: "tbm-meeting-record.hwpx", out: "tbm-meeting-record.hwpx", title: "TBM 회의록" },
  { src: "4.2-serious-accident-response.hwpx", out: "emergency-response.hwpx", title: "중대재해 대응 절차" },
  { src: "safety-pledge.hwpx", out: "safety-pledge.hwpx", title: "안전수칙 이행각서" },
  { src: "health-questionnaire.hwpx", out: "health-questionnaire.hwpx", title: "근로자 건강문진표" },
  { src: "signal-worker-designation.hwpx", out: "signal-worker-designation.hwpx", title: "장비 신호수 지정서" },
  { src: "crane-workplan.hwpx", out: "crane-workplan.hwpx", title: "건설기계 작업계획서 — 크레인" },
  { src: "risk-assessment-form-standard.hwpx", out: "risk-assessment-form-standard.hwpx", title: "위험성평가 표준 서식 (KOSHA)" },
  { src: "risk-assessment-consulting-dialog.hwpx", out: "risk-assessment-consulting-dialog.hwpx", title: "위험성평가 대화형 컨설팅 양식 (KOSHA)" },
  { src: "work-permit-form.hwpx", out: "work-permit-form.hwpx", title: "작업허가서 양식 (KOSHA)" },
  { src: "moel-workplan-excavator.hwpx", out: "moel-workplan-excavator.hwpx", title: "건설기계 작업계획서 — 굴착기 (고용노동부)" },
  { src: "moel-workplan-truck.hwpx", out: "moel-workplan-truck.hwpx", title: "건설기계 작업계획서 — 트럭 (고용노동부)" },
  { src: "moel-workplan-aerial-platform.hwpx", out: "moel-workplan-aerial-platform.hwpx", title: "건설기계 작업계획서 — 고소작업대 (고용노동부)" },
  { src: "moel-workplan-mobile-crane.hwpx", out: "moel-workplan-mobile-crane.hwpx", title: "건설기계 작업계획서 — 이동식 크레인 (고용노동부)" },
  { src: "moel-workplan-concrete-pump.hwpx", out: "moel-workplan-concrete-pump.hwpx", title: "건설기계 작업계획서 — 콘크리트펌프카 (고용노동부)" },
  { src: "moel-workplan-concrete-mixer-truck.hwpx", out: "moel-workplan-concrete-mixer-truck.hwpx", title: "건설기계 작업계획서 — 콘크리트 믹서 트럭 (고용노동부)" },
  { src: "moel-workplan-loader.hwpx", out: "moel-workplan-loader.hwpx", title: "건설기계 작업계획서 — 로더 (고용노동부)" },
  { src: "moel-workplan-roller.hwpx", out: "moel-workplan-roller.hwpx", title: "건설기계 작업계획서 — 롤러 (고용노동부)" },
  { src: "moel-workplan-pile-driver.hwpx", out: "moel-workplan-pile-driver.hwpx", title: "건설기계 작업계획서 — 항타기 (고용노동부)" },
  { src: "moel-workplan-forklift.hwpx", out: "moel-workplan-forklift.hwpx", title: "건설기계 작업계획서 — 지게차 (고용노동부)" },
  { src: "tbm-log-forestry-sample.hwpx", out: "tbm-log-forestry-sample.hwpx", title: "TBM 일지 샘플 — 임업·산림 사업장" },
  { src: "tbm-and-safety-education-writing-guide.hwpx", out: "tbm-and-safety-education-writing-guide.hwpx", title: "TBM·안전보건교육 일지 작성방법 가이드" }
];

function applyReplacements(text, replacementPairs) {
  let next = text;
  let hits = 0;
  for (const [from, to] of replacementPairs) {
    const before = next;
    next = next.split(from).join(to);
    if (before !== next) hits += 1;
  }
  return { text: next, hits };
}

export function assertSafeHwpxArchiveEntry(entryName, attr = 0) {
  const normalized = entryName.replace(/\\/gu, "/");
  const segments = normalized.split("/");
  if (!normalized
    || normalized.includes("\0")
    || normalized.startsWith("/")
    || /^[A-Za-z]:/u.test(normalized)
    || segments.includes("..")) {
    throw new Error(`Unsafe HWPX archive entry path: ${entryName}`);
  }

  const unixMode = (Number(attr) >>> 16) & 0xffff;
  if ((unixMode & 0xf000) === 0xa000) {
    throw new Error(`HWPX archive symlink entry is not allowed: ${entryName}`);
  }
}

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid HWPX archive ${label}`);
  }
}

export function anonymizeHwpxArchive(inputBuffer, replacementPairs = []) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length > HWPX_ANONYMIZATION_BUDGETS.inputBytes) {
    throw new Error("HWPX archive exceeds the input byte budget");
  }

  const startedAt = Date.now();
  const archive = new AdmZip(inputBuffer, { noSort: true });
  const entries = archive.getEntries();
  if (entries.length > HWPX_ANONYMIZATION_BUDGETS.archiveEntries) {
    throw new Error("HWPX archive exceeds the entry-count budget");
  }
  if (entries.length === 0 || entries[0].entryName !== "mimetype" || entries[0].header.method !== 0) {
    throw new Error("HWPX archive must keep mimetype first and uncompressed");
  }

  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    assertSafeHwpxArchiveEntry(entry.entryName, entry.attr);
    assertSafeInteger(entry.header.size, "entry size");
    assertSafeInteger(entry.header.compressedSize, "compressed entry size");
    if (entry.header.size > HWPX_ANONYMIZATION_BUDGETS.archiveEntryUncompressedBytes) {
      throw new Error("HWPX archive entry exceeds the uncompressed byte budget");
    }
    totalUncompressedBytes += entry.header.size;
    if (!Number.isSafeInteger(totalUncompressedBytes)
      || totalUncompressedBytes > HWPX_ANONYMIZATION_BUDGETS.archiveTotalUncompressedBytes) {
      throw new Error("HWPX archive exceeds the total uncompressed byte budget");
    }
  }

  if (entries[0].getData().toString("utf8") !== "application/hwp+zip") {
    throw new Error("HWPX archive has an invalid mimetype payload");
  }

  let totalReplacements = 0;
  let touchedFiles = 0;
  let injectedPlaceholder = false;
  for (const entry of entries) {
    if (Date.now() - startedAt > HWPX_ANONYMIZATION_BUDGETS.elapsedMs) {
      throw new Error("HWPX anonymization exceeded the elapsed-time budget");
    }
    if (entry.isDirectory || !/\.(xml|hpf|rdf|txt)$/iu.test(entry.entryName)) continue;

    const original = entry.getData().toString("utf8");
    const replacement = applyReplacements(original, replacementPairs);
    let next = replacement.text;
    if (path.posix.basename(entry.entryName.replace(/\\/gu, "/")) === "section0.xml") {
      const injected = injectCompanyPlaceholder(next);
      if (injected !== next) injectedPlaceholder = true;
      next = injected;
    }
    if (next !== original) {
      entry.setData(Buffer.from(next, "utf8"));
      touchedFiles += 1;
      totalReplacements += replacement.hits;
    }
  }

  const output = archive.toBuffer();
  if (output.length > HWPX_ANONYMIZATION_BUDGETS.outputBytes) {
    throw new Error("HWPX archive exceeds the output byte budget");
  }
  if (Date.now() - startedAt > HWPX_ANONYMIZATION_BUDGETS.elapsedMs) {
    throw new Error("HWPX anonymization exceeded the elapsed-time budget");
  }

  const outputEntries = new AdmZip(output, { noSort: true }).getEntries();
  if (outputEntries.length === 0
    || outputEntries[0].entryName !== "mimetype"
    || outputEntries[0].header.method !== 0
    || outputEntries[0].getData().toString("utf8") !== "application/hwp+zip") {
    throw new Error("HWPX output did not preserve the mimetype-first contract");
  }

  return {
    output,
    receipt: {
      entryCount: entries.length,
      totalUncompressedBytes,
      touchedFiles,
      totalReplacements,
      injectedPlaceholder
    }
  };
}

export function runAnonymization() {
  fs.mkdirSync(outDir, { recursive: true });
  const replacementPairs = loadCleanupTokens().map((token) => {
    if (token.endsWith("용")) return [token, "__COMPANY__용"];
    return [token, "__COMPANY__"];
  });
  const summary = [];
  for (const item of selected) {
    const srcPath = path.join(srcDir, item.src);
    if (!fs.existsSync(srcPath)) {
      summary.push({ ...item, status: "skip-missing-source" });
      continue;
    }

    const input = fs.readFileSync(srcPath);
    const result = anonymizeHwpxArchive(input, replacementPairs);
    fs.writeFileSync(path.join(outDir, item.out), result.output);
    summary.push({
      ...item,
      bytes: result.output.length,
      src_bytes: input.length,
      archive_entries: result.receipt.entryCount,
      archive_uncompressed_bytes: result.receipt.totalUncompressedBytes,
      touched_files: result.receipt.touchedFiles,
      total_replacements: result.receipt.totalReplacements,
      injected_placeholder: result.receipt.injectedPlaceholder,
      status: "ok"
    });
  }

  fs.writeFileSync(path.join(outDir, "anonymization-report.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    replacementRuleCount: replacementPairs.length,
    items: summary
  }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runAnonymization();
}
