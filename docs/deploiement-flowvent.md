# Déployer Flowvent (app2)

Trois environnements :

| Environnement | Où          | Domaine                                      | Compose                                |
| ------------- | ----------- | -------------------------------------------- | -------------------------------------- |
| dev           | poste local | `dev.flowvent.org` / `http://localhost:3001` | `apps/app2/docker-compose.dev.yml`     |
| release       | Portainer   | `test.flowvent.org`                          | `apps/app2/docker-compose.release.yml` |
| prod          | Portainer   | `flowvent.org`                               | `apps/app2/docker-compose.prod.yml`    |

## La chaîne, en une phrase

Un merge sur `main` qui touche `apps/app2/**` ou `layers/auth/**` fait construire et publier par la
CI l'image `ghcr.io/powange/flowvent:main` (et `:sha-<commit>`). Le webhook Portainer de la stack
la fait ensuite tirer : l'hôte ne construit jamais rien. Le conteneur applique les migrations au
démarrage, puis sert l'application.

Sur une PR qui touche ces chemins, la même image est construite **sans être publiée**. Cette garde
manquait : le layer d'auth avait évolué pour app1 jusqu'à casser le build d'app2, et rien ne
l'avait signalé.

## Une fois, avant la première stack

1. **Publier l'image** : merger la PR, ou lancer le workflow à la main
   (`gh workflow run publier-image-flowvent.yml --ref main`).
2. **Rendre le paquet GHCR public.** Un paquet créé par la CI naît **privé**, et l'hôte ne peut
   alors pas tirer l'image. Dans GitHub, ouvrir _Packages → flowvent → Package settings → Change
   visibility → Public_. C'est ce que fait déjà `convention-de-jonglerie`. L'autre voie consiste à
   déclarer un registre authentifié dans Portainer.
3. **DNS** : `flowvent.org` (et `www.` si on la sert) et `test.flowvent.org` vers l'hôte.

## Créer une stack dans Portainer

_Stacks → Add stack → Repository_ :

- **Repository URL** : le dépôt, branche `refs/heads/main`
- **Compose path** : `apps/app2/docker-compose.release.yml` (ou `…prod.yml`)
- **Environment variables** :

| Variable                                    | Obligatoire | Note                                                                                        |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `NUXT_PUBLIC_SITE_URL`                      | oui         | `https://test.flowvent.org` (release) / `https://flowvent.org` (prod) : liens des courriels |
| `NUXT_SESSION_PASSWORD`                     | oui         | ≥ 32 caractères (`openssl rand -base64 32`), **différent** entre release et prod            |
| `MYSQL_PASSWORD`                            | oui         | sa ponctuation est sans importance : l'entrypoint l'encode                                  |
| `MYSQL_ROOT_PASSWORD`                       | oui         |                                                                                             |
| `MYSQL_USER`, `MYSQL_DATABASE`              | non         | défauts `flowvent_user` / `flowvent_db`                                                     |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `_SECRET`   | non         | Connexion Google. Vides : le bouton renvoie sur `/login`                                    |
| `NUXT_OAUTH_FACEBOOK_CLIENT_ID` / `_SECRET` | non         | Connexion Facebook. Vides : le bouton renvoie sur `/login`                                  |

Le compose refuse de démarrer si une variable obligatoire manque (`${VAR:?…}`), et l'entrypoint
refuse un `NUXT_SESSION_PASSWORD` de moins de 32 caractères. Mieux vaut une erreur au déploiement
qu'une application qui démarre et dont toutes les sessions échouent.

- **Webhook** : l'activer, puis noter son URL. C'est elle qui redéploie.

## Connexion Google et Facebook

Les URL de retour sont **dérivées de `NUXT_PUBLIC_SITE_URL`** par le compose, et non de la requête :
derrière le proxy, celle-ci pourrait se présenter en `http`, et le fournisseur refuserait l'URL.
Elles sont à déclarer à l'identique chez chaque fournisseur, pour chaque environnement :

