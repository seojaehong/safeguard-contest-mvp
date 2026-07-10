import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  frontendShape,
  frontendSpacing,
  frontendTypography,
  generatedSurfaceFiles,
  specialSurfaceFiles,
  userVisibleRoutes,
} from "@/lib/frontend-design-contract";

const root = process.cwd();

describe("frontend design contract", () => {
  it("defines the four deliberate typography roles", () => {
    expect(Object.keys(frontendTypography.fonts)).toEqual([
      "product",
      "hud",
      "multilingual",
      "document",
    ]);
    expect(frontendTypography.screen.body).toEqual({
      size: "15px",
      weight: 500,
      lineHeight: "1.60",
      tracking: "0",
    });
    expect(frontendTypography.screen.hud).toEqual({
      size: "11px",
      weight: 700,
      lineHeight: "16px",
      tracking: "0.08em",
    });
  });

  it("uses the fixed 4px spacing rhythm and contextual radius rules", () => {
    expect(Object.values(frontendSpacing).every((value) => Number.parseInt(value, 10) % 4 === 0)).toBe(true);
    expect(frontendShape).toMatchObject({
      structuralRadius: "0",
      microRadius: "2px",
      controlRadius: "4px",
      panelRadius: "4px",
      circleRadius: "50%",
      controlHeight: "44px",
      compactControlHeight: "36px",
      iconHitArea: "44px",
    });
    expect(Object.values(frontendShape)).not.toContain("999px");
  });

  it("inventories every browser and generated-document surface", () => {
    expect(userVisibleRoutes).toHaveLength(32);
    expect(new Set(userVisibleRoutes).size).toBe(userVisibleRoutes.length);
    for (const relativePath of [...specialSurfaceFiles, ...generatedSurfaceFiles]) {
      expect(fs.existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("declares every semantic CSS token", () => {
    const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
    for (const token of frontendTypography.cssTokens) {
      expect(css, token).toContain(`${token}:`);
    }
    for (const token of Object.keys(frontendSpacing)) {
      expect(css, token).toContain(`--space-${token}:`);
    }
  });
});
