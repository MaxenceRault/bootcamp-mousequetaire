// Côté client : état partagé des likes / enregistrements, par id de post.
// Tous les boutons PostReactions lisent ce store : un like sur la page détail se retrouve
// sur l'accueil (même en revenant en arrière, où Next réaffiche sa version en cache), et
// dans les autres onglets ouverts (BroadcastChannel).
import { getSessionSnapshot, parseSessionUser, subscribeSession } from "@/lib/session";

export type ReactionState = { likeCount: number; liked: boolean; saved: boolean };

const entries = new Map<number, ReactionState>();
const listeners = new Set<() => void>();
const CHANNEL_NAME = "brb:reactions";

let channel: BroadcastChannel | null = null;
let currentUserId: string | null | undefined;

// Initialisé au premier abonnement, uniquement dans le navigateur (jamais pendant le rendu serveur).
function init() {
  if (channel || typeof window === "undefined") return;

  channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
  channel?.addEventListener("message", (event: MessageEvent<{ postId: number; state: ReactionState }>) => {
    store(event.data.postId, event.data.state);
  });

  // Changement d'utilisateur (déconnexion, autre compte) : les « aimé / enregistré » de l'ancien
  // compte sont effacés. Un simple renouvellement du token (même utilisateur) ne change rien.
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

// undefined tant qu'aucune donnée n'a été reçue pour ce post (le composant utilise alors ses props).
export function getReaction(postId: number): ReactionState | undefined {
  return entries.get(postId);
}

// Données reçues de l'API (état de référence) : mises à jour dans cet onglet seulement.
export function setReactionFromServer(postId: number, state: ReactionState) {
  store(postId, state);
}

// Action de l'utilisateur : mise à jour ici et dans ses autres onglets.
export function setReactionFromUser(postId: number, state: ReactionState) {
  store(postId, state);
  channel?.postMessage({ postId, state });
}
