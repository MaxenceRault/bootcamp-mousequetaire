import "server-only";
import { City, Country, State } from "country-state-city";

// Serveur uniquement : la librairie pèse ~17 Mo.

export type Place = {
  key: string;
  label: string; // ex. « Kyoto, Kyōto, Japon »
  country: string; // code ISO du pays
  state?: string; // code de la région
  city?: string;
};

type IndexedPlace = Place & { search: string };

const MAX_RESULTS = 8;
const EXCLUDED_COUNTRIES = new Set(["IL"]);

let index: IndexedPlace[] | null = null;

export function searchPlaces(query: string): Place[] {
  const search = normalize(query);
  const matches = getIndex().filter((place) => place.search.startsWith(search));

  // Nom exact d'abord, puis les plus courts ; les pays avant les villes.
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

// Une ville doit être dans la région indiquée, elle-même dans le pays.
export function placeExists({ country, state, city }: { country: string; state?: string; city?: string }) {
  if (EXCLUDED_COUNTRIES.has(country)) return false;
  if (!Country.getCountryByCode(country)) return false;
  if (!state) return !city;
  if (!State.getStateByCodeAndCountry(state, country)) return false;
  return !city || City.getCitiesOfState(country, state).some(({ name }) => name === city);
}

function getIndex() {
  if (index) return index;

  // La librairie n'a les noms qu'en anglais.
  const displayNames = new Intl.DisplayNames(["fr"], { type: "region" });
  const countryNames = new Map(
    Country.getAllCountries()
      .filter(({ isoCode }) => !EXCLUDED_COUNTRIES.has(isoCode))
      .map(({ isoCode, name }) => [isoCode, displayNames.of(isoCode) ?? name]),
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

  // Une région peut contenir deux villes du même nom.
  const seen = new Set<string>();
  const cities = City.getAllCities().flatMap(({ name, countryCode, stateCode }) => {
    if (EXCLUDED_COUNTRIES.has(countryCode)) return [];
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

// « kyoto » trouve « Kyōto ».
function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export type PlaceNames = { city: string | null; state: string | null; country: string };

export function describePlace({ country, state, city }: { country: string; state?: string | null; city?: string | null }): PlaceNames {
  const countryName = new Intl.DisplayNames(["fr"], { type: "region" }).of(country) ?? country;
  const stateName = state ? (State.getStateByCodeAndCountry(state, country)?.name ?? null) : null;
  return { city: city ?? null, state: stateName, country: countryName };
}
