# Contrôle d'Accès et Validation d'Entrée

Le système de contrôle d'accès permet de vérifier et valider l'entrée des participants à l'événement via QR codes ou recherche manuelle.

## Fonctionnalités

### 1. Vérification d'un Participant

Rechercher un participant par nom, email ou numéro de commande sans valider son entrée.

### 2. Validation d'Entrée

Marquer qu'un participant est entré dans l'événement (horodatage + utilisateur validateur).

### 3. Invalidation d'Entrée

Annuler une validation d'entrée (en cas d'erreur).

### 4. Scan de QR Code

Vérifier un participant via son QR code unique.

### 5. Validations Récentes

Afficher les dernières validations en temps réel.

## Modèle de Données

### Champs de Validation dans `TicketingOrderItem`

```prisma
model TicketingOrderItem {
  // ... autres champs

  // Validation d'entrée
  entryValidated   Boolean   @default(false)
  entryValidatedAt DateTime?
  entryValidatedBy Int?      // ID de l'utilisateur validateur

  @@index([entryValidated])
}
```

## API Routes

### Vérifier un Participant (Recherche)

**Route** : `POST /api/editions/:id/ticketing/verify`

**Permission** : `canAccessEditionData`

**Body** :

```typescript
{
  searchTerm: string // Nom, prénom, email, ou numéro de commande
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  searchTerm: z.string().min(1),
})
```

**Réponse** :

```typescript
{
  participants: Array<{
    id: number
    firstName: string
    lastName: string
    email: string
    qrCode: string
    tierName: string
    amount: number
    entryValidated: boolean
    entryValidatedAt: DateTime | null
    order: {
      id: number
      payerFirstName: string
      payerLastName: string
      payerEmail: string
    }
  }>
}
```

**Recherche** : Insensible à la casse, cherche dans :

- `firstName`
- `lastName`
- `email`
- `order.payerFirstName`
- `order.payerLastName`
- `order.payerEmail`

---

### Vérifier via QR Code

**Route** : `POST /api/editions/:id/ticketing/verify-qrcode`

**Permission** : `canAccessEditionData`

**Body** :

```typescript
{
  qrCode: string // Code QR scanné
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  qrCode: z.string().min(1),
})
```

**Réponse** :

```typescript
{
  participant: {
    id: number
    firstName: string
    lastName: string
    email: string
    qrCode: string
    tierName: string
    amount: number
    entryValidated: boolean
    entryValidatedAt: DateTime | null
    customFields: Json
    order: TicketingOrder
    tier: TicketingTier &
      {
        handoutItems: Array<{ handoutItem: TicketingHandoutItem }>,
      }
  }
}
```

**Erreurs** :

- `404` : QR code non trouvé
- `400` : Participant déjà validé (avec date de validation)

---

### Valider une Entrée

**Route** : `POST /api/editions/:id/ticketing/validate-entry`

**Permission** : `canAccessEditionData`

**Body** :

```typescript
{
  participantId: number // ID du TicketingOrderItem
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  participantId: z.number().int().positive(),
})
```

**Processus** :

1. Vérifie que le participant existe et appartient à l'édition
2. Vérifie qu'il n'est pas déjà validé
3. Met à jour :
   - `entryValidated = true`
   - `entryValidatedAt = now()`
   - `entryValidatedBy = userId`

**Réponse** :

```typescript
{
  success: true
  participant: TicketingOrderItem
}
```

**Erreurs** :

- `404` : Participant non trouvé
- `400` : Participant déjà validé

---

### Invalider une Entrée

