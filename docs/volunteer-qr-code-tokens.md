# Tokens QR Code pour les Bénévoles

## Vue d'ensemble

Le système de QR codes pour les bénévoles utilise maintenant un format sécurisé combinant l'ID du bénévole et un token unique :

**Format**: `volunteer-{id}-{token}`

- `id` : ID de la candidature bénévole (EditionVolunteerApplication.id)
- `token` : Token unique de 32 caractères hexadécimaux (16 bytes)

## Avantages

1. **Sécurité** : Le token empêche la génération de QR codes valides en devinant simplement les IDs
2. **Unicité** : Chaque bénévole a un QR code unique et non-prédictible
3. **Traçabilité** : L'ID permet toujours d'identifier rapidement le bénévole
4. **Rétrocompatibilité** : Les anciens QR codes au format `volunteer-{id}` continuent de fonctionner

## Génération automatique

Les tokens sont générés automatiquement lors de la création d'une candidature bénévole :

- ✅ Candidature via formulaire (`/api/editions/[id]/volunteers/applications/index.post.ts`)
- ✅ Ajout manuel d'un utilisateur existant (`/api/editions/[id]/volunteers/add-manually.post.ts`)
- ✅ Création d'un utilisateur et ajout comme bénévole (`/api/editions/[id]/volunteers/create-user-and-add.post.ts`)

## Migration des données existantes

Pour générer les tokens des bénévoles existants (créés avant cette fonctionnalité), exécuter :

```bash
npx tsx scripts/generate-volunteer-qr-tokens.ts
```

Ce script :

- Trouve tous les bénévoles sans token
- Génère un token unique pour chacun
- Vérifie l'unicité des tokens
- Affiche un rapport détaillé

## Validation du QR code

L'endpoint `/api/editions/[id]/ticketing/verify.post.ts` valide les QR codes :

1. **Avec token** : Format `volunteer-123-abc123def456...`
   - Vérifie que l'ID ET le token correspondent
   - Plus sécurisé

2. **Sans token** (ancien format) : Format `volunteer-123`
   - Vérifie seulement l'ID
   - Maintenu pour rétrocompatibilité
   - Les anciens bénévoles sans token peuvent toujours être scannés

## Affichage du QR code

Les composants suivants affichent le QR code avec le nouveau format :

- `app/components/volunteers/QrCodeModal.vue` : Modal de QR code dans l'espace bénévole
- `app/components/edition/MyTicketCard.vue` : Carte des billets dans "Mes billets"

Les deux composants :

- Affichent le format avec token si disponible
- Utilisent l'ancien format si pas de token (rétrocompatibilité)
- Permettent le téléchargement du QR code en PNG

## Structure de la base de données

```prisma
model EditionVolunteerApplication {
  // ... autres champs
  qrCodeToken String? @unique
  // ... autres champs

  @@index([qrCodeToken])
}
```

- **Type** : `String?` (nullable pour les anciens bénévoles)
- **Contrainte** : `@unique` (un token par bénévole)
- **Index** : Pour des recherches rapides lors de la validation

## Sécurité

- **Longueur** : 32 caractères (16 bytes en hexadécimal)
- **Entropie** : 128 bits (2^128 possibilités)
- **Génération** : `crypto.randomBytes()` (cryptographiquement sécurisé)
- **Unicité** : Vérifiée lors de la génération (max 10 tentatives)

## Tests

Vérifier que :

1. ✅ Les nouveaux bénévoles reçoivent automatiquement un token
2. ✅ Le QR code contient l'ID et le token
3. ✅ La validation vérifie le token quand présent
4. ✅ Les anciens QR codes sans token fonctionnent toujours
5. ✅ Le script de migration génère des tokens uniques
