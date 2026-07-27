# ESLint dans le monorepo

## Le problème résolu

Jusqu'à cette correction, **les onze layers partagés n'étaient lintés nulle part** : ni en local,
ni en CI. Une variable inutilisée déposée dans `layers/tasks/…` faisait sortir `npm run lint`
en code 0.

La cause n'était pas un oubli de configuration. Le module `@nuxt/eslint` génère bien des motifs
couvrant les layers — sa sortie contient les 33 entrées
`../../layers/<nom>/app/{components,layouts,pages}/**`. Mais ces chemins remontent au-dessus
d'`apps/app1`, où vivait `eslint.config.mjs`.

Or ESLint 10 refuse tout fichier situé hors de sa **base path**, et se contente d'émettre un
`warning` par fichier — jamais une erreur, jamais un code de sortie non nul :

```
File ignored because outside of base path
```

D'où le silence complet. Le bloc de la config qui ciblait `layers/*/app/pages/**` n'avait donc
jamais rien matché depuis la migration monorepo.

## La correction

`eslint.config.mjs` vit désormais **à la racine du monorepo**, ce qui place `apps/app1` et
`layers` dans la même base path. Deux ajustements sont nécessaires.

### 1. Réécriture des motifs générés

Les motifs produits par `@nuxt/eslint` restent relatifs à `apps/app1`. La fonction
`rerootPattern()` les réexprime depuis la racine :

| Motif généré                    | Réécrit en                |
| ------------------------------- | ------------------------- |
| `../../layers/faq/app/pages/**` | `layers/faq/app/pages/**` |
| `app/pages/**`                  | `apps/app1/app/pages/**`  |
| `**/*.vue`                      | inchangé (motif global)   |

### 2. Support TypeScript forcé

`@nuxt/eslint-config` active son bloc `@typescript-eslint` via
`isPackageExists('typescript')`, résolu depuis `process.cwd()`. Lancé depuis la racine — qui n'a
pas de `node_modules` — il ne trouve rien et **supprime tout le bloc** : la configuration passe
de 15 à 13 objets, le plugin disparaît, et la moindre règle `@typescript-eslint/*` devient une
erreur fatale (`could not find plugin "@typescript-eslint"`).

La config appelle donc `createConfigForNuxt()` avec `features.typescript` forcé à `true`, au lieu
de laisser la détection dépendre du répertoire courant.

## Conséquences pratiques

- **Le lint s'exécute depuis la racine.** Le script d'`apps/app1` fait `cd ../.. && eslint .` :
  npm ayant déjà injecté `apps/app1/node_modules/.bin` dans le `PATH`, le binaire reste résolu.
  Les points d'entrée existants (`npm run lint`, `npm run app1:lint`, le job CI avec son
  `working-directory: apps/app1`) continuent de fonctionner sans modification.
- **Ne pas remettre de `eslint.config.mjs` dans `apps/app1`.** ESLint 10 cherche sa configuration
  en remontant depuis chaque fichier : une config dans `apps/app1` masquerait celle de la racine
  pour tout ce qui s'y trouve, et ferait réapparaître l'erreur de plugin.
- **Docker dev** monte le fichier racine (`../../eslint.config.mjs:/app/eslint.config.mjs`).
  Comme tout montage de fichier unique, il se désolidarise quand l'éditeur réécrit le fichier
  (nouvel inode) : redémarrer le conteneur après avoir modifié la config.
- **Linter depuis l'hôte échoue** (`EACCES` sur `.nuxt/eslint-typegen.d.ts`) : `.nuxt` est
  bind-monté et appartient à root. Lancer le lint dans le conteneur.

## Couverture obtenue

|                   | Avant | Après    |
| ----------------- | ----- | -------- |
| Fichiers analysés | 1010  | **1398** |
| dont `layers/`    | 0     | **387**  |

La reprise du lint sur les 387 fichiers de layers n'a révélé qu'**une seule erreur** (une variable
`toast` inutilisée dans `layers/auth/app/pages/auth/invitation.vue`) et un avertissement
`vue/no-v-html` préexistant sur le rendu Markdown de la FAQ.
