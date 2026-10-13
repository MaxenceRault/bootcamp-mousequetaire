# TripPlanner IA

Projet fil rouge : blog et planificateur de voyage basé sur les posts et avis des voyageurs. Nom de l'app : **Brb** (BeRightBack). Next.js (App Router) + TypeScript strict + Tailwind CSS v4, gestionnaire de paquets **npm**.

## Commandes

```bash
npm run dev     # serveur de dev
npm run build   # build de prod (lance aussi le typecheck)
npm run lint    # ESLint
```

Vérifier `npm run lint` et `npm run build` avant de considérer une tâche terminée.

## Architecture — à respecter

```
messages/
└── fr.json                    # Textes de l'interface (i18n, seule langue pour l'instant)
src/
├── app/
│   ├── layout.tsx             # Layout global (Navbar + Footer + Fonts)
│   ├── page.tsx               # Homepage (Feed + Hero Search)
│   ├── post/[id]/page.tsx     # Détail d'un post de voyage
│   ├── profile/page.tsx       # Tableau de bord utilisateur
│   ├── planner/page.tsx       # Planification (Calendrier + Checklist)
│   ├── login/page.tsx         # Auth : connexion / inscription / mot de passe oublié (?view=)
│   └── api/
│       └── chat/route.ts      # API RAG : recherche vectorielle + appel Gemini
├── i18n/
│   └── request.ts             # Config next-intl (locale + chargement des messages)
├── components/
│   ├── ui/                    # Design system : Button, Input, PasswordInput, Label, Field, Checkbox, Card, Icon, Avatar
│   ├── Navbar.tsx             # Barre du haut (version visiteur / connecté)
│   ├── Footer.tsx
│   ├── TravelCard.tsx         # Carte de post dans le feed
│   ├── LoginForm.tsx          # Formulaire de connexion (client)
│   ├── RegisterForm.tsx       # Formulaire d'inscription (client)
│   ├── ForgotPasswordForm.tsx # Formulaire mot de passe oublié (client)
│   └── AIChatDrawer.tsx       # Drawer du chat RAG
└── lib/
    ├── ai.ts                  # Helpers Gemini & embeddings
    ├── posts.ts               # Accès aux posts du feed (seul point à brancher sur l'API back-end)
    └── demo-posts.ts          # Données de démo du feed, en attendant l'API
supabase/
└── migrations/                # SQL du schéma (à exécuter dans le SQL Editor de Supabase)
scripts/
└── seed.mts                   # Seed manuel : npm run seed (clé secrète, local uniquement)
```

- Ne pas créer de dossier ou de fichier hors de cette structure sans le demander d'abord. Si un nouveau fichier est nécessaire, le placer au bon endroit (page → `app/`, composant → `components/`, logique/clients → `lib/`) et le signaler.
- Les fichiers existent mais sont vides : ne les remplir que lorsqu'on travaille sur la fonctionnalité concernée. Ne pas inventer d'UI, de textes, de données ou de logique qui n'ont pas été demandés.
- L'app n'appelle pas Supabase directement : les données passeront par une API back-end (pas encore disponible). En attendant, le feed lit `src/lib/demo-posts.ts`. Tout accès aux données reste dans `src/lib/`, jamais dans les pages ou composants.
- Schéma de la base (tables `users` et `post`, RLS en lecture seule) dans `supabase/migrations/`. Seed uniquement via le script manuel `npm run seed`, jamais via une route de l'app. `SUPABASE_SECRET_KEY` n'est lue que par ce script.
- Imports via l'alias `@/` (→ `src/`).

## Internationalisation

- `next-intl`, français uniquement pour l'instant, sans préfixe de langue dans l'URL.
- Aucun texte visible par l'utilisateur en dur dans les composants : tout passe par `messages/fr.json`, via `getTranslations` (composants serveur) ou `useTranslations` (composants client). Une clé par namespace de page/composant (ex. `Metadata`, `Login`).

## Design system

- Dès qu'un même élément d'UI (bouton, champ, carte, badge, modal…) apparaît dans plusieurs composants, l'extraire dans `src/components/ui/` et réutiliser ce composant partout. Pas de duplication de classes Tailwind pour un même élément.
- Référence : design system « Kinetic Horizon » (maquettes Stitch). Thème clair uniquement.
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
