# Flowvent : porter les modules d'app1

Plan vivant du chantier ouvert le 25/11/2026 : ajouter à Flowvent (app2) les modules **Artistes et
spectacles**, **Appel à spectacles**, **Repas**, **Billetterie**, **Trésorerie** et **Stock et
prêts**, plus la **carte du site** et l'**envoi des courriels**, qui en sont les préalables.

Modèle de portage : celui des bénévoles (cf. [flowvent-benevoles.md](flowvent-benevoles.md)). Le
code du module vit dans un layer partagé (`layers/<module>/`), et chaque application lui fournit
un **contrat d'hôte** : droits, store d'édition, ports.

## Décisions de l'utilisateur

- **Courriels** : un vrai envoi dans Flowvent (lot 0), plutôt que des messages simulés.
- **Appel à spectacles** : sans messagerie pour l'instant.
- **Billetterie** : HelloAsso seulement (ni SumUp ni Infomaniak).
- **Carte du site** : portée elle aussi, pour que le stock et les spectacles gardent leur emplacement.
- **Droits** : un droit par domaine, et le propriétaire de l'événement a tout. **Modules** : un
  interrupteur chacun, et désactiver ne supprime rien.

## File

| Lot | Contenu                                                                     | État         |
| --- | --------------------------------------------------------------------------- | ------------ |
| 0   | Courriels : transport commun (`layers/core/server/socle/envoi-courriel.ts`) | livré (#956) |
| 1   | Socle des modules : catalogue, droits, activation, pages, fichiers          | en cours     |
| 2   | Carte du site (zones, repères, import)                                      | à faire      |
| 3   | Stock et prêts                                                              | à faire      |
| 4   | Artistes et spectacles                                                      | à faire      |
| 5   | Appel à spectacles (sans messagerie)                                        | à faire      |
| 6   | Billetterie (HelloAsso)                                                     | à faire      |
| 7   | Repas                                                                       | à faire      |
| 8   | Trésorerie                                                                  | à faire      |

## Le socle (lot 1) : ce qu'un module doit faire pour exister dans Flowvent

**Un seul catalogue**, `apps/app2/shared/modules-evenement.ts` : chaque module (`MODULES_EVENEMENT`)
et chaque droit par domaine (`DROITS_PAR_DOMAINE`) y figure avec sa colonne Prisma, son libellé et
son icône. L'API (droits, activation, organisateurs) et les écrans (accueil de la gestion,
organisateurs) le lisent. Rien n'est à recopier ailleurs.

Les colonnes existent déjà pour tous les modules (`Event.*Enabled`, `EditionOrganizer.can*`, mêmes
noms qu'app1). Un module **pas encore porté** a `disponible: false` :

- ni son interrupteur ni son droit n'apparaissent dans les écrans ;
- l'API refuse de l'activer (400) et ignore son droit à l'enregistrement ;
- le contrat de droits (`server/utils/permissions/edition-permissions.ts`) répond **non**. Sans
  cela, les routes de repas du layer bénévoles, déjà chargées, viseraient des tables absentes.

Pour porter un module, dans cet ordre :

1. **Schéma** : ses modèles dans `apps/app2/prisma/schema.prisma` (relations vers `Event`), et une
   migration écrite à la main puis vérifiée par `prisma migrate diff` (diff vide).
2. **Layer** : l'ajouter à `extends` dans `apps/app2/nuxt.config.ts`, au `COPY` du `Dockerfile`
   et aux volumes de `docker-compose.dev.yml`. Les paquets qu'il importe vont dans
   `apps/app2/package.json`, car le build de Flowvent ne voit pas les `node_modules` d'app1.
3. **Contrat d'hôte** : ce que ses fichiers importent par `#server/utils/…` doit exister dans
   app2. Les fonctions de droits (`canManageStock`, `canManageArtistsById`…) y sont déjà.
4. **Pages** : rien à faire. `pages:extend` monte toute page de layer de `/editions/:id/…` sous
   `/events/:id/…`, avec le middleware d'abonnement pour la gestion.
5. **Fichiers déposés** : déclarer son domaine dans `apps/app2/server/routes/uploads/[...path].get.ts`
   (motif, formats, règle de lecture). Un chemin non déclaré répond 404.
6. **Barre latérale** : ses entrées dans `apps/app2/app/layouts/edition-dashboard.vue`.
7. **Catalogue** : passer `disponible: true`.

Garde : `apps/app1/test/unit/outillage/flowvent-modules-evenement.test.ts` vérifie que chaque
colonne du catalogue existe dans le schéma de Flowvent.

## Notions « convention » à ramener à l'événement

Flowvent n'a pas de convention : l'événement en tient lieu (`getEditionWithPermissions` rend
`convention: { id: <id de l'événement>, … }`). À traiter dans les lots concernés :

- `TreasuryCode.conventionId` (trésorerie) ;
- la comparaison entre éditions (billetterie) ;
- l'annuaire public `/shows-call/open` (appel à spectacles) ;
- les chemins de dépôt `conventions/<cid>/editions/<eid>/…`.
