# Système de Billeterie

Le système de billeterie permet de gérer les inscriptions et les entrées pour les éditions de conventions. Il supporte à la fois l'intégration avec des systèmes externes (HelloAsso) et la gestion manuelle de participants.

## Architecture Générale

```
docs/ticketing/
├── README.md                    # Ce fichier - Vue d'ensemble
├── tiers.md                     # Gestion des tarifs
├── options.md                   # Gestion des options de billets
├── quotas.md                    # Gestion des quotas
├── returnable-items.md          # Gestion des items à restituer
├── orders.md                    # Gestion des commandes
├── access-control.md            # Contrôle d'accès et validation
└── external-integration.md      # Intégration systèmes externes
```

## Composants Principaux

### 1. Tarifs (TicketingTiers)

Définition des différents types de billets disponibles (adulte, enfant, pass weekend, etc.)

- **Documentation** : [tiers.md](./tiers.md)
- **API** : `server/api/editions/[id]/ticketing/tiers/`
- **Utilitaire** : `server/utils/editions/ticketing/tiers.ts`

### 2. Options

Questions et champs supplémentaires lors de l'inscription (régime alimentaire, allergies, etc.)

- **Documentation** : [options.md](./options.md)
- **API** : `server/api/editions/[id]/ticketing/options/`
- **Utilitaire** : `server/utils/editions/ticketing/options.ts`

### 3. Quotas

Limitations sur le nombre de participants par catégorie (nombre de places, nombre de repas végétariens, etc.)

- **Documentation** : [quotas.md](./quotas.md)
- **API** : `server/api/editions/[id]/ticketing/quotas/`
- **Utilitaire** : `server/utils/editions/ticketing/quota-stats.ts`

### 4. Items à Restituer

Objets prêtés aux participants qui doivent être restitués (badges, t-shirts, etc.)

- **Documentation** : [returnable-items.md](./returnable-items.md)
- **API** : `server/api/editions/[id]/ticketing/returnable-items/`
- **Utilitaire** : `server/utils/editions/ticketing/returnable-items.ts`

### 5. Commandes

Gestion des commandes et des participants

- **Documentation** : [orders.md](./orders.md)
- **API** : `server/api/editions/[id]/ticketing/helloasso/orders.*`

### 6. Contrôle d'Accès

Validation des entrées via QR codes ou recherche manuelle

- **Documentation** : [access-control.md](./access-control.md)
- **API** :
  - `server/api/editions/[id]/ticketing/verify.post.ts`
  - `server/api/editions/[id]/ticketing/validate-entry.post.ts`
  - `server/api/editions/[id]/ticketing/verify-qrcode.post.ts`

### 7. Intégration Externe

Configuration et synchronisation avec les systèmes de billeterie externes (HelloAsso, etc.)

- **Documentation** : [external-integration.md](./external-integration.md)
- **API** : `server/api/editions/[id]/ticketing/external/` et `helloasso/`
- **Utilitaire** : `server/utils/editions/ticketing/helloasso.ts`

## Modèle de Données

### Tables Principales

```
ExternalTicketing          → Configuration de billeterie externe
├── HelloAssoConfig        → Configuration spécifique HelloAsso
├── TicketingTier                   → Tarifs (synchronisés ou manuels)
├── TicketingOption                 → Options (synchronisées ou manuelles)
├── TicketingOrder         → Commandes
│   └── TicketingOrderItem → Participants/billets
├── TicketingQuota         → Quotas
└── ReturnableItem         → Items à restituer

Relations:
- TicketingTierQuota             → Lien tarifs ↔ quotas
- TierReturnableItem    → Lien tarifs ↔ items à restituer
- TicketingOptionQuota           → Lien options ↔ quotas
- TicketingOptionReturnableItem  → Lien options ↔ items à restituer
```

### Flux de Données

1. **Configuration**
   - L'organisateur configure la billeterie externe OU crée des tarifs manuels
   - Définit les quotas, options, et items à restituer

2. **Synchronisation** (si externe)
   - Les tarifs et options sont synchronisés depuis HelloAsso
   - Les commandes sont importées périodiquement

3. **Inscription Manuelle** (optionnel)
   - L'organisateur peut ajouter des participants manuellement
   - Ces participants suivent le même flux que ceux importés

4. **Validation d'Entrée**
   - Scan du QR code OU recherche manuelle
   - Validation de l'entrée avec horodatage
   - Gestion des items à restituer

## Permissions

### Lecture

- **Lecture basique** : `canAccessEditionData()`
  - Voir les statistiques
  - Lister les tarifs, options, quotas disponibles

### Modification

