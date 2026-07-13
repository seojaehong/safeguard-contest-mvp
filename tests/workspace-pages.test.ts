import { describe, expect, it } from "vitest";

import {
  buildCanonicalShareReturnPath,
  buildShareOwnerHref,
  buildWorkspaceStepStatuses,
  canOpenWorkspacePage,
  nextWorkspacePageAfterGenerationError,
  nextWorkspacePageAfterGenerate,
  resolveSafeShareReturnPath,
  resolveWorkspaceRouteState
} from "@/lib/workspace-pages";

describe("workspace page navigation", () => {
  it("moves generation feedback into the document page instead of keeping users on input", () => {
    expect(nextWorkspacePageAfterGenerate()).toBe("document");

    expect(
      buildWorkspaceStepStatuses({
        currentPage: "document",
        hasWorkpack: false,
        isGenerating: true
      })
    ).toEqual({
      input: "done",
      document: "active",
      share: "locked"
    });
  });

  it("keeps document and share pages locked before a workpack exists", () => {
    expect(canOpenWorkspacePage({ targetPage: "document", hasWorkpack: false, isGenerating: false }).allowed).toBe(false);
    expect(canOpenWorkspacePage({ targetPage: "share", hasWorkpack: false, isGenerating: false }).allowed).toBe(false);
    expect(canOpenWorkspacePage({ targetPage: "input", hasWorkpack: false, isGenerating: false }).allowed).toBe(true);
  });

  it("lets users return to input and move to share after a workpack is ready", () => {
    expect(canOpenWorkspacePage({ targetPage: "input", hasWorkpack: true, isGenerating: false }).allowed).toBe(true);
    expect(canOpenWorkspacePage({ targetPage: "document", hasWorkpack: true, isGenerating: false }).allowed).toBe(true);
    expect(canOpenWorkspacePage({ targetPage: "share", hasWorkpack: true, isGenerating: false }).allowed).toBe(true);

    expect(
      buildWorkspaceStepStatuses({
        currentPage: "share",
        hasWorkpack: true,
        isGenerating: false
      })
    ).toEqual({
      input: "done",
      document: "done",
      share: "active"
    });
  });

  it("keeps a blocked workpack inspectable on Share without making it sendable", () => {
    const gate = canOpenWorkspacePage({
      targetPage: "share",
      hasWorkpack: true,
      isGenerating: false,
      canShare: false
    });

    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeUndefined();
  });

  it("marks share as blocked instead of pending when readiness gates fail", () => {
    expect(
      buildWorkspaceStepStatuses({
        currentPage: "document",
        hasWorkpack: true,
        isGenerating: false,
        canShare: false
      })
    ).toEqual({
      input: "done",
      document: "active",
      share: "blocked"
    });

    expect(
      buildWorkspaceStepStatuses({
        currentPage: "share",
        hasWorkpack: true,
        isGenerating: false,
        canShare: false
      })
    ).toEqual({
      input: "done",
      document: "blocked",
      share: "active"
    });
  });

  it("returns users to input after generation fails so they can revise or retry", () => {
    expect(nextWorkspacePageAfterGenerationError()).toBe("input");
  });

  it("strictly validates workspace step, document, locale, return step, and theme", () => {
    expect(resolveWorkspaceRouteState({
      step: "document",
      document: "foreignWorkerTransmission",
      language: "vi",
      returnStep: "share",
      theme: "night"
    })).toEqual({
      step: "document",
      document: "foreignWorkerTransmission",
      language: "vi",
      returnStep: "share",
      theme: "night"
    });

    expect(resolveWorkspaceRouteState({
      step: "share<script>",
      document: "../../settings",
      language: "vi-VN",
      returnStep: "javascript:alert(1)",
      theme: "purple"
    })).toEqual({
      step: "input",
      document: null,
      language: null,
      returnStep: null,
      theme: "day"
    });
  });

  it("builds owner links with one encoded canonical Share return and no raw locale interpolation", () => {
    const shareReturn = "/workspace?step=share&theme=night";
    expect(buildCanonicalShareReturnPath("night")).toBe(shareReturn);
    expect(buildShareOwnerHref({ owner: "workers", theme: "night" })).toBe(
      `/workers?next=${encodeURIComponent(shareReturn)}`
    );
    expect(buildShareOwnerHref({ owner: "worker-language", theme: "night" })).toBe(
      `/workers?focus=language&next=${encodeURIComponent(shareReturn)}`
    );
    expect(buildShareOwnerHref({ owner: "settings", theme: "night" })).toBe(
      `/settings?next=${encodeURIComponent(shareReturn)}`
    );
    expect(buildShareOwnerHref({ owner: "login", theme: "night" })).toBe(
      `/login?next=${encodeURIComponent(shareReturn)}`
    );
    expect(buildShareOwnerHref({ owner: "translation", theme: "night", language: "vi" })).toBe(
      "/workspace?step=document&document=foreignWorkerTransmission&language=vi&returnStep=share&theme=night"
    );
    expect(buildShareOwnerHref({ owner: "worker-language", theme: "night", language: "vi-VN" })).not.toContain("language=");
  });

  it("accepts only a canonical local Share next path", () => {
    expect(resolveSafeShareReturnPath("/workspace?step=share&theme=night", "day")).toBe(
      "/workspace?step=share&theme=night"
    );
    expect(resolveSafeShareReturnPath("https://evil.example/workspace?step=share", "night")).toBe(
      "/workspace?step=share&theme=night"
    );
    expect(resolveSafeShareReturnPath("//evil.example/workspace?step=share", "day")).toBe(
      "/workspace?step=share&theme=day"
    );
    expect(resolveSafeShareReturnPath("/workspace?step=document&theme=night", "day")).toBe(
      "/workspace?step=share&theme=day"
    );
    expect(resolveSafeShareReturnPath("/workspace?step=share&theme=night&language=vi", "day")).toBe(
      "/workspace?step=share&theme=day"
    );
  });
});
