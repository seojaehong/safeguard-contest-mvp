import { describe, expect, it } from "vitest";

import {
  buildWorkspaceStepStatuses,
  canOpenWorkspacePage,
  nextWorkspacePageAfterGenerationError,
  nextWorkspacePageAfterGenerate
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

  it("keeps the share page locked until the workpack passes readiness", () => {
    const gate = canOpenWorkspacePage({
      targetPage: "share",
      hasWorkpack: true,
      isGenerating: false,
      canShare: false
    });

    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("공유 전 검수와 보완을 완료해 주세요.");
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
});
