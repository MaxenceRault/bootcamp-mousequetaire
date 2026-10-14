import "server-only";
import { City, Country, State } from "country-state-city";

// Recherche de lieux (pays et villes) dans country-state-city.
// Serveur uniquement : la librairie pèse ~17 Mo, elle ne doit pas partir dans le bundle client.

export type Place = {
  key: string;
  label: string; // ex. « Kyoto, Kyōto, Japon »
  country: string; // code ISO du pays
  state?: string; // code de la région
  city?: string;
};

type IndexedPlace = Place & { search: string };

const MAX_RESULTS = 8;

// Index construit au premier appel puis gardé en mémoire (~150 000 villes + 250 pays).
let index: IndexedPlace[] | null = null;

export function searchPlaces(query: string): Place[] {
  const search = normalize(query);
  const matches = getIndex().filter((place) => place.search.startsWith(search));

  // Nom exact d'abord, puis les noms les plus courts (les plus proches de la saisie).
  // Les pays passent avant les villes à égalité.
  return matches
    .sort(
      (a, b) =>
        Number(b.search === search) - Number(a.search === search) ||
        a.search.length - b.search.length ||
        Number(Boolean(a.city)) - Number(Boolean(b.city)) ||
        a.label.localeCompare(b.label, "fr"),
    )
    .slice(0, MAX_RESULTS)
    .map(({ key, label, country, state, city }) => ({ key, label, country, state, city }));
}

// Vérifie qu'un lieu envoyé par le client existe vraiment dans country-state-city.
// Une ville doit appartenir à la région indiquée, elle-même dans le pays indiqué.
export function placeExists({ country, state, city }: { country: string; state?: string; city?: string }) {
  if (!Country.getCountryByCode(country)) return false;
  if (!state) return !city;
  if (!State.getStateByCodeAndCountry(state, country)) return false;
  return !city || City.getCitiesOfState(country, state).some(({ name }) => name === city);
}

// Nom d'une région (ex. « IDF » en France → « Île-de-France »), null si inconnue.
export function getStateName(country: string, state: string) {
  return State.getStateByCodeAndCountry(state, country)?.name ?? null;
}

function getIndex() {
  if (index) return index;

  // Noms des pays en français à partir du code ISO (la librairie ne les a qu'en anglais).
  const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });
  const countryNames = new Map(
    Country.getAllCountries().map(({ isoCode, name }) => [isoCode, displayNames.of(isoCode) ?? name]),
  );
  const stateNames = new Map(
    State.getAllStates().map(({ countryCode, isoCode, name }) => [`${countryCode}-${isoCode}`, name]),
  );

  const countries = [...countryNames].map(([code, name]) => ({
    key: code,
    label: name,
    country: code,
    search: normalize(name),
  }));

  // Clé unique : une même région peut contenir deux villes du même nom.
  const seen = new Set<string>();
  const cities = City.getAllCities().flatMap(({ name, countryCode, stateCode }) => {
    const key = `${countryCode}-${stateCode}-${name}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const label = [name, stateNames.get(`${countryCode}-${stateCode}`), countryNames.get(countryCode)]
      .filter(Boolean)
      .join(", ");
    return [{ key, label, country: countryCode, state: stateCode || undefined, city: name, search: normalize(name) }];
  });

  index = [...countries, ...cities];
  return index;
}

// Insensible à la casse et aux accents : « kyoto » trouve « Kyōto ».
function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
