import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SwaggerDocs } from "@/components/SwaggerDocs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ApiDocs");

  return { title: t("metaTitle") };
}

// Page /api-docs : Swagger UI. Développement uniquement (404 en production).
export default function ApiDocsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="w-full flex-1 bg-surface">
      <SwaggerDocs url="/api/v1/openapi.json" />
    </main>
  );
}
