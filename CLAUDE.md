# TripPlanner IA

Projet fil rouge : blog et planificateur de voyage basé sur les posts et avis des voyageurs. Nom de l'app : **Brb** (BeRightBack). Next.js (App Router) + TypeScript strict + Tailwind CSS v4, gestionnaire de paquets **npm**.

## Commandes

```bash
podman compose up   # environnement de dev conteneurisé (ou docker compose up ; voir README.md) → http://localhost:3000
npm run dev     # serveur de dev (sans Docker)
npm run build   # build de prod (lance aussi le typecheck)
npm run lint    # ESLint
```

Dans le conteneur : `podman compose run --rm app npm run <script>`.

Vérifier `npm run lint` et `npm run build` avant de considérer une tâche terminée.

## Architecture — à respecter

```
messages/
└── fr.json                    # Textes de l'interface (i18n, seule langue pour l'instant)
src/
├── app/
│   ├── layout.tsx             # Layout global (Navbar + Footer + Fonts)
│   ├── page.tsx               # Homepage : feed, ou résultats de recherche si /?q= (lieux, puis titres, puis textes)
│   ├── post/[slug]/page.tsx   # Détail d'un récit : /post/<slug> (ancien lien /post/<id> → redirection 308)
│   ├── tags/page.tsx          # Récits d'un lieu : /tags?country=FR[&state=IDF&city=Montesson] (destination ou tag)
│   ├── post/new/page.tsx      # Éditeur de récit (création d'un post)
│   ├── profile/page.tsx       # Tableau de bord utilisateur
│   ├── profile/[username]/page.tsx # Profil public d'un autre utilisateur (lien depuis l'auteur dans le fil) : récits, enregistrés si partagés, ou « profil privé »
│   ├── admin/page.tsx         # Administration (rôle admin) : modération, rôles, types de récit, réglages IA, journal
│   ├── planner/page.tsx       # Planificateur : mes voyages + génération par l'IA
│   ├── planner/[id]/print/page.tsx # Planning imprimable (export PDF via l'impression du navigateur)
│   ├── planner/[id]/page.tsx  # Planning d'un voyage (note de saison, jours, activités, checklist, budget, discussion avec l'IA)
│   ├── login/page.tsx         # Auth : connexion / inscription / mot de passe oublié (?view=)
│   ├── api-docs/page.tsx      # Swagger UI (dev uniquement, 404 en production)
│   └── api/v1/                # Couche CONTROLLER (route handlers), toutes les routes sous /api/v1/
│       ├── auth/login/route.ts    # POST /api/v1/auth/login → auth.controller
│       ├── auth/register/route.ts # POST /api/v1/auth/register → auth.controller
│       ├── auth/refresh/route.ts  # POST /api/v1/auth/refresh (rotation du refresh token) → auth.controller
│       ├── auth/logout/route.ts   # POST /api/v1/auth/logout (révoque la session) → auth.controller
│       ├── posts/route.ts         # GET (public, feed paginé par curseur) / POST (multipart + Bearer) /api/v1/posts → post.controller
│       ├── posts/[id]/route.ts    # PATCH (masquer / réafficher) / DELETE /api/v1/posts/{id} — auteur uniquement → post.controller
│       ├── posts/[id]/like/route.ts      # PUT / DELETE : aimer un post (Bearer, idempotent) → reaction.controller
│       ├── posts/[id]/save/route.ts      # PUT / DELETE : enregistrer un post (Bearer, idempotent) → reaction.controller
│       ├── posts/[id]/reactions/route.ts # GET : mes réactions + nombre de likes (Bearer) → reaction.controller
│       ├── locations/route.ts     # GET /api/v1/locations?q= recherche de villes / pays (country-state-city) → location.controller
│       ├── users/me/route.ts  # GET / PATCH /api/v1/users/me (profil connecté) → user.controller
│       ├── users/[username]/route.ts # GET /api/v1/users/{pseudo} : profil public (réglages de confidentialité appliqués côté serveur) → user.controller
│       ├── users/me/reactions/route.ts # GET ?postIds=1,2,3 : mes likes / enregistrements sur une page du feed (Bearer) → reaction.controller
│       ├── users/me/avatar/route.ts    # PUT (multipart « image ») / DELETE : photo de profil (Bearer) → user.controller
│       ├── openapi.json/route.ts # GET /api/v1/openapi.json : spécification OpenAPI (dev uniquement)
│       ├── trips/…            # Voyages : CRUD + regenerate (IA) + messages / suggestions (discussion IA) → trip.controller
│       └── chat/route.ts      # API RAG : recherche vectorielle + appel Gemini
├── schemas/                   # DTO : schémas Zod `.strict()` + types inférés (auth.schema.ts, user.schema.ts, post.schema.ts)
├── services/                  # Couche SERVICE : logique métier (ex. post.service.ts)
├── repositories/              # Couche REPOSITORY : accès base de données (ex. post.repository.ts)
├── proxy.ts                   # Middleware Next 16 : redirige (308) les anciens liens /post/{id} vers /post/{slug} ; refuse sans token valide les routes API privées (/api/v1/users/*, /api/v1/posts/* sauf GET /api/v1/posts et GET /api/v1/users/{pseudo}, /api/v1/trips/*)
├── types/
│   └── swagger-ui-dist.d.ts   # Types du bundle navigateur de Swagger UI
├── i18n/
│   └── request.ts             # Config next-intl (locale + chargement des messages)
├── components/
│   ├── ui/                    # Design system : EmptyState, Button, Input, Textarea, Autocomplete, PasswordInput, Label, Field, Checkbox, Card, Icon, Avatar, Logo, Badge
│   ├── Navbar.tsx             # Barre du haut (version visiteur / connecté)
│   ├── NavbarAccount.tsx      # Zone compte de la Navbar (client : lit la session du navigateur)
│   ├── Footer.tsx
│   ├── TravelCard.tsx         # Carte de post dans le feed
│   ├── ProfileHeader.tsx      # En-tête de profil partagé (bannière, avatar, nom, stats, style des onglets) : /profile et /profile/{pseudo}
│   ├── ProfileLink.tsx        # Liens vers le profil public d'un auteur (avatar et nom) : fil d'actualité, page d'un récit, commentaires
│   ├── TripContextBar.tsx     # Barre destination · dates · type de récit (éditeur de récit + planificateur)
│   ├── HomeHero.tsx           # Bannière de l'accueil : couvertures de récits en fondu + slogan
│   ├── NavbarLinks.tsx        # Liens principaux (page active), en ligne ou dans le menu mobile
│   ├── NavbarMobileMenu.tsx   # Menu burger (< md) : recherche + liens
│   ├── TripPrint.tsx          # Document imprimable du planning (export PDF)
│   ├── PlannerHome.tsx        # Liste des voyages + formulaire de génération (client)
│   ├── AdminView.tsx          # Page d'administration (client, onglets) → /api/v1/admin/*
│   ├── ReportButton.tsx       # « Signaler » un récit (page détail)
│   ├── RoleBadge.tsx          # Badge du rôle d'un utilisateur (profil, auteur d'un récit, admin)
│   ├── TripPlanner.tsx        # Planning d'un voyage, modifiable (client)
│   ├── FeedList.tsx           # Feed à chargement infini (client : GET /api/v1/posts?cursor=)
│   ├── ShareButton.tsx        # Partage du lien (menu natif ou copie dans le presse-papiers)
│   ├── PostReactions.tsx      # Boutons J'aime / Enregistrer (connecté) ; visiteur : nombre de likes seul
│   ├── NewPostButton.tsx      # Bouton flottant « Nouveau post » de l'accueil (connecté uniquement)
│   ├── StoryCard.tsx          # Carte d'un récit dans une grille (profil, page d'un lieu)
│   ├── TripCard.tsx           # Carte d'un voyage généré (planificateur, onglet Itinéraires IA du profil)
│   ├── PostEditorForm.tsx     # Formulaire de l'éditeur de récit (client)
│   ├── RichTextEditor.tsx     # Éditeur du récit (TipTap) : gras, italique, souligné, taille, puces, 5 photos (client)
│   ├── PostBody.tsx           # Affichage du récit mis en page : JSON validé → éléments React, jamais de HTML
│   ├── ProfileView.tsx        # Page profil (client : charge /api/v1/users/me avec le token)
│   ├── ProfileEditForm.tsx    # Formulaire de modification du profil (PATCH /api/v1/users/me)
│   ├── SwaggerDocs.tsx        # Swagger UI autonome (swagger-ui-dist), hors du Strict Mode de l'app
│   ├── LoginForm.tsx          # Formulaire de connexion (client)
│   ├── RegisterForm.tsx       # Formulaire d'inscription (client)
│   ├── ForgotPasswordForm.tsx # Formulaire mot de passe oublié (client)
│   └── AIChatDrawer.tsx       # Drawer du chat RAG
└── lib/
    ├── ai.ts                  # Gemini 2.5 Flash-Lite sur Vertex AI (auth IAM, sortie JSON imposée)
    ├── tripExport.ts          # Export CSV du planning (côté navigateur)
    ├── useDismiss.ts          # Fermeture d'un menu au clic extérieur / Échap
    ├── roles.ts               # Rôles des utilisateurs (USER_ROLES) : traveler, globetrotter, dreamer, patron (badges) et admin
    └── posts.ts               # Types du feed (FeedPost, FeedPage) et type de récit (Archetype : slug + libellé)
db/
└── migrations/                # SQL du schéma Cloud SQL (à exécuter dans Cloud SQL Studio)
scripts/
└── seed.mts                   # Seed manuel : npm run seed (identité Google + rôle brb_admin, local uniquement) — 5 comptes démo sans mot de passe, 10 posts + tags, dans une transaction ; relançable, ne touche jamais aux vrais comptes
├── lib/
│   ├── controllers/           # HTTP : validation Zod, rate limit, appel du service, réponse
│   ├── services/              # Règles métier (hash, JWT, règles d'inscription)
│   ├── repositories/          # Accès base de données (Cloud SQL) et Cloud Storage uniquement
│   ├── logger.ts              # Logs structurés pour Cloud Logging / Error Reporting (logError, logInfo)
│   ├── config.ts              # Configuration serveur : lit et valide (Zod) les variables d'environnement
│   ├── jwt.ts                 # Signature / vérification JWT (jose)
│   ├── rateLimit.ts           # Rate limit en mémoire
│   ├── session.ts             # Côté client : access token en mémoire, refresh via le cookie httpOnly, appels API (apiFetch ajoute le Bearer)
│   ├── country.ts             # Drapeau emoji et nom du pays à partir du code pays
│   ├── images.ts              # Type réel d'une image (octets de signature) : photos de récits et images de profil
│   ├── reactions-store.ts     # Côté client : likes / enregistrements partagés entre pages et onglets (PostReactions)
│   ├── openapi.ts             # Spécification OpenAPI de l'API (corps de requête générés depuis schemas/)
│   └── ai.ts                  # Gemini sur Vertex AI
└── utils/                     # Clients GCP, serveur uniquement : db.ts (Cloud SQL, auth IAM), storage.ts (Cloud Storage)
db/                            # Scripts SQL à exécuter dans Cloud SQL Studio
Dockerfile                     # Images multi-étapes, utilisateur non-root : « dev » (compose.yaml) et production (Cloud Run, sortie standalone)
compose.yaml                   # Dev conteneurisé : code monté, node_modules dans un volume, identifiants gcloud de la machine en lecture seule
.github/workflows/deploy.yml   # Déploiement continu : push sur main → lint → image Docker → Cloud Run
```

