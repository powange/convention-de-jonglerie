# Audit de logique metier - Fevrier 2026

> **Date de l'audit** : 12 fevrier 2026
> **Perimetre** : Analyse approfondie de la logique metier, des incoherences entre fonctionnalites et des problemes de securite applicative.

---

## Table des matieres

- [1. Problemes CRITIQUES](#1-problemes-critiques)
- [2. Problemes MAJEURS](#2-problemes-majeurs)
- [3. Problemes MOYENS](#3-problemes-moyens)
- [4. Tableau recapitulatif](#4-tableau-recapitulatif)
- [5. Plan de correction recommande](#5-plan-de-correction-recommande)

---

## 1. Problemes CRITIQUES

> Impact immediat en production : fraude possible, corruption de donnees, failles de securite.

### 1.1 Billetterie - Aucune validation de quota en creation manuelle

**Fichier** : `server/api/editions/[id]/ticketing/add-participant-manually.post.ts`

**Probleme** : Lors de la creation manuelle de participants, les quotas ne sont jamais verifies avant de creer la commande. Les tarifs sont recuperes (lignes 87-98) mais sans verification des quotas associes.

**Impact** :

- Depassement des limites de quotas configurees
- Survente possible lors de creations manuelles
- Incoherence avec le systeme HelloAsso qui a ses propres limites

**Race condition associee** : Meme avec une verification ajoutee, deux requetes simultanees pourraient toutes deux voir de la place et creer des commandes depassant le quota.

**Correction recommandee** :

```typescript
// Utiliser une transaction avec verrouillage
await prisma.$transaction(async (tx) => {
  const quotaStats = await getQuotaStats(editionId, tx)
  for (const item of body.items) {
    // Verifier chaque quota associe au tarif
    const tierQuotas = // recuperer quotas du tarif
    for (const quota of tierQuotas) {
      const currentStat = quotaStats.find(s => s.id === quota.id)
      if (currentStat && currentStat.currentCount + item.quantity > currentStat.quantity) {
        throw createError({ status: 400, message: `Quota "${quota.title}" depasse` })
      }
    }
  }
  // Creer la commande dans la meme transaction
  await tx.ticketingOrder.create(...)
})
```

---

### 1.2 Billetterie - Double validation d'entree possible

**Fichier** : `server/api/editions/[id]/ticketing/validate-entry.post.ts` (lignes 393-455)

**Probleme** : L'`updateMany` ne verifie pas `entryValidated: false` avant la mise a jour. Un billet peut etre valide plusieurs fois. Le meme probleme existe pour les artistes (ligne 196) et les benevoles (ligne 59).

**Impact** :

- `entryValidatedAt` ecrasee a chaque appel
- Notifications SSE envoyees meme si aucune nouvelle validation
- Statistiques faussees

**Correction recommandee** :

```typescript
// Ajouter la condition entryValidated: false
const result = await prisma.ticketingOrderItem.updateMany({
  where: {
    id: { in: body.participantIds },
    order: { editionId },
    entryValidated: false, // Empecher la double validation
  },
  data: {
    entryValidated: true,
    entryValidatedAt: new Date(),
    entryValidatedBy: user.id,
  },
})
```

---

### 1.3 Billetterie - Billets rembourses toujours validables

**Fichier** : `server/api/editions/[id]/ticketing/verify.post.ts` (lignes 570-591)

**Probleme** : La recherche par QR code ne filtre pas les commandes remboursees. L'interface retourne `isRefunded: true` (ligne 598) mais la validation reste possible.

**Impact** : Un billet rembourse peut etre scanne et valide pour l'entree.

**Correction recommandee** :

```typescript
const orderItem = await prisma.ticketingOrderItem.findFirst({
  where: {
    qrCode: body.qrCode,
    state: { in: ['Processed', 'Pending'] },
    order: {
      editionId,
      status: { notIn: ['Refunded'] },
    },
  },
})
```

---

### 1.4 ~~Benevoles - Etat incoherent lors du rejet~~ CORRIGE

**Fichier** : `server/api/editions/[id]/volunteers/applications/[applicationId].patch.ts`

**Probleme** : Quand un benevole passait a `REJECTED`, ses assignations d'equipes et selections de repas n'etaient PAS nettoyees. Le nettoyage ne se faisait que lors du retour a `PENDING`. De plus, `entryValidated` n'etait pas reinitialise.

**Resolution** : La condition de nettoyage a ete etendue a `target === 'PENDING' || target === 'REJECTED'`, incluant la suppression des equipes, des repas et la reinitialisation de `entryValidated`/`entryValidatedAt`/`entryValidatedBy`.

---

### 1.5 Benevoles - Assignation d'equipes aux benevoles PENDING

**Fichier** : `server/api/editions/[id]/volunteers/applications/[applicationId]/teams.patch.ts` (lignes 42-47)

**Probleme** : Seul le statut `REJECTED` est bloque. Un benevole `PENDING` peut etre assigne a des equipes.

**Correction recommandee** :

```typescript
if (application.status !== 'ACCEPTED')
  throw createError({
    status: 400,
    message: 'Seuls les benevoles acceptes peuvent etre assignes a des equipes',
  })
```

---

### 1.6 Repas - Validation multiple possible (fraude)

**Fichier** : `server/api/editions/[id]/meals/[mealId]/validate.post.ts`

**Probleme** : La validation ne verifie pas si `consumedAt` est deja rempli avant la mise a jour. Un QR code peut etre scanne plusieurs fois.

- Benevoles (lignes 74-77) : `update({ data: { consumedAt: now } })` sans verification
- Artistes (lignes 95-98) : idem
- Participants (lignes 144-159) : `upsert` permet l'ecrasement

**Correction recommandee** :

```typescript
const selection = await prisma.volunteerMealSelection.findUnique({
  where: { id: validatedData.id },
})
if (selection.consumedAt) {
  throw createError({ status: 400, message: 'Ce repas a deja ete valide' })
}
```

---

### 1.7 Artistes - Montants financiers non valides

**Fichier** : `server/api/editions/[id]/artists/[artistId].put.ts` (lignes 15-19)

**Probleme** : Les champs `payment`, `reimbursementMax`, `reimbursementActual` acceptent des valeurs negatives et il n'y a pas de verification que `reimbursementActual <= reimbursementMax`.

**Correction recommandee** :

```typescript
payment: z.number().nonnegative().max(100000).optional().nullable(),
reimbursementMax: z.number().nonnegative().max(100000).optional().nullable(),
reimbursementActual: z.number().nonnegative().max(100000).optional().nullable(),
```

Ajouter une validation custom : `reimbursementActual <= reimbursementMax`.

---

## 2. Problemes MAJEURS

> Logique metier incoherente : comportements confus, violations du principe du moindre privilege.

### 2.1 ~~Permissions - Deux systemes concurrents~~ CORRIGE

> **Corrige le 12/02/2026** : L'ancien fichier `server/utils/permissions/permissions.ts` a ete supprime. Les 3 endpoints qui l'utilisaient (`lost-found/index.post.ts`, `lost-found/[itemId]/return.patch.ts`, `posts/[postId]/comments/index.post.ts`) ont ete migres vers `canAccessEditionData()` du systeme moderne. Les tests ont ete mis a jour.

---

### 2.2 Permissions - canEditAllEditions donne le droit de suppression

**Fichier** : `server/utils/permissions/edition-permissions.ts` (ligne 129)

**Probleme** : Dans `canDeleteEdition()`, le droit `canEditAllEditions` est inclus dans la condition de suppression. Violation du principe du moindre privilege.

**Correction recommandee** : Retirer `canEditAllEditions` de la condition de suppression.

---

### 2.3 ~~Permissions - canManageOrganizers donne le droit de changer le statut~~ CORRIGE

**Fichier** : `server/utils/permissions/edition-permissions.ts` (ligne 150)

**Probleme** : Dans `canManageEditionStatus()`, le droit `canManageOrganizers` permettait de modifier le statut de publication d'une edition. Aucune logique metier ne justifiait ce lien.

**Resolution** : `canManageOrganizers` retire de la verification dans `canManageEditionStatus()`. Test mis a jour.

---

### 2.4 ~~Permissions - Ajout d'artistes avec canEditEdition au lieu de canManageArtists~~ CORRIGE

**Fichier** : `server/api/editions/[id]/artists/index.post.ts`

**Probleme** : L'endpoint d'ajout d'artistes verifiait `canEditEdition()` au lieu de `canManageArtists()`, contrairement aux shows-call qui utilisaient correctement `canManageArtists()`.

**Resolution** : Remplace la requete Prisma manuelle + `canEditEdition()` par `getEditionWithPermissions()` + `canManageArtists()`, alignant le pattern avec `shows-call/index.post.ts`.

**Correction recommandee** : Remplacer `canEditEdition()` par `canManageArtists()`.

---

### 2.5 Editions - Aucune machine a etats pour les statuts

**Fichier** : `server/api/editions/[id]/status.patch.ts` (lignes 9-11)

**Probleme** : N'importe quelle transition est possible : `CANCELLED` -> `PUBLISHED`, etc. De plus, aucun endpoint ne verifie le statut de l'edition. On peut creer des posts, ateliers, objets trouves sur une edition `CANCELLED`.

**Endpoints concernes** (pas de verification du statut) :

- `server/api/editions/[id]/posts/index.post.ts`
- `server/api/editions/[id]/workshops/index.post.ts`
- `server/api/editions/[id]/lost-found/index.post.ts`

**Correction recommandee** : Implementer une machine a etats avec transitions valides :

```
OFFLINE -> PLANNED -> PUBLISHED
                         |
                    CANCELLED
```

Ajouter un middleware ou une verification systematique du statut avant les actions de creation.

---

### 2.6 Posts - Permissions incoherentes entre posts et commentaires

**Fichiers** :

- `server/api/editions/[id]/posts/index.post.ts` - Aucune verification de permissions
- `server/api/editions/[id]/posts/[postId]/comments/index.post.ts` - Restreint aux organisateurs
- `server/api/editions/[id]/posts/[postId]/index.delete.ts` - Seul l'auteur peut supprimer

**Probleme** : N'importe quel utilisateur authentifie peut creer un post sur n'importe quelle edition, mais les commentaires sont restreints aux organisateurs. Les organisateurs ne peuvent pas supprimer des posts problematiques.

**Correction recommandee** :

- Restreindre la creation de posts aux organisateurs ou participants (benevoles acceptes, detenteurs de billets)
- Permettre aux organisateurs de supprimer des posts
- Harmoniser les permissions posts/commentaires

---

### 2.7 ~~Messagerie - VOLUNTEER_TO_ORGANIZERS sans verification de benevole~~ CORRIGE

**Fichier** : `server/api/messenger/volunteer-to-organizers.post.ts`

**Probleme** : N'importe quel utilisateur authentifie pouvait creer une conversation avec les organisateurs, meme sans etre benevole de l'edition.

**Resolution** : Ajout d'une verification que l'utilisateur a une candidature benevole avec statut `ACCEPTED` avant de permettre la creation de la conversation. Retourne une erreur 403 sinon.

---

### 2.8 Benevoles - Pas de validation de chevauchements de creneaux cote serveur

**Fichier** : `server/api/editions/[id]/volunteer-time-slots/[slotId]/assignments.post.ts` (lignes 50-89)

**Probleme** : Le serveur verifie :

- Que le benevole est `ACCEPTED`
- Que le creneau n'est pas plein
- Que le benevole n'est pas deja assigne a CE creneau

Mais il ne verifie PAS les chevauchements temporels avec d'autres creneaux. Un benevole peut etre assigne a "Bar 14h-16h" ET "Accueil 15h-17h". La detection existe cote client (alertes) mais n'est pas bloquante.

**Correction recommandee** : Ajouter une verification serveur des chevauchements temporels avant l'assignation.

---

### 2.9 Billetterie - Transition de statut non atomique

**Fichier** : `server/api/editions/[id]/ticketing/validate-entry.post.ts` (lignes 429-454)

**Probleme** : La mise a jour du statut de commande et des items se fait en deux requetes separees. En cas d'erreur sur la seconde, la commande est `Onsite` mais les items restent `Pending`.

**Correction recommandee** :

```typescript
await prisma.$transaction([
  prisma.ticketingOrder.updateMany({ where: { id: { in: orderIds }, status: 'Pending' }, data: { status: 'Onsite', ... } }),
  prisma.ticketingOrderItem.updateMany({ where: { id: { in: body.participantIds }, state: 'Pending' }, data: { state: 'Processed' } }),
])
```

---

### 2.10 Artistes - ShowApplication sans lien avec Show

**Fichier** : `prisma/schema/artists.prisma`

**Probleme** : Aucun lien relationnel entre `ShowApplication` (candidature) et `Show` (spectacle cree). Apres acceptation d'une candidature, l'organisateur doit manuellement creer le spectacle. Risque d'oubli, pas de tracabilite.

**Correction recommandee** : Ajouter un champ `showId` nullable dans `ShowApplication` ou creer un endpoint de conversion automatique candidature -> spectacle.

---

## 3. Problemes MOYENS

> Ameliorations souhaitables : robustesse, coherence, securite renforcee.

### 3.1 Impersonation sans audit trail en base de donnees

**Fichiers** :

- `server/api/admin/users/[id]/impersonate.post.ts`
- `server/api/admin/impersonate/stop.post.ts`

Les sessions d'impersonation sont loguees en console mais pas en base de donnees. Pas de limite de duree explicite, pas d'historique des actions effectuees pendant l'impersonation.

**Correction recommandee** : Creer une table `AdminImpersonationLog` et logger toutes les actions.

---

### 3.2 FCM tokens - Race condition a l'enregistrement

**Fichier** : `server/api/notifications/fcm/subscribe.post.ts` (lignes 27-49)

Pattern check-then-act au lieu d'un `upsert` atomique. Deux connexions simultanees avec le meme token peuvent creer des doublons ou des erreurs 500.

**Correction recommandee** : Utiliser `prisma.fcmToken.upsert()`.

---

### 3.3 Conversations privees - Doublons possibles

**Fichier** : `server/api/messenger/private.post.ts` (lignes 43-83)

Pattern check-then-act : deux utilisateurs creant simultanement une conversation privee entre eux peuvent creer des doublons.

**Correction recommandee** : Utiliser une contrainte unique composite ou un verrou optimiste.

---

### 3.4 Covoiturage - Race condition sur acceptation

**Fichier** : `server/api/carpool-offers/[id]/bookings/[bookingId].put.ts` (lignes 51-59)

Deux acceptations simultanees peuvent toutes deux voir de la place et depasser la capacite.

**Correction recommandee** : Utiliser une transaction Prisma avec re-verification apres l'update.

---

### 3.5 Billetterie - Dates de validite non verifiees en creation manuelle

**Fichier** : `server/api/editions/[id]/ticketing/add-participant-manually.post.ts` (lignes 84-105)

Les tarifs expires sont correctement filtres cote public (`tiers/available.get.ts`), mais pas lors de la creation manuelle.

**Correction recommandee** : Ajouter un filtre `validFrom`/`validUntil` ou au minimum un avertissement.

---

### 3.6 Repas organisateur - Pas de verification du statut benevole

**Fichier** : `server/api/editions/[id]/volunteers/[volunteerId]/meals.put.ts` (lignes 28-39)

Un organisateur peut gerer les repas d'un benevole `REJECTED` ou `PENDING`. L'endpoint verifie l'appartenance a l'edition mais pas le statut.

**Correction recommandee** : Ajouter `status: 'ACCEPTED'` dans la requete.

---

### 3.7 Notifications email vs in-app desynchronisees

**Fichier** : `server/utils/notification-service.ts` (lignes 92-254)

Un utilisateur peut desactiver les notifications in-app mais continuer a recevoir les emails pour le meme type de notification, car les verifications utilisent des cles differentes.

**Correction recommandee** : Harmoniser la logique de preferences entre in-app, push et email.

---

### 3.8 Compteurs billetterie - Tokens sans expiration

**Fichier** : `prisma/schema/ticketing.prisma` (lignes 412-425)

Les tokens de compteurs (`@default(cuid())`) n'ont pas de date d'expiration ni de possibilite de desactivation. Un QR code partage reste valide indefiniment.

**Correction recommandee** : Ajouter des champs `expiresAt` et `isActive`.

---

### 3.9 ~~Statistiques billetterie - Commandes remboursees comptees~~ CORRIGE

**Fichier** : `server/api/editions/[id]/ticketing/stats.get.ts`

**Probleme** : Les statistiques comptaient les items avec `state: { in: ['Processed', 'Pending'] }` mais ne verifiaient pas le `status` de la commande parente. Les commandes remboursees etaient comptees.

**Resolution** : Ajout de `status: { not: 'Refunded' }` dans le filtre `order` de toutes les requetes de comptage (5 requetes corrigees).

---

### 3.10 Convention sans proprietaire peut devenir orpheline

**Fichier** : `prisma/schema/schema.prisma` (ligne 214)

`authorId` est nullable (pour les conventions importees). Si aucun organisateur n'a ete ajoute, la convention devient ingeranteable. De plus, pas de `onDelete` defini : impossible de supprimer un utilisateur qui est auteur de conventions.

**Correction recommandee** : Ajouter `onDelete: SetNull` et une validation garantissant au moins un organisateur avec tous les droits.

---

### 3.11 Benevoles - Pas d'endpoint de suppression de candidature spontanee

**Fichier** : `server/api/editions/[id]/volunteers/applications/[applicationId].delete.ts` (lignes 54-59)

Seules les candidatures `source: 'MANUAL'` peuvent etre supprimees. Si un benevole souhaite retirer sa candidature spontanee (`source: 'APPLICATION'`), il n'y a pas d'endpoint pour cela (probleme RGPD potentiel).

**Correction recommandee** : Creer un endpoint `my-application.delete.ts` permettant a un utilisateur de supprimer sa candidature si elle n'est pas encore acceptee.

---

## 4. Tableau recapitulatif

| #    | Domaine       | Probleme                                         | Severite |
| ---- | ------------- | ------------------------------------------------ | -------- |
| 1.1  | Billetterie   | Pas de validation de quotas en creation manuelle | CRITIQUE |
| 1.2  | Billetterie   | Double validation d'entree possible              | CRITIQUE |
| 1.3  | Billetterie   | Billets rembourses validables                    | CRITIQUE |
| 1.4  | Benevoles     | ~~Pas de nettoyage au rejet~~                    | CORRIGE  |
| 1.5  | Benevoles     | Assignation equipes aux PENDING                  | CRITIQUE |
| 1.6  | Repas         | Validation multiple possible                     | CRITIQUE |
| 1.7  | Artistes      | Montants negatifs acceptes                       | CRITIQUE |
| 2.1  | Permissions   | Deux systemes concurrents                        | MAJEUR   |
| 2.2  | Permissions   | Edition = suppression                            | MAJEUR   |
| 2.3  | Permissions   | ~~canManageOrganizers = statut edition~~         | CORRIGE  |
| 2.4  | Permissions   | ~~canEditEdition au lieu de canManageArtists~~   | CORRIGE  |
| 2.5  | Editions      | Pas de machine a etats                           | MAJEUR   |
| 2.6  | Posts         | Permissions incoherentes posts/commentaires      | MAJEUR   |
| 2.7  | Messagerie    | ~~Conversation sans verif benevole~~             | CORRIGE  |
| 2.8  | Benevoles     | Pas de validation chevauchements serveur         | MAJEUR   |
| 2.9  | Billetterie   | Transition non atomique                          | MAJEUR   |
| 2.10 | Artistes      | ShowApplication sans lien Show                   | MAJEUR   |
| 3.1  | Admin         | Impersonation sans audit trail                   | MOYEN    |
| 3.2  | FCM           | Race condition tokens                            | MOYEN    |
| 3.3  | Messagerie    | Doublons conversations privees                   | MOYEN    |
| 3.4  | Covoiturage   | Race condition acceptation                       | MOYEN    |
| 3.5  | Billetterie   | Dates validite non verifiees                     | MOYEN    |
| 3.6  | Repas         | Repas organisateur sans verif statut             | MOYEN    |
| 3.7  | Notifications | Email vs in-app desynchronises                   | MOYEN    |
| 3.8  | Billetterie   | Compteurs sans expiration                        | MOYEN    |
| 3.9  | Billetterie   | ~~Stats comptent rembourses~~                    | CORRIGE  |
| 3.10 | Conventions   | Convention orpheline possible                    | MOYEN    |
| 3.11 | Benevoles     | Pas de suppression candidature spontanee         | MOYEN    |

---

## 5. Plan de correction recommande

### Phase 1 - Corrections critiques (priorite immediate)

Corrections de securite et d'integrite des donnees :

1. **Billetterie** : Ajouter validation de quotas avec transaction dans `add-participant-manually.post.ts`
2. **Billetterie** : Ajouter `entryValidated: false` dans les conditions de `validate-entry.post.ts`
3. **Billetterie** : Filtrer `status: { notIn: ['Refunded'] }` dans `verify.post.ts`
4. **Benevoles** : Nettoyer equipes/repas/entryValidated lors du passage a `REJECTED`
5. **Benevoles** : Restreindre l'assignation d'equipes aux `ACCEPTED` uniquement
6. **Repas** : Verifier `consumedAt === null` avant validation dans `validate.post.ts`
7. **Artistes** : Ajouter `.nonnegative()` et validation `actual <= max` dans le schema Zod

### Phase 2 - Corrections majeures (priorite haute)

Coherence de la logique metier et des permissions :

8. **Permissions** : Deprecier l'ancien systeme `permissions.ts`
9. **Permissions** : Retirer `canEditAllEditions` des conditions de suppression
10. **Permissions** : Retirer `canManageOrganizers` de `canManageEditionStatus`
11. **Editions** : Implementer la machine a etats des statuts
12. **Posts** : Harmoniser les permissions posts/commentaires
13. **Messagerie** : Ajouter verification du statut benevole dans `volunteer-to-organizers.post.ts`
14. **Benevoles** : Ajouter validation de chevauchements de creneaux cote serveur
15. **Billetterie** : Utiliser `$transaction` pour les mises a jour de statut

### Phase 3 - Ameliorations moyennes (priorite normale)

Robustesse et bonnes pratiques :

16. **FCM** : Remplacer check-then-act par `upsert`
17. **Messagerie** : Prevenir les doublons de conversations privees
18. **Covoiturage** : Utiliser une transaction pour l'acceptation
19. **Stats** : Exclure les commandes remboursees des statistiques
20. **Repas** : Verifier le statut benevole dans l'endpoint organisateur
21. **Notifications** : Harmoniser preferences email/in-app/push
