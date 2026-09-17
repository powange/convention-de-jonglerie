# Les quotas

Un quota répond à une seule question : **combien de personnes sont concernées par tel ensemble de
conditions ?** « Places totales », « repas végétariens », « t-shirts taille M ».

> ⚠️ **Un quota ne plafonne rien.** Il compte, il affiche, il ne refuse jamais. Aucune écriture du
> projet ne consulte un quota avant d'accepter : on peut vendre le cent unième billet d'un quota de
> cent, et ajouter un participant au guichet alors que la jauge est à 140 %. C'est un **indicateur**,
> au même titre que le maximum d'une équipe de bénévoles. Cette page dit ce que le code fait ; si le
> comportement doit changer, c'est une décision, pas une correction.

## Le quota lui-même

```prisma
model TicketingQuota {
  id          Int
  editionId   Int
  title       String
  description String?
  quantity    Int      // le repère, pas une limite
  position    Int      @default(0)
}
```

`quantity` est validé `> 0` à la création. Rien n'impose que deux quotas d'une même édition portent
des titres différents.

## Les sept façons d'occuper une place

Un quota se remplit par sept tables de liaison, et elles ne se ressemblent pas : trois passent par
ce que le participant a **acheté**, quatre par **qui il est**.

| Table                           | Ce qui déclenche l'occupation                   |
| ------------------------------- | ----------------------------------------------- |
| `TicketingTierQuota`            | le tarif du billet                              |
| `TicketingOptionQuota`          | une option prise sur le billet                  |
| `TicketingTierCustomFieldQuota` | une réponse à un champ personnalisé             |
| `EditionOrganizerQuota`         | être organisateur — tous, ou un nommé           |
| `EditionVolunteerQuota`         | être bénévole accepté — tous, ou d'une équipe   |
| `EditionArtistQuota`            | être artiste — tous, ou jouer dans un spectacle |

Les quatre dernières existent parce qu'un organisateur, un bénévole et un artiste sont présents sur
l'événement **sans billet** : rien ne les faisait entrer dans un décompte de places.

### La clé nulle vaut « tout le monde »

`organizerId`, `teamId` et `showId` sont nullables : `NULL` désigne l'ensemble de la population,
une valeur désigne un sous-ensemble.

⚠️ **L'index unique ne protège pas la ligne globale.** Sous MySQL, deux `NULL` sont distincts :
`(edition, quota, NULL)` peut donc être inséré plusieurs fois. C'est l'**écriture** qui l'empêche,
par une sémantique de remplacement complet — `remplacerLesQuotas` efface la portée visée avant de
la réécrire, dans une transaction.

### Une divergence assumée avec les articles à remettre

Les articles d'une équipe **remplacent** les articles globaux. Les quotas, eux, **s'additionnent** —
et un bénévole visé à la fois globalement et par son équipe n'occupe qu'**une** place, jamais deux
ni zéro. La raison est dans le schéma : un article est un colis qu'on reçoit, le remplacer a un
sens ; un quota est une place qu'on occupe, et on l'occupe ou non.

## Le calcul

Tout vit dans `apps/app1/server/utils/editions/ticketing/quota-stats.ts`, et rend par quota :
`currentCount`, `validatedCount`, `percentage`.

### Quels billets comptent

`state ∈ { Processed, Pending }`. Les lignes `Canceled` sont écartées.

⚠️ `Onsite` est un statut de **commande**, jamais un état de ligne : une vente au guichet porte
`status: 'Onsite'` et `state: 'Processed'`. Elle compte donc bien.

### Un billet est une place, quelle que soit la raison

Tarif, option et champ personnalisé versent dans le **même ensemble** d'identifiants de billets. Un
billet retenu par son tarif *et* par une option ne compte qu'une fois. Le dédoublonnage se fait par
`Set`, en mémoire — pas par un `DISTINCT` SQL.

### Les options se lisent dans leur table, pas dans l'instantané du billet

Le rapprochement passe par `TicketingOrderItemOption.optionId`. Il a longtemps cherché les options
dans l'instantané JSON du billet, où elles ne sont **jamais** : un quota posé sur une option comptait
zéro, quel que soit le nombre de billets vendus.

### Les champs personnalisés se rapprochent par identifiant

