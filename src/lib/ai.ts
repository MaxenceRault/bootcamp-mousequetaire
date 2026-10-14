import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";

// Gemini sur Vertex AI, authentifié par IAM : aucune clé API. Flash-Lite : le modèle le moins cher.
const MODEL = "gemini-2.5-flash-lite";
// Un planning d'un mois peut prendre une minute.
const TIMEOUT_MS = 100_000;

const globalForAi = globalThis as unknown as { genai?: GoogleGenAI };

function getClient() {
  const project = process.env.GCP_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION;
  if (!project || !location) throw new Error("GCP_PROJECT_ID et VERTEX_LOCATION doivent être définies");

  globalForAi.genai ??= new GoogleGenAI({ vertexai: true, project, location });
  return globalForAi.genai;
}

type GenerateJsonOptions = {
  system: string;
  prompt: string;
  // Réponse imposée en JSON, mais toujours à revalider (donnée non fiable).
  schema: Schema;
  maxOutputTokens?: number;
  temperature?: number;
  image?: { mimeType: string; data: Buffer };
  timeoutMs?: number;
};

export async function generateJson({
  system,
  prompt,
  schema,
  maxOutputTokens = 32_768,
  temperature = 0.7,
  image,
  timeoutMs = TIMEOUT_MS,
}: GenerateJsonOptions): Promise<unknown> {
  const request = getClient().models.generateContent({
    model: MODEL,
    contents: image
      ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } }] }]
      : prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
  // Délai garanti : le SDK ne respecte pas toujours abortSignal (appel resté bloqué plusieurs minutes).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Délai de réponse du modèle dépassé")), timeoutMs);
  });
  const response = await Promise.race([request, timeout]).finally(() => clearTimeout(timer));

  if (!response.text) throw new Error("Réponse vide du modèle");
  return JSON.parse(response.text);
}
