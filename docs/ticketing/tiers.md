# Les tarifs

Un tarif, c'est ce qu'on achète : un nom, un prix, une période de validité, et tout ce qui en
découle — des quotas occupés, des articles à remettre, des repas, des champs personnalisés à
renseigner, des options proposées.

Un tarif vient de deux endroits : **saisi ici**, ou **importé d'une billetterie externe**. La
différence tient à une seule colonne, et elle n'est pas celle qu'on croit.

## Le modèle

```prisma
model TicketingTier {
  id                  Int
  editionId           Int       // toujours renseigné
  externalTicketingId String?   // nul si le tarif est manuel
  helloAssoTierId     Int?      // nul si le tarif est manuel
  name                String
  customName          String?   // prioritaire sur `name` à l'affichage
  description         String?
  price               Int       // en CENTIMES
  minAmount           Int?      // tarifs libres
  maxAmount           Int?
  isActive            Boolean   @default(true)
  position            Int       @default(0)
  countAsParticipant  Boolean   @default(true)
  validFrom           DateTime?
  validUntil          DateTime?

  @@unique([externalTicketingId, helloAssoTierId])
}
```

### `customName` : renommer sans casser la synchronisation

`name` porte le libellé du fournisseur et la synchronisation le réécrit à chaque passage.
`customName` est le nom qu'on choisit ici, et il survit. `applyCustomName` (dans
`server/utils/editions/ticketing/tiers.ts`) rabat simplement l'un sur l'autre à la lecture :

```ts
name: tier.customName || tier.name
```

Les écrans ne voient donc qu'un `name`. Le rapprochement avec la billetterie externe, lui,
continue de se faire sur `helloAssoTierId`.

### `countAsParticipant` : ce qui est une entrée, et ce qui est autre chose

Vrai par défaut. À faux pour ce qui se vend sans être une venue — un tee-shirt, une adhésion, un
don. Ce drapeau sépare les deux séries des statistiques de validation.

⚠️ Il vit sur le **tarif**. Un billet sans tarif n'est donc ni « participant » ni « autre » — voir
plus bas.

### `validFrom` / `validUntil` : une disponibilité, pas une activation

`isActive` est un interrupteur manuel. Les deux dates sont une fenêtre, évaluée **à la lecture** par
`tiers/available.get` et non par une tâche de fond : un tarif hors fenêtre existe toujours, il n'est
simplement plus proposé. Le paramètre `?showAll=true` le rend quand même.

### L'unicité, et ce qu'elle ne couvre pas

`@@unique([externalTicketingId, helloAssoTierId])` empêche d'importer deux fois le même tarif
fournisseur. Sous MySQL, deux `NULL` étant distincts, elle n'entrave pas les tarifs manuels.

**Rien n'impose que deux tarifs d'une même édition portent des noms différents** — contrairement aux
articles à remettre, qui ont reçu cette contrainte.

## Ce qu'un tarif porte

| Table                                 | Ce qu'elle attache            |
| ------------------------------------- | ----------------------------- |
| `TicketingTierQuota`                  | les quotas occupés            |
| `TicketingTierHandoutItem`            | les articles à remettre, avec quantité |
| `TicketingTierMeal`                   | les repas ouverts             |
| `TicketingTierOption`                 | les options proposées         |
| `TicketingTierCustomFieldAssociation` | les champs personnalisés demandés |
| `TicketingOrderItem`                  | les billets vendus            |

## Supprimer un tarif

Deux chemins, et ils n'ont pas les mêmes gardes.

**À la main** (`DELETE …/tiers/:tierId`) : refusé avec un **403** si le tarif vient de HelloAsso
(`helloAssoTierId` non nul). Un tarif synchronisé ne se supprime pas ici, il se supprime chez le
fournisseur.

