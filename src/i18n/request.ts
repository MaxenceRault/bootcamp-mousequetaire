import { getRequestConfig } from "next-intl/server";

// Une seule langue pour l'instant : en ajouter une = messages/<locale>.json + choix de la locale ici.
export default getRequestConfig(async () => {
  const locale = "fr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
