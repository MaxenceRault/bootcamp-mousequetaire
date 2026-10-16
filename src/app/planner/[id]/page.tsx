import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { TripPlanner } from "@/components/TripPlanner";
import { tripIdParamSchema } from "@/schemas/trip.schema";

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

// Voyage chargé côté client (token dans le navigateur) : ici, seul l'id est validé.
async function TripContent({ params }: Pick<PageProps<"/planner/[id]">, "params">) {
  const id = tripIdParamSchema.safeParse((await params).id);
  if (!id.success) notFound();

  return <TripPlanner tripId={id.data} />;
}
