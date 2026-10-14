import { NextResponse, type NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/jwt";
import { getPostSlug } from "@/lib/services/post.service";
import { postIdSchema } from "@/schemas/post.schema";

// 1. Anciens liens de récit par id (/post/30) : vraie redirection permanente 308 vers /post/{slug},
//    avant le rendu de la page (une redirection depuis la page, rendue en streaming, répondrait 200).
// 2. Première barrière sur les routes API privées : refuse tout de suite une requête sans token valide.
//    Chaque controller revérifie le token (une modification du matcher ne doit pas ouvrir de faille).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/post/")) {
    const id = postIdSchema.safeParse(pathname.slice("/post/".length));
    const slug = id.success ? await getPostSlug(id.data) : null;
    // Introuvable ou masqué : la page affiche « introuvable » (sans révéler l'existence du post).
    return slug ? NextResponse.redirect(new URL(`/post/${slug}`, request.url), 308) : NextResponse.next();
  }

  // Exception : la lecture du feed (GET /api/v1/posts, chemin exact) est publique.
  if (request.method === "GET" && pathname === "/api/v1/posts") return NextResponse.next();

  if (!(await getUserIdFromRequest(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Anciens liens /post/{id} uniquement (chiffres) : /post/{slug} ne passe pas par ici.
    "/post/:id(\\d+)",
    // Routes API privées (les pages ne reçoivent pas le token : il est dans le navigateur, pas dans un cookie).
    "/api/v1/users/:path*",
    "/api/v1/posts/:path*",
    "/api/v1/trips/:path*",
  ],
};
