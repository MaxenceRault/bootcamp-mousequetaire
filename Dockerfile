# Images de Brb (multi-étapes) :
#   - « dev »  : environnement de développement identique pour tous (docker compose up, voir compose.yaml) ;
#   - dernière étape (« run ») : image de production pour Cloud Run (docker build .).
# Toutes s'exécutent en utilisateur non-root (« node », uid 1000, fourni par l'image Node).

# --- Développement -------------------------------------------------------------
# Le code est monté depuis la machine (compose.yaml) : seule la version de Node et l'outillage viennent de l'image.
FROM node:22-alpine AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Dossiers des volumes de compose.yaml créés ici pour appartenir à « node » (un volume neuf reprend ces droits).
RUN mkdir -p /app/node_modules /app/.next && chown -R node:node /app
USER node
EXPOSE 3000
# Dépendances (re)installées au démarrage si package-lock.json a changé, puis serveur de dev accessible hors du conteneur.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev -- --hostname 0.0.0.0"]


# --- Dépendances ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build -------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL publique du site : figée dans le build (en-têtes CORS de next.config.ts).
ARG APP_URL
ENV APP_URL=$APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Exécution ---------------------------------------------------------------------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

# Sortie « standalone » : serveur + dépendances utilisées uniquement. Fichiers en lecture seule pour l'app.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Utilisateur non-root fourni par l'image Node (uid 1000).
USER node
EXPOSE 8080
CMD ["node", "server.js"]
