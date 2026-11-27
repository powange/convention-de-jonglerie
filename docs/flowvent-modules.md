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

| Lot | Contenu                                                                     | État           |
| --- | --------------------------------------------------------------------------- | -------------- |
| 0   | Courriels : transport commun (`layers/core/server/socle/envoi-courriel.ts`) | livré (#956)   |
| 1   | Socle des modules : catalogue, droits, activation, pages, fichiers          | livré (#957)   |
| 2   | Carte du site (zones, repères, import)                                      | livré (#959)   |
| 3   | Stock et prêts                                                              | livré (#964)   |
| 4   | Artistes et spectacles                                                      | livré (#970)   |
| 5   | Appel à spectacles (sans messagerie)                                        | livré (#971)   |
| 6   | Billetterie (HelloAsso)                                                     | livré (#981)   |
| 7   | Repas                                                                       | livré (#982)   |
| 8   | Trésorerie                                                                  | livré (ce lot) |

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

## La carte du site (lot 2)

Sortie d'app1 dans `layers/map` (alias `#map`), qu'étendent app1 et Flowvent : zones, repères,
import Google My Maps, page de gestion et d'import, traductions `map` / `gestion-map`. Le stock,
les ateliers et le covoiturage d'app1 l'importent désormais par `#map/…`.

- **Port** `#server/map/ports/registry` (type : `layers/map/server/ports/types.ts`) : lire les
  drapeaux de la carte, enregistrer sa visibilité et la carte externe. App1 écrit sur l'édition,
  Flowvent sur l'événement — seuls endroits où les deux diffèrent.
- `useEditionId()` est passé de `layers/volunteers` à `layers/core` : tout layer d'événement en a
  besoin (un `parseInt(route.params.id)` rend `NaN` dans Flowvent). Garde :
  `layer-benevoles-id-par-useeditionid.test.ts`, étendue à la carte.
- `fetch-helpers` est passé dans `layers/core/server/socle/` (réexporté par chaque app).
- Restent dans app1 : la page PUBLIQUE de la carte (`/editions/:id/map`, liée au programme) et
  l'export KML.

## Stock et prêts (lot 3)

Le layer `stock` existait déjà ; ce qui le rattachait encore à app1 est parti dans les layers :

- utilitaires du stock (`stock-helpers`, quantités, étiquettes, prêts, modification par lot) →
  `layers/stock/server/utils` (alias `#stock`) ;
- traductions `gestion.stock` sorties de `gestion.json` → `layers/stock/i18n/locales/*/gestion-stock.json`,
  chargées par app1 partout où `gestion` l'est (menu et accueil de la gestion en affichent) ;
- composants et utilitaires d'interface qu'il empruntait à app1 → `layers/ui` (`UserSelector`,
  `UiDateField`, `useSaisieTemporisee`, `useSaisieNonEnregistree`, `colonnes-a-exporter`) et
  `layers/core/shared/utils` (`recherche-texte`, `recherche-responsable`).

Contrat d'hôte propre à Flowvent : `personnes-edition` (qui peut être responsable d'un article :
propriétaire, organisateurs, bénévoles acceptés), `personSearchRateLimiter`,
`userWithNameAndAvatarSelect`, `permissions/types`. L'accès au stock suit app1 : le droit dédié,
ou responsable d'une équipe de bénévoles.

⚠️ Un layer ne doit pas compter sur les auto-imports de VueUse : app1 a `@vueuse/nuxt`, pas
Flowvent (`useNow` y valait `undefined`, page en 500). Importer depuis `@vueuse/core`.

## Artistes et spectacles (lot 4)

Le code des spectacles vivait dans app1 (API, modèles de spectacle du profil, dépôts de fichiers,
composants) : il rejoint `layers/artists` (alias `#artists`), avec ses utilitaires propres
(suppression d'un artiste, reste à verser, présence, représentations, numéros, sélections et
schéma des spectacles, type d'hébergement). Les traductions `artists.json` et `gestion.artists` /
`gestion.shows` passent dans le layer. Partagés par plusieurs modules → `layers/core` (montants,
coordonnées bancaires, nom affichable, phases de l'édition, validation générique, justificatifs,
repas, sélection d'articles) ou `layers/ui` / `layers/map` (`UiMoneyInput`, `EditionLocationPicker`).

Les points qui chargeaient l'édition d'app1 eux-mêmes (`prisma.edition` + convention) passent
par `getEditionWithPermissions`, que les deux apps fournissent.

**Tables dormantes** : la fiche d'un artiste et ses requêtes incluent les articles remis
(billetterie) et les repas. Plutôt que de réordonner la file, leurs tables sont créées vides dans
Flowvent (`TicketingHandoutItem`, `ArtistHandoutItem`, `ShowHandoutItem`, `VolunteerMeal`,
`ArtistMealSelection`) ; leurs écrans restent cachés (modules inactifs, aucun droit), et
`handout-items-actifs` y répond « non ». Les lots 6 et 7 les rendront vivantes.

Propre à Flowvent : port artistes (texte d'accueil sur `Event.artistInfo`, aucun repas), messagerie
neutre (`syncShowGroupParticipants`, `ShowApplicationChat` vide — pas de messagerie, décision de
l'utilisateur), un artiste compte comme « impliqué » pour atteindre son espace sur un événement non
public, et deux domaines de fichiers : visuels de spectacle (publics) et justificatifs d'artiste
(qui gère les artistes, ou l'artiste lui-même).

## Appel à spectacles (lot 5)

API, pages de gestion et publiques, annuaire des appels ouverts (`/shows-call/open`) et sondage par
jeton rejoignent `layers/artists`, avec les traductions `shows-call`, `gestion-shows-call`,
`survey` et `gestion.shows_call` (dans `gestion-artists`). Restent dans app1 les deux points de la
conversation d'une candidature : c'est la messagerie, que Flowvent n'a pas (décision).

Le port artistes gagne `lireEdition` (statut, dates, nom affiché) et une sélection d'affichage
propre à chaque app (`selectionEditionAffichee` + `editionAffichee`) : l'édition d'app1 a ville,
pays, image et convention, l'événement de Flowvent non — le lieu y tient lieu de ville, et
l'événement de convention. Dans Flowvent, la relation d'un appel vers l'événement garde le nom
`edition`, et une table `Conversation` DORMANTE (réduite à ses liens) répond aux requêtes qui
comptent les non-lus. Un appel en ligne ouvre l'événement aux visiteurs (sa page se partage).

## Billetterie (lot 6)

Les points d'API restés dans app1 (contrôle d'accès, guichet, statistiques, articles des
bénévoles, artistes et organisateurs) et ses utilitaires rejoignent `layers/ticketing` (alias
`#ticketing`), avec les traductions `ticketing` et `gestion.ticketing`. Les utilitaires SERVEUR y
gardent leur adresse `#server/utils/…` par une réexportation dans chaque app — les tests les
simulent à cette adresse. `encryption`, `sse-manager`, `recherche-mots-cles` et le verrou
`synchronisation-unique` passent dans `core`.

Le port billetterie (types dans le layer) gagne `lireEdition` (statut, fuseau, dates, articles
remis activés) et `editionsComparables` (même convention dans app1, autres événements du même
propriétaire dans Flowvent). La validation d'une entrée d'artiste prévient les responsables des
artistes par le contrat `organisateursHabilitesSurLesArtistes` (lot 5).

**HelloAsso seul dans Flowvent** : `app.config` du layer, `billetterie.infomaniak` et
`billetterie.sumup` à `false` dans Flowvent (sections cachées), logo d'un billet vendu sur place
configurable. Flowvent reçoit les réglages `ticketing*` sur `Event` (mêmes noms et défauts qu'app1),
le journal des erreurs serveur (`ApiErrorLog`, où la billetterie signale ses échecs), et les tables
de liaison aux repas, DORMANTES jusqu'au lot 7.

## Repas (lot 7)

Les points d'API repas restés dans app1 (mes repas, droit à la validation), les ports repas, le
service des repas des bénévoles (`server/meals/meals-service.ts` et ses types), le droit au repas
et la validation au comptoir rejoignent `layers/meals` (alias `#meals`), avec les traductions
`gestion.meals` (`gestion-meals.json`). Les utilitaires serveur gardent leur adresse
`#server/utils/…` et `#server/meals/…` par réexportation dans chaque app.

L'implémentation des ports est COMMUNE aux deux apps, qui ont les mêmes modèles pour ce qu'elle
lit : `createDefaultMealsPorts` (le port repas lui-même) et `portsBenevolesDesRepas` (les sections
`meals`, `artists` et `ticketing` du port bénévoles, que chaque app étale dans son registre). Dans
Flowvent, ces trois sections étaient neutres : elles deviennent réelles — un bénévole accepté y
reçoit ses repas, et la liste des candidatures les montre. Le port artistes de Flowvent lit aussi
le vrai catalogue des repas (`getEnabledMeals`).

Flowvent reçoit la section « Repas » de la barre latérale (configuration, liste et doublons au droit
`repas` ; validation ouverte aussi au responsable de l'équipe qui valide et au bénévole en
créneau), le droit `canManageMealsOrValidation` complet, et le module devient disponible. La table
`VolunteerMeal` y perd une colonne `eventId` inventée (vide) et gagne sa vraie relation à
l'événement.

Restent propres à app1 : les repas des **organisateurs** (pas d'organisateurs déclarés dans
Flowvent).

## Trésorerie (lot 8)

La trésorerie n'était pas encore un layer : elle devient `layers/treasury` (alias `#treasury`) —
pages, composants, utilitaires de l'interface (`etats-de-tresorerie`, exports, codes, plans
comptables), utilitaires partagés (`avance-nom-libre`, `fonds-de-caisse`), points d'API (dont le
dépôt des justificatifs `/api/files/treasury`) et utilitaires serveur, ceux-ci gardant leur adresse
`#server/utils/treasury-*` par réexportation. Traductions `gestion.treasury` → `gestion-treasury.json`.

Ce qui appartient à l'app hôte passe par le port `#server/treasury/ports/registry` :

- `edition.lire` : l'identifiant, la devise, le comptage du fonds de caisse, et `conventionId` — le
  PORTEUR DU PLAN COMPTABLE. La convention dans app1, où un plan se réutilise d'une année sur
  l'autre ; l'événement lui-même dans Flowvent. C'est aussi lui qui range les justificatifs.
- `edition.enregistrerComptageDuFonds`.
- `organisateurs` : qui compte comme organisateur dans le périmètre des avances (cf.
  `clausesDesPersonnesRattachees`, dont la clause des organisateurs est sortie). Organisateurs de la
  convention dans app1 ; propriétaire et organisateurs déclarés de l'événement dans Flowvent.

Flowvent reçoit les modèles de la trésorerie (mêmes noms, `editionId` et `TreasuryCode.conventionId`
rattachés à l'événement, migration purement additive), le comptage du fonds de caisse sur `Event`,
le domaine protégé des justificatifs (`/uploads/…/treasury/…`, lisibles par qui gère la
trésorerie), la section « Trésorerie » de la barre latérale, et le module devient disponible.

## FAQ (27/11/2026)

Le layer `faq` existait déjà (pages publique et de gestion, API) ; il est branché dans Flowvent.

- **Catalogue** : module `faq` (`Event.faqEnabled`), relevant du droit « modifier l'événement »
  comme la carte (`canManageFAQ` = `modifier`, côté serveur et dans le store) — pas de droit à
  part. `Event.faqPagePublic` rend sa page publique visible des visiteurs.
- **Ports** : leur type est passé dans le layer (`#faq/server/ports/types`, alias déclaré par
  `layers/faq/nuxt.config.ts`) ; chaque app câble `#server/faq/ports/registry`. Nouveau port
  `setFaqPagePublic`, appelé par `PUT /api/editions/:id/faq/visibility` (point du layer) : la page
  de gestion appelait la mise à jour générale de l'édition, propre à app1.
- **Contrat d'hôte** : `aAccesGestionEdition` (`server/utils/permissions/acces-gestion-edition.ts`,
  « voir l'événement ») ; `getEditionWithPermissions` accepte un visiteur sans identifiant.
- **Utilitaires partagés** : `highlight.ts` passé d'app1 à `layers/ui/app/utils/`,
  `html-to-text.ts` à `layers/core/shared/utils/` (`#core/shared/utils/html-to-text`).
- **Pages** : `useEditionId()` au lieu de `parseInt(route.params.id)` (garde étendue au layer).
- **Libellés** : les 27 clés empruntées à app1 sont dans `apps/app2/i18n/locales/benevoles.json`.

## Notions « convention » à ramener à l'événement

Flowvent n'a pas de convention : l'événement en tient lieu (`getEditionWithPermissions` rend
`convention: { id: <id de l'événement>, … }`). À traiter dans les lots concernés :

- `TreasuryCode.conventionId` (trésorerie) ;
- la comparaison entre éditions (billetterie) ;
- l'annuaire public `/shows-call/open` (appel à spectacles) ;
- les chemins de dépôt `conventions/<cid>/editions/<eid>/…`.
