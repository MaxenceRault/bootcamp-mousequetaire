import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PostEditorForm, type PostOption } from "@/components/PostEditorForm";

// Temporaire : en attendant la table archetype (valeurs reprises de la maquette Stitch).
const DEMO_ARCHETYPES: PostOption[] = [
  { id: 1, name: "Slow travel & photographie" },
  { id: 2, name: "Architecture en solo" },
  { id: 3, name: "Patrimoine culinaire" },
  { id: 4, name: "Trek en montagne" },
];

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
          <PostEditorForm archetypes={DEMO_ARCHETYPES} />
        </div>
      </main>

      <Footer />
    </>
  );
}