**Par la synchronisation** (`POST …/helloasso/tiers`) : les tarifs absents de la réponse sont
supprimés. `decisionSuppression` écarte la suppression quand la réponse ne contient **aucun** tarif —
une réponse vraisemblablement incomplète. Aucun seuil de proportion au-delà : passer de dix tarifs à
deux est un geste d'organisateur banal.

> ⚠️ **Dans les deux cas, les billets déjà vendus survivent — détachés.** La clé étrangère
> `TicketingOrderItem.tierId` est en `ON DELETE SET NULL`. Le billet perd alors ses quotas, ses
> articles à remettre, ses repas, ses champs personnalisés et son `countAsParticipant`, et
> **disparaît des statistiques de validation par tarif** sans que rien ne le signale. Sur une copie
> des données de production, 47 lignes sont déjà dans cet état — dont 35 billets importés qu'aucun
> tarif n'a rapprochés.

## Le rapprochement à l'import

Pour chaque ligne de commande reçue, la synchronisation cherche son tarif dans cet ordre :

1. `item.tierId === tier.helloAssoTierId` — l'identifiant du fournisseur ;
2. à défaut, **le nom** : `tier.name === item.name || tier.name === item.priceCategory`.

Le second niveau est un repli par libellé, avec le défaut que cela suppose : renommer un tarif chez
le fournisseur détache les lignes à importer. Les lignes qu'aucun tarif ne rapproche sont créées
avec `tierId: null` et un message dans les journaux.

## Les points d'API

Tous exigent `canManageTicketingById`, sauf mention contraire.

| Route                                      | Rôle                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| `GET    …/ticketing/tiers`                  | liste complète — **admet aussi le guichet**           |
| `GET    …/ticketing/tiers/available`        | ceux dans leur fenêtre de validité (`?showAll=true` pour tous) — **admet aussi le guichet** |
| `GET    …/ticketing/tiers/public`           | **route publique** : tarifs actifs, pour le SEO. Rend 404 si l'édition n'est pas visible publiquement |
| `POST   …/ticketing/tiers`                  | création d'un tarif manuel                            |
| `PUT    …/ticketing/tiers/:tierId`          | modification                                          |
| `DELETE …/ticketing/tiers/:tierId`          | suppression — 403 sur un tarif HelloAsso              |
| `PUT    …/ticketing/tiers/reorder`          | ordre d'affichage                                     |
| `PUT    …/ticketing/tiers/:tierId/quotas`   | remplace les quotas du tarif                          |
| `PUT    …/ticketing/tiers/:tierId/handout-items` | remplace les articles du tarif                   |
| `POST   …/ticketing/helloasso/tiers`        | synchronise tarifs, options et champs personnalisés   |

Le corps de création : `name` (obligatoire), `price` en centimes (≥ 0), et en option `customName`,
`description`, `minAmount`, `maxAmount`, `position`, `isActive`, `countAsParticipant`, `validFrom`,
`validUntil`, `handoutItemIds`, `mealIds`.

## Les écrans

- `gestion/ticketing/tiers.vue` — la page, et la synchronisation
- `TicketingTiersList.vue` — la liste, l'ordre, les actions
- `TierModal.vue` — création et modification, 650 lignes : c'est là que se posent quotas, articles,
  repas et champs personnalisés

## Ce que le système ne fait pas

- **Il ne limite pas les ventes.** Le quota d'un tarif compte, il ne refuse pas — voir
  [les quotas](quotas.md).
- **Il ne gère pas de stock par tarif** : `minAmount` / `maxAmount` sont des bornes de *prix* pour
  les tarifs libres, pas des quantités.
- **Il n'historise pas les changements de prix** : un billet porte le montant payé, le tarif porte
  le prix courant, et rien ne relie les deux dans le temps.

## Voir aussi

- [Les options](options.md) · [Les quotas](quotas.md) · [Les articles à remettre](handout-items.md)
- [L'intégration externe](external-integration.md) — ce que la synchronisation écrase
- [Les commandes](orders.md) — ce que devient un tarif une fois vendu
