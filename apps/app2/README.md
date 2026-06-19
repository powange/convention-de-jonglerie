# App2 — deuxième application (placeholder)

Application **Nuxt 4 autonome**, dans `apps/app2/`, **sans layers pour l'instant**. Pour le moment :
une simple page d'accueil vide, destinée aux tests / à la mise en place de la 2ᵉ app.

## Lancer en Docker (autonome)

Depuis `apps/app2/` :

```bash
docker compose up --build -d   # build + run
# → http://localhost:3001
docker compose down            # arrêt
```

L'app tourne dans le conteneur sur le port 3000, exposé sur **3001** côté hôte (pour ne pas entrer en
conflit avec l'application principale sur 3000).

## Lancer en local (sans Docker)

```bash
npm install
npm run dev        # http://localhost:3000 (dev) — ou:
npm run build && node .output/server/index.mjs
```

## Réutiliser plus tard les modules partagés

Quand on voudra mutualiser des fonctionnalités, ajouter dans `nuxt.config.ts` :

```ts
export default defineNuxtConfig({
  extends: ['../../layers/<module>'],
})
```

(cf. `docs/modularisation-multi-domaines.md` à la racine du repo).
