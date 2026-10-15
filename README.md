# Brb (BeRightBack)

Blog et planificateur de voyage basé sur les récits des voyageurs. Next.js + TypeScript + Tailwind, données sur GCP (Cloud SQL, Cloud Storage, Vertex AI).

Règles du projet (architecture, sécurité, design system) : voir [CLAUDE.md](CLAUDE.md).

## Démarrer en local (conteneur, recommandé)

Même environnement pour tout le monde (version de Node, dépendances), quelle que soit la machine.

**Prérequis** : [Podman](https://podman.io/docs/installation) (ou Docker) et [gcloud](https://cloud.google.com/sdk/docs/install), avec un compte Google qui a accès au projet `biirb-511608`.

1. Identité Google pour la base, le stockage et l'IA (une seule fois) :
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project biirb-511608
   ```
2. Variables d'environnement : copier `.env.example` en `.env.local` et remplir les valeurs (`DB_USER` = ton email Google, `JWT_SECRET` = `openssl rand -base64 48`).
3. Lancer :
   ```bash
   podman compose up        # ou : docker compose up
   ```
   puis ouvrir http://localhost:3000. Le code est modifiable normalement, l'app se recharge à chaud.

   Le service `stripe` démarre aussi : il relaie les paiements de test de Stripe vers l'app (rôle mécène). Il faut `STRIPE_SECRET_KEY` (clé `sk_test_…` du compte Stripe de l'équipe) et `STRIPE_WEBHOOK_SECRET` dans `.env.local`, ce dernier obtenu une fois avec :
   ```bash
   docker compose run --rm --no-deps stripe 'stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret'
   ```
   Paiement de test sur `/patron` avec la carte `4242 4242 4242 4242`. Sans clé Stripe, seul ce service s'arrête : l'app fonctionne.

   Podman sur macOS / Windows : créer sa machine virtuelle une fois (`podman machine init`), puis `podman machine start` après chaque redémarrage de l'ordinateur.

**Windows** : avant `podman compose up`, indiquer où gcloud range ses identifiants :
```powershell
$env:GCLOUD_CONFIG_DIR = "$env:APPDATA\gcloud"
```

Commandes utiles (remplacer `docker` par `podman` selon l'outil) :
```bash
docker compose run --rm app npm run lint     # lint
docker compose run --rm app npm run build    # build de prod + typecheck
docker compose run --rm app npm run seed     # données de démo (rôle brb_admin requis)
docker compose run --rm app npm install <paquet>   # ajouter une dépendance (met à jour package-lock.json)
docker compose logs -f stripe                # webhooks Stripe relayés (et leur code de réponse)
docker compose down                          # arrêter
docker compose build --no-cache              # reconstruire l'image (ex. après un changement du Dockerfile)
```

## Démarrer sans Docker

Node 22 (≥ 22.18 pour `npm run seed`), puis les étapes 1 et 2 ci-dessus et :
```bash
npm install
npm run dev
```

## Mise en production

Automatique : chaque push sur `main` est déployé sur Cloud Run (https://brb-105103278561.europe-west9.run.app) par GitHub Actions. Détails dans [CLAUDE.md](CLAUDE.md#déploiement-cloud-run).
