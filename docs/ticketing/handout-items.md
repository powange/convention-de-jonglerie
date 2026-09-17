# Les articles à remettre

Ce qu'une édition donne aux gens qui se présentent au guichet : un bracelet, un tee-shirt, un
ticket de cantine, un badge. Le système répond à une seule question — **qu'est-ce qui est dû à
cette personne ?** — et il y répond pour quatre populations : les porteurs de billet, les
bénévoles, les artistes et les organisateurs.

> **Ce qu'il ne fait pas.** Il ne trace **pas** ce qui a été réellement remis. La liste du guichet
> est une liste à cocher qui ne survit pas à la fermeture de la modale, et aucune colonne du schéma
> n'enregistre une remise. Deux bénévoles au même poste n'ont donc aucun moyen de savoir ce que
> l'autre a distribué. C'est le manque le plus structurant du module, et il est connu.

## L'article, et son seul réglage

```prisma
model TicketingHandoutItem {
  id         Int      @id @default(autoincrement())
  editionId  Int
  name       String
  cumulative Boolean  @default(false)

  @@unique([editionId, name])
}
```

`cumulative` est le **seul** réglage porté par l'article, et il gouverne tout le calcul :

- **non cumulable** (le défaut) — remis **une seule fois**, quel que soit le nombre d'associations.
  Un bracelet attaché au tarif ET à une option ne fait pas deux bracelets.
- **cumulable** — les quantités **s'additionnent**. Un artiste jouant dans deux spectacles qui
  donnent chacun 3 tickets boisson en reçoit six.

`@@unique([editionId, name])` empêche deux articles de même nom dans une édition : ils seraient
indiscernables au guichet, et l'agrégation se faisant par identifiant, ils ne fusionneraient
jamais. La colonne étant en `utf8mb4_unicode_ci`, **l'unicité ignore la casse et les accents** —
« Bracelet » et « bracelet » sont le même nom.

## Les neuf tables de liaison

Un article ne sert à rien tant qu'il n'est associé à rien. Neuf tables disent à qui il revient.
**Toutes portent une `quantity`** (défaut 1) et un index unique sur (porteur, article).

| Table                                 | Porteur                         | Écrit par                                     |
| ------------------------------------- | ------------------------------- | --------------------------------------------- |
| `TicketingTierHandoutItem`            | un tarif                        | `PUT ticketing/tiers/[tierId]/handout-items`   |
| `TicketingOptionHandoutItem`          | une option                      | `PUT ticketing/options/[optionId]/handout-items` |
| `TicketingTierCustomFieldHandoutItem` | un champ personnalisé           | `PUT ticketing/custom-fields/[id]/handout-items` |
| `ShowHandoutItem`                     | un spectacle                    | `PUT shows/[showId]` (mise à jour complète)    |
| `ArtistHandoutItem`                   | un artiste précis               | `PUT artists/[artistId]/handout-items`         |
| `EditionArtistHandoutItem`            | **tous** les artistes           | `PUT ticketing/artists/handout-items`          |
| `EditionVolunteerHandoutItem`         | tous les bénévoles, ou une équipe | `PUT ticketing/volunteers/handout-items`     |
| `EditionOrganizerHandoutItem`         | tous les organisateurs, ou un seul | `PUT ticketing/organizers/handout-items`    |
| `VolunteerMealHandoutItem`            | un repas                        | `PUT volunteers/meals` (mise à jour complète)  |

`TicketingTierCustomFieldHandoutItem` est la seule à porter une **troisième dimension** :
`choiceValue`. L'article n'est alors dû que si la réponse au champ vaut exactement cette valeur —
`NULL` signifiant « quelle que soit la réponse ». C'est la raison pour laquelle son écran de
configuration est le seul à ne pas partager la coquille commune des modales.

### Deux colonnes nullables, et ce qu'elles ne protègent pas

`EditionVolunteerHandoutItem.teamId` et `EditionOrganizerHandoutItem.organizerId` valent `NULL`
pour dire « tout le monde ».

⚠️ **Sous MySQL, deux `NULL` sont distincts dans un index unique.** `@@unique([editionId,
handoutItemId, teamId])` ne protège donc **pas** la ligne globale : `(édition, article, NULL)`
peut être inséré plusieurs fois, ce qui doublerait la quantité remise à *tous* les bénévoles.

