import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PostEditorForm } from "@/components/PostEditorForm";
import { Card } from "@/components/ui/Card";
import { listActiveArchetypes } from "@/server/services/archetype.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PostEditor");

  return { title: t("metaTitle") };
}

export default async function NewPostPage() {
  const t = await getTranslations("PostEditor");

  return (
    <>
      <Navbar />

      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-225 px-4 md:px-6">
          <h1 className="sr-only">{t("heading")}</h1>
          {/* Types de récit lus en base : rendu à la requête. */}
          <Suspense fallback={<Card className="h-96 animate-pulse bg-surface-muted" />}>
            <Editor />
          </Suspense>
        </div>
      </main>

      <Footer />
    </>
  );
}

async function Editor() {
  await connection();
  return <PostEditorForm archetypes={await listActiveArchetypes()} />;
}
