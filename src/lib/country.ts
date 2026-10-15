export function flagEmoji(countryCode: string) {
  return String.fromCodePoint(...[...countryCode].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function countryName(countryCode: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
}

export function placeHref({ country, state, city }: { country: string; state?: string | null; city?: string | null }) {
  const params = new URLSearchParams({ country });
  if (state) params.set("state", state);
  if (state && city) params.set("city", city);
  return `/tags?${params}`;
}
