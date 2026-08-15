---
description: 'Redéploie une stack — release, production, ou les deux en parallèle — via le webhook Portainer, puis vérifie que la bascule a réellement eu lieu'
thinking: false
---

# Redéploiement via webhook Portainer

Déclenche le redéploiement d'une stack hébergée chez le partenaire. Les piles sont **adossées au
dépôt Git** : le webhook récupère le dépôt puis **construit sur place**. Aucune image n'est
publiée dans un registre, et aucun workflow GitHub n'en produit — inutile donc d'attendre quoi
que ce soit avant de déclencher.

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

Second effet, mineur : en séquence, la production profite du cache de couches Docker chauffé par
release et bascule en quelques dizaines de secondes. En parallèle, les deux constructions se font
concurrence et l'ensemble prend un peu plus longtemps.

## Environnements

- **Release** : https://test.juggling-convention.com
- **Production** : https://juggling-convention.com
