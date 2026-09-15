---
description: 'Redéploie une stack — release, production, ou les deux en parallèle — via le webhook Portainer, puis vérifie que la bascule a réellement eu lieu'
thinking: false
---

# Redéploiement via webhook Portainer

Déclenche le redéploiement d'une stack hébergée chez le partenaire.

⚠️ **Les piles TIRENT une image ; elles ne construisent plus rien.** Les deux composes déployés
(`apps/app1/docker-compose.prod.yml` et `.release.yml`) portent
`image: ghcr.io/powange/convention-de-jonglerie:main` avec `pull_policy: always`, et c'est la CI
qui construit et publie cette image — sur `main` uniquement, par le workflow `publier-image.yml`, qui pousse
`:main` et `:sha-<commit>`.

Conséquence à ne jamais oublier : **déclencher le webhook avant la fin de ce job redéploie l'image
PRÉCÉDENTE**. Le webhook répond 204, la pile redémarre, l'application répond — et rien de nouveau
n'est livré. C'est exactement le genre de silence que ce dispositif cherchait à supprimer, déplacé
d'un cran en amont. D'où l'attente ajoutée à l'étape 1.

Une version antérieure de ce texte affirmait l'inverse — « aucune image n'est publiée », « inutile
d'attendre quoi que ce soit avant de déclencher ». C'était vrai des piles adossées au dépôt Git,
abandonnées depuis : leur extraction d'archive n'effaçait jamais les fichiers supprimés, et c'est
un ancien composant qui s'est retrouvé servi en production.

L'argument détermine la cible :

| Argument                     | Cible                                           |
| ---------------------------- | ----------------------------------------------- |
| `prod` (ou aucun)            | production seule (`PORTAINER_PROD_WEBHOOK_URL`) |
| `release`                    | release seule (`PORTAINER_RELEASE_WEBHOOK_URL`) |
| `all` / `both` / `parallèle` | **les deux en parallèle**                       |

## Ce qu'un déploiement fait d'autre, et qu'il faut avoir en tête

`apps/app1/docker/entrypoint.sh` — le point d'entrée de release et de production, à ne pas
confondre avec `scripts/docker-start.sh` qui ne sert qu'au développement — exécute :

```
set -e  →  npx prisma migrate deploy  →  démarrage de Nuxt
```

Autrement dit : **un déploiement applique les migrations en attente, sans confirmation**. Si l'une
d'elles supprime des données, elles seront supprimées en production. Le vérifier avant de
déclencher, et le dire à l'utilisateur.

Corollaire utile : `set -e` fait échouer le conteneur si une migration échoue. Une application qui
répond après bascule prouve donc que les migrations sont passées.

## Étapes

### 1. Vérifier ce qui va partir

- `git log origin/main -1` — est-ce bien le commit attendu ?
- Une migration non appliquée en production ? Si oui, l'annoncer explicitement.
- **L'image de ce commit est-elle publiée ?** C'est elle que les piles vont tirer :

La publication a son propre workflow, `publier-image.yml` — la question est donc directe :

```bash
SHA=$(git rev-parse origin/main)
until gh run list --workflow=publier-image.yml --limit 5 \
    --json headSha,status,conclusion \
    --jq ".[] | select(.headSha==\"$SHA\") | select(.status==\"completed\") | .conclusion" \
    | grep -q .; do
  sleep 30
done
gh run list --workflow=publier-image.yml --limit 5 --json headSha,conclusion \
  --jq ".[] | select(.headSha==\"$SHA\") | .conclusion"
```

Filtrer sur `headSha` plutôt que prendre le dernier run : juste après un merge, la liste rend
encore celui du commit précédent, et l'attente se terminerait aussitôt sur le mauvais. Si la
conclusion n'est pas `success`, **ne pas déployer**.

Lancer cette attente en tâche de fond : la construction dure plusieurs minutes.

⚠️ **Ne pas surveiller `tests.yml`.** Le dépôt a DEUX workflows, et c'est `publier-image.yml` qui
publie l'image — le seul qui décide de ce que les piles vont tirer. Attendre `tests.yml` fait
attendre la mauvaise chose : il peut être vert alors que l'image n'existe pas encore, et l'on
déclenche à nouveau trop tôt. Erreur commise le 2026-09-15 sur #434, en plus de l'attente omise.

