export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

const TOKEN_KEY = "brb_token";
const USER_KEY = "brb_user";

export function saveSession(token: string, user: SessionUser, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  clearSession();
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
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
