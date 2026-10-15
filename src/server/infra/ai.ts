import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";
import { getConfig } from "@/server/config";

// Gemini sur Vertex AI, authentifié par IAM : aucune clé API. Flash-Lite : le modèle le moins cher.
const MODEL = "gemini-2.5-flash-lite";
// Un planning d'un mois peut prendre une minute.
const TIMEOUT_MS = 100_000;

const globalForAi = globalThis as unknown as { genai?: GoogleGenAI };

function getClient() {
  const vertex = getConfig().vertex;
  if (!vertex) throw new Error("GCP_PROJECT_ID et VERTEX_LOCATION doivent être définies");

  globalForAi.genai ??= new GoogleGenAI({ vertexai: true, project: vertex.project, location: vertex.location });
  return globalForAi.genai;
}

type GenerateJsonOptions = {
  system: string;
  prompt: string;
  // Réponse imposée en JSON, mais toujours à revalider (donnée non fiable).
  schema: Schema;
  maxOutputTokens?: number;
  temperature?: number;
  images?: { mimeType: string; data: Buffer }[];
  timeoutMs?: number;
};

export async function generateJson({
  system,
  prompt,
  schema,
  maxOutputTokens = 32_768,
  temperature = 0.7,
  images = [],
  timeoutMs = TIMEOUT_MS,
}: GenerateJsonOptions): Promise<unknown> {
  const request = getClient().models.generateContent({
    model: MODEL,
    contents:
      images.length > 0
        ? [
            {
              role: "user",
              parts: [
                { text: prompt },
                ...images.map(({ mimeType, data }) => ({ inlineData: { mimeType, data: data.toString("base64") } })),
              ],
            },
          ]
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
