import { NextRequest, NextResponse } from "next/server";
import {
  buildHwpxFromTemplate,
  isValidTemplateKind,
  listAvailableTemplates,
  TEMPLATE_LABELS,
  type HwpxTemplateKind
} from "@/lib/hwpx-template";
import { buildExportErrorPayload, buildSafeExportErrorContext } from "@/lib/export-error";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("export/hwpx-template");

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-template";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const kind = url.searchParams.get("kind");
  const companyName = url.searchParams.get("companyName") || "";

  if (!kind) {
    return NextResponse.json(
      {
        ok: true,
        route: "/api/export/hwpx-template",
        methods: ["GET"],
        message:
          "GET ?kind=<template>&companyName=<사업장명>으로 사업장명이 반영된 HWPX 양식을 내려받습니다.",
        templates: listAvailableTemplates()
      },
      { headers: { "cache-control": "no-store" } }
    );
  }

  if (!isValidTemplateKind(kind)) {
    return NextResponse.json(
      { ...buildExportErrorPayload("HWPX_TEMPLATE_KIND_INVALID"), valid: Object.keys(TEMPLATE_LABELS) },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const buffer = buildHwpxFromTemplate(kind as HwpxTemplateKind, companyName);
    const label = TEMPLATE_LABELS[kind as HwpxTemplateKind];
    const fileName = `${sanitizeFileName(`${companyName || "SafeClaw"}-${label}`)}.hwpx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/hwp+zip",
        "content-disposition": `attachment; filename="safeclaw-template.hwpx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    log.error("export_failed", buildSafeExportErrorContext(error, "HWPX_EXPORT_FAILED"));
    return NextResponse.json(
      buildExportErrorPayload("HWPX_EXPORT_FAILED"),
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
