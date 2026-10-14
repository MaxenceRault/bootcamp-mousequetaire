export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  // Absent dans les sessions ouvertes avant l'ajout du choix d'avatar.
  avatar_seed?: string | null;
};

const TOKEN_KEY = "brb_token";
const USER_KEY = "brb_user";
// Événement émis à chaque connexion / déconnexion pour mettre à jour l'interface (ex. Navbar).
const SESSION_EVENT = "brb:session";

export function saveSession(token: string, user: SessionUser, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  clearSession();
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

// Abonnement aux changements de session (cet onglet + autres onglets), pour useSyncExternalStore.
export function subscribeSession(onChange: () => void) {
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Utilisateur stocké, sérialisé (valeur stable pour useSyncExternalStore), ou null si
// pas de session ou token expiré. Lecture de l'expiration pour l'affichage uniquement :
// la signature du token est vérifiée côté serveur (jwt.ts).
export function getSessionSnapshot() {
  const token = getToken();
  const user = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!token || !user || isExpired(token)) return null;
  return user;
}

export function parseSessionUser(snapshot: string | null): SessionUser | null {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot) as SessionUser;
  } catch {
    return null;
  }
}

function isExpired(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp !== "number" || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export async function postAuth(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  const data = await response?.json().catch(() => null);
  if (!response?.ok || !data?.token) return { error: String(data?.error ?? "INTERNAL_ERROR") };
  return { token: data.token as string, user: data.user as SessionUser };
}

// Met à jour l'utilisateur stocké (ex. après modification du profil), sans toucher au token.
export function updateSessionUser(user: SessionUser) {
  const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export type ApiResult<T> = { data: T } | { error: string };

// Appel d'une route API privée avec « Authorization: Bearer <token> ».
// Session invalide ou expirée (401) : la session locale est effacée.
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const token = getToken();
  if (!token) return { error: "UNAUTHORIZED" };

  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => null);

  const data = await response?.json().catch(() => null);
  if (response?.status === 401) clearSession();
  if (!response?.ok) return { error: String(data?.error ?? "INTERNAL_ERROR") };
  return { data: data as T };
}
