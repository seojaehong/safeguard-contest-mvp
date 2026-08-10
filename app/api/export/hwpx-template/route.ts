import { NextRequest, NextResponse } from "next/server";
import {
  buildHwpxFromTemplate,
  isValidTemplateKind,
  listAvailableTemplates,
  TEMPLATE_LABELS,
  type HwpxTemplateKind
} from "@/lib/hwpx-template";
import { withPublicDocumentExportAdmission } from "@/lib/public-distributed-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-template";
}

async function exportHwpxTemplate(request: NextRequest) {
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
      { ok: false, error: `지원하지 않는 양식 종류입니다: ${kind}`, valid: Object.keys(TEMPLATE_LABELS) },
      { status: 400 }
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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "HWPX 양식을 만들지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withPublicDocumentExportAdmission(request, () => exportHwpxTemplate(request));
}
