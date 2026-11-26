# Flowvent — abonnements à la taille

Ce document décrit comment Flowvent (app2) fait payer l'organisation d'un événement. Les décisions
viennent du rapport « Tarifs de Flowvent », **version 2** (26/11/2026), validée par l'utilisateur.
La version 1 faisait payer au nombre de modules (Solo, Duo, Intégral, #996) : elle est remplacée.

## Les formules

Le prix suit la **taille** de l'organisation. **Tous les modules** sont compris dans toutes les
formules, carte du site comprise.

| Formule        | Au mois | À l'année         | Événements en cours | Bénévoles acceptés | Artistes | Co-organisateurs |
| -------------- | ------- | ----------------- | ------------------- | ------------------ | -------- | ---------------- |
| Découverte     | gratuit | gratuit           | 1                   | 15                 | 5        | 1                |
| Association    | 9 €     | 84 € (7 €/mois)   | 1                   | 75                 | 20       | 3                |
| Festival       | 19 €    | 180 € (15 €/mois) | 5                   | 250                | 60       | 10               |
| Grand festival | 39 €    | 372 € (31 €/mois) | 15                  | 1 000              | 200      | illimités        |

- Les plafonds de bénévoles, d'artistes et de co-organisateurs valent **par événement** ; celui
  d'événements vaut pour le compte du propriétaire. Au-delà du Grand festival : sur devis.
- **Découverte** est la formule de tout compte sans abonnement payant actif : jamais souscrit, ou
  arrivé à son terme. Elle ne se souscrit pas et ne se remise pas.
- Prix TTC. Paiement **simulé** pour l'instant : aucun prestataire n'est appelé.

La grille vit dans **`apps/app2/shared/formules.ts`**, écrite une fois et lue par l'API comme par
les écrans. Ce fichier n'importe aucune valeur : le test
`apps/app1/test/unit/utils/flowvent-formules.test.ts` le transpile et l'exécute tel quel.

## Qui paie

L'abonnement est celui du **propriétaire** de l'événement. Il couvre tous ses co-organisateurs,
dans la limite de sa formule. Bénévoles, artistes et acheteurs ne paient jamais. Tout compte peut
créer un événement, dans la limite de ses événements en cours.

## Ce qui compte

`apps/app2/server/utils/quotas.ts` compte et refuse :

| Compteur         | Compte                                                | Ne compte pas                                  |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Événements       | les événements non archivés du propriétaire           | les archivés, ceux où l'on est co-organisateur |
| Bénévoles        | les candidatures `ACCEPTED`, ajouts manuels compris   | les candidatures en attente ou refusées        |
| Artistes         | les fiches d'artistes de l'événement                  | les candidatures d'appel à spectacles          |
| Co-organisateurs | les lignes `EditionOrganizer`, invitations en attente | le propriétaire                                |

### À la limite

- **Alerte** à 80 %, puis à la limite : un **courriel** au propriétaire, une fois par palier et par
  compteur d'événement (`signalerSeuil`, texte dans `shared/alerte-quota.ts`, paliers déjà signalés
  dans `Event.alertesQuota`). Pas de courriel pour le compteur d'événements : le tableau de bord
  affiche « N événements en cours sur M ».
- **Jauges** sur l'accueil de la gestion (`EditionJaugesFormule`) : orange dès 80 %, rouge à la
  limite (la jauge d'événements reste orange : être plein y est le cas ordinaire).
- **Tolérance** de 10 % au-delà du plafond, arrondie à l'inférieur (`plafondTolere` : 75 → 82,
  250 → 275 ; un petit plafond comme 3 n'a pas de marge).
- Au-delà, l'**ajout** est refusé en **402**, avec un message qui nomme la formule qui relève ce
  plafond (`formuleQuiReleve`). Rien de ce qui existe n'est jamais retiré ni bloqué.
- Un administrateur global n'est pas soumis aux quotas.

### Les points de contrôle

| Ajout                              | Où                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Créer un événement, le désarchiver | `server/api/events/index.post.ts`, `server/api/events/[id]/archive.post.ts`                         |
| Ajouter un co-organisateur         | `server/api/events/[id]/organizers/index.post.ts` (avant de créer un compte invité)                 |
| Accepter ou ajouter un bénévole    | layer `volunteers` : `applications/[applicationId].patch.ts`, `add-manually`, `create-user-and-add` |
| Créer une fiche d'artiste          | layer `artists` : `artists/index.post.ts`, `import-performer.post.ts`                               |

Dans les layers, le contrôle passe par un **port facultatif** du contrat d'hôte (`quotas` dans
`VolunteerPorts` et `ArtistsPorts`). Flowvent le branche sur `quotas.ts` ; app1 ne le fournit pas et
n'a donc aucun plafond. Le test `flowvent-formules.test.ts` vérifie que les quatre points restent
branchés.

