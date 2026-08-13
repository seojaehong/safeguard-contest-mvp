"use client";

import { useEffect, useState } from "react";

import {
  isNewDeploymentAvailable,
  normalizeCommitSha,
  type BuildInfoResponse,
} from "@/lib/deployment-freshness";

const REFRESH_INTERVAL_MS = 60_000;

export function DeploymentFreshnessGuard({ currentBuildSha }: { currentBuildSha: string | null }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!normalizeCommitSha(currentBuildSha)) return undefined;

    let disposed = false;
    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/api/build-info?freshness=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          console.warn(`Deployment freshness check failed with HTTP ${response.status}.`);
          return;
        }
        const buildInfo = await response.json() as BuildInfoResponse;
        if (!disposed && isNewDeploymentAvailable(currentBuildSha, buildInfo)) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        if (!disposed) console.warn("Deployment freshness check failed.", error);
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(() => void checkForUpdate(), REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentBuildSha]);

  if (!updateAvailable) return null;

  return (
    <aside className="deployment-freshness-notice" role="status" aria-live="polite" data-testid="deployment-freshness-notice">
      <span>새 버전이 배포됐습니다.</span>
      <button type="button" onClick={() => window.location.reload()} aria-label="최신 버전으로 새로고침">
        새로고침
      </button>
    </aside>
  );
}
