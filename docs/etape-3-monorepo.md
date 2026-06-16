# Étape 3 — Passage en monorepo

> **Statut** : proposition de conception (non implémentée).
> **Date** : 2026-06-15.
> **Prérequis** : étapes 0–2 ([modularisation-multi-domaines.md](./modularisation-multi-domaines.md)).
> On ne fait l'étape 3 **que** lorsque la 2ᵉ app est réellement décidée (sinon l'étape 2 suffit).

## 1. Objectif

Transformer le repo mono-app actuel en **monorepo** hébergeant plusieurs apps et les layers
partagés, avec un outillage de workspace qui lie le code (propagation automatique) tout en gardant
des **builds, bases et déploiements séparés** par app.

État actuel : `package.json` → `name: nuxt-app`, `private: true`, **`workspaces: aucun`**. Tout est
à la racine.

## 2. Arborescence cible

```
convention-platform/
├── package.json                 # racine : workspaces + scripts d'orchestration (pas de code)
├── pnpm-workspace.yaml          # déclare apps/* et layers/*
├── tsconfig.base.json           # options TS communes
├── .github/workflows/           # CI avec matrice par app
├── apps/
│   └── jonglerie/               # = repo actuel déplacé ici
│       ├── package.json         # name @cdj/app-jonglerie
│       ├── nuxt.config.ts       # extends: core, volunteers, …
│       ├── prisma/
│       │   ├── schema/          # fragments composés (core + layers + edition.prisma)
│       │   └── migrations/      # migrations PROPRES à la base jonglerie
│       ├── prisma.config.ts
│       ├── Dockerfile
│       ├── server/ app/ i18n/ scripts/ test/ …
│       └── (base de données A)
├── layers/
│   ├── core/                    # User, auth, Event, notifications, messenger, emails
│   └── volunteers/              # le module pilote (étape 2)
└── packages/                    # optionnel : utils purs partagés (ex. allergy-severity)
```

## 3. Outil de workspace

