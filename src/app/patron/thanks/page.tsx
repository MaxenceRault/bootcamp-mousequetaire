import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PatronThanks } from "@/components/PatronThanks";
import { Card } from "@/components/ui/Card";
import { checkoutSessionIdSchema } from "@/schemas/patron.schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Patron");
  return { title: t("thanksMetaTitle") };
}

// Retour de Stripe : /patron/thanks?session_id=cs_…
export default function PatronThanksPage({ searchParams }: PageProps<"/patron/thanks">) {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-140 px-4 md:px-6">
          <Suspense fallback={<Card className="h-80 animate-pulse" />}>
            <ThanksContent searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function ThanksContent({ searchParams }: Pick<PageProps<"/patron/thanks">, "searchParams">) {
  const sessionId = checkoutSessionIdSchema.safeParse((await searchParams).session_id);
  return (
    <Card className="p-6 md:p-10">
      <PatronThanks sessionId={sessionId.success ? sessionId.data : null} />
    </Card>
  );
}
