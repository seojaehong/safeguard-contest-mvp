// HWPX template substitution: streams a committed official template (.hwpx) with
// minimal placeholder substitution (currently only `__COMPANY__` → scenario.companyName).
//
// HWPX zip layout requires `mimetype` first + STORED (uncompressed). This module
// preserves that order when re-packing.

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

export type HwpxTemplateKind =
  | "risk-assessment"
  | "work-plan"
  | "permit-inspection"
  | "tbm-log"
  | "tbm-meeting-record"
  | "emergency-response"
  | "safety-pledge"
  | "health-questionnaire"
  | "signal-worker-designation"
  | "crane-workplan"
  | "risk-assessment-form-standard"
  | "risk-assessment-consulting-dialog"
  | "work-permit-form"
  | "moel-workplan-excavator"
  | "moel-workplan-truck"
  | "moel-workplan-aerial-platform"
  | "moel-workplan-mobile-crane"
  | "moel-workplan-concrete-pump"
  | "moel-workplan-concrete-mixer-truck"
  | "moel-workplan-loader"
  | "moel-workplan-roller"
  | "moel-workplan-pile-driver"
  | "moel-workplan-forklift";

const TEMPLATE_FILES: Record<HwpxTemplateKind, string> = {
  "risk-assessment": "risk-assessment.hwpx",
  "work-plan": "work-plan.hwpx",
  "permit-inspection": "permit-inspection.hwpx",
  "tbm-log": "tbm-log.hwpx",
  "tbm-meeting-record": "tbm-meeting-record.hwpx",
  "emergency-response": "emergency-response.hwpx",
  "safety-pledge": "safety-pledge.hwpx",
  "health-questionnaire": "health-questionnaire.hwpx",
  "signal-worker-designation": "signal-worker-designation.hwpx",
  "crane-workplan": "crane-workplan.hwpx",
  "risk-assessment-form-standard": "risk-assessment-form-standard.hwpx",
  "risk-assessment-consulting-dialog": "risk-assessment-consulting-dialog.hwpx",
  "work-permit-form": "work-permit-form.hwpx",
  "moel-workplan-excavator": "moel-workplan-excavator.hwpx",
  "moel-workplan-truck": "moel-workplan-truck.hwpx",
  "moel-workplan-aerial-platform": "moel-workplan-aerial-platform.hwpx",
  "moel-workplan-mobile-crane": "moel-workplan-mobile-crane.hwpx",
  "moel-workplan-concrete-pump": "moel-workplan-concrete-pump.hwpx",
  "moel-workplan-concrete-mixer-truck": "moel-workplan-concrete-mixer-truck.hwpx",
  "moel-workplan-loader": "moel-workplan-loader.hwpx",
  "moel-workplan-roller": "moel-workplan-roller.hwpx",
  "moel-workplan-pile-driver": "moel-workplan-pile-driver.hwpx",
  "moel-workplan-forklift": "moel-workplan-forklift.hwpx"
};

