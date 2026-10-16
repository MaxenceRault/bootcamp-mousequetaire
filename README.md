# Biirb

**Biirb** (formerly *Brb — BeRightBack*) is a travel community and trip planner. Travellers share illustrated stories of their trips; **Biirbou**, the app's assistant, turns those stories into day-by-day itineraries that you can adjust, share with your travel companions and use on the road — even offline.

Live app: https://brb-105103278561.europe-west9.run.app · Interface in French.

Project rules (architecture, security, design system): see [CLAUDE.md](CLAUDE.md) (in French).

## What the app does

### Travel stories
- **Feed** of stories with infinite scroll, filters by type of trip (solo, culture, food…) and trending destinations.
- **Search** (`/?q=`) across places, then titles, then story text.
- **Destination pages** (`/tags?country=JP&state=…&city=…`) gathering every story about a country, region or city.
- **Story editor**: rich text (bold, italic, lists, sizes), cover photo and up to 5 photos in the text, destination, dates, type of trip and tags.
- **Reactions and discussion**: likes, saved stories, threaded comments (questions to the author), sharing link, reporting.
- **Profiles**: public profile per user (stories, saved stories if shared, or a "private profile"), avatar or generated "blobatar", **badges** (Traveller, Globetrotter after 50 stories, Dreamer after 50 liked stories, Patron) with the displayed badge chosen by the user.

### Trip planner with Biirbou
- **Generate a trip**: pick a destination, dates (up to one month, typed or picked on a calendar) and a type of trip; Biirbou builds a full plan from the community's stories: activities for each day, preparation checklist, budget estimate and a **season note** (weather, typhoons/monsoon, crowds, prices for that month).
- **Edit everything**: add, move or delete activities, tick the checklist, adjust the budget and target.
- **Chat with Biirbou** about the trip: it suggests where and when to fit a wish, and can **add, modify or remove activities** — nothing changes until you accept each suggestion.
- **Table view**: days × hours grid with colour-coded activities.
- **Exports**: CSV for everyone; PDF (classic, table or day-by-day booklet), calendar `.ics` and per-day Google Maps routes with the trip pass.
- **Daily limit**: a counter shows how many more times Biirbou can help today.

### Travelling together
- **Sharing**: invite companions by username or link, as **editor** (plans and expenses) or **viewer** (read-only, own expenses); up to 10 travellers per trip.
- **Shared expenses** (Tricount-style): multi-currency amounts converted at the ECB rate of the day, flexible splits, balances, minimal settlements and a "to pay" list.
- **Offline mode** (PWA): trips and expenses stay readable without a network.

### Trip pass (premium)
One payment (€9.99 via Buy Me a Coffee) unlocks a trip for all its members: more help from Biirbou each day and a 4× longer chat, regenerating a single day, PDF / `.ics` / Maps exports. Locked features are greyed out and open the pass window; purchases are activated automatically by a signed webhook, and admins can attach a payment or gift a pass.

### Community and safety
- **Moderation**: banned-words filter on texts, photo check by AI, reports, hidden posts pending review.
- **Administration**: dashboard, reports, support tickets, stories, users and roles, types of trip, banned words, AI settings and quota, trip passes, audit log of every admin action.
- **Support**: tickets by category (trip pass, bug, report, account, other); trip-pass requests email the admins.
- **Accounts**: sign-up with terms acceptance, "remember me", password reset by email.
- **Legal pages**: terms of use, terms of sale, legal notice, privacy policy.
- **Patron**: optional donation via Buy Me a Coffee, rewarded with a badge.

## Tech stack

- **Next.js 16** (App Router, React 19), **TypeScript** (strict), **Tailwind CSS v4**, **next-intl** (French).
- **Backend** in layers: route handler → controller (Zod validation, auth, rate limit) → service (business rules) → repository (parameterised SQL only).
- **Google Cloud**: Cloud SQL (PostgreSQL, IAM authentication, no database password), Cloud Storage (photos), Vertex AI (Gemini), Cloud Run, Secret Manager, Cloud Logging / Monitoring.
- **Auth**: short-lived JWT kept in memory + rotating refresh token in an HttpOnly, SameSite=Strict cookie.
- **Other**: pdf-lib (server-side PDFs), nodemailer (Gmail SMTP), country-state-city, TipTap.

Security highlights: strict Zod allowlists on every input, rate limiting (login, AI, exports…), restrictive CORS and security headers (CSP, HSTS…), bcrypt password hashing, prompt-injection filters around the AI, public UUIDs for trips, generic error messages and structured logs.

## Run locally (container, recommended)

Same environment for everyone (Node version, dependencies), whatever the machine.

**Prerequisites**: [Podman](https://podman.io/docs/installation) (or Docker) and [gcloud](https://cloud.google.com/sdk/docs/install), with a Google account that has access to the `biirb-511608` project.

1. Google identity for the database, storage and AI (once):
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project biirb-511608
   ```
2. Environment variables: copy `.env.example` to `.env.local` and fill in the values (`DB_USER` = your Google email, `JWT_SECRET` = `openssl rand -base64 48`).
3. Start:
   ```bash
   podman compose up        # or: docker compose up
   ```
   then open http://localhost:3000. Edit the code as usual: the app hot-reloads.

   Podman on macOS / Windows: create the virtual machine once (`podman machine init`), then run `podman machine start` after each computer restart.

**Windows**: before `podman compose up`, tell it where gcloud stores its credentials:
```powershell
$env:GCLOUD_CONFIG_DIR = "$env:APPDATA\gcloud"
```

Useful commands (replace `docker` with `podman` depending on your tool):
```bash
docker compose run --rm app npm run lint     # lint
docker compose run --rm app npm run build    # production build + typecheck
docker compose run --rm app npm run seed     # demo data (requires the brb_admin role)
docker compose run --rm app npm install <package>   # add a dependency (updates package-lock.json)
docker compose down                          # stop
docker compose build --no-cache              # rebuild the image (e.g. after a Dockerfile change)
```

## Run without Docker

Node 22 (≥ 22.18 for `npm run seed`), then steps 1 and 2 above, and:
```bash
npm install
npm run dev
```

API documentation (Swagger UI, development only): http://localhost:3000/api-docs

## Deployment

Automatic: every push to `main` is deployed to Cloud Run by GitHub Actions, after lint, typecheck, dependency audit and build. Database migrations (`db/migrations/`) are applied by hand in Cloud SQL Studio **before** merging the code that needs them. Details in [CLAUDE.md](CLAUDE.md#déploiement-cloud-run).
