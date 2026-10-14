import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { TripPlanner } from "@/components/TripPlanner";
import { idParamSchema } from "@/schemas/trip.schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Planner");

  return { title: t("metaTitle") };
}

export default function TripPage({ params }: PageProps<"/planner/[id]">) {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-300 px-4 md:px-6">
          <Suspense>
            <TripContent params={params} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

// Le voyage lui-même est chargé côté client (token dans le navigateur) ; ici on valide seulement l'id.
async function TripContent({ params }: Pick<PageProps<"/planner/[id]">, "params">) {
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) notFound();

  return <TripPlanner tripId={id.data} />;
}
