import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LEGAL_DRAFT, LEGAL_PAGES, type LegalPage } from "@/lib/legal";

type Section = { title: string; paragraphs: string[] };

function legalPage(value: string): LegalPage | null {
  return (LEGAL_PAGES as readonly string[]).includes(value) ? (value as LegalPage) : null;
}

export function generateStaticParams() {
  return LEGAL_PAGES.map((page) => ({ page }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[page]">): Promise<Metadata> {
  const page = legalPage((await params).page);
  if (!page) return {};
  const t = await getTranslations("Legal");
  return { title: t(`${page}.title`) };
}

// CGU, CGV, mentions légales, confidentialité : textes dans messages/fr.json (Legal), rendus en texte simple.
export default async function LegalDocumentPage({ params }: PageProps<"/legal/[page]">) {
  const page = legalPage((await params).page);
  if (!page) notFound();

  const t = await getTranslations("Legal");
  const sections = t.raw(`${page}.sections`) as Section[];

  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto flex max-w-200 flex-col gap-6 px-4 md:px-6">
          <nav aria-label={t("nav")} className="flex flex-wrap gap-2">
            {LEGAL_PAGES.map((value) => (
              <Link
                key={value}
                href={`/legal/${value}`}
                aria-current={value === page ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 font-display text-label-md transition ${
                  value === page ? "bg-ink text-surface" : "bg-surface-muted text-ink-soft hover:text-ink"
                }`}
              >
                {t(`${value}.short`)}
              </Link>
            ))}
          </nav>

          <Card className="flex flex-col gap-6 p-6 md:p-10">
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-headline-lg text-ink">{t(`${page}.title`)}</h1>
              <p className="text-body-sm text-ink-soft">{t("updated", { date: t(`${page}.date`) })}</p>
            </header>

            {LEGAL_DRAFT && (
              <p role="note" className="flex gap-2 rounded-lg bg-surface-muted p-4 text-body-sm text-ink">
                <Icon name="help" className="mt-0.5 size-4.5 shrink-0 text-accent" />
                {t("draft")}
              </p>
            )}

            {sections.map((section) => (
              <section key={section.title} className="flex flex-col gap-2">
                <h2 className="font-display text-headline-sm text-ink">{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-body-md whitespace-pre-line text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