- Ne pas créer de dossier ou de fichier hors de cette structure sans le demander d'abord. Si un nouveau fichier est nécessaire, le placer au bon endroit (page → `app/`, composant → `components/`, endpoint → `app/api/v1/`, schéma Zod → `schemas/`, logique métier → `services/`, accès BDD → `repositories/`, helpers/clients externes → `lib/`) et le signaler.
- Les fichiers existent mais sont vides : ne les remplir que lorsqu'on travaille sur la fonctionnalité concernée. Ne pas inventer d'UI, de textes, de données ou de logique qui n'ont pas été demandés.
- Base de données : **Cloud SQL (PostgreSQL)** sur GCP, instance `biirb-511608:europe-west9:biirb-db1`, base `brb`. Connexion via `src/utils/db.ts` (connecteur `@google-cloud/cloud-sql-connector` + `pg`, variables lues via `getConfig()`), en **authentification IAM** : aucun mot de passe de base dans l'app ni dans `.env*`. En local : `gcloud auth application-default login` + variables `CLOUD_SQL_INSTANCE`, `DB_NAME`, `DB_USER` (son email Google). `getDb()` n'est importé que par `repositories/`. Requêtes SQL toujours paramétrées (`$1, $2…`), jamais de concaténation. Le feed de la homepage lit la table `post` (Server Component → `post.service` → `post.repository`), pagination par curseur (id du dernier post affiché).
- Photos des posts : bucket **Cloud Storage** `biirb-post-photos` (public en lecture), via `src/utils/storage.ts`, importé uniquement par `repositories/`. Écriture réservée au serveur.
- Schéma de la base (tables `users`, `post` — dont `slug` : identifiant de l'URL, unique, généré par la base à la création (trigger `post_fill_slug`) et jamais modifié ; dont `is_hidden` : post masqué par son auteur, exclu du feed, de la page détail et des pages de lieu ; dont `body` : récit mis en page en JSON (sous-ensemble de TipTap validé par `postBodySchema`), `long_description` en est le texte brut dérivé par le serveur (recherche, IA, temps de lecture), `body_photo_urls` ses photos (supprimées du bucket avec le récit) ; `body` null = ancien récit en texte brut —, `archetype` — types de récit gérés depuis l'admin (libellé, description, actif), jamais écrits en dur dans le code —, `tag`, `post_tag`, `refresh_token`, `post_like`, `post_save`, `trip*`, `post_report`, `ai_usage`, `app_settings`, `admin_action`) dans `db/migrations/`. Une migration s'exécute **une seule fois** : tout changement de schéma passe par un nouveau fichier daté (jamais de modification à la main dans la console, jamais en modifiant ou relançant un ancien fichier), commençant par `set role brb_admin;`. Rôles Postgres : `brb_admin` (propriétaire, développeurs : migrations + seed) et `brb_app` (droits minimaux de l'app, compte de service Cloud Run `brb-run`) : chaque migration accorde à `brb_app` uniquement les droits utilisés par le code. Seed uniquement via le script manuel `npm run seed`, jamais via une route de l'app.
- Schéma de la base (tables `users` — dont `is_private` et `show_saved` : confidentialité du profil public —, `post` — dont `slug` : identifiant de l'URL, unique, généré par la base à la création (trigger `post_fill_slug`) et jamais modifié ; dont `is_hidden` : post masqué par son auteur, exclu du feed, de la page détail et des pages de lieu —, `archetype` — types de récit gérés depuis l'admin (libellé, description, actif), jamais écrits en dur dans le code —, `tag`, `post_tag`, `refresh_token`, `post_like`, `post_save`, `trip*`, `post_report`, `ai_usage`, `app_settings`, `admin_action`) dans `db/migrations/`. Une migration s'exécute **une seule fois** : tout changement de schéma passe par un nouveau fichier daté (jamais de modification à la main dans la console, jamais en modifiant ou relançant un ancien fichier), commençant par `set role brb_admin;`. Rôles Postgres : `brb_admin` (propriétaire, développeurs : migrations + seed) et `brb_app` (droits minimaux de l'app, compte de service Cloud Run `brb-run`) : chaque migration accorde à `brb_app` uniquement les droits utilisés par le code. Seed uniquement via le script manuel `npm run seed`, jamais via une route de l'app.
- Architecture back : route → controller → service → repository → base. Pas d'accès base hors des repositories.
- Documentation API : toute nouvelle route sous `/api/v1/` est ajoutée dans `src/lib/openapi.ts` (visible sur `/api-docs` en dev). Les schémas Zod des requêtes vont dans `schemas/` pour être réutilisés par la doc.
- **Commentaires** : uniquement l'essentiel, c'est-à-dire le *pourquoi* non évident (sécurité, contournement, contrainte), en une ligne si possible. Pas de commentaire qui répète le code, pas de bandeau de section.
- **Nommage en anglais** : tables, colonnes, types, variables, fonctions, fichiers et routes (ex. `short_description`, `start_date`, `archetype_id`). Seuls les textes affichés (`messages/fr.json`) et les commentaires sont en français.
- Imports via l'alias `@/` (→ `src/`).

