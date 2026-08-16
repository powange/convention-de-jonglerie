# Fusion de deux comptes utilisateur

Un même juggler peut se retrouver avec deux comptes : inscription par email puis connexion
Google, doublon créé après un changement d'adresse, compte « bénévole » et compte
« organisateur »… La suppression d'un des deux détruirait son historique (candidatures
bénévole, créneaux, covoiturages, conversations, ateliers). La **fusion** rattache d'abord
toutes ces données au compte conservé, puis supprime le compte absorbé.

## Utilisation

Sur `/admin/users`, menu « Actions » d'un utilisateur → **Fusionner avec un autre compte**.
Le modal se déroule en trois étapes :

1. **Sélection** — recherche du second compte, puis choix explicite de celui qui est
   **conservé**. L'autre est **absorbé** (supprimé).
2. **Aperçu et arbitrage** — un appel en `dryRun` affiche, par domaine, le nombre d'éléments
   transférés et de doublons écartés. En dessous, chaque information de profil qui diffère
   entre les deux comptes est arbitrée par un bouton (valeur du compte conservé ou du compte
   absorbé). Un champ vide côté compte conservé est présélectionné sur la valeur de l'autre.
3. **Confirmation** — saisie du pseudo du compte absorbé, revalidée côté serveur.

Restrictions : un compte ne peut pas être fusionné avec lui-même, l'administrateur ne peut
pas absorber son propre compte, et un super administrateur ne peut pas être absorbé
(cohérent avec le refus de le supprimer).

## Champs de profil arbitrables

| Choix | Colonnes réellement écrites |
| --- | --- |
| `credentials` | `email`, `emailHash` (recalculé), `password`, `authProvider`, `isEmailVerified` |
| `pseudo` | `pseudo` |
| `nom`, `prenom`, `phone`, `pronouns`, `preferredLanguage`, `profilePicture` | la colonne homonyme |

Non arbitrés, appliqués systématiquement :

- `isVolunteer`, `isArtist`, `isOrganizer` sont **cumulés** (OU logique) ;
- `createdAt` prend la plus ancienne des deux dates d'inscription ;
- `lastLoginAt` prend la plus récente des deux connexions ;
- `isGlobalAdmin` reste celui du compte conservé.

Si la photo retenue vient du compte absorbé et qu'elle est stockée sous forme de nom de
fichier nu, le fichier est recopié de `public/uploads/profiles/<idAbsorbé>/` vers
`public/uploads/profiles/<idConservé>/` après le commit, puis le dossier source est supprimé.

## Ordre des opérations

Tout se déroule dans une transaction unique (`timeout: 60 s`, `maxWait: 10 s` — le défaut de
5 s est insuffisant pour ~50 requêtes) :

1. **Transfert des lignes**, référence par référence. `ConventionOrganizer` passe en premier :
   écarter son doublon fait disparaître en cascade `EditionOrganizer`,
   `EditionOrganizerPermission`, `OrganizerMealSelection` et `EditionOrganizerHandoutItem`,
   qui portent leurs propres contraintes d'unicité.
2. **Relations many-to-many implicites** (`_FavoriteEditions`, `_AttendingEditions`) :
   `UPDATE IGNORE` repointe ce qui peut l'être, puis `DELETE` retire les doublons restants.
   Ces tables ne sont pas des modèles Prisma, elles sont donc traitées en SQL brut.
3. **Notifications** dont `entityType = 'User'` et `entityId` pointe sur le compte absorbé.
4. **Suppression du compte absorbé** — libère `email` et `pseudo`, qui peuvent donc être
   repris par le compte conservé à l'étape suivante.
5. **Mise à jour du profil** du compte conservé avec les arbitrages.

## Traitement des conflits

Une contrainte `@@unique` incluant la colonne utilisateur (par exemple
`@@unique([eventId, userId])` sur `EditionVolunteerApplication`) empêche les deux comptes de
coexister sur la même clé. Dans ce cas, **la ligne du compte conservé fait foi** et celle du
compte absorbé est supprimée. Les doublons internes au compte absorbé sont traités de la
même façon : la première ligne survit.

Le décompte des lignes écartées est remonté dans l'aperçu comme dans la réponse finale.

## Maintenance — le point important

L'inventaire des colonnes référençant `User.id` vit dans
[`apps/app1/server/utils/user-merge-references.ts`](../apps/app1/server/utils/user-merge-references.ts) :
**48 colonnes** (44 relations Prisma + 4 références « molles », c'est-à-dire des colonnes
`Int` stockant un `User.id` sans relation ni clé étrangère).

> ⚠️ **Toute nouvelle relation vers `User` dans `prisma/schema/*.prisma` doit être ajoutée à
> `USER_REFERENCES`.** Sinon la fusion laisse des lignes rattachées au compte absorbé et la
> suppression finale échoue sur une contrainte de clé étrangère.

Cette table ne peut pas être dérivée automatiquement : le DMMF exposé par Prisma 7 à
l'exécution est réduit (`Prisma.dmmf.datamodel.models` n'expose ni `relationFromFields` ni
`uniqueFields`), et `@prisma/internals` n'est pas installé.

Pour chaque entrée : `model` (clé du delegate Prisma), `field` (colonne), `uniqueWith`
(les autres colonnes de la contrainte `@@unique`, si un conflit est possible), `group`
(regroupement d'affichage) et `soft` (référence sans clé étrangère).

## Fichiers concernés

| Fichier | Rôle |
| --- | --- |
| `apps/app1/server/utils/user-merge-references.ts` | Inventaire des colonnes + `splitConflicts` (sans dépendance, testable en unitaire) |
| `apps/app1/server/utils/user-merge.ts` | `previewUserMerge`, `mergeUsers`, gestion des fichiers d'avatar |
| `apps/app1/server/api/admin/users/[id]/merge.post.ts` | Endpoint (`[id]` = compte conservé), garde-fous, `dryRun` |
| `apps/app1/app/components/admin/UserMergeModal.vue` | Modal en trois étapes |
| `apps/app1/app/pages/admin/users/index.vue` | Entrée de menu et montage du modal |

## Limites connues

- Aucun email n'est envoyé au propriétaire du compte absorbé.
- Les sessions étant des cookies scellés, le compte absorbé reste « connecté » jusqu'à
  expiration de son cookie ; il n'y a pas de table de sessions à purger.
- `OrganizerPermissionHistory.before` / `.after` (JSON) peuvent contenir l'ancien identifiant
  ou l'ancien pseudo : ces snapshots ne sont pas réécrits.
- La fusion ne touche pas au schéma : aucune migration Prisma n'est nécessaire.
