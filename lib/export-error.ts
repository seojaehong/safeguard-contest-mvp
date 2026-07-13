export type ExportErrorCode =
  | "HWP_EXPORT_FAILED"
  | "HWPX_EXPORT_FAILED"
  | "HWPX_TEMPLATE_KIND_INVALID"
  | "PDF_EXPORT_FAILED"
  | "PDF_FONT_ASSET_UNAVAILABLE"
  | "XLSX_EXPORT_FAILED"
  | "XLSX_STRUCTURED_PAYLOAD_INVALID";

const EXPORT_ERROR_MESSAGES = {
  HWP_EXPORT_FAILED: "HWP 문서를 만들지 못했습니다.",
  HWPX_EXPORT_FAILED: "HWPX 양식을 만들지 못했습니다.",
  HWPX_TEMPLATE_KIND_INVALID: "지원하지 않는 HWPX 양식 종류입니다.",
  PDF_EXPORT_FAILED: "PDF 문서를 만들지 못했습니다.",
  PDF_FONT_ASSET_UNAVAILABLE: "PDF 글꼴 자산을 확인하지 못해 문서를 만들지 못했습니다.",
  XLSX_EXPORT_FAILED: "XLSX 문서를 만들지 못했습니다.",
  XLSX_STRUCTURED_PAYLOAD_INVALID: "구조화 XLSX 입력 형식이 올바르지 않습니다.",
} satisfies Readonly<Record<ExportErrorCode, string>>;

export function buildExportErrorPayload(code: ExportErrorCode): {
  ok: false;
  code: ExportErrorCode;
  message: string;
} {
  return { ok: false, code, message: EXPORT_ERROR_MESSAGES[code] };
}

export function buildSafeExportErrorContext(
  error: unknown,
  errorCode: ExportErrorCode,
): { errorType: string; errorCode: ExportErrorCode } {
  return {
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode,
  };
}
