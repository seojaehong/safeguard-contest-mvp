"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createSafeClawBrowserSupabaseClient } from "@/lib/supabase-browser-client";
import { requiresFaceConsent } from "@/lib/video-face-blur";
import { extractVideoScenes, type ExtractedScene } from "@/lib/video-hazard-browser";
import { chunkScenes, formatVideoTime, VIDEO_SCENES_PER_REQUEST } from "@/lib/video-hazard-frames";
import {
  mergeVideoHazardReports,
  validateVideoCheckInput,
  VIDEO_CHECK_FIELD_LABELS,
  type VideoCheckField,
  type VideoHazardReport
} from "@/lib/video-hazard-report";

import styles from "./VideoHazardCheck.module.css";

type Phase = "idle" | "extracting" | "review" | "analyzing" | "done" | "error";

let authClient: ReturnType<typeof createSafeClawBrowserSupabaseClient> | null = null;

async function readAccessToken(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    if (!authClient) authClient = createSafeClawBrowserSupabaseClient(url, anonKey);
    const { data } = await authClient.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

function isVideoHazardReport(value: unknown): value is VideoHazardReport {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.flowOpinion === "string" && Array.isArray(record.rows) && Array.isArray(record.fieldChecks);
}

const FACE_STATUS_LABEL: Record<ExtractedScene["faceStatus"], string> = {
  blurred: "얼굴 흐림 처리함",
  none_found: "얼굴 찾지 못함",
  unavailable: "자동 얼굴 흐림 못 함"
};

export function VideoHazardCheck() {
  const [fields, setFields] = useState<Record<VideoCheckField, string>>({ site: "", task: "", concern: "" });
  const [missing, setMissing] = useState<VideoCheckField[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [durationSec, setDurationSec] = useState(0);
  const [scenes, setScenes] = useState<ExtractedScene[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [faceConsent, setFaceConsent] = useState(false);
  const [report, setReport] = useState<VideoHazardReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scenesRef = useRef<ExtractedScene[]>([]);

  useEffect(() => () => {
    abortRef.current?.abort();
    scenesRef.current.forEach((scene) => URL.revokeObjectURL(scene.previewUrl));
  }, []);

  function replaceScenes(next: ExtractedScene[]) {
    scenesRef.current.forEach((scene) => URL.revokeObjectURL(scene.previewUrl));
    scenesRef.current = next;
    setScenes(next);
  }

  async function onVideoSelected(file: File | undefined) {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    replaceScenes([]);
    setExcluded([]);
    setFaceConsent(false);
    setReport(null);
    if (!file.type.startsWith("video/")) {
      setPhase("error");
      setStatus("동영상 파일만 올릴 수 있습니다.");
      return;
    }
    setPhase("extracting");
    setStatus("영상에서 장면을 고르는 중입니다. 영상은 이 브라우저 밖으로 나가지 않습니다.");
    try {
      const result = await extractVideoScenes(file, { onProgress: setStatus, signal: controller.signal });
      if (controller.signal.aborted) return;
      replaceScenes(result.scenes);
      setDurationSec(result.durationSec);
      setPhase("review");
      setStatus(`${formatVideoTime(result.durationSec)} 길이 영상에서 장면 ${result.scenes.length}개를 골랐습니다. 보낼 장면을 확인해 주세요.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "영상에서 장면을 고르지 못했습니다.");
    }
  }

  const selectedScenes = scenes.filter((scene) => !excluded.includes(scene.name));
  const consentNeeded = requiresFaceConsent(selectedScenes.map((scene) => scene.faceStatus));

  async function runCheck() {
    const validation = validateVideoCheckInput(fields);
    if (!validation.ok) {
      setMissing(validation.missing);
      setStatus(validation.message);
      return;
    }
    setMissing([]);
    if (!selectedScenes.length) {
      setStatus("보낼 장면이 없습니다.");
      return;
    }
    if (consentNeeded && !faceConsent) {
      setStatus("자동 얼굴 흐림을 하지 못한 장면이 있습니다. 장면을 확인하고 동의 칸을 체크하거나 해당 장면을 빼 주세요.");
      return;
    }
    const token = await readAccessToken();
    if (!token) {
      setStatus("관리자 로그인 후 동영상 위험 점검을 쓸 수 있습니다.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("analyzing");
    const batches = chunkScenes(selectedScenes, VIDEO_SCENES_PER_REQUEST);
    const reports: VideoHazardReport[] = [];
    try {
      for (let index = 0; index < batches.length; index += 1) {
        setStatus(`장면 점검 중 ${index + 1}/${batches.length}묶음`);
        const batch = batches[index];
        const form = new FormData();
        form.set("site", validation.value.site);
        form.set("task", validation.value.task);
        form.set("concern", validation.value.concern);
        form.set("durationSec", String(durationSec));
        form.set("sceneCount", String(selectedScenes.length));
        form.set("sceneTimes", JSON.stringify(batch.map((scene) => ({ name: scene.name, time: scene.time }))));
        batch.forEach((scene) => form.append("scenes", scene.file, scene.name));
        const response = await fetch("/api/input-videos/hazard-analysis", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: form,
          signal: controller.signal
        });
        const body: unknown = await response.json().catch(() => ({}));
        const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
        if (!response.ok || !isVideoHazardReport(record.report)) {
          throw new Error(typeof record.message === "string" ? record.message : `장면 점검 요청 실패: HTTP ${response.status}`);
        }
        reports.push(record.report);
      }
      const merged = mergeVideoHazardReports(reports, { sceneCount: selectedScenes.length, durationSec });
      setReport(merged);
      setPhase("done");
      setStatus(`장면 ${selectedScenes.length}개 점검을 마쳤습니다.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "장면 점검을 완료하지 못했습니다.");
    }
  }

  function toggleScene(name: string) {
    setExcluded((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  const busy = phase === "extracting" || phase === "analyzing";

  return (
    <div className={styles.wrap}>
      <div className={styles.notice}>
        <p>
          <strong>영상 원본은 서버로 올리지 않습니다.</strong> 이 브라우저에서 장면 사진(최대 10장)만 골라 줄이고,
          얼굴을 흐린 뒤 그 사진만 사진 분석(OpenAI)으로 보냅니다. 영상 속 근로자에게 촬영·점검 사실을 알려 주시고,
          이름표·차량 번호처럼 사람을 알아볼 수 있는 부분이 보이는 장면은 보내기 전에 빼 주세요.
        </p>
      </div>

      <div className={styles.fields}>
        {(Object.keys(VIDEO_CHECK_FIELD_LABELS) as VideoCheckField[]).map((key) => (
          <label key={key} className={styles.field}>
            <span>{VIDEO_CHECK_FIELD_LABELS[key]} (필수)</span>
            {key === "concern" ? (
              <textarea
                className={missing.includes(key) ? styles.missing : undefined}
                value={fields[key]}
                maxLength={200}
                placeholder="예: 호스에 걸려 넘어질까 걱정"
                onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              />
            ) : (
              <input
                className={missing.includes(key) ? styles.missing : undefined}
                value={fields[key]}
                maxLength={200}
                placeholder={key === "site" ? "예: 물류센터 B동 1층 통로" : "예: 세척 호스 정리·바닥 세척"}
                onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
              />
            )}
          </label>
        ))}
      </div>

      <label className={styles.field}>
        <span>현장 동영상 (1~3분)</span>
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => void onVideoSelected(event.target.files?.[0])}
        />
      </label>

      {status ? <p className={styles.status} role="status" aria-live="polite">{status}</p> : null}

      {scenes.length ? (
        <section className={styles.section} aria-label="보낼 장면">
          <h3>보낼 장면 ({selectedScenes.length}/{scenes.length})</h3>
          <div className={styles.scenes}>
            {scenes.map((scene) => {
              const isExcluded = excluded.includes(scene.name);
              return (
                <figure key={scene.name} className={`${styles.scene} ${isExcluded ? styles.sceneExcluded : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scene.previewUrl} alt={`${formatVideoTime(scene.time)} 장면`} />
                  <figcaption>
                    <strong className={styles.time}>{formatVideoTime(scene.time)}</strong> · {FACE_STATUS_LABEL[scene.faceStatus]}
                  </figcaption>
                  <button type="button" onClick={() => toggleScene(scene.name)} disabled={busy}>
                    {isExcluded ? "다시 넣기" : "이 장면 빼기"}
                  </button>
                </figure>
              );
            })}
          </div>
          {consentNeeded ? (
            <div className={`${styles.notice} ${styles.warning}`}>
              <p>
                이 브라우저는 얼굴 자동 찾기를 지원하지 않아 <strong>얼굴을 흐리지 못했습니다.</strong> 위 장면에 얼굴이
                보이면 그 장면을 빼 주세요.
              </p>
              <label>
                <input type="checkbox" checked={faceConsent} onChange={(event) => setFaceConsent(event.target.checked)} />{" "}
                장면을 확인했고, 얼굴이 흐려지지 않은 채로 보내는 것에 동의합니다.
              </label>
            </div>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className="button"
              onClick={() => void runCheck()}
              disabled={busy || !selectedScenes.length || (consentNeeded && !faceConsent)}
            >
              장면 점검 시작
            </button>
            <Link href="/login">관리자 로그인</Link>
          </div>
        </section>
      ) : null}

      {report ? <VideoHazardReportView report={report} /> : null}
    </div>
  );
}

function VideoHazardReportView({ report }: { report: VideoHazardReport }) {
  return (
    <article className={styles.wrap} aria-label="동영상 위험 점검 결과">
      <section className={styles.section}>
        <h3>영상 흐름 의견</h3>
        <p>{report.flowOpinion}</p>
      </section>

      <section className={styles.section}>
        <h3>위험·조치 표</h3>
        {report.rows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">위험요인</th>
                  <th scope="col">장면에서 보인 것</th>
                  <th scope="col">조치</th>
                  <th scope="col">근거 조문</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={`${row.sceneName}-${index}`}>
                    <td className={styles.time}>{row.timeLabel}</td>
                    <td>
                      {row.hazard}
                      {row.msdNote ? <p><small>{row.msdNote}</small></p> : null}
                    </td>
                    <td>{row.observation}</td>
                    <td>{row.control}</td>
                    <td>{row.articles.length ? row.articles.join(", ") : "확인 안 됨"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>고른 장면에서 위험 후보를 찾지 못했습니다.</p>}
      </section>

      {report.riskScenes.length ? (
        <section className={styles.section}>
          <h3>위험 장면</h3>
          <ul>
            {report.riskScenes.map((scene) => (
              <li key={`${scene.sceneName}-${scene.time}`}>
                <strong className={styles.time}>{scene.timeLabel}</strong> · {scene.hazards.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h3>근거 조문</h3>
        {report.articles.length ? (
          <ul>
            {report.articles.map((article) => (
              <li key={article.citation}>
                {article.citation}{article.heading ? `(${article.heading})` : ""} · 관련 장면 {article.timeLabels.join(", ")}
              </li>
            ))}
          </ul>
        ) : <p>지적한 요소와 이어지는 조문을 확인하지 못했습니다.</p>}
      </section>

      <section className={styles.section}>
        <h3>현장 확인 목록</h3>
        {report.fieldChecks.length ? (
          <>
            <p><strong>현장에서 확인할 것</strong></p>
            <ul>{report.fieldChecks.map((item) => <li key={item}>{item}</li>)}</ul>
          </>
        ) : null}
        {report.baseActions.length ? (
          <>
            <p><strong>기본 조치</strong></p>
            <ul>{report.baseActions.map((item) => <li key={item}>{item}</li>)}</ul>
          </>
        ) : null}
      </section>

      <section className={`${styles.notice} ${styles.warning}`}>
        <p><strong>{report.disclaimer}</strong></p>
        <ul>{report.limits.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </article>
  );
}
