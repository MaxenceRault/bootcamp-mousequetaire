"use client";

import { useEffect, useRef, useState } from "react";

// Lieu renvoyé par GET /api/v1/locations?q=… (pays, ou ville avec sa région et son pays).
export type Place = { key: string; label: string; country: string; state?: string; city?: string };

// Attente après la dernière frappe avant de lancer une recherche de lieu.
const SEARCH_DELAY_MS = 250;

// Recherche de lieux pendant la saisie (destination, tags…).
export function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Numéro de la dernière recherche : une réponse plus ancienne (frappe rapide) est ignorée.
  const lastRequest = useRef(0);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function changeQuery(value: string) {
    setQuery(value);
    setError(false);
    clearTimeout(searchTimer.current);

    if (value.trim().length < 2) {
      lastRequest.current++;
      setPlaces([]);
      return;
    }
    searchTimer.current = setTimeout(() => search(value.trim()), SEARCH_DELAY_MS);
  }

  async function search(text: string) {
    const requestId = ++lastRequest.current;
    const response = await fetch(`/api/v1/locations?${new URLSearchParams({ q: text })}`).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (requestId !== lastRequest.current) return;

    setError(!data);
    setPlaces((data?.places as Place[] | undefined) ?? []);
  }

  // Après un choix : vide les suggestions et remplace le texte saisi.
  function reset(nextQuery = "") {
    clearTimeout(searchTimer.current);
    lastRequest.current++;
    setQuery(nextQuery);
    setPlaces([]);
  }

  return { query, places, error, changeQuery, reset };
}
