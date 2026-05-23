# Articles à remettre pour bénévoles - Association par équipe

## Vue d'ensemble

Amélioration du système d'articles à remettre pour permettre l'association d'articles spécifiques à certaines équipes de bénévoles, avec une logique de surcharge.

## Principe de fonctionnement

### Portées d'association

1. **Portée globale** (`teamId = NULL`)
   - Articles remis à **tous les bénévoles**
   - Par défaut si aucune équipe spécifique n'est définie

2. **Portée équipe** (`teamId` défini)
   - Articles remis uniquement aux membres de cette équipe
   - **Surcharge complète** : Si une équipe a des articles spécifiques, seuls ces articles lui sont attribués (les articles globaux sont ignorés)

### Exemple concret

**Configuration :**

- Articles globaux : Badge, T-shirt
- Équipe "Bar" : Badge, T-shirt, Tablier
- Équipe "Accueil" : Badge, Gilet fluo
- Équipe "Montage" : _(pas d'articles spécifiques)_

**Résultat lors de la validation d'accès :**

- Bénévole de l'équipe "Bar" → reçoit : Badge, T-shirt, Tablier
- Bénévole de l'équipe "Accueil" → reçoit : Badge, Gilet fluo
- Bénévole de l'équipe "Montage" → reçoit : Badge, T-shirt _(articles globaux)_
- Bénévole sans équipe → reçoit : Badge, T-shirt _(articles globaux)_

## Modifications techniques

### 1. Schéma Prisma

**Modèle `EditionVolunteerHandoutItem` modifié :**

```prisma
model EditionVolunteerHandoutItem {
  id               Int      @id @default(autoincrement())
  editionId        Int
  handoutItemId Int
  teamId           String?  // NULL = global, défini = équipe spécifique
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  edition        Edition                @relation(fields: [editionId], references: [id], onDelete: Cascade)
  handoutItem TicketingHandoutItem @relation(fields: [handoutItemId], references: [id], onDelete: Cascade)
  team           VolunteerTeam?          @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([editionId, handoutItemId, teamId])
  @@index([editionId])
  @@index([handoutItemId])
  @@index([teamId])
}
```

**Modèle `VolunteerTeam` modifié :**

```prisma
model VolunteerTeam {
  // ... champs existants
  handoutItems      EditionVolunteerHandoutItem[]
}
```

### 2. Migration de base de données

**Commande à exécuter (par l'utilisateur) :**

```bash
npx prisma migrate dev --name add_team_id_to_volunteer_handout_items
```

**Changements effectués :**

- Ajout de la colonne `teamId` (nullable) dans `EditionVolunteerHandoutItem`
- Modification de la contrainte unique : `[editionId, handoutItemId]` → `[editionId, handoutItemId, teamId]`
- Ajout d'un index sur `teamId`
- Ajout de la relation avec `VolunteerTeam`

### 3. API modifiée

#### GET `/api/editions/[id]/ticketing/volunteers/handout-items`

**Retour :**

```typescript
{
  items: [
    {
      id: number
      handoutItemId: number
      teamId: string | null  // ← NOUVEAU
      name: string
      team?: {               // ← NOUVEAU
        id: string
        name: string
        color: string
      }
      createdAt: Date
      updatedAt: Date
    }
  ]
}
```

#### POST `/api/editions/[id]/ticketing/volunteers/handout-items`

**Body :**

```typescript
{
  handoutItemId: number
  teamId?: string | null  // ← NOUVEAU : null/undefined = global, string = équipe spécifique
}
```

**Validation :**

- Vérifie que l'article à remettre existe
- Si `teamId` fourni, vérifie que l'équipe existe et appartient à l'édition
- Vérifie qu'il n'y a pas de doublon pour la même portée (édition + article + teamId)

### 4. Interface utilisateur

#### Composant `TicketingVolunteerHandoutItemsList.vue`

**Nouvelles fonctionnalités :**

1. **Affichage séparé par portée :**
   - Section "Tous les bénévoles" (articles globaux) avec icône 🌍
   - Sections par équipe avec pastille de couleur et nom de l'équipe

2. **Formulaire d'ajout amélioré :**
   - **Nouveau :** Sélecteur de portée (Global / Équipe spécifique)
   - Options :
     - `🌍 Tous les bénévoles (global)`
     - `🔹 [Nom de l'équipe]` (pour chaque équipe)
   - Sélecteur d'article (filtré selon la portée sélectionnée)
   - Bouton "Ajouter"

3. **Filtrage intelligent :**
   - Les articles disponibles changent selon la portée sélectionnée
   - Un même article peut être associé à plusieurs portées différentes
   - Message contextuel si tous les articles sont déjà associés pour cette portée

4. **Feedback utilisateur :**
   - Message de succès indique la portée : "L'article a été ajouté pour [équipe/tous les bénévoles]"
   - Après ajout, la portée reste sélectionnée pour faciliter l'ajout multiple

## Utilisation

### Ajouter un article global

1. Aller sur `/editions/[id]/gestion/ticketing/tiers#aremettre`
2. Dans "Articles à remettre pour les bénévoles"
3. Sélectionner "🌍 Tous les bénévoles (global)"
4. Choisir un article
5. Cliquer sur "Ajouter"

### Ajouter un article pour une équipe

1. Aller sur `/editions/[id]/gestion/ticketing/tiers#aremettre`
2. Dans "Articles à remettre pour les bénévoles"
3. Sélectionner "🔹 [Nom de l'équipe]"
4. Choisir un article
5. Cliquer sur "Ajouter"

### Supprimer un article

1. Survoler l'article à supprimer
2. Cliquer sur l'icône corbeille
3. Confirmer la suppression

## Comportement lors de la validation d'accès

**Logique de résolution (à implémenter dans le code de validation d'accès) :**

```typescript
function getHandoutItemsForVolunteer(
  editionId: number,
  volunteerTeams: string[]
): TicketingHandoutItem[] {
  // 1. Récupérer tous les articles configurés pour l'édition
  const allItems = await getVolunteerHandoutItems(editionId)

  // 2. Chercher des articles spécifiques aux équipes du bénévole
  const teamSpecificItems = allItems.filter(
    (item) => item.teamId && volunteerTeams.includes(item.teamId)
  )

  // 3. Si le bénévole a des articles d'équipe, les utiliser (surcharge)
  if (teamSpecificItems.length > 0) {
    return teamSpecificItems
  }

  // 4. Sinon, utiliser les articles globaux
  return allItems.filter((item) => item.teamId === null)
}
```

## Notes importantes

- ✅ Un même article peut être associé plusieurs fois (une fois en global, une fois par équipe)
- ✅ Les articles d'équipe **remplacent** complètement les articles globaux (pas de fusion)
- ✅ Un bénévole sans équipe ou dans une équipe sans articles spécifiques reçoit les articles globaux
- ✅ La suppression d'une équipe supprime automatiquement ses articles associés (CASCADE)
- ⚠️ La logique de surcharge doit être implémentée dans le code de validation d'accès des bénévoles

## Compatibilité

- ✅ Rétrocompatible : Les articles existants (sans `teamId`) sont traités comme globaux
- ✅ Pas d'impact sur les bénévoles déjà validés
- ✅ Les équipes existantes ne sont pas affectées
