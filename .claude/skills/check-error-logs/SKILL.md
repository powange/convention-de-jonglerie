---
description: "Surveille les logs d'erreur de l'API en prod, corrige ce qui doit l'être, puis /full-pipeline et déploiement"
thinking: true
---

# Surveillance des logs d'erreur de production

Cette commande interroge l'endpoint public `/api/public/error-logs` **en production**, analyse les
erreurs non résolues, **corrige le code** pour celles qui le nécessitent, puis enchaîne
`/full-pipeline` et un déploiement en prod.

Elle est conçue pour être lancée **ponctuellement** ou en boucle via `/loop` (voir tout en bas).

## Configuration requise

Deux variables dans `.env` (jamais committé) :

- `MONITORING_PROD_URL` — URL de base de la **production** (ex. `https://juggling-convention.com`).
  ⚠️ Ne PAS utiliser `NUXT_PUBLIC_SITE_URL` / `APP_URL` qui pointent vers la **dev**.
- `MONITORING_ERROR_LOGS_TOKEN` — un token d'API ayant le scope `error-logs`, à créer dans
  **Admin → Tokens d'API publique** (`/admin/api-tokens`) sur la prod.

Si l'une des deux est absente ou vide : **arrêter immédiatement** et demander à l'utilisateur de
les renseigner (sans jamais afficher le token en clair).

## Étapes à suivre

### 1. Charger la configuration

Le chargement de la config et la requête sont encapsulés dans `scripts/check-error-logs.sh`
(autorisé sans prompt). Le script lit `MONITORING_PROD_URL` et `MONITORING_ERROR_LOGS_TOKEN`
dans `.env`, valide leur présence, et n'affiche jamais le token. S'il sort avec
`MISSING_PROD_URL` / `MISSING_TOKEN` (code 3) → stop + instructions ci-dessus.

### 2. Déterminer la fenêtre de temps (`since`)

L'état est conservé dans `.claude/error-logs-monitor.json` (gitignoré) :

```json
{ "lastCheckedAt": "2026-06-12T10:00:00.000Z", "dismissed": [] }
```

- `lastCheckedAt` : borne `since` du dernier passage. Si le fichier n'existe pas, prendre les
  dernières **24 h** par défaut (ne pas remonter tout l'historique au premier passage).
- `dismissed` : liste d'**empreintes** d'erreurs déjà jugées « à ne pas corriger »
  (empreinte = `errorType|method|path|message`). Sert à ne pas les re-trier à chaque passage.

### 3. Interroger l'endpoint en production

Appeler le script dédié en lui passant la borne `since` (et éventuellement une limite). Il
affiche le corps JSON puis une ligne `HTTP_CODE=<code>`, sans jamais exposer le token :

```bash
bash scripts/check-error-logs.sh "<lastCheckedAt ou maintenant-24h>"
# limite personnalisée : bash scripts/check-error-logs.sh "<since>" 500
```

Gestion des réponses :

- `401` → token absent/invalide/révoqué : stop, demander de vérifier `MONITORING_ERROR_LOGS_TOKEN`.
- `403` → token sans le scope `error-logs` : stop, demander de cocher l'endpoint sur le token.
- `200` avec `logs: []` → **rien à faire** : afficher « Aucune nouvelle erreur », mettre à jour
  `lastCheckedAt` (étape 7), terminer.
- `200` avec des logs → continuer.

Si `pagination.hasMore` est vrai, paginer avec `cursor` pour tout récupérer.

### 4. Trier les erreurs

Regrouper les logs par empreinte (`errorType|method|path|message`) pour éviter les doublons, puis,
pour chaque groupe **non présent dans `dismissed`**, décider s'il faut corriger :

- **À corriger (bug code)** — typiquement :
  - `statusCode` 5xx (500, 502, 503…) ou exceptions non gérées,
  - erreurs Prisma / `TypeError` / `undefined`, validations qui plantent au lieu de renvoyer 4xx,
  - `404` sur une route qui **devrait** exister.
- **À NE PAS corriger (bruit attendu)** — typiquement :
  - `400`/`401`/`403`/`422` liés à une saisie ou à une auth utilisateur,
  - `404` sur des chemins manifestement scannés/inexistants,
  - erreurs provenant d'un service externe indisponible (sans bug de notre côté).

En cas de doute, **ouvrir le code du handler** correspondant (`method` + `path` → fichier dans
`server/api/...`) avec les outils jCodemunch pour trancher. Documenter la décision pour chaque groupe.

### 5. Corriger les erreurs « à corriger »

Pour chaque groupe à corriger :

1. Localiser le handler via `path`/`method` (`server/api/<...>.<method>.ts`).
2. Diagnostiquer la cause à partir du `message`/`errorType` (ouvrir le code avec jCodemunch).
3. **Évaluer la certitude de la cause** — c'est la règle clé de cette commande :
   - **Cause CERTAINE** = on a identifié dans le code la ligne/condition précise qui produit
     exactement cette erreur, et le correctif la résout sans ambiguïté (ex. accès à une propriété
     d'un objet potentiellement `undefined`, `await` manquant, champ Prisma inexistant, validation
     absente sur un paramètre qui plante). → **Corriger automatiquement**.
   - **Cause INCERTAINE** = plusieurs causes possibles, erreur non reproductible localement,
     dépend de données de prod inconnues, ou le correctif envisagé n'est qu'une hypothèse.
     → **NE PAS corriger automatiquement**. Présenter le diagnostic à l'utilisateur (erreur,
     code suspecté, hypothèses) et **attendre son feu vert** avant toute modification. Ne pas
     ajouter l'empreinte à `dismissed` dans ce cas (l'erreur reste à traiter au prochain passage
     tant que l'utilisateur n'a pas tranché).
