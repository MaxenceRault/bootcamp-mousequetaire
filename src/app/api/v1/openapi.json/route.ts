import { buildOpenApiDocument } from "@/lib/openapi";

// GET /api/v1/openapi.json : spécification OpenAPI lue par la page /api-docs.
// Disponible en développement uniquement : on n'expose pas la carte de l'API en production.
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json(buildOpenApiDocument());
}
