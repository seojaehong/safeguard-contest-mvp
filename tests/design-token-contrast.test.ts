import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// DESIGN.md 「색 토큰」 표의 글자/바탕 쌍이 WCAG 2.x AA(4.5:1)를 넘는지 :root 값으로 잰다.
// 색 값을 바꾸면 이 시험이 먼저 깨진다. 쌍을 늘리면 DESIGN.md 표도 같이 고친다.

const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

function rootTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const block of source.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/gu)) {
    for (const decl of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/giu)) {
      tokens.set(decl[1], decl[2].trim());
    }
  }
  return tokens;
}

const tokens = rootTokens(css);

function resolve(name: string, depth = 0): string {
  const raw = tokens.get(name);
  if (!raw) throw new Error(`token ${name} is not defined on :root`);
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/u);
  if (ref && depth < 8) return resolve(ref[1], depth + 1);
  if (!/^#[0-9a-f]{6}$/iu.test(raw)) throw new Error(`token ${name} is not a 6-digit hex: ${raw}`);
  return raw.toLowerCase();
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(resolve(foreground));
  const b = luminance(resolve(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const documentedPairs: Array<[foreground: string, background: string]> = [
  ["--ink", "--paper"],
  ["--ink", "--desk"],
  ["--ink", "--desk-2"],
  ["--ink-2", "--paper"],
  ["--ink-2", "--desk"],
  ["--ink-3", "--paper"],
  ["--ink-3", "--desk"],
  ["--on-sign", "--sign-blue"],
  ["--on-sign", "--sign-blue-hover"],
  ["--on-sign", "--sign-red"],
  ["--on-sign", "--sign-green"],
  ["--ink", "--sign-yellow"],
  ["--ink", "--sign-yellow-soft"],
  ["--ink", "--sign-blue-soft"],
  ["--ink", "--sign-green-soft"],
  ["--ink", "--sign-red-soft"],
  ["--sign-blue", "--paper"],
  ["--sign-blue", "--desk"],
  ["--sign-blue", "--sign-blue-soft"],
  ["--sign-red", "--paper"],
  ["--sign-red", "--sign-red-soft"],
  ["--sign-green", "--paper"],
  ["--sign-green", "--sign-green-soft"],
  // 야간 테마(사용자 선택)의 밝은 판 — --ink(#1b1c1e)는 야간 바탕(#010102~#18191a)보다 밝아 보수적인 기준이다.
  ["--night-sign-blue", "--ink"],
  ["--night-sign-green", "--ink"],
  ["--night-sign-yellow", "--ink"],
  ["--night-sign-red", "--ink"],
  ["--paper", "--ink"],
];

describe("design token contrast (안전보건표지 색채)", () => {
  it("maps the four 별표 8 sign colours to fixed hex values", () => {
    expect(resolve("--sign-red")).toBe("#be1e2d");
    expect(resolve("--sign-yellow")).toBe("#f2cf1d");
    expect(resolve("--sign-blue")).toBe("#1d5aa6");
    expect(resolve("--sign-green")).toBe("#0b7a4b");
  });

  it.each(documentedPairs)("%s on %s is at least 4.5:1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("never sets text in sign yellow — yellow is a background with ink text only", () => {
    expect(contrast("--sign-yellow", "--paper")).toBeLessThan(4.5);
    const yellowText = Array.from(css.matchAll(/(?:^|[;{\s])color\s*:\s*var\(--(?:sign-yellow|night-sign-yellow)\)/gu));
    expect(yellowText).toEqual([]);
  });

  it("routes legacy accent aliases onto the sign palette", () => {
    expect(resolve("--accent")).toBe(resolve("--sign-blue"));
    expect(resolve("--sc-hazard-yellow")).toBe(resolve("--sign-blue"));
    expect(resolve("--sc-warning")).toBe(resolve("--sign-yellow"));
    expect(resolve("--sc-danger")).toBe(resolve("--sign-red"));
    expect(resolve("--sc-ok")).toBe(resolve("--sign-green"));
    expect(resolve("--bg")).toBe(resolve("--desk"));
  });
});