**Route** : `POST /api/editions/:id/ticketing/invalidate-entry`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  participantId: number
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  participantId: z.number().int().positive(),
})
```

**Processus** :

1. Vérifie que le participant existe
2. Vérifie qu'il est validé
3. Réinitialise :
   - `entryValidated = false`
   - `entryValidatedAt = null`
   - `entryValidatedBy = null`

**Réponse** :

```typescript
{
  success: true
  participant: TicketingOrderItem
}
```

---

### Validations Récentes

**Route** : `GET /api/editions/:id/ticketing/recent-validations`

**Permission** : `canAccessEditionData`

**Query Params** :

```typescript
{
  limit?: number  // Défaut: 10, max: 50
}
```

**Réponse** :

```typescript
{
  validations: Array<{
    id: number
    firstName: string
    lastName: string
    email: string
    tierName: string
    entryValidatedAt: DateTime
    entryValidatedBy: number
    validator: {
      firstName: string
      lastName: string
    }
  }>
}
```

**Tri** : Par `entryValidatedAt` descendant (plus récentes en premier)

---

### Recherche Avancée

**Route** : `POST /api/editions/:id/ticketing/search`

**Permission** : `canAccessEditionData`

**Body** :

```typescript
{
  searchTerm: string // Minimum 2 caractères
}
```

**Réponse** :

```typescript
{
  success: true,
  results: {
    tickets: Array<{
      type: 'ticket',
      isRefunded: boolean,
      participant: {
        found: true,
        ticket: TicketingOrderItem & {
          user: { firstName, lastName, email },
          order: { ... }
        }
      }
    }>,
    volunteers: Array<{
      type: 'volunteer',
      participant: {
        found: true,
        volunteer: {
          id: number,
          user: { firstName, lastName, email },
          teams: Array<{ id, name, isLeader }>,
          timeSlots: Array<{ id, title, team, startDateTime, endDateTime }>,
          handoutItems: Array<{ id, name }>,
          entryValidated: boolean,
          entryValidatedAt: DateTime | null,
          entryValidatedBy: { firstName, lastName } | null
        }
      }
    }>,
    total: number
  }
}
```

**Filtrage des bénévoles** :

La recherche ne retourne **que les bénévoles disponibles pendant l'événement**.
Les bénévoles qui ont explicitement indiqué être disponibles uniquement pour le montage et/ou démontage (`eventAvailability = false`) ne sont **pas inclus** dans les résultats.

**Critères d'inclusion pour les bénévoles** :

- Statut : `ACCEPTED`
- Disponibilité événement : `eventAvailability = true` OU `eventAvailability = null` (anciens bénévoles avant l'ajout du champ)
- Correspondance : prénom, nom ou email contient le terme de recherche (insensible à la casse)

**Limite** : 20 résultats maximum par type (billets et bénévoles)

---

### Statistiques d'Entrée

**Route** : `GET /api/editions/:id/ticketing/stats`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
{
  totalParticipants: number
  validatedEntries: number
  pendingEntries: number
  percentageValidated: number
  byTier: Array<{
    tierId: number
    tierName: string
    total: number
    validated: number
  }>
}
```

---

## Composants Vue

### `QrCodeScanner.vue`

**Localisation** : `app/components/ticketing/QrCodeScanner.vue`

**Fonctionnalités** :

- Scan de QR code via caméra (WebRTC)
- Support mobile et desktop
- Détection automatique et validation
- Affichage du résultat (succès/erreur)
- Son de confirmation (optionnel)

**Props** :

```typescript
{
  editionId: number
}
```

**Events** :

```typescript
{
  'participant-found': (participant: TicketingOrderItem) => void
  'validation-success': (participant: TicketingOrderItem) => void
  'error': (error: Error) => void
}
```

**Usage** :

```vue
<QrCodeScanner
  :edition-id="editionId"
  @participant-found="handleParticipantFound"
  @validation-success="handleValidationSuccess"
  @error="handleError"
/>
```

### `ParticipantDetailsModal.vue`

**Localisation** : `app/components/ticketing/ParticipantDetailsModal.vue`

**Fonctionnalités** :

- Affiche les détails complets du participant
- QR code en grand (pour affichage)
- Informations de la commande
- Réponses aux options personnalisées
- Items à remettre
- Bouton de validation/invalidation d'entrée
- Statut de validation (date, validateur)

**Props** :

```typescript
{
  participant: TicketingOrderItem
  editionId: number
}
```

**Sections** :

1. **Informations Participant**
   - Nom, prénom, email
   - Tarif et montant
   - QR code

2. **Informations Commande**
   - Payeur (si différent)
   - Date de commande
   - Statut

