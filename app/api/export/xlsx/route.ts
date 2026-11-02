import { NextRequest, NextResponse } from "next/server";
import {
  createDocumentExportInternalErrorPayload,
  DocumentExportLimitError,
  DocumentExportRequestError,
  readDocumentExportRequestJson
} from "@/lib/document-export-budget";
import { withPublicDocumentExportAdmission } from "@/lib/public-distributed-rate-limit";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xlsxResponse(buffer: Buffer, fileName: string, fallbackName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fallbackName}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "no-store"
    }
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/xlsx",
      methods: ["POST"],
      modes: ["single", "workpack", "workPlanStructured", "permitInspectionStructured", "tbmBriefingStructured", "tbmLogStructured", "educationRecordStructured"],
      message: "POST a single document spec or a workpack array. Returns OOXML .xlsx binary.",
      schema: {
        single: {
          mode: "single",
          title: "string",
          rows: "SheetRow[]",
          profile: "SafetyFormProfile",
          scenario: "AskScenario"
        },
        workpack: {
          mode: "workpack",
          scenario: "AskScenario",
          documents: "[{ title, rows, profile }]"
        },
        structured: {
          mode: "workPlanStructured | permitInspectionStructured | tbmBriefingStructured | tbmLogStructured | educationRecordStructured",
          scenario: "AskScenario",
          structured: "Record<string, unknown>"
        }
      }
    },
    { headers: { "cache-control": "no-store" } }
  );
}

async function exportXlsx(request: NextRequest) {
  try {
    // 게이트·예산·렌더는 lib/document-export-xlsx.ts(MCP generate_risk_assessment 와 공용)에서 한다.
    const result = await renderXlsxDocumentExport(await readDocumentExportRequestJson(request));
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, headers: { "cache-control": "no-store" } }
      );
    }
    return xlsxResponse(result.buffer, result.fileName, result.fallbackName);
  } catch (error) {
    if (error instanceof DocumentExportRequestError) return error.response;
    if (error instanceof DocumentExportLimitError) {
      return NextResponse.json(
        {
          ok: false,
          code: "DOCUMENT_EXPORT_LIMIT_EXCEEDED",
          message: "문서 내보내기 요청이 허용된 크기 한도를 초과했습니다."
        },
        { status: 413, headers: { "cache-control": "no-store" } }
      );
    }
    return NextResponse.json(
      createDocumentExportInternalErrorPayload("XLSX", error),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  return withPublicDocumentExportAdmission(request, () => exportXlsx(request));
}
