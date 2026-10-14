// Drapeau emoji à partir du code pays ISO (ex. « JP » → 🇯🇵).
export function flagEmoji(countryCode: string) {
  return String.fromCodePoint(...[...countryCode].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

// Nom du pays dans la langue de l'interface (ex. « JP » → « Japon »).
export function countryName(countryCode: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
}
