import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PlannerHome } from "@/components/PlannerHome";
import { POST_ARCHETYPES } from "@/lib/posts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Planner");

  return { title: t("metaTitle") };
}

// Le token est stocké dans le navigateur (pas de cookie) : les voyages sont chargés côté client, via l'API.
export default function PlannerPage() {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-300 px-4 md:px-6">
          <PlannerHome archetypes={POST_ARCHETYPES} />
        </div>
      </main>
      <Footer />
    </>
  );
}