4. Pour les causes certaines, appliquer un correctif **ciblé et minimal**, en respectant les
   conventions du projet (helpers Prisma, `useApiAction`, composants Nuxt UI, i18n FR uniquement,
   etc. — cf. `CLAUDE.md`).

**S'il n'y a finalement aucune correction certaine à appliquer** (tout est du bruit attendu, ou
seules des causes incertaines en attente de l'utilisateur) : mettre à jour l'état (étape 7) et
**s'arrêter là** — ne PAS lancer le pipeline ni le déploiement.

### 6. Pipeline puis déploiement automatique

Uniquement si au moins une correction (cause certaine) a été appliquée :

1. Lancer `/full-pipeline` (i18n, code review + corrections, lint, tests, commit/push).
   Si une étape échoue → **arrêter**, signaler l'erreur, ne PAS déployer.
2. Le pipeline réussi, **déployer la prod automatiquement, sans demander de confirmation**
   (déploiement auto assumé dans ce flux). Déclencher directement le webhook Portainer de prod
   sans afficher l'URL (qui contient un secret), en n'affichant que le code HTTP :

   ```bash
   bash scripts/trigger-prod-deploy.sh
   ```

   (le script lit `PORTAINER_PROD_WEBHOOK_URL` dans `.env`, n'affiche que le code HTTP, et sort
   avec `MISSING_WEBHOOK_URL` / code 3 si la variable est absente.)
   - `200`/`204` → redéploiement déclenché.
   - `404` → webhook introuvable/désactivé ; `409` → déploiement déjà en cours ; autre → échec.

   Ne PAS passer par `/deploy` ici : cette commande impose une confirmation interactive, alors que
   ce flux est volontairement automatique. Si `PORTAINER_PROD_WEBHOOK_URL` est absente → signaler
   que les corrections sont commit/push mais que le déploiement n'a pas pu être déclenché.

### 7. Mettre à jour l'état

Utiliser le script dédié (autorisé sans prompt) plutôt que d'éditer le JSON à la main :

```bash
# lastCheckedAt = instant du DÉBUT de ce passage (pas la fin), pour ne pas rater
# les erreurs survenues pendant le traitement.
# Empreintes optionnelles à ajouter à `dismissed` (jamais retirées) :
bash scripts/update-error-logs-state.sh "<début-du-passage-ISO8601>" \
  "errorType|method|path|message"
```

Le script fusionne avec l'état existant : il remplace `lastCheckedAt` et n'ajoute que les
empreintes `dismissed` encore absentes.

### 8. Résumé final

Afficher un compte rendu concis :

- nombre d'erreurs récupérées, groupes distincts,
- ce qui a été corrigé (fichiers + nature du correctif),
- ce qui a été écarté et pourquoi,
- statut du pipeline et du déploiement (déclenché / refusé / non applicable).

---

## Utilisation en boucle

Pour une surveillance continue pendant une session ouverte :

```
/loop 15m /check-error-logs
```

À chaque tour, seules les **nouvelles** erreurs (depuis `lastCheckedAt`) sont traitées, et les
empreintes déjà écartées ne sont pas re-triées.
