# Guide des tests

## Suites et usages

Le projet utilise une configuration multi-projet Vitest pour de meilleures perfs et une maintenance simple.

1. Unit (sans Nuxt complet, sans DB)

- Projet: `unit` dans `vitest.config.ts`
- Setup: `test/setup-common.ts`, `test/setup-mocks.ts`
- Scripts:
  - `npm run test:unit` (watch)
  - `npm run test:unit:run` (one-shot)
  - `npm run test:ui` (UI)

2. Nuxt (runtime Nuxt, DB mockée)

- Projet: `nuxt` dans `vitest.config.ts`
- Setup: `test/setup-common.ts`, `test/setup.ts`
- Scripts:
  - `npm run test:nuxt` (watch)
  - `npm run test:nuxt:run` (one-shot)

Notes Auth (nuxt-auth-utils):

- Les helpers `getUserSession` et `requireUserSession` sont moqués via `#imports`.
- Dans le code serveur, on privilégie les imports dynamiques (`await import('#imports')`) pour garantir que les mocks Vitest soient appliqués.
- Dans les tests, récupérez une référence stable au mock dans `beforeEach` pour utiliser `mockResolvedValueOnce` et `mockRejectedValueOnce` proprement.
- Simulez les erreurs HTTP en ajoutant `statusCode` à l'Error: `Object.assign(new Error('Unauthorized'), { statusCode: 401 })`.

3. Intégration/DB (Prisma + MySQL réels)

- Projet: `integration` dans `vitest.config.ts`
- Setup: `test/setup-common.ts`, `test/setup-integration.ts`, `test/setup-db.ts`
- Exécution mono-thread pour éviter les conflits DB
- Scripts:
  - `npm run test:db` (watch si DB déjà prête)
  - `npm run test:db:run` (prépare Docker + migrations + run)
  - `npm run test:setup` / `npm run test:teardown` (DB de test)

4. E2E (Nuxt lancé + $fetch boîte noire)

- Projet: `e2e` dans `vitest.config.ts`
- Setup: `test/e2e/setup.ts`
- Scripts:
  - `npm run test:e2e` / `npm run test:e2e:run`

Raccourci pour tout lancer (hors DB):

- `npm run test:all` → unit + nuxt + e2e

## Environnement DB de test

- MySQL via Docker Compose, port 3307 (voir `docker-compose.test.yml`)
- Base: `convention_db` (valeur par défaut)
- Utilisateur: `convention_user` / `convention_password` (valeurs par défaut)
- URL par défaut si aucune n’est fournie: `mysql://convention_user:convention_password@localhost:3307/convention_db`
- Migrations gérées par `scripts/migrate-test.js` et `test/setup-db.ts`

## Arborescence utile

```
test/
├── __mocks__/             # Mocks partagés
├── e2e/                   # E2E
├── integration/           # Tests DB (suffixe .db.test.ts)
├── nuxt/                  # Tests Nuxt (handlers, composables…)
├── composables/, stores/, utils/, feedback/  # Unitaires
├── setup-common.ts        # Fallbacks H3/Nitro partagés
├── setup-integration.ts   # Mocks min sans Nuxt pour l’intégration
├── setup-mocks.ts         # Mocks unitaires
└── setup.ts               # Setup Nuxt
```

## CI/CD (exemple)

```yaml
- name: Setup test DB
  run: npm run test:setup

- name: Run unit + nuxt + e2e
  run: npm run test:all

- name: Run DB integration
  run: npm run test:db:run

- name: Teardown test DB
  run: npm run test:teardown
```