3. **Options Personnalisées**
   - Liste des réponses (`customFields`)

4. **Items à Remettre**
   - Checklist des items du tarif
   - Items des options
   - Items bénévole (si applicable)

5. **Validation**
   - Bouton "Valider l'entrée" (si non validé)
   - Bouton "Invalider l'entrée" (si validé + permission)
   - Date et validateur (si validé)

---

### `EntryStatsCard.vue`

**Localisation** : `app/components/ticketing/stats/EntryStatsCard.vue`

**Fonctionnalités** :

- Affiche les statistiques d'entrée en temps réel
- Graphique en anneau (donut chart)
- Pourcentage de validation
- Statistiques par tarif

**Props** :

```typescript
{
  editionId: number
}
```

**Exemple** :

```vue
<EntryStatsCard :edition-id="editionId" />
```

---

## Pages de Gestion

### `access-control.vue`

**Localisation** : `app/pages/editions/[id]/gestion/ticketing/access-control.vue`

**Fonctionnalités** :

1. **Onglet Scan QR Code**
   - Scanner QR code
   - Validation automatique après scan
   - Historique des scans récents

2. **Onglet Recherche Manuelle**
   - Barre de recherche
   - Liste des résultats
   - Boutons de validation

3. **Onglet Statistiques**
   - Carte statistiques globales
   - Graphiques par tarif
   - Validations récentes

**Layout** :

```vue
<template>
  <div>
    <h1>Contrôle d'Accès</h1>

    <UTabs :items="tabs">
      <!-- Onglet 1: Scanner -->
      <template #scanner>
        <QrCodeScanner :edition-id="editionId" @validation-success="onValidationSuccess" />
        <RecentValidations :edition-id="editionId" />
      </template>

      <!-- Onglet 2: Recherche -->
      <template #search>
        <UInput
          v-model="searchTerm"
          placeholder="Nom, email, numéro de commande..."
          @input="debounceSearch"
        />
        <ParticipantsList :participants="searchResults" @validate="validateEntry" />
      </template>

      <!-- Onglet 3: Statistiques -->
      <template #stats>
        <EntryStatsCard :edition-id="editionId" />
        <QuotaStatsCard :edition-id="editionId" />
      </template>
    </UTabs>
  </div>
</template>
```

---

## Cas d'Usage

### 1. Scanner un QR Code et Valider

```typescript
// Dans QrCodeScanner.vue
const onScan = async (qrCode: string) => {
  try {
    // Vérifier le QR code
    const { participant } = await $fetch(`/api/editions/${editionId}/ticketing/verify-qrcode`, {
      method: 'POST',
      body: { qrCode },
    })

    // Afficher les détails
    emit('participant-found', participant)

    // Valider automatiquement si non validé
    if (!participant.entryValidated) {
      await $fetch(`/api/editions/${editionId}/ticketing/validate-entry`, {
        method: 'POST',
        body: { participantId: participant.id },
      })
      emit('validation-success', participant)
    }
  } catch (error) {
    emit('error', error)
  }
}
```

### 2. Rechercher et Valider Manuellement

```typescript
// Recherche
const searchParticipants = async () => {
  const { participants } = await $fetch(`/api/editions/${editionId}/ticketing/verify`, {
    method: 'POST',
    body: { searchTerm: searchTerm.value },
  })
  searchResults.value = participants
}

// Validation
const validateEntry = async (participantId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/ticketing/validate-entry`, {
      method: 'POST',
      body: { participantId },
    })
    toast.add({ title: 'Entrée validée avec succès' })
    searchParticipants() // Rafraîchir les résultats
  } catch (error) {
    toast.add({ title: 'Erreur lors de la validation', color: 'red' })
  }
}
```

### 3. Invalider une Entrée (Erreur)

```typescript
const invalidateEntry = async (participantId: number) => {
  try {
    await $fetch(`/api/editions/${editionId}/ticketing/invalidate-entry`, {
      method: 'POST',
      body: { participantId },
    })
    toast.add({ title: 'Validation annulée' })
  } catch (error) {
    toast.add({ title: "Erreur lors de l'annulation", color: 'red' })
  }
}
```

### 4. Afficher les Validations Récentes

```typescript
const fetchRecentValidations = async () => {
  const { validations } = await $fetch(
    `/api/editions/${editionId}/ticketing/recent-validations?limit=20`
  )
  recentValidations.value = validations
}

