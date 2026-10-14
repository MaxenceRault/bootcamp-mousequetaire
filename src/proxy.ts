import { NextResponse, type NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/jwt";

// Première barrière sur les routes API privées : refuse tout de suite une requête sans token valide.
// Chaque controller revérifie le token (une modification du matcher ne doit pas ouvrir de faille).
export async function proxy(request: NextRequest) {
  if (!(await getUserIdFromRequest(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  // Routes API privées (les pages ne reçoivent pas le token : il est dans le navigateur, pas dans un cookie).
  matcher: ["/api/v1/users/:path*", "/api/v1/posts/:path*"],
};