## Déploiement (Cloud Run)

- **Automatique** : chaque push sur `main` est déployé par GitHub Actions (`.github/workflows/deploy.yml`) sur https://brb-105103278561.europe-west9.run.app. Un `main` qui ne passe pas le lint ou le build n'est pas déployé (onglet *Actions* du repo pour suivre).
- Authentification GitHub → GCP sans clé ni secret GitHub : Workload Identity Federation (pool `github`, provider `github-repo`, limité à la branche `main` de ce repo) → compte de service `brb-deploy` (droits de déploiement uniquement).
- L'app tourne avec le compte de service `brb-run` (Cloud SQL en `brb_app`, Vertex AI, bucket des photos, lecture des secrets). Images dans Artifact Registry `europe-west9-docker.pkg.dev/biirb-511608/brb/web`.
- Variables : non sensibles dans `deploy.yml` (`--set-env-vars`) ; secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) dans **Secret Manager** (`brb-jwt-secret`, `brb-jwt-refresh-secret`), jamais dans le repo ni dans GitHub. Nouvelle variable d'env = l'ajouter aussi dans `deploy.yml` (ou Secret Manager si elle est sensible).
- `APP_URL` (seule origine autorisée par CORS sur `/api/*`) est figée au build : argument du build Docker.
- `--max-instances=1` : les rate limits sont en mémoire, une seule instance les garde cohérents (et plafonne le coût).
- Les migrations ne sont pas lancées par le déploiement : les appliquer sur la base (Cloud SQL Studio) **avant** de merger le code qui en dépend.

