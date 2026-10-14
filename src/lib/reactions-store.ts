// État partagé des likes / enregistrements : synchronisé entre les pages, le cache de Next et les onglets.
import { getSessionSnapshot, parseSessionUser, subscribeSession } from "@/lib/session";

export type ReactionState = { likeCount: number; liked: boolean; saved: boolean };

const entries = new Map<number, ReactionState>();
const listeners = new Set<() => void>();
const CHANNEL_NAME = "brb:reactions";

let channel: BroadcastChannel | null = null;
let currentUserId: string | null | undefined;

// Navigateur uniquement, jamais pendant le rendu serveur.
function init() {
  if (channel || typeof window === "undefined") return;

  channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
  channel?.addEventListener("message", (event: MessageEvent<{ postId: number; state: ReactionState }>) => {
    store(event.data.postId, event.data.state);
  });

  // Changement d'utilisateur : on efface l'état de l'ancien compte.
  currentUserId = sessionUserId();
  subscribeSession(() => {
    const userId = sessionUserId();
    if (userId === currentUserId) return;
    currentUserId = userId;
    for (const [postId, state] of entries) entries.set(postId, { ...state, liked: false, saved: false });
    notify();
  });
}

function sessionUserId() {
  return parseSessionUser(getSessionSnapshot())?.id ?? null;
}

function store(postId: number, state: ReactionState) {
  entries.set(postId, state);
  notify();
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeReactions(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getReaction(postId: number): ReactionState | undefined {
  return entries.get(postId);
}

export function setReactionFromServer(postId: number, state: ReactionState) {
  store(postId, state);
}

export function setReactionFromUser(postId: number, state: ReactionState) {
  store(postId, state);
  channel?.postMessage({ postId, state });
}
