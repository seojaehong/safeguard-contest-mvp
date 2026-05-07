import { NextRequest, NextResponse } from "next/server";
import {
  buildHwpxFromTemplate,
  isValidTemplateKind,
  listAvailableTemplates,
  TEMPLATE_LABELS,
  type HwpxTemplateKind
} from "@/lib/hwpx-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
          "GET ?kind=<template>&companyName=<your-company> to download an official HWPX template with companyName substituted.",
        templates: listAvailableTemplates()
      },
      { headers: { "cache-control": "no-store" } }
    );
  }

  if (!isValidTemplateKind(kind)) {
    return NextResponse.json(
      { ok: false, error: `Unknown template kind: ${kind}`, valid: Object.keys(TEMPLATE_LABELS) },
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
      { ok: false, error: error instanceof Error ? error.message : "template build failed" },
      { status: 500 }
    );
  }
}