## Architecture en couches (back) — à respecter

```
CLIENT / FRONTEND
   │  requête HTTP (ex. POST /api/v1/posts)
   ▼
CONTROLLER   app/api/v1/**/route.ts, Server Actions, Server Components
   │  DTO (types inférés des schémas Zod)
   ▼
SERVICE      services/*.service.ts
   │  entités / paramètres de requête
   ▼
REPOSITORY   repositories/*.repository.ts
   │  pool `pg` (requêtes paramétrées $1, $2…)
   ▼
DATABASE     Cloud SQL (Postgres)
```

- **Controller** : valide la requête avec le schéma Zod (`schemas/`), extrait les données (params, body, searchParams), vérifie l'auth, appelle le service adapté, puis renvoie la réponse HTTP (200, 400, 401, 404…) avec un message générique en cas d'erreur. Aucune logique métier, aucun accès direct à la base.
- **Service** : contient la logique et les règles métier (calculs, transformations, vérification que l'utilisateur est propriétaire de la ressource, orchestration de plusieurs opérations). Sait *quoi* faire, pas *comment* c'est stocké : n'importe ni la base (`pg`, `utils/db`) ni rien de HTTP (`Request`, `NextResponse`, cookies, en-têtes).
- **Repository** : seul endroit qui parle à la base. Uniquement du CRUD en SQL paramétré (`$1`, `$2`… ; jamais de SQL concaténé avec une entrée), colonnes sélectionnées explicitement (jamais de hash ni de champ interne renvoyé vers le haut). Aucune règle métier.
- Les dépendances ne vont que vers le bas et sans sauter de couche : controller → service → repository → base. Un controller n'appelle jamais un repository directement ; un repository n'appelle jamais un service.
- Un fichier par ressource et par couche : `schemas/post.schema.ts`, `services/post.service.ts`, `repositories/post.repository.ts`.
- Les composants `"use client"` n'importent jamais `services/`, `repositories/` ni `utils/` : ils passent par une route API ou une Server Action.

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

1. **Authentification & autorisation** — JWT transmis dans l'en-tête `Authorization: Bearer <token>`. Vérification du token (signature + expiration, lib éprouvée comme `jose`) dans `src/proxy.ts` (le middleware de Next 16) pour les routes privées, **et** dans chaque route handler / Server Action qui touche des données privées. Vérifier que l'utilisateur est propriétaire de la ressource qu'il modifie. Secret JWT uniquement côté serveur. Access token JWT de **1 h**, gardé **en mémoire uniquement** côté navigateur (jamais dans localStorage / sessionStorage : un script injecté ne doit pas pouvoir le lire), + **refresh token** (30 jours avec « Se souvenir de moi », 24 h sinon) dans le cookie **`brb_refresh` HttpOnly, SameSite=Strict, Secure en prod, Path=/api/v1/auth** : en base uniquement son empreinte SHA-256 (table `refresh_token`), rotation à chaque refresh, réutilisation d'un token déjà utilisé = révocation de toute la session, déconnexion = révocation côté serveur + cookie effacé. À chaque chargement de page, `session.ts` récupère un access token via `/auth/refresh` (verrou entre onglets). Le stockage du navigateur ne contient que le profil affiché (`brb_user`, non secret).
2. **Endpoints API** — Rate limiting anti-bruteforce sur le login (et sur `/api/v1/chat`). CORS restreint à l'URL du frontend (variable d'env), jamais `*`. L'IP du client se lit **uniquement** via `clientIp()` (`src/lib/rateLimit.ts`), qui prend l'entrée de `X-Forwarded-For` ajoutée par le proxy de confiance (`TRUSTED_PROXY_HOPS`) : jamais la première entrée, que le client peut inventer. Le login est aussi limité par compte visé (email).
3. **Données sensibles** — HTTPS/TLS en production. Mots de passe hachés avec **bcrypt**, salt rounds ≥ 10. Jamais de mot de passe en clair (ni en base, ni dans les logs, ni dans une réponse).
4. **Validation des entrées** — Schéma **Zod** en allowlist (`.strict()`) sur toutes les entrées serveur (body, params, searchParams) : tout champ inconnu ou mal typé est rejeté immédiatement.
5. **Dépendances** — `npm audit` avant mise en ligne : zéro vulnérabilité critique tolérée.
6. **Logs & zéro fuite technique** — Logs structurés côté serveur uniquement, via `src/lib/logger.ts` (`logError` / `logInfo`, champ `severity` lu par Cloud Logging, erreurs regroupées dans Error Reporting) ; jamais `console.error` directement. Alertes Cloud Monitoring par email à l'équipe : site injoignable (vérification toutes les 5 min) et log de gravité ERROR (au plus un email par heure). Le client ne reçoit que des messages d'erreur génériques : jamais de stack trace, d'erreur SQL brute ou de détail interne. Message de login générique (« identifiants invalides »).
7. **CSRF** — Le JWT est envoyé via l'en-tête `Authorization`, jamais via un cookie : les routes de l'API ne lisent aucun cookie. Seule exception, validée : le cookie `brb_refresh`, lu uniquement par `/auth/refresh` et `/auth/logout`, protégé par SameSite=Strict **et** une vérification de l'en-tête `Origin` (403 si absent ou différent du site). Ne pas introduire d'autre cookie sans en discuter.
8. **Base de données** — Requêtes paramétrées obligatoires (ORM type Prisma ou driver préparé), jamais de SQL concaténé avec des entrées utilisateur. Utilisateur DB avec droits restreints.
9. **Durcissement serveur** — En-têtes HTTP de sécurité (équivalent Helmet, via `headers()` dans `next.config.ts` : CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS). Si Docker : conteneur exécuté en utilisateur **non-root**. En place dans `next.config.ts` (`securityHeaders`, `poweredByHeader: false`) : toute nouvelle ressource externe (image, script, API) doit y être ajoutée à la CSP.
10. **Audit avant soutenance** — Repasser cette checklist point par point et tester l'injection d'erreurs (entrées invalides, token absent/expiré/falsifié, champs inconnus, SQL/XSS) avant la soutenance du vendredi.

