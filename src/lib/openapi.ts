import "server-only";
import { z } from "zod";
import { loginSchema, refreshTokenSchema, registerSchema } from "@/schemas/auth.schema";
import {
  adjustTripSchema,
  createTripItemSchema,
  createTripSchema,
  createTripTaskSchema,
  updateTripItemSchema,
  updateTripSchema,
  updateTripTaskSchema,
} from "@/schemas/trip.schema";
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
    refreshToken: {
      type: "string",
      description:
        "Token opaque à usage unique (30 jours avec remember, 24 h sinon). À envoyer à /auth/refresh pour obtenir " +
        "une nouvelle paire : l'ancien devient invalide, et le réutiliser révoque toute la session.",
    },
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
const tooManyRequests = error("Trop de tentatives : 5 maximum par IP toutes les 15 minutes", ["TOO_MANY_REQUESTS"]);
const internalError = error("Erreur serveur (détail uniquement dans les logs serveur)", ["INTERNAL_ERROR"]);

// ─── Planificateur (/trips) ──────────────────────────────────────────────────

const tripDetail = {
  type: "object",
  properties: {
    trip: { type: "object", description: "Voyage (destination, dates, archetype, budget, source_post_count, generated_at)" },
    items: { type: "array", items: { type: "object" }, description: "Activités, triées par jour et heure" },
    tasks: { type: "array", items: { type: "object" }, description: "Checklist de préparation" },
  },
};
const notFound = error("Voyage (ou élément) introuvable, ou appartenant à un autre utilisateur", ["NOT_FOUND"]);
const aiUnavailable = error("L'IA n'a pas répondu ou a renvoyé un format invalide", ["AI_UNAVAILABLE"]);
const aiRateLimited = error("Trop d'appels à l'IA : 20 maximum par utilisateur et par heure", ["TOO_MANY_REQUESTS"]);
const idParam = (name: string) => ({ name, in: "path", required: true, schema: { type: "integer", minimum: 1 } });

// Route privée sur un voyage : JWT obligatoire, propriété vérifiée côté serveur.
function tripRoute(summary: string, options: { params?: string[]; body?: z.ZodType; ok?: object; ai?: boolean; description?: string }) {
  return {
    tags: ["Voyages"],
    summary,
    ...(options.description ? { description: options.description } : {}),
    security: [{ bearerAuth: [] }],
    parameters: (options.params ?? ["id"]).map(idParam),
    ...(options.body ? { requestBody: requestBody(options.body) } : {}),
    responses: {
      ...(options.ok ?? { 200: json("Voyage à jour", tripDetail) }),
      400: invalidInput,
      401: unauthorized,
      404: notFound,
      ...(options.ai ? { 429: aiRateLimited, 503: aiUnavailable } : {}),
      500: internalError,
    },
  };
}

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
      { name: "Voyages", description: "Planificateur : voyages générés par l'IA (Gemini) à partir des posts, puis modifiables" },
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
          description:
            "`remember` fixe la durée du refresh token (30 jours, sinon 24 h) et le stockage côté navigateur. " +
            "L'access token dure toujours 1 h.",
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
      "/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Renouveler l'access token",
          description: "Rotation : renvoie une nouvelle paire et invalide le refresh token envoyé.",
          requestBody: requestBody(refreshTokenSchema),
          responses: {
            200: json("Nouvelle paire de tokens", authResult),
            400: invalidInput,
            401: error("Refresh token inconnu, expiré, révoqué ou déjà utilisé", ["INVALID_REFRESH_TOKEN"]),
            429: error("Trop de tentatives : 30 maximum par IP toutes les 15 minutes", ["TOO_MANY_REQUESTS"]),
            500: internalError,
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Se déconnecter",
          description: "Révoque toute la session liée au refresh token. Répond 204 même si le token est inconnu.",
          requestBody: requestBody(refreshTokenSchema),
          responses: {
            204: { description: "Session révoquée" },
            400: invalidInput,
            500: internalError,
          },
        },
      },
      "/trips": {
        get: {
          tags: ["Voyages"],
          summary: "Mes voyages",
          security: [{ bearerAuth: [] }],
          responses: {
            200: json("Liste", { type: "object", properties: { trips: { type: "array", items: { type: "object" } } } }),
            401: unauthorized,
            500: internalError,
          },
        },
        post: {
          tags: ["Voyages"],
          summary: "Générer un voyage avec l'IA",
          description:
            "Posts filtrés par lieu (destination ou tags) et par archetype, puis envoyés à Gemini (15 max). " +
            "Réponse de l'IA revalidée côté serveur. Rien n'est enregistré si l'IA échoue.",
          security: [{ bearerAuth: [] }],
          requestBody: requestBody(createTripSchema),
          responses: {
            201: json("Voyage créé", { type: "object", properties: { id: { type: "integer" } } }),
            400: invalidInput,
            401: unauthorized,
            429: aiRateLimited,
            503: aiUnavailable,
            500: internalError,
          },
        },
      },
      "/trips/{id}": {
        get: tripRoute("Détail d'un voyage", {}),
        patch: tripRoute("Modifier le titre ou le budget", { body: updateTripSchema }),
        delete: tripRoute("Supprimer un voyage", { ok: { 204: { description: "Supprimé" } } }),
      },
      "/trips/{id}/regenerate": {
        post: tripRoute("Re-générer avec l'IA", {
          ai: true,
          description: "Remplace toutes les activités, la checklist et le budget.",
        }),
      },
      "/trips/{id}/adjust": {
        post: tripRoute("Ajuster avec l'IA", {
          body: adjustTripSchema,
          ai: true,
          description: "Consigne libre (300 caractères max), traitée comme une donnée non fiable par le prompt.",
        }),
      },
      "/trips/{id}/items": {
        post: tripRoute("Ajouter une activité", { body: createTripItemSchema, ok: { 201: json("Voyage à jour", tripDetail) } }),
      },
      "/trips/{id}/items/{itemId}": {
        patch: tripRoute("Modifier une activité", { params: ["id", "itemId"], body: updateTripItemSchema }),
        delete: tripRoute("Supprimer une activité", { params: ["id", "itemId"] }),
      },
      "/trips/{id}/tasks": {
        post: tripRoute("Ajouter une tâche", { body: createTripTaskSchema, ok: { 201: json("Voyage à jour", tripDetail) } }),
      },
      "/trips/{id}/tasks/{taskId}": {
        patch: tripRoute("Modifier / cocher une tâche", { params: ["id", "taskId"], body: updateTripTaskSchema }),
        delete: tripRoute("Supprimer une tâche", { params: ["id", "taskId"] }),
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
            500: internalError,
          },
        },
      },
    },
  };
}
