"use client";

import { useEffect, useRef, useState } from "react";

export type Place = { key: string; label: string; country: string; state?: string; city?: string };

const SEARCH_DELAY_MS = 250;

export function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Une réponse plus ancienne (frappe rapide) est ignorée.
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

  function reset(nextQuery = "") {
    clearTimeout(searchTimer.current);
    lastRequest.current++;
    setQuery(nextQuery);
    setPlaces([]);
  }

  return { query, places, error, changeQuery, reset };
}
