import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { TravelCard } from "@/components/TravelCard";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getFeedPosts, POST_CATEGORIES, type FeedPost, type PostCategory } from "@/lib/posts";

// Allowlist : toute autre valeur de ?category= retombe sur le feed complet.
const categorySchema = z.enum(POST_CATEGORIES);

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
          {/* Le feed dépend de l'URL (?category=) : il est rendu à la requête, dans un Suspense. */}
          <Suspense fallback={<FeedSkeleton />}>
            <Feed searchParams={searchParams} />
          </Suspense>
        </div>
      </main>

      {/* Bouton flottant : ouvre l'éditeur pour publier un nouveau post. */}
      <Link
        href="/post/new"
        aria-label={t("newPost")}
        className={buttonClassName(
          "md",
          "group fixed right-4 bottom-4 z-50 gap-0 px-3.5 shadow-lg md:right-6 md:bottom-6",
        )}
      >
        <Icon name="add" className="size-5" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-focus-visible:ml-2 group-focus-visible:max-w-xs">
          {t("newPost")}
        </span>
      </Link>

      <Footer />
    </>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // Rendu à chaque requête : les dates relatives (« il y a 2 heures ») dépendent de l'heure actuelle.
  await connection();
  const parsed = categorySchema.safeParse((await searchParams).category);
  const category = parsed.success ? parsed.data : undefined;
  const t = await getTranslations("Home");

  let posts: FeedPost[] | null;
  try {
    posts = await getFeedPosts(category);
  } catch {
    posts = null;
  }
  const now = new Date();

  return (
    <>
      <CategoryTabs active={category} />

      {posts === null && <p className="py-10 text-center text-body-md text-ink-soft">{t("error")}</p>}
      {posts?.length === 0 && <p className="py-10 text-center text-body-md text-ink-soft">{t("empty")}</p>}

      <div className="space-y-12">
        {posts?.map((post, index) => (
          <TravelCard key={post.id} post={post} now={now} preload={index === 0} />
        ))}
      </div>
    </>
  );
}

async function CategoryTabs({ active }: { active: PostCategory | undefined }) {
  const t = await getTranslations("Home");
  const tabs = [
    { key: "all", href: "/", isActive: active === undefined },
    ...POST_CATEGORIES.map((category) => ({
      key: category,
      href: `/?category=${category}`,
      isActive: active === category,
    })),
  ];

  return (
    <nav aria-label={t("categoriesLabel")} className="mb-8 border-b border-line pb-3">
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
              {t(`categories.${tab.key}`)}
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