`reponseDesigneLeChamp` (`server/utils/ticketing/rapprochement-champ.ts`) essaie, dans l'ordre :
l'identifiant interne, puis l'identifiant du fournisseur, puis le libellé en dernier repli. Renommer
un champ ne détache donc pas les billets déjà vendus. La même fonction sert au calcul des articles à
remettre — les deux copies avaient déjà divergé.

`choiceValue` nul signifie « toute réponse non vide » ; renseigné, il vise une réponse précise.

### Les personnes présentes sans billet

Une personne **inscrite** occupe sa place immédiatement, comme un billet compte dès la vente. La
validation de son entrée l'ajoute ensuite à `validatedCount`, sans rien changer à `currentCount`.

Un ensemble **par famille** : les identifiants d'un bénévole, d'un organisateur et d'un artiste sont
des entiers issus de tables différentes, et les mêler ferait disparaître des personnes.

⚠️ **Rien ne rapproche ces personnes d'un billet qu'elles auraient acheté par ailleurs**, ni une même
personne d'une famille à l'autre : elle compte alors deux fois. C'est délibéré — un billet ne porte
qu'une adresse de courriel, jamais un compte, et le rapprochement échouerait en silence dès qu'elle
achèterait sous une autre adresse.

## Les points d'API

Tous exigent `canManageTicketingById`, sauf `stats` qui admet aussi le guichet.

### Le quota

| Route                                | Rôle                                       |
| ------------------------------------ | ------------------------------------------ |
| `GET    …/ticketing/quotas`          | liste                                      |
| `POST   …/ticketing/quotas`          | création (`title`, `description?`, `quantity > 0`) |
| `PUT    …/ticketing/quotas/:id`      | modification                               |
| `DELETE …/ticketing/quotas/:id`      | suppression, en cascade sur les sept liaisons |
| `PUT    …/ticketing/quotas/reorder`  | ordre d'affichage                          |
| `GET    …/ticketing/quotas/stats`    | les jauges — `canAccessEditionDataOrAccessControl` |

### Les associations

Toutes en `PUT`, toutes à **sémantique de remplacement** : le corps porte la liste complète des
quotas de la portée visée, et ce qui n'y est pas est retiré.

| Route                                                  | Portée                     |
| ------------------------------------------------------ | -------------------------- |
| `…/ticketing/tiers/:tierId/quotas`                     | un tarif                   |
| `…/ticketing/options/:optionId/quotas`                 | une option                 |
| `…/ticketing/custom-fields/:customFieldId/quotas`      | un champ personnalisé      |
| `…/ticketing/organizers/quotas`                        | tous les organisateurs     |
| `…/ticketing/organizers/:editionOrganizerId/quotas`    | un organisateur            |
| `…/ticketing/volunteers/quotas`                        | tous les bénévoles acceptés |
| `…/ticketing/volunteers/teams/:teamId/quotas`          | une équipe                 |
| `…/ticketing/artists/quotas`                           | tous les artistes          |
| `…/ticketing/artists/shows/:showId/quotas`             | les artistes d'un spectacle |

Trois `GET` rendent les associations existantes, ligne globale comprise :
`organizers/quotas`, `volunteers/quotas`, `artists/quotas`.

## Les écrans

`gestion/ticketing/quotas.vue` — création, ordre, et les jauges. Les associations se posent depuis
l'écran de l'objet concerné : la modale d'un tarif, celle d'une option, celle d'un champ
personnalisé, et les listes des trois populations.

## Ce que le système ne fait pas

- **Il ne refuse rien.** Voir l'avertissement en tête.
- **Il ne prévient pas** au franchissement d'un seuil : ni courriel, ni pastille.
- **Il ne trace pas** l'historique d'une jauge : on lit l'état à l'instant de la requête, jamais son
  évolution.
- **Il ne rapproche pas** une même personne de ses différents rôles, ni d'un billet qu'elle aurait
  acheté.

## Coût

`getQuotaStats` met environ **245 ms** sur une édition de 13 quotas et 271 billets, contre ~20 ms
sur une édition sans quota (mesuré sur une copie des données de production). L'écran ne l'interroge
pas en boucle : c'est un coût de chargement.

## Voir aussi

- [Les articles à remettre](handout-items.md) — même forme d'associations, règle de portée opposée
- [Les tarifs](tiers.md) · [Les options](options.md) · [Les champs personnalisés](orders.md)
- [Le contrôle d'accès](access-control.md) — d'où vient `validatedCount`
