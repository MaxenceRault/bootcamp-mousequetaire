import { getRequestConfig } from "next-intl/server";

// Une seule langue pour l'instant, sans préfixe de langue dans l'URL.
// Pour en ajouter une : créer messages/<locale>.json et choisir la locale ici.
export default getRequestConfig(async () => {
  const locale = "fr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
