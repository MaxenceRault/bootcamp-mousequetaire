import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { FeedList } from "@/components/FeedList";
import { NewPostButton } from "@/components/NewPostButton";
import { Card } from "@/components/ui/Card";
import { POST_ARCHETYPES, type FeedPage, type PostArchetype } from "@/lib/posts";
import { getFeedPage, searchPosts } from "@/lib/services/post.service";
import { searchQuerySchema } from "@/schemas/post.schema";

// Allowlist : toute autre valeur de ?archetype= retombe sur le feed complet.
const archetypeSchema = z.enum(POST_ARCHETYPES);

export default async function Home({ searchParams }: PageProps<"/">) {
  const t = await getTranslations("Home");

  return (
    <>
      {/* Fond décoratif flouté, fixe pendant le défilement. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 scale-110 bg-[url(/home-bg.jpg)] bg-cover bg-center opacity-75 blur-2xl" />
        <div className="absolute inset-0 bg-linear-to-b from-surface/40 via-canvas/60 to-canvas/80" />
      </div>

      <Navbar />

      <main className="relative w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-190 px-4 md:px-6">
          <h1 className="sr-only">{t("title")}</h1>
          {/* Le feed dépend de l'URL (?archetype=) : il est rendu à la requête, dans un Suspense. */}
          <Suspense fallback={<FeedSkeleton />}>
            <Feed searchParams={searchParams} />
          </Suspense>
        </div>
      </main>

      {/* Bouton flottant : ouvre l'éditeur pour publier un nouveau post (connecté uniquement). */}
      <NewPostButton />

      <Footer />
    </>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // Rendu à chaque requête : les dates relatives (« il y a 2 heures ») dépendent de l'heure actuelle.
  await connection();
  const params = await searchParams;
  // ?q= valide (2 à 100 caractères) : résultats de recherche à la place du feed.
  const query = searchQuerySchema.safeParse(params.q);
  if (query.success) return <SearchResults query={query.data} />;

  const parsed = archetypeSchema.safeParse(params.archetype);
  const archetype = parsed.success ? parsed.data : undefined;
  const t = await getTranslations("Home");

  let page: FeedPage | null;
  try {
    // Server Component = couche controller : il appelle directement le service (pas d'appel HTTP à soi-même).
    page = await getFeedPage({ archetype });
  } catch {
    page = null;
  }
  const now = new Date();

  return (
    <>
      <ArchetypeTabs active={archetype} />

      {page === null && <p className="py-10 text-center text-body-md text-ink-soft">{t("error")}</p>}
      {page?.posts.length === 0 && <p className="py-10 text-center text-body-md text-ink-soft">{t("empty")}</p>}

      {/* key : changer d'onglet repart d'une liste neuve (état du chargement infini remis à zéro). */}
      {page && page.posts.length > 0 && (
        <FeedList
          key={archetype ?? "all"}
          initialPosts={page.posts}
          initialCursor={page.nextCursor}
          archetype={archetype}
          now={now}
        />
      )}
    </>
  );
}

// Résultats de la recherche (30 max, sans chargement infini) : mêmes cartes que le feed.
async function SearchResults({ query }: { query: string }) {
  const t = await getTranslations("Home");

  let posts: FeedPage["posts"] | null;
  try {
    posts = await searchPosts(query);
  } catch {
    posts = null;
  }

  return (
    <>
      <header className="mb-8 flex flex-col gap-2 border-b border-line pb-4">
        <h2 className="font-display text-headline-md text-ink">{t("searchTitle", { query })}</h2>
        <p className="flex flex-wrap items-center gap-3 text-body-md text-ink-soft">
          {posts && <span>{t("searchCount", { count: posts.length })}</span>}
          <Link href="/" className="font-display text-label-md text-ink-soft underline transition hover:text-ink">
            {t("searchClear")}
          </Link>
        </p>
      </header>

      {posts === null && <p className="py-10 text-center text-body-md text-ink-soft">{t("error")}</p>}
      {posts?.length === 0 && <p className="py-10 text-center text-body-md text-ink-soft">{t("searchEmpty")}</p>}
      {posts && posts.length > 0 && (
        <FeedList key={`search:${query}`} initialPosts={posts} initialCursor={null} now={new Date()} />
      )}
    </>
  );
}

// Onglets du feed : « Tendances » (tout) puis un onglet par type de récit.
async function ArchetypeTabs({ active }: { active: PostArchetype | undefined }) {
  const t = await getTranslations("Home");
  const tArchetypes = await getTranslations("Archetypes");
  const tabs = [
    { key: "all", label: t("allArchetypes"), href: "/", isActive: active === undefined },
    ...POST_ARCHETYPES.map((archetype) => ({
      key: archetype,
      label: tArchetypes(archetype),
      href: `/?archetype=${archetype}`,
      isActive: active === archetype,
    })),
  ];

  return (
    <nav aria-label={t("archetypesLabel")} className="mb-8 border-b border-line pb-3">
      <ul className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.isActive ? "page" : undefined}
              className={`block rounded-lg border px-3.5 py-1.5 font-display text-label-md whitespace-nowrap transition ${
                tab.isActive
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface text-ink-soft hover:border-ink-soft/25 hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-12 pt-14">
      {[0, 1].map((i) => (
        <Card key={i} className="h-150 animate-pulse p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-surface-muted" />
            <div className="h-4 w-40 rounded-lg bg-surface-muted" />
          </div>
          <div className="h-105 rounded-lg bg-surface-muted" />
        </Card>
      ))}
    </div>
  );
}
