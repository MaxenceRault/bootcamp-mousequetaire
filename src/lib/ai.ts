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
};

export async function generateJson({ system, prompt, schema, maxOutputTokens = 32_768 }: GenerateJsonOptions): Promise<unknown> {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });

  if (!response.text) throw new Error("Réponse vide du modèle");
  return JSON.parse(response.text);
}
