# Publier l'application sur le Google Play Store (PWA + TWA)

Marche à suivre pour publier le site comme application Android, sans réécrire l'application.

## Ce qu'on publie, et ce qu'on ne publie pas

Une **Trusted Web Activity** est une coquille Android qui ouvre `juggling-convention.com` en plein
écran, sans barre d'adresse, dans le moteur de Chrome déjà installé sur le téléphone. Elle ne
contient aucun code applicatif.

Trois conséquences, à avoir en tête avant de commencer :

1. **Publier le site met à jour l'application.** Un déploiement en production est immédiatement ce
   que voient les utilisateurs de l'application. On ne repasse par le Play Store que pour changer
   ce que porte la coquille : nom, couleurs, icônes, version, raccourcis.
2. **Ce qui ne marche pas dans le navigateur ne marchera pas dans l'application.** Il n'y a rien à
   « adapter » : c'est le même site.
3. **Les notifications push fonctionnent déjà** — le site enregistre un service worker Firebase, et
   le TWA le reprend tel quel (`enableNotifications` dans `android/twa-manifest.json`).

## Les décisions déjà prises

| Décision              | Valeur                                                | Pourquoi                                                                                                                                         |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identifiant du paquet | `com.jugglingconvention.app`                          | **Définitif** : on ne peut plus le changer après la première publication sans perdre installations et avis.                                      |
| Signature             | Play App Signing                                      | Google détient la clé finale ; la perdre n'est pas fatal, il la remplace. Avec une clé personnelle, la perdre rend toute mise à jour impossible. |
| Fabrication           | Workflow CI (`.github/workflows/publier-android.yml`) | Reproductible et versionné, et rien à installer localement.                                                                                      |

## Étape 0 — ce qui est déjà en place dans le dépôt

- `android/twa-manifest.json` — la recette du paquet. Le projet Android est régénéré à partir
  d'elle à chaque fabrication ; il n'est pas versionné.
- `.github/workflows/publier-android.yml` — fabrique le `.aab` et le dépose en artefact.
- `apps/app1/server/routes/.well-known/assetlinks.json.get.ts` — sert le fichier Digital Asset
  Links à partir de la variable `ANDROID_SIGNING_FINGERPRINTS`.
- Une icône **maskable** dédiée (`public/favicons/android-chrome-maskable-512x512.png`), déclarée
  dans le manifeste web. Sans elle, Android pose le logo sur une pastille blanche.

## Étape 1 — créer la clé d'envoi

Sur une machine avec un JDK (ou dans le conteneur de développement) :

```bash
keytool -genkeypair -v \
  -keystore cle-envoi.keystore \
  -alias envoi \
  -keyalg RSA -keysize 2048 -validity 10000
```

`-alias envoi` doit correspondre à `signingKey.alias` de `android/twa-manifest.json`.

Puis, dans le dépôt GitHub, **Settings › Secrets and variables › Actions**, créer trois secrets :

| Secret                      | Contenu                         |
| --------------------------- | ------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 cle-envoi.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du magasin      |
| `ANDROID_KEY_PASSWORD`      | le mot de passe de la clé       |

> ⚠️ Garder le fichier `cle-envoi.keystore` ailleurs qu'ici : il n'est **pas** versionné, et le
> workflow l'efface après usage. Avec Play App Signing sa perte se rattrape, mais elle demande une
> démarche auprès de Google.

## Étape 2 — fabriquer un premier paquet

Onglet **Actions** du dépôt → _Fabriquer le paquet Android_ → _Run workflow_, avec la version
affichée (par exemple `1.0.0`).

Le numéro de version interne est celui du run, et il monte tout seul. La console Play refuse un
paquet dont le numéro n'est pas strictement supérieur au précédent.

Le `.aab` se télécharge dans les artefacts du run.

## Étape 3 — créer la fiche dans la console Play

Il faut un compte développeur Google Play (25 $ une fois). Dans la console :

1. Créer l'application, avec `com.jugglingconvention.app` comme identifiant.
2. Remplir la fiche : description, captures d'écran (au moins deux, en 16:9 ou 9:16), icône 512×512,
   image de bandeau 1024×500.
3. Répondre au questionnaire de **classification du contenu**, et déclarer la **sécurité des
   données** — ce que l'application collecte. Le site demande une adresse électronique, un pseudo,
   éventuellement un numéro de téléphone et des données de bénévolat : le dire.
