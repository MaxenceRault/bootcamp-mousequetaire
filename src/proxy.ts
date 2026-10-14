import { NextResponse, type NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/jwt";

// Première barrière sur les routes API privées : refuse tout de suite une requête sans token valide.
// Chaque controller revérifie le token (une modification du matcher ne doit pas ouvrir de faille).
export async function proxy(request: NextRequest) {
  // Exception : la lecture du feed (GET /api/v1/posts, chemin exact) est publique.
  if (request.method === "GET" && request.nextUrl.pathname === "/api/v1/posts") return NextResponse.next();

  if (!(await getUserIdFromRequest(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  // Routes API privées (les pages ne reçoivent pas le token : il est dans le navigateur, pas dans un cookie).
  matcher: ["/api/v1/users/:path*", "/api/v1/posts/:path*", "/api/v1/trips/:path*"],
};
