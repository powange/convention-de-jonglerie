# Utils - Gestion des équipes de bénévoles

## Localisation

`server/utils/editions/volunteers/teams.ts`

## Vue d'ensemble

Ce module fournit des fonctions utilitaires pour gérer les équipes de bénévoles et leurs assignations. Il encapsule la logique métier liée aux relations entre les candidatures de bénévoles et les équipes.

## Architecture

### Modèles Prisma concernés

- `VolunteerTeam` - Équipes de bénévoles
- `ApplicationTeamAssignment` - Table de jointure (candidature ↔ équipe)
- `EditionVolunteerApplication` - Candidatures de bénévoles

### Relations

```prisma
EditionVolunteerApplication --[1:N]--> ApplicationTeamAssignment --[N:1]--> VolunteerTeam
```

## Fonctions disponibles

### 📋 Récupération des équipes

#### `getVolunteerTeams(editionId)`

Récupère toutes les équipes d'une édition, triées par nom.

```typescript
const teams = await getVolunteerTeams(editionId)
// Retourne: { id, name, description, color, maxVolunteers }[]
```

#### `getVolunteerTeamById(teamId)`

Récupère une équipe spécifique par son ID.

```typescript
const team = await getVolunteerTeamById(teamId)
// Retourne: { id, name, description, color, maxVolunteers, editionId } | null
```

### 👥 Assignations des bénévoles

#### `getVolunteerTeamAssignments(applicationId)`

Récupère toutes les équipes auxquelles un bénévole est assigné.

```typescript
const assignments = await getVolunteerTeamAssignments(applicationId)
// Retourne: { teamId, isLeader, assignedAt, team: {...} }[]
```

#### `assignVolunteerToTeams(applicationId, teamIds)`

Assigne un bénévole à des équipes. **Remplace toutes les assignations existantes**.

```typescript
const assignments = await assignVolunteerToTeams(applicationId, ['team-id-1', 'team-id-2'])
// Retourne: les nouvelles assignations créées
```

**Caractéristiques** :

- Supprime d'abord toutes les assignations existantes
- Déduplique automatiquement les IDs
- Utilise une transaction pour garantir la cohérence
- Met à jour le champ JSON `assignedTeams` pour compatibilité

#### `addVolunteerToTeam(applicationId, teamId)`

Ajoute un bénévole à une équipe sans supprimer les assignations existantes.

```typescript
const assignment = await addVolunteerToTeam(applicationId, teamId)
// Retourne: l'assignation créée (ou existante si déjà assigné)
```

#### `removeVolunteerFromTeam(applicationId, teamId)`

Retire un bénévole d'une équipe spécifique.

```typescript
await removeVolunteerFromTeam(applicationId, teamId)
```

### ⭐ Gestion des responsables

#### `setTeamLeader(applicationId, teamId, isLeader)`

Définit ou retire le statut de responsable d'un bénévole pour une équipe.

```typescript
// Définir comme responsable
await setTeamLeader(applicationId, teamId, true)

// Retirer le statut de responsable
await setTeamLeader(applicationId, teamId, false)
```

#### `isTeamLeader(applicationId, teamId)`

Vérifie si un bénévole est responsable d'une équipe.

```typescript
const leader = await isTeamLeader(applicationId, teamId)
// Retourne: boolean
```

### 📊 Statistiques et analyses

#### `getTeamVolunteers(teamId, options?)`

Récupère tous les bénévoles assignés à une équipe.

```typescript
const volunteers = await getTeamVolunteers(teamId, {
  includeLeadersFirst: true, // Trier les responsables en premier
  includeUserDetails: true, // Inclure les détails utilisateur
})
// Retourne: { isLeader, application: { id, status, user?: {...} } }[]
```

#### `countTeamVolunteers(teamId)`

Compte le nombre de bénévoles assignés à une équipe.

```typescript
const count = await countTeamVolunteers(teamId)
// Retourne: number
```

#### `getTeamStats(teamId)`

Récupère les statistiques complètes d'une équipe.

```typescript
const stats = await getTeamStats(teamId)
// Retourne:
// {
//   teamId: string
//   teamName: string
//   totalVolunteers: number
//   leadersCount: number
//   maxVolunteers: number | null
//   utilizationRate: number | null  // Pourcentage (0-100)
//   hasCapacity: boolean
// }
```

### 🔧 Fonctions utilitaires

#### `resolveTeamIdentifiers(editionId, identifiers)`

Résout des identifiants (IDs ou noms) en IDs d'équipes. Utile pour gérer l'ancien système où on pouvait passer des noms.

```typescript
const teamIds = await resolveTeamIdentifiers(editionId, [
  'team-id-1', // ID valide
  'Accueil', // Nom d'équipe
  'Check-in Gymnase', // Autre nom
])
// Retourne: ['team-id-1', 'resolved-id-2', 'resolved-id-3']
// Lance une erreur si une équipe n'est pas trouvée
```

## Exemples d'utilisation

### Assigner un bénévole à plusieurs équipes

