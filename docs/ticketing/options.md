# Les options

Une option est ce qu'on ajoute à un billet : un repas du samedi, un tee-shirt, un emplacement de
camping, une question à laquelle répondre. Elle peut avoir un prix, ouvrir des repas, déclencher la
remise d'un article et occuper un quota.

## Le modèle

```prisma
model TicketingOption {
  id                  Int
  editionId           Int
  externalTicketingId String?  // ⚠️ voir ci-dessous
  helloAssoOptionId   String?  // nul ⇒ option saisie ici
  name                String
  description         String?
  type                String   // TextInput, CheckBox, ChoiceList…
  isRequired          Boolean  @default(false)
  choices             Json?    // les valeurs possibles d'une liste
  price               Int?     // en centimes, nul si gratuite
  position            Int      @default(0)

  @@unique([externalTicketingId, helloAssoOptionId])
}
```

### ⚠️ `externalTicketingId` ne dit pas d'où vient l'option

C'est le piège de ce modèle, et il diverge du tarif. `createOption` **exige** une configuration de
billetterie externe et y rattache l'option, **même quand elle est saisie à la main** :

```ts
if (!externalTicketing) {
  throw createError({ status: 400, message: 'Aucune configuration de billeterie externe trouvée' })
}
```

Deux conséquences :

1. **`externalTicketingId` est toujours renseigné.** Ce qui distingue une option importée d'une
   option manuelle, c'est `helloAssoOptionId` — nul pour une saisie locale. Le tarif, lui, laisse
   bien son `externalTicketingId` nul quand il est manuel.
2. **Une édition sans billetterie externe ne peut créer aucune option**, et reçoit un 400 — alors
   qu'elle peut créer des tarifs et vendre au guichet.

## Ce qu'une option porte

| Table                        | Ce qu'elle attache                          |
| ---------------------------- | ------------------------------------------- |
| `TicketingTierOption`        | les tarifs qui la proposent                 |
| `TicketingOptionQuota`       | les quotas qu'elle fait occuper             |
| `TicketingOptionHandoutItem` | les articles à remettre, avec quantité      |
| `TicketingOptionMeal`        | les repas qu'elle ouvre                     |
| `TicketingOrderItemOption`   | ce que chaque billet a réellement pris      |

## Ce qu'un participant a pris

`TicketingOrderItemOption` porte le lien billet ↔ option, le montant payé, et les réponses aux
champs de l'option.

```prisma
model TicketingOrderItemOption {
  orderItemId  Int
  optionId     Int
  amount       Int  @default(0)   // en centimes
  customFields Json?
  @@unique([orderItemId, optionId])
}
```

**C'est la seule source de vérité sur les options prises.** Elles ne sont **jamais** dans
l'instantané JSON du billet : les deux chemins d'écriture les en excluent explicitement. Un calcul
qui les y cherche trouve zéro — c'est exactement ce qui est arrivé au décompte des quotas, qui
comptait zéro option sur 149 réellement vendues.

### Le prix d'une option entre dans le total de la commande

`orderTotal`, dans la synchronisation, additionne les lignes **et leurs options**. Ce n'était pas le
cas : sur une édition, deux cent quatre-vingt-onze euros de bouteilles étaient encaissés sans
apparaître, ni dans le montant affiché de la commande, ni dans la trésorerie.

## Supprimer une option

Une suppression part en cascade sur les cinq tables ci-dessus — **y compris
`TicketingOrderItemOption`**, c'est-à-dire le relevé de ce que chaque participant a acheté. Le
montant de la commande, lui, est stocké et reste : on saurait qu'on a encaissé, plus ce qu'on a
vendu.

> ⚠️ **La synchronisation supprime les options absentes de la réponse, sans garde.** Les tarifs ont
> reçu `decisionSuppression`, qui écarte la suppression quand la réponse est vraisemblablement
> incomplète. Les options n'ont pas d'équivalent : un simple `filter` puis un `deleteMany`. Une
> réponse vide les supprime toutes.

## Le rapprochement à l'import

Pour chaque option reçue sur une ligne de commande, la synchronisation cherche, dans cet ordre :

1. `option.helloAssoOptionId === String(selectedOption.optionId)` ;
2. à défaut, `option.id === selectedOption.optionId` — l'identifiant **local**, pour une option
   saisie ici et proposée chez le fournisseur.

Sans correspondance, un message part dans les journaux et l'option n'est pas enregistrée.

Si l'option trouvée porte des repas (`TicketingOptionMeal`), les accès repas correspondants sont
créés pour ce billet. **Ils ne sont jamais retirés** : une option retirée d'une commande en amont
laisse ses accès repas en place.

## Les points d'API

Tous exigent `canManageTicketingById`, sauf mention contraire.

| Route                                             | Rôle                                        |
| ------------------------------------------------- | ------------------------------------------- |
| `GET    …/ticketing/options`                       | liste — **admet aussi le guichet**          |
| `POST   …/ticketing/options`                       | création (400 sans billetterie externe)     |
| `PUT    …/ticketing/options/:optionId`             | modification                                |
| `DELETE …/ticketing/options/:optionId`             | suppression, en cascade                     |
| `PUT    …/ticketing/options/:optionId/quotas`      | remplace les quotas de l'option             |
| `PUT    …/ticketing/options/:optionId/handout-items` | remplace les articles de l'option         |

Le corps de création : `name` et `type` (obligatoires), puis `description`, `isRequired`, `choices`,
`price` en centimes, `position`, `handoutItemIds`, `tierIds`, `mealIds`.

## Les écrans

- `OptionsList.vue` — la liste et les actions
- `OptionModal.vue` — création et modification, avec les tarifs qui la proposent
- `ManageOptionHandoutItemsModal.vue` — les articles à remettre, via la coquille commune
  `TicketingHandoutItemsModal`

## Ce que le système ne fait pas

- **Il ne limite pas les ventes d'une option.** Le quota compte, il ne refuse pas.
- **Il ne retire pas** un accès repas créé par une option qui a disparu de la commande.
- **Il n'impose pas de nom unique** par édition.
- **Il ne valide pas `choices` contre `type`** : une option `ChoiceList` sans choix est acceptée.

## Voir aussi

- [Les tarifs](tiers.md) — qui propose quelles options
- [Les quotas](quotas.md) — comment une option fait occuper une place
- [Les articles à remettre](handout-items.md) · [Les commandes](orders.md)
- [L'intégration externe](external-integration.md) — ce que la synchronisation supprime
