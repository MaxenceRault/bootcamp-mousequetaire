import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Côté serveur : en ligne (aucun bandeau au premier rendu).
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
