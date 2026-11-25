---
description: 'Redéploie Flowvent (app2) — release, production, ou les deux en parallèle — via le webhook Portainer, puis vérifie que la bascule a réellement eu lieu'
thinking: false
---

# Redéploiement de Flowvent (app2) via webhook Portainer

Pendant de `/deploy` (app1), dont il reprend la méthode. Les raisons détaillées de chaque
précaution sont dans `.claude/skills/deploy/SKILL.md` ; ne sont répétées ici que les règles, et
ce qui diffère pour Flowvent.

⚠️ **Les piles TIRENT une image ; elles ne construisent rien.** `apps/app2/docker-compose.release.yml`
et `.prod.yml` portent `image: ghcr.io/powange/flowvent:main` avec `pull_policy: always`. L'image est
construite et publiée par la CI, sur `main`, par le workflow `publier-image-flowvent.yml`, qui pousse
`:main` et `:sha-<commit>`. **Déclencher le webhook avant la fin de ce workflow redéploie l'image
précédente** : 204, redémarrage, et rien de livré.

L'argument détermine la cible :

| Argument                     | Cible                                           |
| ---------------------------- | ----------------------------------------------- |
| `prod` (ou aucun)            | production seule (`PORTAINER_PROD_WEBHOOK_URL`) |
| `release`                    | release seule (`PORTAINER_RELEASE_WEBHOOK_URL`) |
| `all` / `both` / `parallèle` | **les deux en parallèle**                       |

## ⚠️ Ce qui diffère d'app1 : l'image ne suit pas chaque commit

`publier-image-flowvent.yml` ne se déclenche que si un commit touche `apps/app2/**`, l'un des layers
que Flowvent étend (`layers/auth/**`, `core`, `ui`, `volunteers`) ou le workflow lui-même. Un lot qui
ne concerne qu'app1 ne publie **aucune** image Flowvent.

Deux conséquences :

- le commit qu'on lira dans la page après bascule est celui de la **dernière image publiée**, pas
  `origin/main`. Attendre `origin/main` ferait boucler indéfiniment ;
- si rien de Flowvent n'a changé depuis le dernier déploiement, **redéployer ne livre rien** : le
  dire à l'utilisateur plutôt que de déclencher pour rien.

## Ce qu'un déploiement fait d'autre

`apps/app2/docker/entrypoint.sh` (release et prod ; `scripts/docker-start.sh` ne sert qu'au dev) :

```
set -e  →  construit DATABASE_URL  →  npx prisma migrate deploy  →  démarrage de Nuxt
```

**Un déploiement applique les migrations en attente, sans confirmation.** Lister celles qui partent
(`apps/app2/prisma/migrations/`) et dire explicitement si l'une détruit des données. Corollaire :
une application qui répond après bascule prouve que les migrations sont passées.

## Étapes

### 1. Déterminer l'image qui va partir

```bash
gh run list --workflow=publier-image-flowvent.yml --branch main --limit 5 \
  --json headSha,status,conclusion,event,createdAt \
  --jq '.[] | "\(.createdAt) \(.headSha[0:12]) \(.event) \(.status) \(.conclusion)"'
```

- Si un run est `in_progress` ou `queued` pour un commit plus récent, **l'attendre** en tâche de
  fond, en filtrant sur son `headSha` :

  ```bash
  SHA=<headSha du run en cours>
  until gh run list --workflow=publier-image-flowvent.yml --limit 5 --json headSha,status,conclusion \
      --jq ".[] | select(.headSha==\"$SHA\") | select(.status==\"completed\") | .conclusion" | grep -q .; do
    sleep 30
  done
  ```

- La cible est le `headSha` du **dernier run `completed` / `success`**. Si sa conclusion n'est pas
  `success`, **ne pas déployer** : lire le journal (`gh run view <id> --log-failed`). Une panne de
  registre ou de DNS se rejoue avec `gh run rerun <id> --failed`.
- Pas de run du tout pour un commit qui touche Flowvent ? Le déclencheur a pu ne pas partir :
  `gh workflow run publier-image-flowvent.yml --ref main`, jamais un commit vide.

Retenir `ATTENDU` = les 12 premiers caractères de ce `headSha`.

Contrôle facultatif, mais décisif, du contenu de l'image :

```bash
docker pull -q ghcr.io/powange/flowvent:main >/dev/null
docker run --rm --entrypoint sh ghcr.io/powange/flowvent:main -c 'ls /app/apps/app2/.output/public | grep _nuxt; ls /app/apps/app2/prisma/migrations'
```

Le répertoire `_nuxt-<ATTENDU>` doit y figurer, et la liste des migrations dit ce qui partira.

### 2. Relever le commit actuellement servi

Le répertoire des fichiers de build porte l'empreinte du commit (`/_nuxt-<sha>/`, cf.
`apps/app2/nuxt.config.ts`) :

