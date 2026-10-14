import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { TripPrint } from "@/components/TripPrint";
import { idParamSchema } from "@/schemas/trip.schema";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TripExport");

  return { title: t("metaTitle"), robots: { index: false } };
}

// Version imprimable du planning (« Enregistrer en PDF » du navigateur), sans barre de navigation.
export default function TripPrintPage({ params }: PageProps<"/planner/[id]/print">) {
  return (
    <Suspense>
      <PrintContent params={params} />
    </Suspense>
  );
}

async function PrintContent({ params }: Pick<PageProps<"/planner/[id]/print">, "params">) {
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) notFound();

  return <TripPrint tripId={id.data} />;
}