// Rafraîchir toutes les 10 secondes
setInterval(fetchRecentValidations, 10000)
```

### 5. Recherche Avancée (Participants Non Validés)

```typescript
const { participants } = await $fetch(`/api/editions/${editionId}/ticketing/search`, {
  method: 'POST',
  body: {
    validated: false,
    tierId: adulteId,
  },
})

console.log(`${participants.length} adultes non validés`)
```

---

## Flux de Validation

### Scénario 1 : Scan QR Code

```
1. Participant présente son QR code
2. Bénévole scanne avec QrCodeScanner
3. Système vérifie le QR code (verify-qrcode)
4. Si trouvé et non validé :
   a. Affiche les détails (modal)
   b. Valide automatiquement (validate-entry)
   c. Affiche confirmation visuelle + sonore
   d. Indique les items à remettre
5. Si déjà validé :
   a. Affiche erreur avec date/heure de validation
   b. TicketingOption d'invalider (si permission)
```

### Scénario 2 : Recherche Manuelle

```
1. Bénévole entre le nom/email
2. Système cherche (verify)
3. Affiche les résultats
4. Bénévole sélectionne le participant
5. Affiche les détails (modal)
6. Bénévole clique "Valider l'entrée"
7. Système valide (validate-entry)
8. Confirmation visuelle
```

### Scénario 3 : Erreur de Validation

```
1. Participant validé par erreur
2. Bénévole avec permission ouvre la modal
3. Clique "Invalider l'entrée"
4. Confirmation demandée
5. Système invalide (invalidate-entry)
6. État réinitialisé
```

---

## Bonnes Pratiques

### 1. Double Validation

Affichez toujours une confirmation avant de valider :

```vue
<UButton @click="confirmValidation">
  Valider l'entrée
</UButton>
```

### 2. Feedback Visuel et Sonore

Utilisez des signaux multiples pour confirmer la validation :

- ✅ Badge vert "Validé"
- 🔊 Son de confirmation
- 📳 Vibration (mobile)

### 3. Gestion des Doublons

Si un participant est scanné 2 fois :

- Affichez clairement qu'il est déjà validé
- Montrez la date/heure de la première validation
- Proposez d'invalider si erreur

### 4. Mode Hors Ligne

Pour une utilisation sans connexion :

- Synchronisez les participants avant l'événement
- Stockez les validations en local
- Synchronisez quand la connexion revient

### 5. Permissions Strictes

Seuls les organisateurs peuvent invalider :

```typescript
canManageEditionVolunteers() // Pour invalidation
canAccessEditionData() // Pour validation
```

---

## Dépannage

### Le scanner ne détecte pas les QR codes

**Causes possibles** :

- Permissions caméra refusées
- QR code abîmé/illisible
- Mauvais éclairage

**Solutions** :

- Vérifier les permissions dans le navigateur
- Utiliser la recherche manuelle en fallback
- Améliorer l'éclairage

### Erreur "Participant déjà validé"

**Cause** : Le participant a déjà été validé
**Solution** :

- Afficher la date/heure de validation
- Proposer d'invalider si erreur (avec permission)

### Erreur "QR code non trouvé"

**Causes possibles** :

- QR code d'un autre événement
- Participant non synchronisé depuis HelloAsso
- QR code généré manuellement incorrect

**Solutions** :

- Vérifier que c'est le bon QR code
- Re-synchroniser les commandes
- Utiliser la recherche manuelle

### Les statistiques ne se mettent pas à jour

**Cause** : Pas de rafraîchissement automatique
**Solution** : Implémenter un polling ou SSE pour les mises à jour en temps réel.

---

## Voir Aussi

- [Commandes](./orders.md) - Structure des participants
- [Items à Remettre](./handout-items.md) - Gestion des items lors de l'entrée
- [Options](./options.md) - Affichage des réponses personnalisées