Repère chiffré, pour savoir si l'on s'impatiente à tort : quand l'image est publiée AVANT le
déclenchement, les deux piles basculent en **~75 secondes** (#435, les deux en parallèle). Une
attente qui dépasse quelques minutes ne signale donc pas une pile lente — elle signale qu'on a
déclenché trop tôt, ou que le webhook n'a rien déclenché du tout. Ne pas relancer en boucle :
revenir à l'étape 1 et vérifier l'image.

### 2. Relever le build actuel

C'est la seule référence qui permettra de constater la bascule :

```bash
curl -s --max-time 20 https://test.juggling-convention.com/_nuxt/builds/latest.json
curl -s --max-time 20 https://juggling-convention.com/_nuxt/builds/latest.json
```

L'identifiant est **déterministe par commit** : deux environnements sur le même commit affichent
le même. Le noter avant de déclencher.

### 3. Confirmation

Demander confirmation explicite avant la **production**. Ne jamais y déployer sans un accord clair.
Une autorisation donnée pour un lot ne vaut pas pour le suivant.

### 4. Déclencher

Le fichier `.env` est dans **`apps/app1/`**, pas à la racine. Ne jamais afficher l'URL, qui contient
un secret : la lire dans la commande et n'afficher que le code HTTP. Le `sed` retire d'éventuels
guillemets, sans quoi curl renvoie `HTTP 000`.

Une cible :

```bash
URL=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' apps/app1/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL"
```

Les deux en parallèle :

```bash
R=$(grep -E '^PORTAINER_RELEASE_WEBHOOK_URL=' apps/app1/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
P=$(grep -E '^PORTAINER_PROD_WEBHOOK_URL=' apps/app1/.env | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
curl -s -o /dev/null -w "webhook release : HTTP %{http_code}\n" -X POST "$R" &
curl -s -o /dev/null -w "webhook prod    : HTTP %{http_code}\n" -X POST "$P" &
wait
```

Si la variable est absente ou vide, **arrêter** et demander à l'utilisateur de la renseigner
(Portainer : édition de la stack > toggle « Webhook »).

### 5. Interpréter le code de retour

- `200` / `204` → déclenché. **Cela ne prouve rien d'autre** : passer à l'étape 6.
- `404` → webhook introuvable (UUID invalide ou désactivé dans Portainer).
- `409` → un déploiement est probablement déjà en cours.
- Autre ou pas de réponse → signaler l'échec.

### 6. Vérifier la bascule — l'étape qui compte

Attendre que l'identifiant de build change, avec une boucle `until` et non une suite de `sleep` :

```bash
until curl -s --max-time 15 https://test.juggling-convention.com/_nuxt/builds/latest.json | grep -q '"id"' \
   && ! curl -s --max-time 15 https://test.juggling-convention.com/_nuxt/builds/latest.json | grep -q '<ANCIEN_ID>'; do
  sleep 25
done
curl -s --max-time 20 https://test.juggling-convention.com/_nuxt/builds/latest.json
```

Deux pièges :

- **Un 502 juste après le webhook est normal** — la pile redémarre. Attendre une réponse JSON
  valide, d'où la double condition ci-dessus.
- Compter uniquement sur l'absence de l'ancien identifiant sortirait de la boucle sur une page
  d'erreur, qui ne contient évidemment pas cet identifiant.

Puis contrôler quelques pages : l'accueil et une page d'édition au minimum.

### 7. Vérifier ce qui vient d'être livré

Un code 200 dit que l'application tourne, pas que le changement est là. Quand c'est possible,
contrôler la fonctionnalité elle-même : un champ rendu par une API, un bloc présent ou absent du
HTML. Attention à distinguer le **HTML rendu** de la **charge d'hydratation** — un champ encore
présent dans le `<script>` de payload n'est pas affiché pour autant.

## Sur le parallèle, à dire à l'utilisateur

Déployer les deux en même temps **supprime la répétition** que fournit release : d'ordinaire, on
déploie release, on vérifie, puis la production. En parallèle, un build défaillant fait tomber les
deux ensemble.

À éviter quand une **migration** est en attente : release sert alors de galop d'essai, et la voir
répondre prouve que la migration est passée avant d'y soumettre la production.

L'argument du cache de build, lui, ne vaut plus : rien n'est construit sur l'hôte, les deux piles
ne font que tirer la même image déjà publiée. Le parallèle ne coûte donc plus de temps de calcul —
il ne coûte que la répétition.

## Revenir à un build précédent

La CI publie aussi `:sha-<commit>`. Pour revenir en arrière sans reconstruire, remplacer `:main`
par cette étiquette dans le compose de la pile concernée, puis redéployer. C'est plus sûr et plus
rapide qu'un `git revert` suivi d'une nouvelle construction.

## Environnements

- **Release** : https://test.juggling-convention.com
- **Production** : https://juggling-convention.com
