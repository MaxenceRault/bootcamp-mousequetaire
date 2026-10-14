import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";

// Gemini sur Vertex AI (projet GCP) : authentification IAM, comme la base et le stockage
// (application-default en local, compte de service sur Cloud Run), donc aucune clé API.
// Flash-Lite : le modèle Gemini le moins cher, suffisant pour produire un planning en JSON.
const MODEL = "gemini-2.5-flash-lite";
// Un planning d'un mois (jusqu'à ~180 activités) peut prendre une minute.
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
  // Consignes du système (prioritaires sur le contenu du prompt).
  system: string;
  prompt: string;
  // Format de réponse imposé au modèle. La réponse reste à valider (Zod) : c'est une donnée non fiable.
  schema: Schema;
  // Taille maximale de la réponse (par défaut : un planning d'un mois).
  maxOutputTokens?: number;
};

// Renvoie la réponse JSON du modèle, non validée.
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
