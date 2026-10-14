import "server-only";
import { z } from "zod";
import { loginSchema, refreshTokenSchema, registerSchema } from "@/schemas/auth.schema";
import {
  answerTripSuggestionSchema,
  createTripItemSchema,
  createTripSchema,
  createTripTaskSchema,
  sendTripMessageSchema,
  updateTripItemSchema,
  updateTripSchema,
  updateTripTaskSchema,
} from "@/schemas/trip.schema";
import { createPostSchema, FEED_MAX_LIMIT, updatePostSchema } from "@/schemas/post.schema";
import { updateProfileSchema } from "@/schemas/user.schema";
import { POST_ARCHETYPES } from "@/lib/posts";

// Corps de requête générés à partir des schémas Zod utilisés par les controllers :
// la doc suit automatiquement les règles de validation.
function requestBody(schema: z.ZodType) {
  // OpenAPI 3.0 (et non 3.1) : le moteur 3.1 de Swagger UI ne fonctionne pas une fois compilé par Turbopack.
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, { io: "input", target: "openapi-3.0" });
  delete jsonSchema.$schema;
  return { required: true, content: { "application/json": { schema: jsonSchema } } };
}

// Variante multipart/form-data (envoi de fichier), même génération à partir du schéma Zod.
function multipartBody(schema: z.ZodType) {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, { io: "input", target: "openapi-3.0" });
  delete jsonSchema.$schema;
  return { required: true, content: { "multipart/form-data": { schema: jsonSchema } } };
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
    is_hidden: { type: "boolean", description: "Masqué par l'auteur : absent du feed public" },
  },
};

// Carte du feed (FeedPost de src/lib/posts.ts).
const feedPost = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    shortDescription: { type: "string" },
    location: { type: "string", nullable: true, description: "Ville, sinon région ; null pour un pays entier" },
    countryCode: { type: "string", example: "JP" },
    archetype: { type: "string", enum: [...POST_ARCHETYPES] },
    photoUrl: { type: "string" },
    photoAlt: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    likeCount: { type: "integer", minimum: 0, description: "Nombre de likes (visible par tous)" },
    author: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        username: { type: "string" },
        displayName: { type: "string" },
        avatarUrl: { type: "string", nullable: true },
        avatarSeed: { type: "string", nullable: true },
      },
    },
  },
};

const authResult = {
  type: "object",
  properties: {
    token: {
      type: "string",
      description: "JWT HS256, durée JWT_EXPIRES_IN (1 h par défaut). À envoyer dans « Authorization: Bearer <token> ».",
    },
    refreshToken: {
      type: "string",
      description:
        "Token opaque à usage unique (REFRESH_TOKEN_REMEMBER_DAYS avec remember, 30 jours par défaut ; " +
        "REFRESH_TOKEN_SESSION_HOURS sinon, 24 h par défaut). À envoyer à /auth/refresh pour obtenir " +
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
const tooManyRequests = error("Trop de requêtes : limite atteinte (réglable par variables RATE_LIMIT_*, voir .env.example)", [
  "TOO_MANY_REQUESTS",
]);
// Même réponse pour un post inexistant ou appartenant à un autre utilisateur (on ne révèle rien).
const notFound = error("Post introuvable ou appartenant à un autre utilisateur", ["NOT_FOUND"]);
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
const tripNotFound = error("Voyage (ou élément) introuvable, ou appartenant à un autre utilisateur", ["NOT_FOUND"]);
const tripMessages = {
  type: "object",
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string" },
          off_topic: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          suggestions: {
            type: "array",
            items: { type: "object", properties: { status: { type: "string", enum: ["pending", "accepted", "rejected"] } } },
          },
        },
      },
    },
  },
};
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
      400: invalidInput,
      401: unauthorized,
      404: tripNotFound,
      ...(options.ai ? { 429: aiRateLimited, 503: aiUnavailable } : {}),
      500: internalError,
      // En dernier : peut remplacer une réponse par défaut (ex. le 429 de la discussion).
      ...(options.ok ?? { 200: json("Voyage à jour", tripDetail) }),
    },
  };
}