| Environnement | Google et Facebook                                                                  |
| ------------- | ----------------------------------------------------------------------------------- |
| dev           | `https://dev.flowvent.org/auth/google` · `https://dev.flowvent.org/auth/facebook`   |
| release       | `https://test.flowvent.org/auth/google` · `https://test.flowvent.org/auth/facebook` |
| prod          | `https://flowvent.org/auth/google` · `https://flowvent.org/auth/facebook`           |

- **Google** : console.cloud.google.com → _API et services → Identifiants → Créer un ID client
  OAuth_ (type « Application Web »). Renseigner les trois URI dans « URI de redirection autorisés »,
  et `https://flowvent.org` dans les origines. L'écran de consentement doit être **publié**
  (« En production ») : en mode test, seuls les comptes listés peuvent se connecter.
- **Facebook** : developers.facebook.com → _Créer une app_ (cas d'usage « Authentifier et demander
  des données avec Facebook Login »). _Facebook Login → Paramètres_ : les trois URI dans « URI de
  redirection OAuth valides ». _Paramètres de base_ : domaines `flowvent.org`, URL de la politique de
  confidentialité, puis passer l'app en mode **Live** (en mode développement, seuls les rôles de
  l'app peuvent se connecter). La permission `email` est requise.

Un client par fournisseur suffit pour les trois environnements. Ses identifiants vont dans les
variables de chaque stack, et dans `apps/app2/.env` pour le dev.

## Reverse proxy

Les deux stacks rejoignent le réseau externe `proxy-network`, comme app1. Hôtes à déclarer :

| Domaine             | Cible                       |
| ------------------- | --------------------------- |
| `test.flowvent.org` | `flowvent-app-release:3000` |
| `flowvent.org`      | `flowvent-app-prod:3000`    |

## Redéployer

1. Attendre que `publier-image-flowvent.yml` ait **terminé** pour le commit voulu. Un webhook
   déclenché trop tôt fait tirer l'image précédente, répond 204 et ne livre rien :

   ```bash
   SHA=$(git rev-parse origin/main)
   gh run list --workflow=publier-image-flowvent.yml --limit 5 \
     --json headSha,status,conclusion --jq ".[]|select(.headSha==\"$SHA\")"
   ```

2. Déclencher le webhook de la stack.
3. Vérifier la bascule : `/_nuxt/builds/latest.json` porte un `id` qui doit être celui de l'image.

Revenir en arrière : remplacer `:main` par `:sha-<commit>` dans le compose de la stack.

## Ce que l'environnement ne fait pas encore

- **Aucun courriel n'est envoyé.** App2 n'a pas de transport : les messages, codes de vérification
  d'inscription compris, sont seulement écrits dans les journaux du conteneur (`📧 EMAIL SIMULÉ`).
  En release, on s'en accommode en lisant les journaux. **En prod, personne ne pourra valider son
  inscription par email** tant qu'un transport n'est pas branché. La connexion Google, une fois ses identifiants renseignés,
  fonctionne sans courriel.
- **Release est indexable.** App2 n'a pas `@nuxtjs/seo` : rien n'empêche un moteur de référencer
  `test.flowvent.org`.
- **Paiement simulé** : l'abonnement s'active sans prestataire.
- **Sessions à durée fixe** (30 jours) : app2 n'a pas la session glissante d'app1, et « se souvenir
  de moi » y est sans effet (`apps/app2/server/utils/session-helpers.ts`).

## Dev local

```bash
cd apps/app2
docker compose -f docker-compose.dev.yml up --build -d
```

`http://localhost:3001` fonctionne directement. Pour `dev.flowvent.org`, faire pointer le DNS et le
proxy vers le port 3001 du poste, comme pour `dev.juggling-convention.com`. Côté application, le
domaine vient de `NUXT_PUBLIC_SITE_URL` (`apps/app2/.env`), qui alimente aussi
`vite.server.allowedHosts` : aucun domaine n'est écrit dans le code.
