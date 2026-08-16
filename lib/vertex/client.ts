/**
 * Cancellable Vertex AI REST client.
 * Uses the same service-account JSON contract as the former Vertex SDK path,
 * but owns the fetch AbortSignal so caller disconnects stop the HTTP request.
 */
import type { GenerationConfig } from "@google-cloud/vertexai";
import { GoogleAuth, type JWTInput } from "google-auth-library";
import { readBoundedResponseText } from "@/lib/server/upstream-http";

const VERTEX_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;

let cachedAuth: GoogleAuth | null = null;

function getVertexAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not configured");
  const credentials = JSON.parse(json) as JWTInput;
  cachedAuth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  return cachedAuth;
}

type VertexCandidate = {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
};

type VertexGenerateResponse = {
  candidates?: VertexCandidate[];
  error?: { message?: string; status?: string };
};

export type GenerateWithVertexOptions = {
  generationConfig?: GenerationConfig;
  /** Hard wall-clock timeout in milliseconds. Default: 10_000. */
  timeoutMs?: number;
  /** Cancels the underlying Vertex HTTP request when the originating request is gone. */
  signal?: AbortSignal;
};

export async function generateWithVertex(
  model: string,
  prompt: string,
  options: GenerateWithVertexOptions = {},
): Promise<string> {
  const { generationConfig, timeoutMs = 10_000, signal } = options;
  signal?.throwIfAborted();
  const project = process.env.GCP_PROJECT_ID?.trim();
  if (!project) throw new Error("GCP_PROJECT_ID not configured");
  const location = process.env.GCP_REGION?.trim() || "us-central1";
  const accessToken = await getVertexAuth().getAccessToken();
  signal?.throwIfAborted();
  if (!accessToken) throw new Error("Vertex AI access token unavailable");

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error(`Vertex AI timeout after ${timeoutMs}ms (model=${model})`)),
    timeoutMs,
  );
  try {
    const endpoint = [
      `https://${location}-aiplatform.googleapis.com/v1`,
      `projects/${encodeURIComponent(project)}`,
      `locations/${encodeURIComponent(location)}`,
      `publishers/google/models/${encodeURIComponent(model)}:generateContent`,
    ].join("/");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(generationConfig ? { generationConfig } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await readBoundedResponseText(response, {
      label: "Vertex AI generation response",
      maxBytes: VERTEX_RESPONSE_MAX_BYTES,
    });
    const payload = raw ? JSON.parse(raw) as VertexGenerateResponse : {};
    if (!response.ok) {
      throw new Error(payload.error?.message || `Vertex AI returned HTTP ${response.status}`);
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!text) {
      throw new Error(`Vertex AI empty response (model=${model}, finishReason=${candidate?.finishReason ?? "unknown"})`);
    }
    return text;
  } catch (error) {
    signal?.throwIfAborted();
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