## Lecture seule

La règle est dans `droitsSurEvenement` (`apps/app2/server/utils/droits-evenement.ts`). La gestion
d'un événement ne passe en **lecture seule** que dans deux cas, sans jamais rien supprimer :

- l'événement est **archivé** ;
- son propriétaire a **plus d'événements en cours que sa formule n'en tolère** (fin d'abonnement,
  descente de formule) : il archive ceux qu'il veut pour reprendre la main (`surnombre`).

Une lecture reste toujours permise. Pour la distinguer d'une écriture, la règle lit la méthode de la
requête en cours par le **contexte asynchrone de Nitro** (`nitro.experimental.asyncContext: true`
dans `nuxt.config.ts`). Hors requête (tâche planifiée), la règle stricte s'applique. Un
administrateur n'est jamais en lecture seule.

`acces-gestion` et `accueil` rendent `lectureSeule` (`'archive'`, `'surnombre'` ou `null`) et
`quotas` (formule et état des quatre compteurs). Le layout `edition-dashboard` affiche le bandeau
correspondant. Les champs `abonnementActif` et `abonnement` y restent un lot, pour les pages
ouvertes avant le changement : à retirer ensuite.

**Limite connue** : quelques actions du contrôle des entrées (scan, recherche, ajout manuel,
remboursement) ne vérifient que le droit de voir l'événement, comme dans app1. Elles échappent à la
lecture seule.

## Archivage

`POST /api/events/:id/archive` (`{ archive: true | false }`), par le propriétaire ou un
administrateur, depuis les informations de l'événement. Archiver reste permis en lecture seule :
c'est le moyen d'en sortir. Désarchiver reprend une place et est soumis au plafond.

## Données

- `Event.archivedAt` : date d'archivage, `null` pour un événement en cours.
- `Subscription.plan` : la **période**, `monthly` ou `annual` (nom historique).
- `Subscription.formule` : `association`, `festival` ou `grand`.
- Migration `20261128090000_formules_a_la_taille` : `solo` → `association`, `duo` et `integral` →
  `festival` (formule de prix équivalent, même échéance), mêmes correspondances pour les formules
  visées par les codes promo ; la colonne `Subscription.modules` est supprimée.

## Codes promo

Un code accorde une remise ou une gratuité aux personnes à qui on transmet son lien,
`/pricing?code=CODE`. La règle vit dans **`apps/app2/shared/codes-promo.ts`** (sans import, testée
par `apps/app1/test/unit/utils/flowvent-codes-promo.test.ts`) ; le serveur s'appuie dessus dans
`server/utils/codes-promo.ts`.

### Réglages

Ils sont calqués sur les coupons Stripe, pour une reprise directe le jour du paiement réel.

| Réglage      | Valeurs                                                    |
| ------------ | ---------------------------------------------------------- |
| Avantage     | pourcentage (1 à 100), montant retiré (centimes), gratuité |
| Formules     | une, plusieurs, ou toutes (liste vide)                     |
| Périodes     | mensuel, annuel, ou les deux (liste vide)                  |
| Durée        | premier paiement, N mois, à vie                            |
| Validité     | date de début et de fin, facultatives                      |
| Plafond      | nombre maximal d'utilisations, facultatif                  |
| Destinataire | une adresse, ou tout le monde                              |

