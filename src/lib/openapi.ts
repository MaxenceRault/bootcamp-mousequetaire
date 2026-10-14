import "server-only";
import { z } from "zod";
import { loginSchema, registerSchema } from "@/schemas/auth.schema";
import { updateProfileSchema } from "@/schemas/user.schema";

// Corps de requête générés à partir des schémas Zod utilisés par les controllers :
// la doc suit automatiquement les règles de validation.
function requestBody(schema: z.ZodType) {
  // OpenAPI 3.0 (et non 3.1) : le moteur 3.1 de Swagger UI ne fonctionne pas une fois compilé par Turbopack.
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, { io: "input", target: "openapi-3.0" });
  delete jsonSchema.$schema;
  return { required: true, content: { "application/json": { schema: jsonSchema } } };
}

// Réponses : écrites à la main (elles reprennent les types des repositories).
const publicUser = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    username: { type: "string" },
    display_name: { type: "string" },
    avatar_url: { type: "string", nullable: true },
    avatar_seed: { type: "string", nullable: true },
  },
  required: ["id", "username", "display_name", "avatar_url", "avatar_seed"],
};

const profileUser = {
  ...publicUser,
  properties: {
    ...publicUser.properties,
    location: { type: "string", nullable: true },
    created_at: { type: "string", format: "date-time" },
  },
  required: [...publicUser.required, "location", "created_at"],
};

const postSummary = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    photo_url: { type: "string" },
    photo_alt: { type: "string" },
    destination_country_code: { type: "string", example: "JP" },
    destination_state_code: { type: "string", nullable: true },
    destination_city: { type: "string", nullable: true },
    start_date: { type: "string", format: "date" },
    created_at: { type: "string", format: "date-time" },
  },
};

const authResult = {
  type: "object",
  properties: {
    token: { type: "string", description: "JWT HS256, valable 1 h. À envoyer dans « Authorization: Bearer <token> »." },
    user: publicUser,
  },
};

// Erreur générique : jamais de détail technique (CLAUDE.md, règle 6).
function error(description: string, codes: string[]) {
  return {
    description,
    content: {
      "application/json": {
        schema: { type: "object", properties: { error: { type: "string", enum: codes } } },
      },
    },
  };
}

function json(description: string, schema: object) {
  return { description, content: { "application/json": { schema } } };
}

const invalidInput = error("Champ manquant, mal typé ou inconnu (Zod .strict())", ["INVALID_INPUT"]);
const unauthorized = error("Token absent, invalide, falsifié ou expiré", ["UNAUTHORIZED"]);
const tooManyRequests = error("Trop de requêtes : limite atteinte (réglable par variables RATE_LIMIT_*, voir .env.example)", [
  "TOO_MANY_REQUESTS",
]);
const internalError = error("Erreur serveur (détail uniquement dans les logs serveur)", ["INTERNAL_ERROR"]);

export function buildOpenApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Brb API",
      version: "1.0.0",
      description:
        "API de Brb (BeRightBack). Pour les routes protégées : se connecter via /auth/login, " +
        "copier le token, puis cliquer sur « Authorize ».",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    tags: [
      { name: "Auth", description: "Inscription et connexion" },
      { name: "Utilisateurs", description: "Profil de l'utilisateur connecté" },
    ],
    paths: {
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Créer un compte",
          requestBody: requestBody(registerSchema),
          responses: {
            201: json("Compte créé, utilisateur connecté", authResult),
            400: invalidInput,
            409: error("Email déjà utilisé", ["EMAIL_TAKEN"]),
            429: tooManyRequests,
            500: internalError,
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Se connecter",
          description: "`remember` choisit seulement le stockage côté navigateur : le token dure toujours 1 h.",
          requestBody: requestBody(loginSchema),
          responses: {
            200: json("Connecté", authResult),
            400: invalidInput,
            401: error("Email ou mot de passe incorrect (message volontairement identique)", ["INVALID_CREDENTIALS"]),
            429: tooManyRequests,
            500: internalError,
          },
        },
      },
      "/users/me": {
        get: {
          tags: ["Utilisateurs"],
          summary: "Mon profil et mes récits publiés",
          security: [{ bearerAuth: [] }],
          responses: {
            200: json("Profil", {
              type: "object",
              properties: {
                user: profileUser,
                stories: { type: "array", items: postSummary, description: "12 plus récents" },
                storyCount: { type: "integer" },
              },
            }),
            401: unauthorized,
            500: internalError,
          },
        },
        patch: {
          tags: ["Utilisateurs"],
          summary: "Modifier mon profil",
          description: "L'utilisateur modifié est toujours celui du token : impossible de modifier un autre compte.",
          security: [{ bearerAuth: [] }],
          requestBody: requestBody(updateProfileSchema),
          responses: {
            200: json("Profil mis à jour", { type: "object", properties: { user: profileUser } }),
            400: invalidInput,
            401: unauthorized,
            409: error("Pseudo déjà pris", ["USERNAME_TAKEN"]),
            429: tooManyRequests,
            500: internalError,
          },
        },
      },
    },
  };
}