### Règles complémentaires
- **Variables sensibles : toujours dans le `.env` (`.env.local`, ignoré par git), jamais en dur dans le code.** Sont sensibles :
  - les **secrets** : clés et mots de passe (`JWT_SECRET`, `JWT_REFRESH_SECRET`, future clé Gemini…) ; la base Cloud SQL n'en a pas (authentification IAM) ;
  - les **réglages de sécurité** : durée du token (`JWT_EXPIRES_IN`) et des sessions (`REFRESH_TOKEN_*`), coût bcrypt (`BCRYPT_SALT_ROUNDS`), rate limits (`RATE_LIMIT_*`), et tout nouveau réglage du même type (URL autorisée par CORS…).
  Les secrets sont lus côté serveur uniquement : jamais dans une variable `NEXT_PUBLIC_*`, ni dans un composant `"use client"`, ni dans un log, une réponse d'API ou un commit. Une valeur de secret ne doit jamais apparaître dans le code, même en valeur par défaut.
  Restent dans le code (pas dans le `.env`) : les limites de données qui doivent rester identiques aux contraintes SQL de `db/migrations/` (longueur du titre, des descriptions, taille max de la photo, nombre de tags…).
- Toute variable d'environnement lue par l'app ou un script est listée dans `.env.example` (seul fichier `.env*` versionné) avec une valeur d'exemple, à quoi elle sert et quel fichier la lit. Jamais de vraie valeur dedans. Côté serveur, on les lit uniquement via `getConfig()` (`src/lib/config.ts`), jamais `process.env` directement (sauf `NODE_ENV` et les scripts de `scripts/`). Un réglage de sécurité peut avoir une valeur par défaut sûre dans `config.ts` ; un secret, jamais (variable obligatoire, validée par Zod).
- Ne jamais renvoyer au client plus de données que nécessaire (pas de hash, pas de champs internes).
- Pas de `dangerouslySetInnerHTML` sur du contenu utilisateur.
- Chat RAG : traiter la question utilisateur et le contenu des posts comme non fiables (injection de prompt), limiter la taille des entrées.
- IA (planificateur, chat) : Gemini via Vertex AI (`src/lib/ai.ts`), authentifié par IAM comme la base : aucune clé API (variables `GCP_PROJECT_ID`, `VERTEX_LOCATION`). Réponse du modèle = donnée non fiable, toujours revalidée par Zod. Tout appel à l'IA passe d'abord par `consumeAiCall` (`ai-quota.service.ts`) : **15 appels par jour et par utilisateur** (`AI_DAILY_LIMIT_PER_USER`, limites horaires `RATE_LIMIT_TRIP_AI_*` et `RATE_LIMIT_TRIP_CHAT_*` dans le .env ; admins illimités, compteur en base `ai_usage`, jour de Paris), plafond global et interrupteur réglables par l'admin (`app_settings`), compte banni refusé.
- Planificateur : départ à n'importe quelle date future, durée de 1 mois maximum **à partir du départ choisi** (`TRIP_MAX_DAYS`). La génération tient compte de la saison (mois du voyage) : météo moyenne, risques (typhons, mousson…), affluence et prix, résumés dans `trip.season_note`.
- **Modération** (`moderation.service.ts`, `lib/moderationFilter.ts`) : **texte** (récits et commentaires) vérifié sans IA par une liste de mots bannis (injures, haine, sexuel explicite, appels à voter ; leet et séparateurs décodés) ; les avis négatifs et jurons d'exclamation restent autorisés. **Photo** d'un récit vérifiée par Gemini, réduite à 384 px (coût minimal). Refus → rien n'est enregistré ; l'auteur voit seulement « ne respecte pas les règles » (motif dans les logs serveur, pour ne pas dévoiler la liste). IA coupée ou en panne → récit publié masqué en attente de validation admin (`pending_review`, non réaffichable par l'auteur).
- **Commentaires** (`post_comment`) : lecture publique (exception GET dans `proxy.ts`), écriture réservée aux connectés non bannis, filtrés par la liste de mots bannis. Fils à un seul niveau (`parent_id` : on répond à un commentaire principal, pas à une réponse). Suppression par l'auteur ou un admin (journal).
- **Administration** : seul le rôle `admin` donne des droits ; les autres rôles sont des badges. Le rôle est **relu en base à chaque requête** (`requireAdmin`), jamais lu dans le JWT ni dans la session du navigateur (le lien « Administration » de la Navbar n'est qu'un affichage). Un admin ne peut ni se rétrograder, ni se bannir, ni se supprimer, ni bannir / supprimer un autre admin sans l'avoir rétrogradé. Toute action admin modifiante est inscrite au journal `admin_action`. La liste des utilisateurs de l'admin n'expose jamais d'email ni de hash.
- **Bannissement** : connexion refusée (`ACCOUNT_BANNED`, révélé seulement après un mot de passe correct), refresh refusé, sessions révoquées ; l'access token en cours reste valide au plus 1 h, mais l'IA, les signalements et l'admin relisent le compte en base.
- Discussion IA d'un voyage (`/trips/[id]/messages`) : enthousiaste pour toute envie liée au voyage (l'IA cherche où et quand la caser), impassible sur le reste. Trois barrières contre l'injection (`trip.service.ts`) : 1) filtre d'entrée déterministe (`ATTACK_PATTERNS` : « ignore tes instructions », jailbreak, balises / champs du prompt…) → refus sans appeler l'IA ; 2) consignes du modèle (contenu utilisateur = données, règles confidentielles, illégal refusé) ; 3) filtre de sortie (`INSTRUCTION_MARKERS`) → une réponse qui laisse fuiter les consignes est bloquée. Tout changement du prompt se vérifie avec une batterie d'attaques (injection directe, via un récit, jailbreak, fuite, données d'autres utilisateurs). Hors sujet non renvoyé dans l'historique, message ≤ 500 caractères, historique court, 30 messages/heure/utilisateur et 50 par voyage. Les activités proposées par l'IA ne rejoignent le planning qu'après un « oui » de l'utilisateur.