4. Donner l'URL de la **politique de confidentialité** : `https://juggling-convention.com/privacy-policy`.
5. Déposer le `.aab` sur une piste — commencer par **test interne**, qui ne passe pas l'examen et
   permet d'installer l'application sur son propre téléphone en quelques minutes.

## ⚠️ Étape 4 — l'empreinte, et c'est là que tout se joue

Après le premier dépôt, dans la console Play : **Intégrité de l'application › Signature
d'application**. Relever l'empreinte **SHA-256** du _certificat de signature de l'application_ —
celui de Google, pas celui de la clé d'envoi affiché juste en dessous.

La placer dans la variable d'environnement des piles Portainer, en release **et** en production :

```
ANDROID_SIGNING_FINGERPRINTS=14:6D:E9:83:...:44:E5
```

Puis redéployer, et vérifier :

```bash
curl -s https://juggling-convention.com/.well-known/assetlinks.json
```

La réponse doit contenir l'empreinte. **Un tableau vide `[]` veut dire que la variable n'est pas
arrivée dans le conteneur** — c'est exactement ce qui s'est produit pour `DATABASE_URL` en
septembre 2026 : une variable déclarée dans la pile Portainer interpole le compose, elle ne peuple
pas l'environnement du conteneur. Il faut qu'elle soit listée dans `environment:` du
`docker-compose.prod.yml`.

### Pourquoi c'est ce fichier qui décide

Sans lui, ou avec une empreinte fausse, Android affiche la barre d'adresse de Chrome au-dessus de
l'application. **Rien n'échoue bruyamment** : pas d'erreur, pas de journal, juste une barre
d'adresse. Et une application qui ressemble à un navigateur déguisé se fait refuser à l'examen du
Play Store.

Deux erreurs classiques, qui donnent toutes deux ce même symptôme muet :

- prendre l'empreinte de la **clé d'envoi** au lieu de celle de Google ;
- prendre la **SHA-1** au lieu de la SHA-256 — les deux sont affichées côte à côte. La fonction qui
  compose le fichier écarte ce qui n'a pas 32 octets, précisément pour que cette erreur-là ne parte
  pas en production.

## Étape 5 — vérifier sur un téléphone

Installer depuis la piste de test interne. Deux contrôles :

1. **Pas de barre d'adresse** en haut de l'écran. Si elle est là, revenir à l'étape 4.
2. L'icône dans le tiroir d'applications n'est **pas** un logo rétréci dans un rond blanc. Si elle
   l'est, l'icône maskable n'a pas été reprise.

Le cache de Chrome sur `assetlinks.json` peut retarder la prise en compte d'une correction :
désinstaller puis réinstaller l'application force une nouvelle lecture.

## Étape 6 — passer en production

Une fois le test interne concluant, promouvoir la version en **production** dans la console. Le
premier examen prend de quelques heures à quelques jours.

## Mettre à jour plus tard

- **Le site a changé** → rien à faire. Le déploiement suffit.
- **Le nom, une couleur, une icône ou un raccourci a changé** → modifier `android/twa-manifest.json`,
  relancer le workflow, déposer le nouveau `.aab`.

## Ce qui n'a pas été vérifié

Le workflow **n'a jamais été exécuté** : l'hôte de développement n'a ni Java, ni SDK Android, ni
Bubblewrap, et un paquet Android ne se fabrique pas sans eux. Sa première exécution est donc aussi
sa première épreuve. Deux points à surveiller ce jour-là :

- `bubblewrap update` doit savoir régénérer le projet à partir du seul `twa-manifest.json`, dans un
  dossier qui ne contient rien d'autre. C'est ce que documente la commande, ce n'est pas mesuré ici.
- Bubblewrap peut demander à télécharger un JDK et le SDK Android s'il ne trouve pas ceux du
  runner ; `~/.bubblewrap/config.json` est écrit pour l'en dispenser, et un job qui reste bloqué
  sans rien afficher est le signe que ce fichier ne lui convient pas.

En revanche, ce qui est éprouvé sans attendre : la composition du fichier `assetlinks.json`
(`apps/app1/test/unit/utils/liens-application-android.test.ts`), parce que c'est la seule pièce dont
une erreur ne se voit qu'une fois l'application installée sur un téléphone.
