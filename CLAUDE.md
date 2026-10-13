# TripPlanner IA

Projet fil rouge : blog et planificateur de voyage basé sur les posts et avis des voyageurs. Next.js (App Router) + TypeScript strict + Tailwind CSS v4, gestionnaire de paquets **npm**.

## Commandes

```bash
npm run dev     # serveur de dev
npm run build   # build de prod (lance aussi le typecheck)
npm run lint    # ESLint
```

Vérifier `npm run lint` et `npm run build` avant de considérer une tâche terminée.

## Architecture — à respecter

```
src/
├── app/
│   ├── layout.tsx             # Layout global (Navbar + Footer + Fonts)
│   ├── page.tsx               # Homepage (Feed + Hero Search)
│   ├── post/[id]/page.tsx     # Détail d'un post de voyage
│   ├── profile/page.tsx       # Tableau de bord utilisateur
│   ├── planner/page.tsx       # Planification (Calendrier + Checklist)
│   └── api/
│       └── chat/route.ts      # API RAG : recherche vectorielle + appel Gemini
├── components/
│   ├── ui/                    # Design system : composants atomiques (Button, Input, Card…)
│   ├── Navbar.tsx
│   ├── TravelCard.tsx         # Carte de post dans le feed
│   └── AIChatDrawer.tsx       # Drawer du chat RAG
└── lib/
    └── ai.ts                  # Helpers Gemini & embeddings
```

- Ne pas créer de dossier ou de fichier hors de cette structure sans le demander d'abord. Si un nouveau fichier est nécessaire, le placer au bon endroit (page → `app/`, composant → `components/`, logique/clients → `lib/`) et le signaler.
- Les fichiers existent mais sont vides : ne les remplir que lorsqu'on travaille sur la fonctionnalité concernée. Ne pas inventer d'UI, de textes, de données ou de logique qui n'ont pas été demandés.
- Pas de Supabase ni de route de seed pour l'instant.
- Imports via l'alias `@/` (→ `src/`).

## Design system

- Dès qu'un même élément d'UI (bouton, champ, carte, badge, modal…) apparaît dans plusieurs composants, l'extraire dans `src/components/ui/` et réutiliser ce composant partout. Pas de duplication de classes Tailwind pour un même élément.
- Couleurs, rayons et espacements passent par les tokens définis dans `src/app/globals.css` (`@theme`), pas par des valeurs codées en dur dispersées dans les composants.
- Avant de créer un composant, vérifier qu'un équivalent n'existe pas déjà dans `ui/`.

## Sécurité — contrôle absolu

La sécurité prime sur la rapidité de livraison. En cas de doute, demander plutôt que supposer. Signaler explicitement toute faille ou tout compromis rencontré, même hors du périmètre de la tâche.

### Must-have bootcamp (obligatoires avant la soutenance)

Seuls les must-have sont exigés : ne pas implémenter les nice-to-have (OAuth/OIDC, MFA, RBAC granulaire, API Gateway/WAF, chiffrement au repos, Dependabot/Snyk, centralisation des logs, etc.) sauf demande explicite.

1. **Authentification & autorisation** — JWT transmis dans l'en-tête `Authorization: Bearer <token>`. Vérification du token (signature + expiration, lib éprouvée comme `jose`) dans `src/proxy.ts` (le middleware de Next 16) pour les routes privées, **et** dans chaque route handler / Server Action qui touche des données privées. Vérifier que l'utilisateur est propriétaire de la ressource qu'il modifie. Secret JWT uniquement côté serveur.
2. **Endpoints API** — Rate limiting anti-bruteforce sur le login (et sur `/api/chat`). CORS restreint à l'URL du frontend (variable d'env), jamais `*`.
3. **Données sensibles** — HTTPS/TLS en production. Mots de passe hachés avec **bcrypt**, salt rounds ≥ 10. Jamais de mot de passe en clair (ni en base, ni dans les logs, ni dans une réponse).
4. **Validation des entrées** — Schéma **Zod** en allowlist (`.strict()`) sur toutes les entrées serveur (body, params, searchParams) : tout champ inconnu ou mal typé est rejeté immédiatement.
5. **Dépendances** — `npm audit` avant mise en ligne : zéro vulnérabilité critique tolérée.
6. **Logs & zéro fuite technique** — Logs structurés côté serveur uniquement. Le client ne reçoit que des messages d'erreur génériques : jamais de stack trace, d'erreur SQL brute ou de détail interne. Message de login générique (« identifiants invalides »).
7. **CSRF** — Le JWT est envoyé via l'en-tête `Authorization`, pas via un cookie d'auth : ne pas introduire de cookie d'authentification sans en discuter.
8. **Base de données** — Requêtes paramétrées obligatoires (ORM type Prisma ou driver préparé), jamais de SQL concaténé avec des entrées utilisateur. Utilisateur DB avec droits restreints.
9. **Durcissement serveur** — En-têtes HTTP de sécurité (équivalent Helmet, via `headers()` dans `next.config.ts` : CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS). Si Docker : conteneur exécuté en utilisateur **non-root**.
10. **Audit avant soutenance** — Repasser cette checklist point par point et tester l'injection d'erreurs (entrées invalides, token absent/expiré/falsifié, champs inconnus, SQL/XSS) avant la soutenance du vendredi.

### Règles complémentaires
- Secrets (JWT, clé Gemini…) uniquement dans `.env*` (ignoré par git) et lus côté serveur. Jamais dans une variable `NEXT_PUBLIC_*` ni dans un composant `"use client"`.
- Ne jamais renvoyer au client plus de données que nécessaire (pas de hash, pas de champs internes).
- Pas de `dangerouslySetInnerHTML` sur du contenu utilisateur.
- Chat RAG : traiter la question utilisateur et le contenu des posts comme non fiables (injection de prompt), limiter la taille des entrées.
