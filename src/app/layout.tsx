import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas font-sans text-body-md text-ink">
        {/* Fond de toutes les pages : courbes de niveau (le SVG sert de masque, la couleur vient du token ink).
            -z-10 : derrière le contenu ; masqué à l'impression (planning en PDF). */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-ink/5 [mask-image:url(/topo.svg)] [mask-size:60rem] print:hidden"
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
