# L'application Android (TWA)

Ce dossier ne contient **pas** un projet Android. Il contient sa _recette_ : `twa-manifest.json`.

Le projet Android lui-même — `build.gradle`, `AndroidManifest.xml`, ressources, icônes — est
régénéré à chaque fabrication par Bubblewrap, dans la CI, à partir de ce seul fichier. C'est
délibéré : un projet Android versionné ici se serait mis à diverger de la PWA sans que rien ne le
signale, et l'on aurait fini par corriger une couleur ou une icône à deux endroits.

## Ce qu'est un TWA, en une phrase

Une **Trusted Web Activity** est une coquille Android qui ouvre le site en plein écran, sans barre
d'adresse, dans le moteur de Chrome déjà installé sur le téléphone. Il n'y a pas de code applicatif
dedans : ce qui s'exécute est le site, tel qu'il est en production, à l'instant où l'utilisateur
ouvre l'application. **Publier une nouvelle version du site met donc à jour l'application, sans
passer par le Play Store.**

On ne refabrique le paquet Android que pour changer ce que la coquille elle-même porte : le nom,
les couleurs, les icônes, la version, les raccourcis.

## ⚠️ Ce qui décide que ça marche : `assetlinks.json`

Sans le fichier `/.well-known/assetlinks.json` servi par le site, et portant l'empreinte **exacte**
de la clé qui signe l'application, Android affiche la barre d'adresse de Chrome au-dessus de
l'application. Aucune erreur, aucun journal : juste une barre d'adresse — et un refus à l'examen du
Play Store, une application qui ressemble à un navigateur déguisé n'y étant pas admise.

Ce fichier est servi par `apps/app1/server/routes/.well-known/assetlinks.json.get.ts`, à partir de
la variable d'environnement `ANDROID_SIGNING_FINGERPRINTS`.

**L'empreinte à y mettre est celle de Google, pas la vôtre.** Avec « Play App Signing », la clé qui
signe réellement l'application livrée aux utilisateurs est détenue par Google ; la clé d'envoi ne
sert qu'à déposer le paquet. L'empreinte se relève dans la console Play, sous _Intégrité de
l'application › Signature d'application_, **après le premier envoi**.

## Comment fabriquer un paquet

Le workflow `.github/workflows/publier-android.yml`, déclenché à la main. Il produit un `.aab` en
artefact de la CI, à déposer ensuite dans la console Play. Il ne publie rien tout seul.

La marche à suivre complète — création de la clé, secrets GitHub, premier envoi, relevé de
l'empreinte — est dans [`docs/publication-play-store-twa.md`](../docs/publication-play-store-twa.md).

## Le numéro de version

`appVersionCode` doit **augmenter** à chaque dépôt sur le Play Store, sans quoi la console refuse le
paquet. Le workflow l'écrase par le numéro de son propre run, qui est monotone : la valeur inscrite
dans `twa-manifest.json` n'est donc qu'un point de départ, et la modifier à la main ne sert à rien.