**Recommandation : pnpm workspaces** (liens symboliques stricts, hoisting maîtrisé, rapide).
npm workspaces reste possible (moins strict sur les dépendances fantômes). Le projet utilise
aujourd'hui `package-lock.json` (npm) → bascule à acter.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'layers/*'
  - 'packages/*'
```

```jsonc
// package.json (racine) — orchestration uniquement
{
  "name": "convention-platform",
  "private": true,
  "scripts": {
    "dev:jonglerie": "pnpm --filter @cdj/app-jonglerie dev",
    "build:jonglerie": "pnpm --filter @cdj/app-jonglerie build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test:unit:run",
  },
}
```

Chaque layer/app a son `package.json` avec un `name` (`@cdj/layer-volunteers`, `@cdj/app-jonglerie`).
Les apps déclarent les layers en dépendances workspace : `"@cdj/layer-volunteers": "workspace:*"`.

## 4. Déplacement du repo actuel → `apps/jonglerie`

- Utiliser `git mv` pour **préserver l'historique** (déplacement, pas recréation).
- Les chemins relatifs internes ne bougent pas (tout descend d'un cran sous `apps/jonglerie/`).
- Les alias `~`/`@`/`#server`/`#shared` restent valides (résolus par Nuxt **relativement à l'app**).
- Extraire `layers/volunteers/` (déjà préparé à l'étape 2) **hors** de `apps/jonglerie/`.

> Faire le déplacement en **un commit dédié** « move to monorepo », sans modification de contenu, pour
> garder un diff lisible et un `git log --follow` exploitable.

## 5. Prisma en monorepo (le poste sensible)

Contraintes actuelles : `prisma.config.ts` → `schema: 'prisma/schema'` (dossier) ; le generator écrit
dans `../../server/generated/prisma` ; migrations dans `prisma/migrations`.

Règles cibles :

1. **Un client Prisma par app**, généré **dans l'app** (`apps/jonglerie/server/generated/prisma`).
   Chaque app a son `prisma.config.ts` et son `prisma/migrations/` (bases séparées → migrations
   séparées, cf. [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) §6).
2. **Composition des fragments** : un script `prepare` (déclenché par `postinstall`) **copie** les
   fragments `.prisma` des layers (`layers/*/prisma/*.prisma`) dans `apps/<app>/prisma/schema/`,
   à côté du fragment de domaine de l'app (`edition.prisma`).

```jsonc
// apps/jonglerie/package.json
{
  "scripts": {
    "prisma:compose": "node ../../scripts/compose-prisma.mjs jonglerie",
    "postinstall": "npm run prisma:compose && nuxt prepare",
  },
}
```

```js
// scripts/compose-prisma.mjs (principe)
// 1. vider apps/<app>/prisma/schema/_generated/
// 2. copier layers/core/prisma/*.prisma + layers/<activés>/prisma/*.prisma
// 3. laisser apps/<app>/prisma/schema/<domaine>.prisma (écrit à la main)
// → Prisma lit tout le dossier prisma/schema/ (fragments composés + domaine)
```

3. **`generator`/`datasource`** : un seul bloc, fourni par le fragment `core` (ou un
   `schema.prisma` racine de l'app) ; les fragments de layer ne contiennent **que des `model`/`enum`**.
4. **Workflow de modification d'un layer** : on édite `layers/volunteers/prisma/volunteer.prisma` →
   chaque app relance `prisma:compose` puis **sa** migration (`prisma migrate dev`). Le code se
   propage seul ; la migration est par app (compromis « bases séparées »).

> ⚠️ Rappel projet : les migrations ne sont jamais exécutées par l'assistant — commandes fournies,
> appliquées par le porteur.

## 6. Scripts

Les ~50 scripts npm actuels se répartissent :

| Catégorie                                                                    | Destination                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Build/dev/lint/test d'app (`build`, `dev`, `lint`, `test:*`, `docker:dev:*`) | `apps/jonglerie/package.json`                                                   |
| Outillage i18n (`check-i18n`, `i18n:mark-todo`…)                             | racine **ou** par app, **adapté pour scanner `layers/*/i18n`** (cf. étape 2 §5) |
| Scripts ops généraux (`admin:*`, `db:clean-tokens`, geocode)                 | `apps/jonglerie/scripts/` (spécifiques aux données de l'app)                    |
| Scripts ops bénévoles (`generate-volunteer-qr-tokens`…)                      | `layers/volunteers/scripts/` (étape 2 §3)                                       |
| Orchestration multi-app (`pnpm -r …`)                                        | racine                                                                          |

## 7. Docker

Le `Dockerfile` actuel copie `package*.json`, `prisma`, `prisma.config.ts`, `i18n`, `scripts`,
`server/generated`, puis `nuxt build`. En monorepo :

- **Contexte de build = racine du monorepo** (pour accéder aux layers), `Dockerfile` **par app**.
- Étapes à adapter : copier `layers/` + `apps/jonglerie/` ; installer via workspace
  (`pnpm install --filter @cdj/app-jonglerie...`) ; `prisma:compose` + `prisma generate` ;
  `nuxt build` dans le dossier de l'app.
- `i18n` n'est plus monolithique : le build doit inclure `apps/jonglerie/i18n` **et** les
  `layers/*/i18n` consommés.
- `entrypoint.sh` (`prisma migrate deploy`) reste **par app**, sur **sa** base.
- Les `docker-compose.*.yml` (dev, prod, release, test-\*) sont **dupliqués/paramétrés par app**
  (service `app` + service `database` par app, réseau dédié).

## 8. CI

Workflows actuels : `tests.yml`, `playwright.yml`. Cible :

- **Matrice par app** (`strategy.matrix.app: [jonglerie, autre-domaine]`).
- **Filtrage par changements** : ne (re)tester qu'une app si seuls ses fichiers changent ; **tester
  toutes les apps** si un `layers/*` change (la propagation impacte chaque app). pnpm + `--filter
...[origin/main]` ou `turbo`/`nx` pour le graphe de dépendances.
- Tests d'un **layer** : exécutés une fois (tests isolés du layer) **plus** les tests d'intégration
  de chaque app qui le consomme.

## 9. TypeScript, ESLint, tests

- `tsconfig.base.json` à la racine ; chaque app/layer `extends` et ajoute ses `paths`. Les alias
  Nuxt (`~`, `@`, `#server`, `#shared`, `#layers/*`) restent résolus par app.
- ESLint : config plate partagée à la racine, étendue par app/layer.
- Vitest : conserver les 4 projets (unit/nuxt/e2e/integration) **par app** ; les tests de layer
  tournent dans le contexte de l'app hôte (ou un harness minimal du layer).

## 10. Ordre d'application et dérisquage

1. Introduire `pnpm-workspace.yaml` + `package.json` racine, **sans** déplacer le code (workspace à
   un seul membre = repo actuel). Valider que tout build/teste encore.
2. `git mv` du code dans `apps/jonglerie/` + extraction `layers/volunteers/`. Un commit dédié (§4).
3. Mettre en place `compose-prisma.mjs` + `prisma:compose`. Régénérer le client, **migration nulle**
   attendue (schéma identique, juste recomposé).
4. Adapter Docker (contexte racine, Dockerfile app) puis CI (matrice).
5. **Aucune** 2ᵉ app encore : à ce stade le monorepo héberge une seule app, mais la plomberie est
   prête. C'est le point de bascule avant l'étape 4.

## 11. Checklist

- [ ] `pnpm-workspace.yaml` + `package.json` racine d'orchestration.
- [ ] `apps/jonglerie/` (code déplacé, historique préservé) + `package.json` nommé.
- [ ] `layers/volunteers/` (+ futur `layers/core/`) avec `package.json` nommés et déclarés en
      dépendances workspace des apps.
- [ ] `compose-prisma.mjs` + `prisma:compose` ; client généré dans l'app ; migration nulle vérifiée.
- [ ] Dockerfile par app, contexte = racine ; compose paramétrés par app ; `entrypoint` par base.
- [ ] CI en matrice par app + invalidation sur changement de layer.
- [ ] `tsconfig.base.json` + configs étendues ; ESLint ; Vitest verts.
