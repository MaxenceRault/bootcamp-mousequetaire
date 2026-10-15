import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PatronView } from "@/components/PatronView";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Patron");
  return { title: t("metaTitle") };
}

// « Devenir mécène » : don sur Buy Me a Coffee, qui donne le rôle mécène au compte de même email.
export default async function PatronPage() {
  const t = await getTranslations("Patron");

  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-140 px-4 md:px-6">
          <Card className="flex flex-col gap-6 p-6 md:p-10">
            <header className="flex flex-col gap-2 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon name="heartFilled" className="size-6" />
              </span>
              <h1 className="font-display text-headline-lg text-ink">{t("title")}</h1>
              <p className="text-body-md text-ink-soft">{t("pitch")}</p>
            </header>
            <PatronView />
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