export const TEMPLATE_LABELS: Record<HwpxTemplateKind, string> = {
  "risk-assessment": "위험성평가표",
  "work-plan": "작업계획서",
  "permit-inspection": "공사·안전감독일지",
  "tbm-log": "TBM 일지",
  "tbm-meeting-record": "TBM 회의록",
  "emergency-response": "중대재해 대응 절차",
  "safety-pledge": "안전수칙 이행각서",
  "health-questionnaire": "근로자 건강문진표",
  "signal-worker-designation": "장비 신호수 지정서",
  "crane-workplan": "건설기계 작업계획서 — 크레인",
  "risk-assessment-form-standard": "위험성평가 표준 서식 (KOSHA)",
  "risk-assessment-consulting-dialog": "위험성평가 대화형 컨설팅 양식 (KOSHA · 지게차/추락 사례 포함)",
  "work-permit-form": "작업허가서 양식 (KOSHA · 5대 위험작업 통합)",
  "moel-workplan-excavator": "건설기계 작업계획서 — 굴착기 (고용노동부)",
  "moel-workplan-truck": "건설기계 작업계획서 — 트럭 (고용노동부)",
  "moel-workplan-aerial-platform": "건설기계 작업계획서 — 고소작업대 (고용노동부)",
  "moel-workplan-mobile-crane": "건설기계 작업계획서 — 이동식 크레인 (고용노동부)",
  "moel-workplan-concrete-pump": "건설기계 작업계획서 — 콘크리트펌프카 (고용노동부)",
  "moel-workplan-concrete-mixer-truck": "건설기계 작업계획서 — 콘크리트 믹서 트럭 (고용노동부)",
  "moel-workplan-loader": "건설기계 작업계획서 — 로더 (고용노동부)",
  "moel-workplan-roller": "건설기계 작업계획서 — 롤러 (고용노동부)",
  "moel-workplan-pile-driver": "건설기계 작업계획서 — 항타기 (고용노동부)",
  "moel-workplan-forklift": "건설기계 작업계획서 — 지게차 (고용노동부)"
};

function templatesDir() {
  return path.join(process.cwd(), "templates", "hwpx");
}

export function isValidTemplateKind(kind: string): kind is HwpxTemplateKind {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_FILES, kind);
}

export function listAvailableTemplates(): { kind: HwpxTemplateKind; label: string; available: boolean; bytes: number }[] {
  const dir = templatesDir();
  return (Object.keys(TEMPLATE_FILES) as HwpxTemplateKind[]).map((kind) => {
    const file = path.join(dir, TEMPLATE_FILES[kind]);
    const exists = fs.existsSync(file);
    return {
      kind,
      label: TEMPLATE_LABELS[kind],
      available: exists,
      bytes: exists ? fs.statSync(file).size : 0
    };
  });
}

/**
 * Read a template HWPX from disk with minimal substitution.
 * Replaces `__COMPANY__` with the provided companyName everywhere it appears
 * in *.xml / *.hpf / *.rdf entries inside the zip. Returns the new HWPX bytes.
 *
 * Uses pure-JS zip (adm-zip) so the route works in Vercel serverless runtime,
 * which does not guarantee a system `zip`/`unzip` CLI is present.
 *
 * Note: adm-zip may not preserve the strict HWPX requirement that `mimetype` be
 * the first entry and STORED. In practice 한컴 opens HWPX produced by adm-zip,
 * but for strict spec compliance the build-time anonymizer
 * (scripts/anonymize_hwpx_templates.mjs) uses the system `zip` CLI.
 */
export function buildHwpxFromTemplate(kind: HwpxTemplateKind, companyName: string): Buffer {
  const srcPath = path.join(templatesDir(), TEMPLATE_FILES[kind]);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`HWPX template not found: ${kind}`);
  }

  const replaceCompany = String(companyName ?? "").trim() || "__COMPANY__";
  const inputZip = new AdmZip(srcPath);
  const outZip = new AdmZip();

  // Always add `mimetype` first, STORED if possible (adm-zip will deflate small entries
  // by default, but consumers we care about accept either).
  const mimetypeEntry = inputZip.getEntry("mimetype");
  if (mimetypeEntry) {
    outZip.addFile("mimetype", mimetypeEntry.getData());
  }

  for (const entry of inputZip.getEntries()) {
    if (entry.isDirectory) continue;
    if (entry.entryName === "mimetype") continue;
    let data = entry.getData();
    if (/\.(xml|hpf|rdf|txt)$/i.test(entry.entryName)) {
      const text = data.toString("utf8");
      if (text.includes("__COMPANY__")) {
        data = Buffer.from(text.split("__COMPANY__").join(replaceCompany), "utf8");
      }
    }
    outZip.addFile(entry.entryName, data, "", entry.attr);
  }

  return outZip.toBuffer();
}