```typescript
import {
  assignVolunteerToTeams,
  resolveTeamIdentifiers,
} from '~/server/utils/editions/volunteers/teams'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id'))
  const applicationId = parseInt(getRouterParam(event, 'applicationId'))
  const body = await readBody(event)

  // Résoudre les identifiants (IDs ou noms)
  const teamIds = await resolveTeamIdentifiers(editionId, body.teams)

  // Assigner le bénévole
  const assignments = await assignVolunteerToTeams(applicationId, teamIds)

  return {
    success: true,
    assignments,
  }
})
```

### Promouvoir un bénévole comme responsable

```typescript
import { setTeamLeader, getTeamStats } from '~/server/utils/editions/volunteers/teams'

export default defineEventHandler(async (event) => {
  const applicationId = parseInt(getRouterParam(event, 'applicationId'))
  const teamId = getRouterParam(event, 'teamId')

  // Définir comme responsable
  await setTeamLeader(applicationId, teamId, true)

  // Récupérer les stats mises à jour
  const stats = await getTeamStats(teamId)

  return {
    success: true,
    stats,
  }
})
```

### Afficher les bénévoles d'une équipe

```typescript
import { getTeamVolunteers, getTeamStats } from '~/server/utils/editions/volunteers/teams'

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'teamId')

  // Récupérer les bénévoles (responsables en premier)
  const volunteers = await getTeamVolunteers(teamId, {
    includeLeadersFirst: true,
    includeUserDetails: true,
  })

  // Récupérer les statistiques
  const stats = await getTeamStats(teamId)

  return {
    volunteers,
    stats,
  }
})
```

### Déplacer un bénévole d'une équipe à une autre

```typescript
import {
  removeVolunteerFromTeam,
  addVolunteerToTeam,
} from '~/server/utils/editions/volunteers/teams'

export default defineEventHandler(async (event) => {
  const applicationId = parseInt(getRouterParam(event, 'applicationId'))
  const { fromTeamId, toTeamId } = await readBody(event)

  // Retirer de l'équipe actuelle
  await removeVolunteerFromTeam(applicationId, fromTeamId)

  // Ajouter à la nouvelle équipe
  const assignment = await addVolunteerToTeam(applicationId, toTeamId)

  return {
    success: true,
    assignment,
  }
})
```

## Gestion des erreurs

### Équipe introuvable

`resolveTeamIdentifiers` lance une erreur si une équipe n'est pas trouvée :

```typescript
try {
  const teamIds = await resolveTeamIdentifiers(editionId, ['Unknown Team'])
} catch (error) {
  // Error: Équipe "Unknown Team" introuvable dans cette édition
}
```

### Assignation inexistante

`setTeamLeader` et `removeVolunteerFromTeam` lancent une erreur Prisma si l'assignation n'existe pas :

```typescript
try {
  await setTeamLeader(999, 'non-existent-team', true)
} catch (error) {
  // Prisma error: Record to update not found
}
```

## Transactions

Les fonctions suivantes utilisent des transactions Prisma pour garantir la cohérence :

- `assignVolunteerToTeams` - Suppression + création atomique
- `addVolunteerToTeam` - Création + mise à jour du champ JSON
- `removeVolunteerFromTeam` - Suppression + mise à jour du champ JSON

## Compatibilité

Le champ JSON `assignedTeams` est maintenu à jour pour compatibilité avec l'ancien système. Cela permet une transition progressive vers le nouveau système de relations.

## Performances

### Optimisations appliquées

- Déduplication des IDs dans `assignVolunteerToTeams`
- Utilisation de `select` pour limiter les données récupérées
- Transactions pour minimiser les allers-retours à la base de données
- Tri au niveau SQL avec `orderBy`

### Recommandations

Pour les opérations en masse, utilisez les fonctions utilitaires plutôt que d'appeler les endpoints plusieurs fois.

**❌ Mauvais** :

```typescript
for (const volunteer of volunteers) {
  await $fetch(`/api/.../teams`, { method: 'PATCH', body: { teams } })
}
```

**✅ Bon** :

```typescript
import { assignVolunteerToTeams } from '~/server/utils/editions/volunteers/teams'

for (const volunteer of volunteers) {
  await assignVolunteerToTeams(volunteer.id, teamIds)
}
```

## Migration

Si vous avez du code qui utilise directement Prisma pour gérer les équipes, migrez-le vers ces utils :

### Avant

```typescript
await prisma.applicationTeamAssignment.deleteMany({
  where: { applicationId },
})
await prisma.applicationTeamAssignment.createMany({
  data: teamIds.map((teamId) => ({ applicationId, teamId, isLeader: false })),
})
```

### Après

```typescript
await assignVolunteerToTeams(applicationId, teamIds)
```

## Tests

Les utils peuvent être testés en isolation sans serveur HTTP :

```typescript
import { assignVolunteerToTeams, getTeamStats } from '~/server/utils/editions/volunteers/teams'

test('should assign volunteer to teams', async () => {
  const assignments = await assignVolunteerToTeams(1, ['team-1', 'team-2'])
  expect(assignments).toHaveLength(2)
})
```

## Liens connexes

- [Documentation API Volunteers](./README.md)
- [Schéma Prisma](../../prisma/schema.prisma)
- [Tests des équipes](../../test/integration/volunteer-teams.test.ts)
