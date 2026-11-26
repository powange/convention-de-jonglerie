# Flowvent — abonnements par module

Ce document décrit comment Flowvent (app2) fait payer l'organisation d'un événement. Les décisions
viennent du rapport « Tarifs de Flowvent » (26/11/2026), validé par l'utilisateur.

## Les formules

| Formule  | Modules                         | Au mois | À l'année         |
| -------- | ------------------------------- | ------- | ----------------- |
| Solo     | 1 au choix                      | 9 €     | 84 € (7 €/mois)   |
| Duo      | 2 au choix                      | 15 €    | 144 € (12 €/mois) |
| Intégral | les 6, et chaque module à venir | 25 €    | 240 € (20 €/mois) |

- Les **six modules payants** : bénévoles, artistes et spectacles, repas, billetterie, trésorerie,
  stock et prêts.
- La **carte du site** est incluse dans toutes les formules : elle sert de support au stock et aux
  spectacles.
- **Ni essai gratuit ni formule gratuite permanente.** Les remises et les gratuités passent par les
  codes promo.
- Prix TTC. Paiement **simulé** pour l'instant : aucun prestataire n'est appelé.

La grille vit dans **`apps/app2/shared/formules.ts`**, écrite une fois et lue par l'API comme par
les écrans. Ce fichier n'importe aucune valeur : le test
`apps/app1/test/unit/utils/flowvent-formules.test.ts` le transpile et l'exécute tel quel.

## Qui paie

L'abonnement est celui du **propriétaire** de l'événement. Il couvre tous ses co-organisateurs,
qui n'ont pas à s'abonner. Bénévoles, artistes et acheteurs ne paient jamais. Créer un événement
demande son propre abonnement, quelle que soit la formule (garde serveur dans
`server/api/events/index.post.ts`).

## Ce que la formule ouvre

La règle est dans `droitsSurEvenement` (`apps/app2/server/utils/droits-evenement.ts`), par où passent
tous les droits des layers partagés (`edition-permissions.ts`, ports des modules) :

- un droit de **module payant** ne s'exerce **en écriture** que si la formule du propriétaire couvre
  ce module ;
- les droits sur l'**événement lui-même** (le modifier, la carte, les organisateurs) demandent
  seulement un abonnement actif ;
- un **administrateur** global n'est pas tenu par l'abonnement d'autrui.

### Lecture seule

Ce qui n'est pas couvert reste **consultable** : une fin d'abonnement ou un changement de formule ne
supprime rien. Pour distinguer une lecture d'une écriture, la règle lit la méthode de la requête en
cours par le **contexte asynchrone de Nitro** (`nitro.experimental.asyncContext: true` dans
`nuxt.config.ts`). Une requête `GET` ou `HEAD` garde les droits de la personne ; toute autre méthode
exige la couverture. Hors requête (tâche planifiée), la règle stricte s'applique.

Côté écran, la gestion s'ouvre à quiconque la voit (middleware `subscription`). Le layout
`edition-dashboard` affiche un bandeau « lecture seule » quand l'abonnement est arrêté ou que le
module de la page n'est pas dans la formule.

**Limite connue** : quelques actions du contrôle des entrées (scan, recherche, ajout manuel,
remboursement) ne vérifient que le droit de voir l'événement, comme dans app1. Elles échappent à la
lecture seule.

### Activation des modules

Activer un module payant (`PUT /api/events/:id/modules`) demande que la formule le couvre (402
sinon). Le désactiver reste toujours possible. À la création d'un événement, le module bénévoles
n'est actif que si la formule le couvre.

## Données

`Subscription` (schéma Prisma d'app2) :

- `plan` : la **période**, `monthly` ou `annual` (nom historique) ;
- `formule` : `solo`, `duo` ou `integral` — `integral` par défaut, ce qui a fait passer les
  abonnements antérieurs en Intégral sans rien leur retirer ;
- `modules` : les modules choisis pour Solo et Duo (JSON), `null` pour Intégral.

`modulesCouverts()` ne rend jamais plus de modules que la formule n'en comprend, même si la colonne
en contient davantage.

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
  à leur terme l'abonnement s'arrête et la gestion passe en lecture seule. Personne n'est prélevé
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
- L'aperçu public n'est pas limité en débit : un code court se devine. Préférer des codes longs pour
  les gratuités.
