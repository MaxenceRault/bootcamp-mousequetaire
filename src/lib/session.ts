export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  // Absent dans les sessions ouvertes avant l'ajout du choix d'avatar.
  avatar_seed?: string | null;
  avatar_background_color?: string | null;
};

const TOKEN_KEY = "brb_token";
const REFRESH_KEY = "brb_refresh";
const USER_KEY = "brb_user";
// Événement émis à chaque connexion / déconnexion pour mettre à jour l'interface (ex. Navbar).
const SESSION_EVENT = "brb:session";

// remember : localStorage (garde la session après fermeture du navigateur) ou sessionStorage.
// Access token et refresh token sont toujours stockés au même endroit.
export function saveSession(token: string, refreshToken: string, user: SessionUser, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  clearSession();
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(REFRESH_KEY, refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(REFRESH_KEY);
    storage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

// Déconnexion : révoque la session côté serveur (best effort), puis efface la session locale.
export async function logout() {
  const refreshToken = getRefreshToken();
  clearSession();
  if (!refreshToken) return;
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);
}

let pendingRefresh: Promise<string | null> | null = null;

// Access token valide, renouvelé avec le refresh token s'il a expiré. null si la session est terminée.
async function getFreshToken(): Promise<string | null> {
  const token = getToken();
  if (token && !isExpired(token)) return token;
  return refreshAccessToken();
}

// Un seul refresh à la fois, y compris entre onglets (verrou navigateur) : un refresh token
// envoyé deux fois serait pris pour un vol et couperait la session.
function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;

  const staleToken = getToken();
  const run = navigator.locks
    ? // Le verrou est tenu jusqu'à la fin du refresh ; then() aplatit la promesse renvoyée.
      navigator.locks.request("brb-refresh", () => runRefresh(staleToken)).then((token) => token)
    : runRefresh(staleToken);
  const pending = run.finally(() => {
    pendingRefresh = null;
  });
  pendingRefresh = pending;
  return pending;
}

async function runRefresh(staleToken: string | null): Promise<string | null> {
  // Un autre onglet a déjà renouvelé la session pendant l'attente du verrou.
  const current = getToken();
  if (current && current !== staleToken && !isExpired(current)) return current;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const remember = localStorage.getItem(REFRESH_KEY) !== null;
  const result = await postAuth("/api/v1/auth/refresh", { refreshToken });
  if ("error" in result) {
    // Hors ligne ou serveur indisponible : on garde la session pour réessayer plus tard.
    if (result.error !== "INTERNAL_ERROR") clearSession();
    return null;
  }

  saveSession(result.token, result.refreshToken, result.user, remember);
  return result.token;
}

// Abonnement aux changements de session (cet onglet + autres onglets), pour useSyncExternalStore.
// Au premier abonnement, renouvelle l'access token s'il a expiré (ex. retour sur le site le lendemain).
export function subscribeSession(onChange: () => void) {
  void getFreshToken();
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Utilisateur stocké, sérialisé (valeur stable pour useSyncExternalStore), ou null si pas de session.
// Access token expiré mais refresh token présent : la session continue (renouvelée au prochain appel).
// Lecture de l'expiration pour l'affichage uniquement : la signature est vérifiée côté serveur (jwt.ts).
export function getSessionSnapshot() {
  const token = getToken();
  const user = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!user || (!getRefreshToken() && (!token || isExpired(token)))) return null;
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

// Codes d'erreur des routes d'auth traduits dans fr.json (Auth.errors) ; tout autre code → INTERNAL_ERROR.
const AUTH_ERRORS = ["INVALID_CREDENTIALS", "EMAIL_TAKEN", "INVALID_INPUT", "TOO_MANY_REQUESTS", "INTERNAL_ERROR"] as const;

export function authErrorCode(code: string | undefined): (typeof AUTH_ERRORS)[number] {
  return AUTH_ERRORS.find((known) => known === code) ?? "INTERNAL_ERROR";
}

export async function postAuth(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  const data = await response?.json().catch(() => null);
  if (!response?.ok || !data?.token) return { error: String(data?.error ?? "INTERNAL_ERROR") };
  return { token: data.token as string, refreshToken: data.refreshToken as string, user: data.user as SessionUser };
}

// Met à jour l'utilisateur stocké (ex. après modification du profil), sans toucher au token.
export function updateSessionUser(user: SessionUser) {
  const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export type ApiResult<T> = { data: T } | { error: string };

// Appel d'une route API privée avec « Authorization: Bearer <token> ».
// body : objet envoyé en JSON, ou FormData envoyé tel quel en multipart (ex. upload de photo).
// Access token expiré ou refusé (401) : renouvelé une fois avec le refresh token, puis l'appel est rejoué.
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const token = await getFreshToken();
  if (!token) return { error: "UNAUTHORIZED" };

  let response = await sendWithToken(path, init, token);
  if (response?.status === 401) {
    const renewed = await refreshAccessToken();
    if (!renewed) return { error: "UNAUTHORIZED" };
    response = await sendWithToken(path, init, renewed);
    if (response?.status === 401) clearSession();
  }

  const data = await response?.json().catch(() => null);
  if (!response?.ok) return { error: String(data?.error ?? "INTERNAL_ERROR") };
  return { data: data as T };
}

function sendWithToken(path: string, init: { method?: string; body?: unknown }, token: string) {
  const isMultipart = init.body instanceof FormData;
  return fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      // Multipart : pas de Content-Type, le navigateur l'ajoute avec la frontière (boundary).
      ...(init.body === undefined || isMultipart ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : isMultipart ? (init.body as FormData) : JSON.stringify(init.body),
  }).catch(() => null);
}