- **Gestion bénévoles** : `canManageEditionVolunteers()`
  - Gérer les tarifs manuels
  - Gérer les options manuelles
  - Gérer les quotas
  - Gérer les items à restituer
  - Configurer la billeterie externe
  - Valider les entrées
  - Ajouter des participants manuellement

## Routes API

### Structure

```
/api/editions/:id/ticketing/
├── external/              # Configuration billeterie externe
│   ├── index.get.ts      # Récupérer la configuration
│   ├── index.post.ts     # Créer/modifier la configuration
│   └── index.delete.ts   # Supprimer la configuration
├── helloasso/            # API HelloAsso
│   ├── test.post.ts      # Tester la connexion
│   ├── tiers.get.ts      # Récupérer tarifs HelloAsso
│   └── orders.*          # Gestion des commandes
├── tiers/                # Gestion des tarifs
│   ├── index.get.ts      # Lister les tarifs
│   ├── index.post.ts     # Créer un tarif
│   ├── available.get.ts  # Tarifs disponibles (public)
│   ├── [tierId].put.ts   # Modifier un tarif
│   └── [tierId].delete.ts # Supprimer un tarif
├── options/              # Gestion des options
│   ├── index.get.ts      # Lister les options
│   ├── index.post.ts     # Créer une option
│   ├── [optionId].put.ts # Modifier une option
│   └── [optionId].delete.ts # Supprimer une option
├── quotas/               # Gestion des quotas
│   ├── index.get.ts      # Lister les quotas
│   ├── index.post.ts     # Créer un quota
│   ├── stats.get.ts      # Statistiques des quotas
│   ├── [quotaId].put.ts  # Modifier un quota
│   └── [quotaId].delete.ts # Supprimer un quota
├── returnable-items/     # Items à restituer
│   ├── index.get.ts      # Lister les items
│   ├── index.post.ts     # Créer un item
│   ├── [itemId].put.ts   # Modifier un item
│   └── [itemId].delete.ts # Supprimer un item
├── verify.post.ts        # Vérifier un participant
├── verify-qrcode.post.ts # Vérifier un QR code
├── validate-entry.post.ts # Valider une entrée
├── invalidate-entry.post.ts # Invalider une entrée
├── search.post.ts        # Rechercher des participants
├── stats.get.ts          # Statistiques générales
├── orders.get.ts         # Liste des commandes (depuis DB)
└── add-participant-manually.post.ts # Ajouter un participant
```

## Composants Vue

### Pages

- `app/pages/editions/[id]/gestion/ticketing/external.vue` - Configuration HelloAsso
- `app/pages/editions/[id]/gestion/ticketing/access-control.vue` - Contrôle d'accès
- `app/pages/editions/[id]/gestion/ticketing/orders.vue` - Liste des commandes
- `app/pages/editions/[id]/gestion/ticketing/tiers.vue` - Gestion des tarifs

### Composants

- `app/components/ticketing/TiersList.vue` - Liste des tarifs
- `app/components/ticketing/TierModal.vue` - Modal tarif
- `app/components/ticketing/OptionsList.vue` - Liste des options
- `app/components/ticketing/OptionModal.vue` - Modal option
- `app/components/ticketing/QuotasList.vue` - Liste des quotas
- `app/components/ticketing/ReturnableItemsList.vue` - Liste des items
- `app/components/ticketing/AddParticipantModal.vue` - Ajout manuel
- `app/components/ticketing/ParticipantDetailsModal.vue` - Détails participant
- `app/components/ticketing/QrCodeScanner.vue` - Scanner QR
- `app/components/ticketing/stats/QuotaStatsCard.vue` - Stats quotas
- `app/components/ticketing/stats/EntryStatsCard.vue` - Stats entrées

## Utilitaires Client

- `app/utils/ticketing/tiers.ts` - Helpers pour les tarifs
- `app/utils/ticketing/options.ts` - Helpers pour les options
- `app/utils/ticketing/orders.ts` - Helpers pour les commandes
- `app/utils/helloasso.ts` - Helpers HelloAsso

## Sécurité

### Chiffrement

Les identifiants HelloAsso (clientSecret) sont chiffrés avec AES-256-CBC avant stockage en base de données.

**Utilitaire** : `server/utils/encryption.ts`

### Validation

Toutes les entrées API sont validées avec Zod pour garantir l'intégrité des données.

### Permissions

Système de permissions hiérarchique :

1. Super admin (accès complet)
2. Collaborateur avec `canManageEditionVolunteers` (gestion complète)
3. Collaborateur avec `canAccessEditionData` (lecture seule)

## Voir Aussi

- [Documentation HelloAsso](../helloasso-integration.md) - Détails de l'intégration HelloAsso
- [Permissions](../COLLABORATOR_PERMISSIONS.md) - Système de permissions
- [Encryption](../../server/utils/encryption.ts) - Utilitaire de chiffrement
