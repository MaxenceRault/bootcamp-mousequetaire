import { NextResponse, type NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/jwt";
import { getPostSlug } from "@/lib/services/post.service";
import { postIdSchema } from "@/schemas/post.schema";

// 1. Anciens liens /post/{id} : redirection 308 avant le rendu (depuis la page, rendue en streaming, ce serait 200).
// 2. Routes API privées : refus immédiat sans token valide (chaque controller revérifie aussi).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/post/")) {
    const id = postIdSchema.safeParse(pathname.slice("/post/".length));
    const slug = id.success ? await getPostSlug(id.data) : null;
    // Sans révéler l'existence d'un post masqué.
    return slug ? NextResponse.redirect(new URL(`/post/${slug}`, request.url), 308) : NextResponse.next();
  }

  // Le feed (GET /api/v1/posts) est public.
  if (request.method === "GET" && pathname === "/api/v1/posts") return NextResponse.next();

  if (!(await getUserIdFromRequest(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/post/:id(\\d+)",
    // Les pages ne reçoivent pas le token (navigateur, pas de cookie).
    "/api/v1/users/:path*",
    "/api/v1/posts/:path*",
    "/api/v1/trips/:path*",
    "/api/v1/admin/:path*",
  ],
};
