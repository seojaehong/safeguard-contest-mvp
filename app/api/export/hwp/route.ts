import { NextRequest, NextResponse } from "next/server";
import {
  createDocumentExportInternalErrorPayload,
  DocumentExportLimitError,
  DocumentExportRequestError,
  readDocumentExportRequestJson
} from "@/lib/document-export-budget";
import { withPublicDocumentExportAdmission } from "@/lib/public-distributed-rate-limit";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/export/hwp",
      methods: ["POST"],
      message: "POST 요청의 단일 문서 내용을 편집 가능한 한컴 HWP 표 양식으로 반환합니다.",
      schema: {
        title: "string",
        rows: "SheetRow[]",
        profile: "SafetyFormProfile",
        scenario: "AskScenario"
      }
    },
    { headers: { "cache-control": "no-store" } }
  );
}

async function exportHwp(request: NextRequest) {
  try {
    // 게이트·예산·렌더는 lib/document-export-hwp.ts(MCP generate_risk_assessment 와 공용)에서 한다.
    const { buffer, fileName } = renderHwpDocumentExport(await readDocumentExportRequestJson(request));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/x-hwp",
        "content-disposition": `attachment; filename="safeclaw-document.hwp"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store"
      }
    });
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
      createDocumentExportInternalErrorPayload("HWP", error),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  return withPublicDocumentExportAdmission(request, () => exportHwp(request));
}
