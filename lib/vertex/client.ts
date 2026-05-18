/**
 * Vertex AI client singleton.
 * Uses GOOGLE_APPLICATION_CREDENTIALS_JSON (SA JSON string) for auth.
 * GCP_PROJECT_ID and GCP_REGION drive the Vertex endpoint.
 */
import { VertexAI, type GenerationConfig } from "@google-cloud/vertexai";

let cached: VertexAI | null = null;

function getVertexClient(): VertexAI {
  if (cached) return cached;

  const jsonStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!jsonStr) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON not configured");
  }

  const credentials = JSON.parse(jsonStr) as Record<string, unknown>;
  cached = new VertexAI({
    project: process.env.GCP_PROJECT_ID ?? "",
    location: process.env.GCP_REGION ?? "us-central1",
    googleAuthOptions: { credentials },
  });
  return cached;
}


export type GenerateWithVertexOptions = {
  generationConfig?: GenerationConfig;
  /**
   * Hard wall-clock timeout in milliseconds.
   * Vertex SDK does not support AbortSignal, so we use Promise.race.
   * The underlying HTTP request is not cancelled (no TCP abort), but the
   * caller unblocks and throws after timeoutMs. Default: 10_000.
   */
  timeoutMs?: number;
};

/**
 * Generate text from a single user prompt using Vertex AI.
 * Throws on empty/blocked response or timeout; caller is responsible for retry/fallback.
 *
 * @param model   Vertex model name (e.g. "gemini-2.5-flash")
 * @param prompt  User prompt text
 * @param options Optional generation config and per-call timeout
 */
export async function generateWithVertex(
  model: string,
  prompt: string,
  options: GenerateWithVertexOptions = {}
): Promise<string> {
  const { generationConfig, timeoutMs = 10_000 } = options;

  const vertex = getVertexClient();
  const genModel = vertex.getGenerativeModel({ model });

  const callPromise = genModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(generationConfig ? { generationConfig } : {}),
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Vertex AI timeout after ${timeoutMs}ms (model=${model})`)), timeoutMs)
  );

  const result = await Promise.race([callPromise, timeoutPromise]);

  const candidate = result.response.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";

  if (!text) {
    const finishReason = candidate?.finishReason ?? "unknown";
    throw new Error(`Vertex AI empty response (model=${model}, finishReason=${String(finishReason)})`);
  }

  return text;
}
