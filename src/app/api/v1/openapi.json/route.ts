import { buildOpenApiDocument } from "@/server/openapi";

// Développement uniquement : on n'expose pas la carte de l'API en production.
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json(buildOpenApiDocument());
}
