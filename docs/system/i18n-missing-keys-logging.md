# Journalisation des clés de traduction manquantes

> **But** : garder un **historique** des clés i18n absentes (par page/locale) pour les corriger plus
> tard, au lieu de ne les voir que ponctuellement dans la console du navigateur.

## Fonctionnement

1. **Côté client** — `i18n/i18n.config.ts` définit le handler `missing` de vue-i18n. Dès qu'une clé
   est absente, elle est mise en file (dédupliquée par `locale:clé` sur la session), puis envoyée par
   **lot, en différé (3 s)** à l'API. Best-effort : si l'envoi échoue, le rendu n'est pas impacté (la
   clé reste affichée telle quelle, comme avant). N'émet **que côté client** (pas pendant le SSR).

2. **API** — `POST /api/i18n/missing-keys` (route **publique**, des clés peuvent manquer sur des
   pages publiques ; validée + bornée à 50 clés/requête + format de clé strict). Chaque clé est
   journalisée dans **`ApiErrorLog`** avec `errorType = 'I18nMissingKey'` :
   - **dédupliquée par clé** (1 ligne par clé) ;
   - `prismaDetails` cumule `{ locales, occurrences, lastPath }` ;
   - `statusCode = 0` (sentinelle : ce n'est pas une erreur HTTP), `method = 'I18N'`, `path` = la page ;
   - une clé qui réapparaît repasse `resolved = false`.

3. **Consultation** — page **`/admin/error-logs`** (filtre par type d'erreur → `I18nMissingKey`).
   La tâche de nettoyage des logs résolus et le workflow « résolu / notes admin » existants
   s'appliquent aussi à ces entrées.

## Pourquoi `ApiErrorLog` (et pas une table dédiée)

Réutilise l'infra existante (page admin, filtres, stats, nettoyage, marquage résolu) **sans
migration de schéma**. Les entrées i18n se distinguent par `errorType = 'I18nMissingKey'`.

## Fichiers

- `i18n/i18n.config.ts` — handler `missing` + reporter (batch/dédup côté client).
- `server/api/i18n/missing-keys.post.ts` — endpoint d'enregistrement (dédup + validation).
- `server/constants/public-routes.ts` — déclaration de la route publique.

## Validation

Smoke testé : POST d'une nouvelle clé → `200 { count: 1 }` (création) ; même clé (autre locale) →
dédup (occurrences++ / locale ajoutée) ; clé invalide (`<script>`) → `400`.
