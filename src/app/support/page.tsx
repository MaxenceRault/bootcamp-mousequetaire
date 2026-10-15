import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SupportView } from "@/components/SupportView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Support : créer un ticket et suivre son état. Réservé aux utilisateurs connectés.
export default async function SupportPage() {
  const t = await getTranslations("Support");

  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto flex max-w-180 flex-col gap-6 px-4 md:px-6">
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-display-lg-mobile text-ink md:text-headline-xl">{t("title")}</h1>
            <p className="text-body-md text-ink-soft">{t("subtitle")}</p>
          </header>
          <SupportView />
        </div>
      </main>
      <Footer />
    </>
  );
}
