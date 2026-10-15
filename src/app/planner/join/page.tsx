import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { TripJoin } from "@/components/TripJoin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Planner.share");

  return { title: t("joinMetaTitle") };
}

// /planner/join#<code> : le code reste dans le navigateur (jamais envoyé avec l'URL), puis part dans le corps d'un POST.
export default function JoinTripPage() {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-xl px-4 md:px-6">
          <TripJoin />
        </div>
      </main>
      <Footer />
    </>
  );
}
