# Favicons et icônes d'application

App1 (Juggling Convention) et app2 (Flowvent) produisent leurs icônes **avec le même générateur**,
et les déclarent de la même façon.

## Générer

Depuis le dossier de l'app :

```bash
cd apps/app1 && npm run favicons   # tsx scripts/generate-favicons.ts
cd apps/app2 && npm run favicons   # node scripts/generate-favicons.mjs
```

À lancer **sur l'hôte**, pas dans le conteneur de dev : celui-ci n'a pas forcément `sharp`, son
`package-lock.json` n'étant pas monté. Après une régénération, incrémenter le `?v=` des liens dans
`nuxt.config.ts` et la `iconVersion` du manifeste : Cloudflare garde les fichiers publics 4 h.

## Organisation

- `scripts/favicons/generer-favicons.mjs` (racine du dépôt) : le générateur commun. Il reçoit
  `sharp` et `png-to-ico` en paramètres, parce que la racine n'a pas de `node_modules`.
- `apps/<app>/scripts/generate-favicons.*` : la configuration de chaque app, et rien d'autre.

| Réglage               | App1                                                           | App2                               |
| --------------------- | -------------------------------------------------------------- | ---------------------------------- |
| Logo source           | `public/logos/logo-jc.svg`                                     | `app/assets/flowvent_v2_logo.svg`  |
| Recoloration          | `rgb(5,12,10)` → blanc                                         | `#000000` → blanc                  |
| Fond                  | bleu nuit `rgb(15,23,43)`                                      | graphite stone-900 `rgb(28,25,23)` |
| Échelle du logo       | 1 (bord à bord)                                                | 0,8 (logo non carré, contenu)      |
| Icône `maskable`      | **non régénérée** (faite à la main, publiée sur le Play Store) | générée, échelle 0,6               |
| Badge de notification | oui                                                            | non                                |

## Fichiers produits (dans `public/`)

- `favicons/favicon-{16…512}x….png`, `favicons/favicon.png`
- `favicons/android-chrome-192x192.png`, `android-chrome-512x512.png`, `apple-touch-icon.png`
- `favicons/android-chrome-maskable-512x512.png` (si configuré)
- `favicons/notification-badge.png` (si configuré)
- `favicon.ico` (16, 32, 48 px)

## Déclaration dans les pages

Dans `app.head.link` de `nuxt.config.ts` : une icône SVG, les PNG 32 et 192 px, l'icône Apple
180 px, le manifeste et l'ICO en repli.

Le manifeste est **dynamique** : `server/api/site.webmanifest.get.ts`. Son nom et sa couleur changent
selon l'environnement (DEV rouge, TEST orange), pour qu'une application installée depuis dev ou
release ne se confonde pas avec la prod.

App2 a une icône SVG propre, `public/favicon.svg`, dont les ailes passent en blanc en mode sombre.
App1 sert directement son logo.

## Refactor neutre pour app1

Le passage au générateur commun a été vérifié en régénérant les icônes d'app1 et en les comparant
aux fichiers commités : **aucun pixel différent**, `favicon.ico` identique à l'octet près. Six PNG
diffèrent seulement par leur encodage ; on garde ceux qui sont commités.
