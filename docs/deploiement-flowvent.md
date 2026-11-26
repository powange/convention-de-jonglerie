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

### Les courriels

Le transport est celui d'app1, mis en commun (`layers/core/server/socle/envoi-courriel.ts`) ; seul
le nom d'expéditeur diffère (« Flowvent »). Variables de la stack :

| Variable      | Défaut  | Note                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------ |
| `SEND_EMAILS` | `false` | `true` pour envoyer. Sinon les messages sont écrits dans les journaux          |
| `SMTP_HOST`   | vide    | serveur SMTP ; vide : Gmail avec `SMTP_USER` / `SMTP_PASS`                     |
| `SMTP_PORT`   | `587`   | `465` = TLS direct                                                             |
| `SMTP_USER`   | vide    |                                                                                |
| `SMTP_PASS`   | vide    |                                                                                |
| `SMTP_FROM`   | vide    | adresse d'expédition (défaut : `SMTP_USER`), affichée sous le nom « Flowvent » |
| `SMTP_BCC`    | vide    | copie cachée d'archivage, adresses séparées par des virgules                   |

**Tant que `SEND_EMAILS` n'est pas `true`, personne ne peut valider son inscription par email** :
les codes ne sont lisibles que dans les journaux du conteneur (`📧 EMAIL SIMULÉ`). La connexion
Google ou Facebook, elle, s'en passe. Aucun message ne part vers un domaine de test (`.test`,
`.invalid`, `example.com`…), même en envoi réel.

### Les photos de profil : un volume

Les photos déposées sont des fichiers, sur le volume nommé `uploads_data` monté en `/uploads`
(déclaré dans le compose, avec `NUXT_FILE_STORAGE_MOUNT=/uploads`). Docker le crée au premier
déploiement et le garde d'un redéploiement à l'autre — sans lui, chaque redéploiement effacerait
toutes les photos. **Il n'est pas dans les sauvegardes de la base** : le sauvegarder à part
(`docker run --rm -v <stack>_uploads_data:/u -v "$PWD":/b alpine tar czf /b/uploads.tgz -C /u .`).

Circuit (le même qu'app1) : dépôt dans `temp/profiles/<id>/`, déplacé dans `profiles/<id>/` à
l'enregistrement du profil, l'ancienne photo effacée ; un dépôt abandonné est supprimé après une
heure par la tâche `cleanup-temp-uploads`. Seules les photos sont servies par `/uploads/**`.

## Administrateurs

L'administration (`/admin` : comptes, événements) est réservée aux comptes `isGlobalAdmin`. Un
administrateur en nomme d'autres depuis la fiche d'un compte ; le PREMIER se nomme hors de
l'interface :

- **partout**, avec le même script qu'app1 (logique commune dans
  `layers/core/scripts/gestion-administrateurs.ts`) : `npm run admin:add <email>` (et
  `admin:remove`, `admin:list`) — en développement depuis `apps/app2/`, en release ou en production
  dans la console du conteneur **applicatif** de la stack (`flowvent-app-release` /
  `flowvent-app-prod`). Le script est dans l'image, et reconstruit seul l'accès à la base à partir
  des `MYSQL_*` du conteneur (la `DATABASE_URL` n'existe que dans le processus de l'entrypoint) ;
- **à défaut**, dans la console du conteneur de base (`flowvent-db-release` / `flowvent-db-prod`) :

  ```sql
  UPDATE User SET isGlobalAdmin = 1 WHERE email = '<adresse du compte>';
  ```

  puis se reconnecter : l'entrée « Administration » apparaît dans le menu du compte.

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

**Avec Claude : `/deploy-flowvent release`, `/deploy-flowvent prod` ou `/deploy-flowvent all`.** Le
skill attend l'image, déclenche le webhook, puis vérifie la bascule dans la page. Il lit
`PORTAINER_RELEASE_WEBHOOK_URL` et `PORTAINER_PROD_WEBHOOK_URL` dans `apps/app2/.env`.

À la main :

1. Attendre que `publier-image-flowvent.yml` ait **terminé** pour le commit voulu. Un webhook
   déclenché trop tôt fait tirer l'image précédente, répond 204 et ne livre rien :

   ```bash
   SHA=$(git rev-parse origin/main)
   gh run list --workflow=publier-image-flowvent.yml --limit 5 \
     --json headSha,status,conclusion --jq ".[]|select(.headSha==\"$SHA\")"
   ```

2. Déclencher le webhook de la stack.
3. Vérifier la bascule : le répertoire des fichiers de build porte le commit de l'image,
   `/_nuxt-<12 premiers caractères du sha>/`, lisible dans le HTML de l'accueil.

Revenir en arrière : remplacer `:main` par `:sha-<commit>` dans le compose de la stack.

## Ce que l'environnement ne fait pas encore

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

<!-- sonde du périmètre de CI leger, PR jetable, à fermer sans merger -->
