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
    location: process.env.GCP_REGION ?? "asia-northeast3",
    googleAuthOptions: { credentials },
  });
  return cached;
}

/**
 * Generate text from a single user prompt using Vertex AI.
 * Throws on empty/blocked response; caller is responsible for retry/fallback.
 *
 * @param model  Vertex model name (e.g. "gemini-2.5-flash")
 * @param prompt User prompt text
 * @param generationConfig  Optional generation config (temperature, maxOutputTokens, responseMimeType, …)
 */
export async function generateWithVertex(
  model: string,
  prompt: string,
  generationConfig?: GenerationConfig
): Promise<string> {
  const vertex = getVertexClient();
  const genModel = vertex.getGenerativeModel({ model });

  const result = await genModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(generationConfig ? { generationConfig } : {}),
  });

  const candidate = result.response.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";

  if (!text) {
    const finishReason = candidate?.finishReason ?? "unknown";
    throw new Error(`Vertex AI empty response (model=${model}, finishReason=${String(finishReason)})`);
  }

  return text;
}
