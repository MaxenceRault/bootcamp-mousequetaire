import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PostEditorForm } from "@/components/PostEditorForm";
import { POST_ARCHETYPES } from "@/lib/posts";

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
          <PostEditorForm archetypes={POST_ARCHETYPES} />
        </div>
      </main>

      <Footer />
    </>
  );
}