C'est l'**écriture** qui l'empêche, et c'est pour cela que ces points d'API ont une sémantique de
**remplacement complet par portée** plutôt qu'un ajout : il n'y a plus de lecture-puis-écriture
entre lesquelles une seconde requête pourrait se glisser.

### L'exception qui reste

`EditionOrganizerHandoutItem` **ne porte aucune clé étrangère vers l'article** — seulement la
colonne `handoutItemId`. Ses lignes ne partent donc pas en cascade quand l'article est supprimé :
elles survivraient en pointant vers un identifiant disparu, ce que l'écran afficherait « Article
inconnu ». `deleteHandoutItem` les retire **explicitement**, dans la même transaction. La vraie
correction est la relation manquante ; elle demande une migration et n'est pas faite.

## La règle d'agrégation

`aggregateHandoutItems` (`server/utils/ticketing/handout-items.ts`) est **l'unique endroit** où la
règle vit. Les quatre populations y passent.

```ts
// non cumulable : on retient la plus grande quantité définie sur ses associations
// cumulable     : on additionne
```

Une quantité absente, nulle, négative ou fractionnaire vaut **un** exemplaire — on ne remet pas
« zéro bracelet ».

## Ce que reçoit chaque population

### Un porteur de billet

Trois sources se rejoignent : **le tarif acheté**, **les options souscrites**, et **les champs
personnalisés renseignés**.

Deux pièges y sont documentés dans le code, parce qu'ils ont chacun coûté un défaut :

- **Les options ne sont pas dans `orderItem.customFields`.** Les deux chemins d'écriture les en
  excluent et les rangent dans `TicketingOrderItemOption`. Les chercher dans le JSON revient à
  n'en trouver aucune.
- **Un champ personnalisé se rapproche par identifiant, pas par libellé.** L'instantané figé à
  l'achat porte deux identifiants possibles dans des espaces sans rapport : `customFieldId`
  (interne) et `id` (celui du fournisseur). `reponseDesigneLeChamp`
  (`server/utils/ticketing/rapprochement-champ.ts`) tient l'ordre — interne, puis fournisseur,
  puis libellé en dernier repli. Comparer les libellés seuls faisait qu'**une faute de frappe
  corrigée détachait tous les billets déjà vendus**.

### Un bénévole

⚠️ **Les articles d'une équipe REMPLACENT les articles globaux.** Dès qu'un bénévole appartient à
une équipe portant **au moins un** article, il ne reçoit **que** ceux-là. Une équipe sans article
retombe sur le global.

C'est une divergence **assumée** avec les quotas, où les portées s'additionnent : un article est
un colis qu'on reçoit, et le remplacer a un sens ; un quota est une place qu'on occupe. L'écran de
configuration énonce la règle **avant** qu'on la déclenche, et affiche un aperçu de ce que le
bénévole recevra réellement.

S'y ajoutent les articles des **repas** auxquels il est inscrit.

### Un artiste

Trois sources qui **s'additionnent**, sans surcharge : les articles de tous les artistes de
l'édition, ceux de l'artiste précis, ceux de ses spectacles. Plus ses repas.

### Un organisateur

Les articles globaux et ceux de l'organisateur précis, **agrégés en une seule liste**. Plus ses
repas — au même titre que les bénévoles et les artistes.

## Les points d'API

### Les articles eux-mêmes

| Route                                       | Effet                                      |
| ------------------------------------------- | ------------------------------------------ |
| `GET ticketing/handout-items`               | la liste, **avec le décompte d'associations** de chacun |
| `POST ticketing/handout-items`              | création (400 si le nom est déjà pris)     |
| `PUT ticketing/handout-items/[itemId]`      | renommage et bascule de `cumulative`       |
| `DELETE ticketing/handout-items/[itemId]`   | suppression, cascade comprise              |

Le `GET` rend pour chaque article un objet `associations` (tarifs, options, champs personnalisés,
spectacles, artistes, équipes de bénévoles, organisateurs, repas). La confirmation de suppression
l'énonce : on ne défait pas en un clic un paramétrage réparti sur huit écrans sans le savoir.

