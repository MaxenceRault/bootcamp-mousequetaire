import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="relative mt-auto w-full border-t border-line bg-surface">
      <div className="mx-auto flex max-w-300 flex-col items-center gap-1 px-4 py-6 sm:flex-row sm:gap-2 md:px-6">
        <span className="font-display text-label-lg text-ink">{t("brand")}</span>
        <span className="text-body-sm text-ink-soft/70">{t("rights")}</span>
      </div>
    </footer>
  );
}
