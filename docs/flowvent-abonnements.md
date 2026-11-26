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
