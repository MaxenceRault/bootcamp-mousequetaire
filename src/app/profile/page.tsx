import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ProfileView } from "@/components/ProfileView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");

  return { title: t("metaTitle") };
}

// Le token est stocké dans le navigateur (pas de cookie) : les données du profil sont
// chargées côté client par ProfileView, via l'API.
export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-300 px-4 md:px-6">
          {/* ProfileView lit ?tab= (useSearchParams) : rendu dans un Suspense. */}
          <Suspense>
            <ProfileView />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
