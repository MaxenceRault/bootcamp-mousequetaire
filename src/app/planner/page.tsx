import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PlannerHome } from "@/components/PlannerHome";
import { Card } from "@/components/ui/Card";
import { listActiveArchetypes } from "@/server/services/archetype.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Planner");

  return { title: t("metaTitle") };
}

// Token dans le navigateur (pas de cookie) : les voyages sont chargés côté client.
export default function PlannerPage() {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-300 px-4 md:px-6">
          {/* Types de récit lus en base : rendu à la requête. */}
          <Suspense fallback={<Card className="h-96 animate-pulse bg-surface-muted" />}>
            <Planner />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function Planner() {
  await connection();
  return <PlannerHome archetypes={await listActiveArchetypes()} />;
}
