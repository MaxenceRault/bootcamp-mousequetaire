import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LEGAL_PAGES } from "@/lib/legal";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="relative mt-auto w-full border-t border-line bg-surface">
      <div className="mx-auto flex max-w-300 flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:gap-2 md:px-6">
        <span className="font-display text-label-lg text-ink">{t("brand")}</span>
        <span className="text-body-sm text-ink-soft/70">{t("rights")}</span>
        <nav aria-label={t("legalLabel")} className="flex flex-wrap justify-center gap-x-3 gap-y-1 sm:ml-2">
          {LEGAL_PAGES.map((page) => (
            <Link key={page} href={`/legal/${page}`} className="text-body-sm text-ink-soft hover:text-ink hover:underline">
              {t(`legal.${page}`)}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col items-center gap-2 sm:ml-auto sm:flex-row">
          <span className="text-body-sm text-ink-soft">{t("patronPitch")}</span>
          <Link href="/patron" className={buttonClassName("sm", "gap-1.5")}>
            <Icon name="heartFilled" className="size-4" />
            {t("patron")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