### Les associations par portée

Les trois populations suivent le même contrat — une lecture, un **remplacement complet d'une
portée** :

```typescript
// Bénévoles : teamId = null ou absent → tous les bénévoles
await $fetch(`/api/editions/${editionId}/ticketing/volunteers/handout-items`, {
  method: 'PUT',
  body: { teamId: null, handoutItemIds: [{ handoutItemId: 12, quantity: 3 }] },
})
```

**Seule la portée envoyée est réécrite.** Régler le global ne vide aucune équipe, et régler une
équipe ne touche pas le global. Un tableau vide vide la portée.

La forme « nombre nu » (`handoutItemIds: [12, 13]`) reste acceptée et vaut un exemplaire.
`normalizeHandoutItemSelections` borne les quantités et écarte les doublons — c'est la **seule**
normalisation du système.

### Les droits

**Tous les points d'API dédiés aux articles exigent `canManageTicketing`**, sans exception : « ce
qu'on remet » est une compétence billetterie.

Deux routes y échappent, et c'est voulu : `PUT shows/[showId]` et `PUT volunteers/meals` sont des
**mises à jour complètes** d'un spectacle ou d'un repas, où les articles ne sont qu'un champ parmi
douze. Elles gardent le droit de leur module — y exiger la billetterie casserait l'édition des
spectacles et des repas.

### L'interrupteur

`Edition.ticketingHandoutItemsEnabled` éteint la fonctionnalité. Contrairement au reste du projet,
il **coupe vraiment** : la page de configuration, les points d'écriture (403) et le calcul au
guichet. L'écart avec les autres modules est délibéré — un article non remis se constate au
comptoir, trop tard. `exigerArticlesARemettreActifs` s'appelle **après** le contrôle des droits,
pour que qui n'a pas le droit d'être là n'apprenne pas au passage ce que l'édition a activé.

## Les écrans

Tout se configure depuis **`/editions/[id]/gestion/ticketing/handout-items`**, un onglet par
cible.

- **`HandoutItemsList.vue`** — créer, renommer, basculer `cumulative`, supprimer.
- **`TicketingHandoutItemsQuantityPicker.vue`** — le sélecteur commun : un multi-select, puis une
  ligne de quantité par article retenu.
- **`TicketingHandoutItemsModal.vue`** — la coquille commune des modales (charger, enregistrer,
  pied). Sept écrans n'en sont plus que des enveloppes d'une quarantaine de lignes.
- **`ManageCustomFieldHandoutItemsModal.vue`** — à part, pour `choiceValue`.
- **`TicketingVolunteerHandoutItemsList.vue`** — la portée bénévole, avec l'avertissement de
  surcharge et l'aperçu.
- **`ParticipantDetailsModal.vue`** — **la seule surface où l'on remet quelque chose**. Aucune
  carte de détail n'affiche les articles : ni celle des artistes, ni celle des bénévoles, ni celle
  des organisateurs.

## Au guichet

Deux points d'API servent le contrôle d'accès, et ils doivent rendre **la même chose** :

- `POST ticketing/verify` — le scan d'un QR code, le geste normal à l'entrée ;
- `POST ticketing/search` — la recherche par nom.

Leur divergence est la faute historique du module : le scan ne chargeait pas les options, et une
même personne obtenait **deux listes différentes selon la façon dont on la trouvait**. Toute
modification de l'un doit être portée sur l'autre, et `selectedOptionsIncludes` existe pour que
l'oubli soit moins facile.

Le serveur rend **une seule liste agrégée** par personne. L'écran se contente de l'afficher — il
ne recalcule rien, sous peine de réintroduire une seconde règle d'agrégation qui divergera.

## Voir aussi

- [`docs/volunteers/volunteer-handout-items-by-team.md`](../volunteers/volunteer-handout-items-by-team.md)
  — la surcharge par équipe en détail
- `server/utils/ticketing/handout-items.ts` — l'agrégation et le calcul pour un billet
- `server/utils/ticketing/rapprochement-champ.ts` — la règle de rapprochement des champs,
  partagée avec le décompte des quotas