```bash
for u in https://test.flowvent.org https://flowvent.org; do
  printf '%-28s ' "$u"
  curl -s --max-time 30 "$u/" | grep -oE '/_nuxt(-[A-Za-z0-9]+)?/' | head -1
done
```

Si on y lit déjà `/_nuxt-<ATTENDU>/`, l'environnement est à jour : le dire, et ne pas déclencher.
Un `/_nuxt/` nu désigne une image antérieure à ce mécanisme, ou construite sans `BUILD_SHA`.

### 3. Confirmation

Demander une confirmation explicite avant la **production**. Une autorisation donnée pour un lot ne
vaut pas pour le suivant.

### 4. Déclencher

Les URL sont dans **`apps/app2/.env`**, distinctes de celles d'app1 (`apps/app1/.env`). Ne jamais
afficher une URL, qui contient un secret : n'afficher que le code HTTP. Le `sed` retire d'éventuels
guillemets, sans quoi curl rend `HTTP 000`.

Une cible :

```bash
URL=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' apps/app2/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL"
```

Les deux en parallèle :

```bash
R=$(grep -E '^PORTAINER_RELEASE_WEBHOOK_URL=' apps/app2/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
P=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' apps/app2/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
curl -s -o /dev/null -w "webhook release : HTTP %{http_code}\n" -X POST "$R" &
curl -s -o /dev/null -w "webhook prod    : HTTP %{http_code}\n" -X POST "$P" &
wait
```

Variable absente ou vide → **arrêter**, et demander à l'utilisateur de la renseigner (Portainer :
édition de la stack `flowvent-release` / `flowvent-prod`, toggle « Webhook »).

### 5. Interpréter le code de retour

- `200` / `204` → déclenché, **sans rien prouver d'autre** : passer à l'étape 6.
- `404` → webhook introuvable (UUID invalide ou désactivé).
- `409` → un déploiement est probablement déjà en cours.
- Autre ou pas de réponse → signaler l'échec.

### 6. Vérifier la bascule

Attendre le commit ATTENDU, et non la disparition de l'ancien : une page d'erreur ne contient ni
l'un ni l'autre. Un 502 juste après le webhook est normal, la boucle l'absorbe.

```bash
U=https://test.flowvent.org   # ou https://flowvent.org
until curl -s --max-time 20 "$U/" | grep -q "/_nuxt-$ATTENDU/"; do sleep 25; done
curl -s --max-time 20 "$U/" | grep -oE '/_nuxt-[A-Za-z0-9]+/' | head -1
```

Repère : avec une image déjà publiée, une pile bascule en une à deux minutes. Bien au-delà, ce n'est
pas une pile lente : revenir à l'étape 1.

### 7. Vérifier ce qui vient d'être livré

Une page en 200 dit que l'application tourne, pas que le changement est là.

- Pages publiques : `/`, `/login`, `/pricing`, `/privacy-policy` → 200.
- Manifeste : `/api/site.webmanifest` → nom « Flowvent TEST » en release, « Flowvent » en prod.
- Console du navigateur vide sur ces pages (Playwright, depuis `apps/app1/`, qui a le paquet).
- Puis la fonctionnalité livrée elle-même, quand elle est observable sans compte.

Ne pas créer de compte en production sans l'accord de l'utilisateur : c'est une vraie donnée.

## Sur le parallèle, à dire à l'utilisateur

Déployer les deux ensemble supprime la répétition que fournit release. À éviter quand une
**migration** part : release sert alors de galop d'essai avant la production.

## Revenir à un build précédent

Remplacer `:main` par `:sha-<commit complet>` dans le compose de la pile concernée (dans Portainer),
puis redéployer.

## Environnements

- **Dev** : https://dev.flowvent.org (local, `apps/app2/docker-compose.dev.yml`)
- **Release** : https://test.flowvent.org — stack `flowvent-release`, conteneur `flowvent-app-release`
- **Production** : https://flowvent.org — stack `flowvent-prod`, conteneur `flowvent-app-prod`
- Guide de mise en place : `docs/deploiement-flowvent.md`