Un compte n'utilise un code qu'une fois. Un code réservé à une autre adresse se dit « introuvable » :
on n'annonce pas qu'il existe pour quelqu'un d'autre.

### Le parcours

1. Le lien ouvre la page tarifs ; le code est retenu **30 jours** dans le cookie
   `flowvent_code_promo`, pour survivre à la création du compte. On peut aussi le saisir sur la page.
2. L'aperçu public `GET /api/codes-promo/:code` rend ce que le code accorde et le prix remisé de
   chaque formule et période qu'il couvre. La page barre les prix concernés.
3. Le paiement (`POST /api/subscription/checkout`, champ `code`) **revérifie tout** : validité,
   plafond (relu dans la transaction), usage unique, destinataire, formule.

### Règles

- **Un seul code par abonnement** ; la réduction de l'annuel reste acquise en plus.
- **Gratuité** : aucun moyen de paiement demandé. « Offert pendant N mois » ouvre exactement N mois ;
  à leur terme l'abonnement s'arrête et le compte revient à la formule Découverte. Personne n'est prélevé
  par surprise.
- **Changement de formule** : sans nouveau code, le paiement reprend d'office celui de l'abonnement
  en cours s'il couvre la nouvelle formule et que son avantage court encore. Une gratuité reprise
  garde son terme. Si la formule choisie ferait perdre la remise, la page tarifs prévient avant de
  valider.
- **Code à vie** : il survit à une interruption d'abonnement. Un compte qui a utilisé un code « à
  vie » le retrouve à sa prochaine souscription, si le code couvre la formule.
- **Désactiver** un code empêche toute nouvelle utilisation ; ses bénéficiaires gardent leur
  avantage jusqu'à son terme. Un code **jamais utilisé** peut être supprimé ; un code utilisé, non.
- L'avantage d'un code ne se modifie pas après création. On peut changer sa note, sa fin de validité
  et son plafond.

### Données

- `PromoCode` : le code et ses réglages.
- `PromoCodeRedemption` : une utilisation (code, compte, formule, période, montant de la première
  période) ; unique par code et par compte.
- `Subscription.promoCodeId`, `advantageEndsAt` (fin de l'avantage, `null` à vie) et `amountPaid`
  (centimes payés pour la période en cours).

### Administration

`/admin/codes-promo` : la liste (avantage, formules, utilisations sur plafond, validité, état),
la création, et la copie du lien. Le détail d'un code liste les comptes qui l'ont utilisé et permet
de le désactiver. API : `/api/admin/promo-codes` (garde `exigerAdministrateur`).

### Limites

- Paiement **simulé** : aucun renouvellement automatique n'existe encore. `advantageEndsAt` est
  enregistré pour le jour où un prestataire facturera les périodes suivantes.
- L'aperçu public est limité à vingt essais par minute et par adresse (`codePromoRateLimiter`). Un
  code court reste plus facile à deviner : préférer des codes longs pour les gratuités.

## Rappel avant la fin d'une période

Le paiement étant simulé, aucun abonnement ne se renouvelle seul. La tâche planifiée
`subscription-end-reminders` (`apps/app2/server/tasks/`, chaque jour à 9 h) écrit **15 jours avant**
la fin de chaque période. Le message (`apps/app2/shared/rappel-fin-abonnement.ts`) dit :

- la formule et la date de fin ; pour une gratuité, que la période offerte s'achève ;
- ce que devient le code : acquis s'il est « à vie », encore valable au renouvellement si son
  avantage court au-delà, sinon qu'il prend fin avec la période ;
- qu'à défaut de renouvellement le compte revient à la formule Découverte, sans rien supprimer.

Un seul rappel par période (`Subscription.endReminderFor`). Un envoi échoué n'est pas retenu : le
passage du lendemain réessaie. Comme les autres tâches, celle-ci ne tourne qu'en production, ou avec
`ENABLE_CRON=true`.

**Renouveler** la même formule (même période, mêmes modules) avant la fin **prolonge** la période :
la nouvelle commence à la fin de l'ancienne. Un code « premier paiement » ne resservira pas : un
avantage qui s'achève avant le début de la période payée ne la couvre pas.