// Likes et enregistrements d'un post.
const reactions = {
  type: "object",
  properties: {
    likeCount: { type: "integer", minimum: 0 },
    liked: { type: "boolean", description: "Le post est aimé par l'utilisateur connecté" },
    saved: { type: "boolean", description: "Le post est dans ses voyages enregistrés" },
  },
};
const postIdParameter = { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } };
const reactionNotFound = error("Post introuvable ou masqué", ["NOT_FOUND"]);

function reactionPaths(kind: "like" | "save", label: string) {
  const responses = {
    200: json("État des réactions après l'opération", reactions),
    400: invalidInput,
    401: unauthorized,
    404: reactionNotFound,
    429: tooManyRequests,
    500: internalError,
  };
  return {
    parameters: [postIdParameter],
    put: {
      tags: ["Réactions"],
      summary: `${label} un post`,
      description: "Idempotent : sans effet si c'est déjà fait.",
      security: [{ bearerAuth: [] }],
      responses,
    },
    delete: {
      tags: ["Réactions"],
      summary: `Retirer le ${kind === "like" ? "like" : "enregistrement"} d'un post`,
      description: "Idempotent : sans effet s'il n'y en avait pas.",
      security: [{ bearerAuth: [] }],
      responses,
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
      { name: "Posts", description: "Feed public, création, masquage et suppression de récits" },
      { name: "Lieux", description: "Recherche de villes et pays (country-state-city)" },
      { name: "Réactions", description: "Likes et voyages enregistrés" },
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
            429: tooManyRequests,
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
            400: error("Champ invalide, ou voyage de plus d'1 mois (31 jours)", ["INVALID_INPUT", "TRIP_TOO_LONG"]),
            401: unauthorized,
            429: aiRateLimited,
            503: aiUnavailable,
            500: internalError,
          },
        },
      },
      "/posts": {
        get: {
          tags: ["Posts"],
          summary: "Feed : posts du plus récent au plus ancien (public)",
          description:
            "Pagination par curseur (chargement infini) : renvoyer `nextCursor` dans `cursor` pour la page suivante. " +
            "`nextCursor` vaut null quand il n'y a plus rien à charger.",
          parameters: [
            { name: "archetype", in: "query", schema: { type: "string", enum: [...POST_ARCHETYPES] } },
            { name: "cursor", in: "query", schema: { type: "integer", minimum: 1 }, description: "Id du dernier post déjà affiché" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: FEED_MAX_LIMIT, default: 10 } },
          ],
          responses: {
            200: json("Une page du feed", {
              type: "object",
              properties: {
                posts: { type: "array", items: feedPost },
                nextCursor: { type: "integer", nullable: true },
              },
            }),
            400: invalidInput,
            429: tooManyRequests,
            500: internalError,
          },
        },
        post: {
          tags: ["Posts"],
          summary: "Publier un récit",
          description:
            "L'auteur est toujours celui du token. Destination et tags vérifiés dans country-state-city, " +
            "type réel de la photo vérifié (JPEG, PNG, WebP, 5 Mo max). Chaque tag est un JSON : " +
            '`{"country":"JP","state":"26","city":"Kyoto"}`.',
          security: [{ bearerAuth: [] }],
          requestBody: multipartBody(createPostSchema),
          responses: {
            201: json("Récit publié", { type: "object", properties: { id: { type: "integer" } } }),
            400: invalidInput,
            401: unauthorized,
            411: error("En-tête Content-Length absent", ["LENGTH_REQUIRED"]),
            413: error("Corps de requête trop lourd", ["PAYLOAD_TOO_LARGE"]),
            429: tooManyRequests,
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
      "/trips/{id}/messages": {
        get: tripRoute("Discussion avec l'IA", { ok: { 200: json("Messages et propositions", tripMessages) } }),
        post: tripRoute("Envoyer un message à l'IA", {
          body: sendTripMessageSchema,
          ai: true,
          ok: {
            201: json("Discussion à jour", tripMessages),
            429: error("30 messages maximum par utilisateur et par heure, 50 par voyage", ["TOO_MANY_REQUESTS", "CHAT_LIMIT_REACHED"]),
          },
          description:
            "Limitée au voyage et à sa destination (hors sujet : off_topic, aucune proposition). Message traité comme " +
            "une donnée non fiable. Les activités proposées restent en attente jusqu'à la réponse de l'utilisateur.",
        }),
      },
      "/trips/{id}/suggestions/{suggestionId}": {
        patch: tripRoute("Accepter ou refuser une proposition de l'IA", {
          params: ["id", "suggestionId"],
          body: answerTripSuggestionSchema,
          description: "Acceptée : l'activité est ajoutée au planning. 404 si la proposition a déjà reçu une réponse.",
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
      "/posts/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
        patch: {
          tags: ["Posts"],
          summary: "Masquer ou réafficher mon post",
          description: "Un post masqué disparaît du feed public mais reste visible par son auteur dans son profil.",
          security: [{ bearerAuth: [] }],
          requestBody: requestBody(updatePostSchema),
          responses: {
            200: json("Visibilité mise à jour", {
              type: "object",
              properties: { id: { type: "integer" }, hidden: { type: "boolean" } },
            }),
            400: invalidInput,
            401: unauthorized,
            404: notFound,
            429: tooManyRequests,
            500: internalError,
          },
        },
        delete: {
          tags: ["Posts"],
          summary: "Supprimer définitivement mon post",
          description: "Supprime le post, ses liens vers les tags et sa photo du bucket.",
          security: [{ bearerAuth: [] }],
          responses: {
            204: { description: "Post supprimé (pas de contenu)" },
            400: invalidInput,
            401: unauthorized,
            404: notFound,
            429: tooManyRequests,
            500: internalError,
          },
        },
      },
      "/locations": {
        get: {
          tags: ["Lieux"],
          summary: "Rechercher une ville ou un pays (8 suggestions max)",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 60 } },
          ],
          responses: {
            200: json("Suggestions", {
              type: "object",
              properties: {
                places: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      label: { type: "string", example: "Kyoto, Kyōto Prefecture, Japon" },
                      country: { type: "string" },
                      state: { type: "string" },
                      city: { type: "string" },
                    },
                  },
                },
              },
            }),
            400: invalidInput,
            429: tooManyRequests,
            500: internalError,
          },
        },
      },
      "/posts/{id}/like": reactionPaths("like", "Aimer"),
      "/posts/{id}/save": reactionPaths("save", "Enregistrer"),
      "/posts/{id}/reactions": {
        parameters: [postIdParameter],
        get: {
          tags: ["Réactions"],
          summary: "Mes réactions sur un post (et son nombre de likes)",
          security: [{ bearerAuth: [] }],
          responses: {
            200: json("État des réactions", reactions),
            400: invalidInput,
            401: unauthorized,
            404: reactionNotFound,
            500: internalError,
          },
        },
      },
      "/users/me/reactions": {
        get: {
          tags: ["Réactions"],
          summary: "Mes réactions sur plusieurs posts (une page du feed)",
          description: "Un seul appel pour toute une page du feed, au lieu d'un appel par post.",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "postIds",
              in: "query",
              required: true,
              description: "Ids séparés par des virgules (1 à 50), ex. 12,11,10",
              schema: { type: "string", pattern: "^[1-9][0-9]{0,9}(,[1-9][0-9]{0,9})*$" },
            },
          ],
          responses: {
            200: json("Réactions de l'utilisateur", {
              type: "object",
              properties: {
                reactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      postId: { type: "integer" },
                      likeCount: { type: "integer", minimum: 0 },
                      liked: { type: "boolean" },
                      saved: { type: "boolean" },
                    },
                  },
                },
              },
            }),
            400: invalidInput,
            401: unauthorized,
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
                saved: { type: "array", items: postSummary, description: "Voyages enregistrés (48 plus récents), avec leur auteur" },
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
