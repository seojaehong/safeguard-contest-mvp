#!/usr/bin/env node
// Anonymize HWPX templates by replacing company names with placeholders.
// Reads templates/hwpx-source/*.hwpx (gitignored), writes templates/hwpx/*.hwpx (committed).
//
// HWPX zip layout requirements (HWPX spec, mirrors ODF/EPUB):
//   1. First file MUST be `mimetype`, STORED (no compression).
//   2. Other entries can be DEFLATED.
// We extract → walk *.xml → text-substitute → repack with the mimetype-first layout
// using the system `zip` CLI (more reliable than adm-zip for this constraint).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import os from "node:os";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(repoRoot, "templates", "hwpx-source");
const outDir = path.join(repoRoot, "templates", "hwpx");
fs.mkdirSync(outDir, { recursive: true });

// Confirmed real-company token in the source set (per repo scan).
// Other tokens like 열수송관공사 / 압입공사 are work-type descriptors, kept.
const replacements = [
  ["한국지역난방공사용", "__COMPANY__용"],
  ["한국지역난방공사", "__COMPANY__"]
];

const selected = [
  { src: "4.4-risk-assessment-rules.hwpx",          out: "risk-assessment.hwpx",      title: "위험성평가표" },
  { src: "4.3-work-plan-standard.hwpx",             out: "work-plan.hwpx",            title: "작업계획서" },
  { src: "4.1-construction-supervision-log.hwpx",   out: "permit-inspection.hwpx",    title: "공사·안전감독일지" },
  { src: "tbm-log.hwpx",                            out: "tbm-log.hwpx",              title: "TBM 일지" },
  { src: "tbm-meeting-record.hwpx",                 out: "tbm-meeting-record.hwpx",   title: "TBM 회의록" },
  { src: "4.2-serious-accident-response.hwpx",      out: "emergency-response.hwpx",   title: "중대재해 대응 절차" },
  { src: "safety-pledge.hwpx",                      out: "safety-pledge.hwpx",        title: "안전수칙 이행각서" },
  { src: "health-questionnaire.hwpx",               out: "health-questionnaire.hwpx", title: "근로자 건강문진표" },
  { src: "signal-worker-designation.hwpx",          out: "signal-worker-designation.hwpx", title: "장비 신호수 지정서" }
];

function applyReplacements(text) {
  let next = text;
  let hits = 0;
  for (const [from, to] of replacements) {
    const before = next;
    next = next.split(from).join(to);
    if (before !== next) hits += 1;
  }
  return { text: next, hits };
}

function repackHwpx(workDir, outFile) {
  // Spec: mimetype first, STORED. Then everything else DEFLATED.
  // `zip -X0 out.hwpx mimetype` then `zip -rXD out.hwpx . -x mimetype`
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  execSync(`cd "${workDir}" && zip -X0 "${outFile}" mimetype`, { stdio: "ignore" });
  execSync(`cd "${workDir}" && zip -rXD "${outFile}" . -x mimetype`, { stdio: "ignore" });
}

const summary = [];
for (const item of selected) {
  const srcPath = path.join(srcDir, item.src);
  if (!fs.existsSync(srcPath)) {
    summary.push({ ...item, status: "skip-missing-source" });
    continue;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `safeclaw-hwpx-${path.basename(item.out, ".hwpx")}-`));
  try {
    execSync(`unzip -q "${srcPath}" -d "${tmp}"`, { stdio: "ignore" });

    let totalReplacements = 0;
    let touchedFiles = 0;
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
        } else if (/\.(xml|hpf|rdf|txt)$/i.test(entry.name)) {
          const orig = fs.readFileSync(p, "utf8");
          const { text, hits } = applyReplacements(orig);
          if (hits > 0) {
            fs.writeFileSync(p, text, "utf8");
            touchedFiles += 1;
            totalReplacements += hits;
          }
        }
      }
    }
    walk(tmp);

    const outPath = path.join(outDir, item.out);
    repackHwpx(tmp, outPath);

    summary.push({
      ...item,
      bytes: fs.statSync(outPath).size,
      src_bytes: fs.statSync(srcPath).size,
      touched_files: touchedFiles,
      total_replacements: totalReplacements,
      status: "ok"
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const summaryPath = path.join(outDir, "anonymization-report.json");
fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), replacements, items: summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
